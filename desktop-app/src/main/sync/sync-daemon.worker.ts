import { parentPort, workerData } from 'worker_threads';
import https from 'https';
import http from 'http';

interface SyncWorkerConfig {
  apiBaseUrl: string;
  tenantId: string;
  facilityId: string;
  deviceId: string;
  pushIntervalMs: number;
  pullIntervalMs: number;
}

interface UnsyncedPayload {
  invoices: Array<Record<string, unknown>>;
  attendanceRecords: Array<Record<string, unknown>>;
  customers: Array<Record<string, unknown>>;
  purchases: Array<Record<string, unknown>>;
  supplierPayments: Array<Record<string, unknown>>;
  expenses: Array<Record<string, unknown>>;
  stockEvents: Array<Record<string, unknown>>;
}

const config = workerData as SyncWorkerConfig;
let pushTimer: ReturnType<typeof setInterval> | null = null;
let pullTimer: ReturnType<typeof setInterval> | null = null;
let lastOnlineState = false;
let isRunning = false;
let cycleBusy = false;

function requestJson(
  method: 'GET' | 'POST',
  urlString: string,
  tenantId: string,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(urlString);
      const bodyString = body ? JSON.stringify(body) : '';
      const transport = parsedUrl.protocol === 'https:' ? https : http;
      const request = transport.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
          path: parsedUrl.pathname + parsedUrl.search,
          method,
          timeout: 20000,
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Id': tenantId,
            ...(body ? { 'Content-Length': Buffer.byteLength(bodyString) } : {}),
          },
        },
        (response) => {
          let data = '';
          response.on('data', (chunk: Buffer) => {
            data += chunk.toString();
          });
          response.on('end', () => {
            resolve({
              ok:
                response.statusCode !== undefined &&
                response.statusCode >= 200 &&
                response.statusCode < 300,
              statusCode: response.statusCode ?? 0,
              body: data,
            });
          });
        },
      );
      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Request timed out'));
      });
      if (body) request.write(bodyString);
      request.end();
    } catch (error) {
      reject(error);
    }
  });
}

async function checkConnectivity(): Promise<boolean> {
  try {
    const response = await requestJson('GET', `${config.apiBaseUrl}/api/v1/health`, config.tenantId);
    return response.ok || (response.statusCode > 0 && response.statusCode < 500);
  } catch {
    return false;
  }
}

function buildPushPayload(unsyncedData: UnsyncedPayload): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    tenantId: config.tenantId,
    facilityId: config.facilityId,
    deviceId: config.deviceId,
  };
  // Only include collections that have rows — older APIs reject unknown empty keys.
  if (unsyncedData.invoices.length > 0) payload.invoices = unsyncedData.invoices;
  if (unsyncedData.attendanceRecords.length > 0) {
    payload.attendanceRecords = unsyncedData.attendanceRecords;
  }
  if (unsyncedData.customers.length > 0) payload.customers = unsyncedData.customers;
  if (unsyncedData.purchases.length > 0) payload.purchases = unsyncedData.purchases;
  if (unsyncedData.supplierPayments.length > 0) {
    payload.supplierPayments = unsyncedData.supplierPayments;
  }
  if (unsyncedData.expenses.length > 0) payload.expenses = unsyncedData.expenses;
  if (unsyncedData.stockEvents.length > 0) payload.stockEvents = unsyncedData.stockEvents;
  return payload;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deleteAtPath(root: Record<string, unknown>, path: string): void {
  const normalized = path.startsWith('body.') ? path.slice(5) : path;
  const parts = normalized.split('.').filter(Boolean);
  if (parts.length === 0) return;

  // TSOA sometimes reports nested invoice-item paths as `items.$0.field`
  // without the `invoices.$n` prefix — strip from every invoice item list.
  if (parts[0] === 'items' && Array.isArray(root.invoices)) {
    for (const invoice of root.invoices as Array<Record<string, unknown>>) {
      deleteAtPath(invoice, parts.join('.'));
    }
    return;
  }

  let cursor: unknown = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    const indexMatch = /^\$(\d+)$/.exec(part);
    if (indexMatch) {
      if (!Array.isArray(cursor)) return;
      cursor = cursor[Number(indexMatch[1])];
      continue;
    }
    if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) return;
    cursor = (cursor as Record<string, unknown>)[part];
  }

  const last = parts[parts.length - 1];
  const lastIndex = /^\$(\d+)$/.exec(last);
  if (lastIndex) {
    if (Array.isArray(cursor)) cursor.splice(Number(lastIndex[1]), 1);
    return;
  }
  if (cursor && typeof cursor === 'object' && !Array.isArray(cursor)) {
    delete (cursor as Record<string, unknown>)[last];
  }
}

function stripExcessProperties(
  payload: Record<string, unknown>,
  details: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const next = cloneJson(payload);
  for (const path of Object.keys(details ?? {})) {
    deleteAtPath(next, path);
  }
  return next;
}

function parseValidationDetails(body: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(body) as {
      errorCode?: string;
      details?: Record<string, unknown>;
    };
    if (parsed.errorCode === 'VALIDATION_ERROR' && parsed.details) return parsed.details;
  } catch {
    /* ignore */
  }
  return null;
}

async function executeSyncCycle(
  unsyncedData: UnsyncedPayload,
  since: string | null,
  options: { push: boolean; pull: boolean },
): Promise<Record<string, unknown>> {
  const timestamp = new Date().toISOString();
  const errors: string[] = [];
  const online = await checkConnectivity();

  if (online !== lastOnlineState) {
    lastOnlineState = online;
    parentPort?.postMessage({
      type: 'CONNECTIVITY_CHANGE',
      online,
      timestamp,
    });
  }

  if (!online) {
    return {
      type: 'SYNC_COMPLETE',
      online: false,
      acceptedIds: [],
      errors: [],
      timestamp,
      pushed: false,
      pulled: false,
    };
  }

  const acceptedIds: string[] = [];
  let pushed = false;

  if (options.push) {
    const hasPush =
      unsyncedData.invoices.length > 0 ||
      unsyncedData.attendanceRecords.length > 0 ||
      unsyncedData.customers.length > 0 ||
      unsyncedData.purchases.length > 0 ||
      unsyncedData.supplierPayments.length > 0 ||
      unsyncedData.expenses.length > 0 ||
      unsyncedData.stockEvents.length > 0;

    if (hasPush) {
      try {
        let pushPayload = buildPushPayload(unsyncedData);

        let response = await requestJson(
          'POST',
          `${config.apiBaseUrl}/api/v1/sync/push`,
          config.tenantId,
          pushPayload,
        );

        // Production may lag local schema; strip rejected fields and retry once.
        if (!response.ok && response.statusCode === 422) {
          const details = parseValidationDetails(response.body);
          if (details) {
            pushPayload = stripExcessProperties(pushPayload, details);
            response = await requestJson(
              'POST',
              `${config.apiBaseUrl}/api/v1/sync/push`,
              config.tenantId,
              pushPayload,
            );
          }
        }

        if (!response.ok) {
          errors.push(`Sync push failed (${response.statusCode}): ${response.body}`);
          return {
            type: 'SYNC_ERROR',
            online: true,
            acceptedIds: [],
            errors,
            timestamp,
            pushed: false,
            pulled: false,
          };
        }

        pushed = true;
        try {
          const parsed = JSON.parse(response.body) as {
            results?: Array<{ clientEventId: string; status: string; message?: string; eventType?: string }>;
          };
          for (const result of parsed.results ?? []) {
            if (result.status === 'ACCEPTED' || result.status === 'DUPLICATE') {
              acceptedIds.push(result.clientEventId);
            } else if (result.status === 'REJECTED') {
              const label = result.eventType ?? result.clientEventId;
              const detail = result.message ?? 'rejected by server';
              errors.push(`Sync rejected ${label}: ${detail}`);
            }
          }
        } catch {
          acceptedIds.push(
            ...unsyncedData.invoices.map((i) => String(i.id)),
            ...unsyncedData.attendanceRecords.map((i) => String(i.id)),
            ...unsyncedData.customers.map((i) => String(i.id)),
            ...unsyncedData.purchases.map((i) => String(i.id)),
            ...unsyncedData.supplierPayments.map((i) => String(i.id)),
            ...unsyncedData.expenses.map((i) => String(i.id)),
            ...unsyncedData.stockEvents.map((i) => String(i.id)),
          );
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Unknown sync push error');
        return {
          type: 'SYNC_ERROR',
          online: true,
          acceptedIds: [],
          errors,
          timestamp,
          pushed: false,
          pulled: false,
        };
      }
    }
  }

  let pull: Record<string, unknown> | undefined;
  let pulled = false;
  if (options.pull) {
    try {
      const pullResponse = await requestJson(
        'POST',
        `${config.apiBaseUrl}/api/v1/sync/pull`,
        config.tenantId,
        {
          tenantId: config.tenantId,
          facilityId: config.facilityId,
          deviceId: config.deviceId,
          since,
        },
      );
      if (pullResponse.ok) {
        pull = JSON.parse(pullResponse.body) as Record<string, unknown>;
        pulled = true;
      } else {
        errors.push(`Sync pull failed (${pullResponse.statusCode})`);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Pull failed');
    }
  }

  return {
    type: 'SYNC_COMPLETE',
    online: true,
    acceptedIds,
    pull,
    errors,
    timestamp,
    pushed,
    pulled,
  };
}

parentPort?.on(
  'message',
  (message: {
    type: 'START' | 'STOP' | 'TRIGGER_SYNC';
    unsyncedData?: UnsyncedPayload;
    since?: string | null;
    push?: boolean;
    pull?: boolean;
  }) => {
    if (message.type === 'START' && !isRunning) {
      isRunning = true;
      // Background push of local outbox — does not block POS UI
      pushTimer = setInterval(() => {
        parentPort?.postMessage({ type: 'REQUEST_PUSH' });
      }, config.pushIntervalMs);
      // Pull web/admin changes into local DB on a longer interval
      pullTimer = setInterval(() => {
        parentPort?.postMessage({ type: 'REQUEST_PULL' });
      }, config.pullIntervalMs);
      // Initial connectivity + push any pending; full pull shortly after boot
      parentPort?.postMessage({ type: 'REQUEST_PUSH' });
      setTimeout(() => parentPort?.postMessage({ type: 'REQUEST_PULL' }), 5_000);
    }

    if (message.type === 'STOP') {
      if (pushTimer !== null) clearInterval(pushTimer);
      if (pullTimer !== null) clearInterval(pullTimer);
      pushTimer = null;
      pullTimer = null;
      isRunning = false;
    }

    if (message.type === 'TRIGGER_SYNC' && message.unsyncedData) {
      if (cycleBusy) {
        parentPort?.postMessage({
          type: 'SYNC_BUSY',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      cycleBusy = true;
      void executeSyncCycle(message.unsyncedData, message.since ?? null, {
        push: message.push !== false,
        pull: Boolean(message.pull),
      })
        .then((result) => {
          parentPort?.postMessage(result);
        })
        .finally(() => {
          cycleBusy = false;
        });
    }
  },
);
