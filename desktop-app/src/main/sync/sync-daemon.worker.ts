import { parentPort, workerData } from 'worker_threads';
import https from 'https';
import http from 'http';

interface SyncWorkerConfig {
  apiBaseUrl: string;
  tenantId: string;
  facilityId: string;
  deviceId: string;
  pollIntervalMs: number;
}

interface SyncWorkerMessage {
  type: 'START' | 'STOP' | 'TRIGGER_SYNC';
}

interface UnsyncedPayload {
  invoices: Array<Record<string, unknown>>;
  attendanceRecords: Array<Record<string, unknown>>;
}

interface SyncWorkerResult {
  type: 'SYNC_COMPLETE' | 'SYNC_ERROR' | 'CONNECTIVITY_CHANGE';
  online: boolean;
  invoicesSynced: number;
  attendanceSynced: number;
  errors: string[];
  timestamp: string;
}

const config = workerData as SyncWorkerConfig;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastOnlineState = false;
let isRunning = false;

function checkConnectivity(apiBaseUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(`${apiBaseUrl}/api/v1/health`);
      const transport = parsedUrl.protocol === 'https:' ? https : http;

      const request = transport.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
          path: parsedUrl.pathname,
          method: 'GET',
          timeout: 5000,
        },
        (response) => {
          resolve(response.statusCode !== undefined && response.statusCode < 500);
        },
      );

      request.on('error', () => resolve(false));
      request.on('timeout', () => {
        request.destroy();
        resolve(false);
      });

      request.end();
    } catch {
      resolve(false);
    }
  });
}

function postSyncPayload(
  apiBaseUrl: string,
  tenantId: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(`${apiBaseUrl}/api/v1/sync/push`);
      const bodyString = JSON.stringify(payload);
      const transport = parsedUrl.protocol === 'https:' ? https : http;

      const request = transport.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
          path: parsedUrl.pathname,
          method: 'POST',
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(bodyString),
            'X-Tenant-Id': tenantId,
          },
        },
        (response) => {
          let body = '';
          response.on('data', (chunk: Buffer) => {
            body += chunk.toString();
          });
          response.on('end', () => {
            resolve({
              ok: response.statusCode !== undefined && response.statusCode >= 200 && response.statusCode < 300,
              statusCode: response.statusCode ?? 0,
              body,
            });
          });
        },
      );

      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Sync push request timed out'));
      });

      request.write(bodyString);
      request.end();
    } catch (error) {
      reject(error);
    }
  });
}

async function executeSyncCycle(unsyncedData: UnsyncedPayload): Promise<SyncWorkerResult> {
  const timestamp = new Date().toISOString();
  const errors: string[] = [];

  const online = await checkConnectivity(config.apiBaseUrl);

  if (online !== lastOnlineState) {
    lastOnlineState = online;
    parentPort?.postMessage({
      type: 'CONNECTIVITY_CHANGE',
      online,
      invoicesSynced: 0,
      attendanceSynced: 0,
      errors: [],
      timestamp,
    } satisfies SyncWorkerResult);
  }

  if (!online) {
    return {
      type: 'SYNC_COMPLETE',
      online: false,
      invoicesSynced: 0,
      attendanceSynced: 0,
      errors: [],
      timestamp,
    };
  }

  if (unsyncedData.invoices.length === 0 && unsyncedData.attendanceRecords.length === 0) {
    return {
      type: 'SYNC_COMPLETE',
      online: true,
      invoicesSynced: 0,
      attendanceSynced: 0,
      errors: [],
      timestamp,
    };
  }

  try {
    const pushPayload = {
      tenantId: config.tenantId,
      facilityId: config.facilityId,
      deviceId: config.deviceId,
      invoices: unsyncedData.invoices,
      attendanceRecords: unsyncedData.attendanceRecords,
    };

    const response = await postSyncPayload(config.apiBaseUrl, config.tenantId, pushPayload);

    if (!response.ok) {
      errors.push(`Sync push failed with status ${response.statusCode}: ${response.body}`);
      return {
        type: 'SYNC_ERROR',
        online: true,
        invoicesSynced: 0,
        attendanceSynced: 0,
        errors,
        timestamp,
      };
    }

    return {
      type: 'SYNC_COMPLETE',
      online: true,
      invoicesSynced: unsyncedData.invoices.length,
      attendanceSynced: unsyncedData.attendanceRecords.length,
      errors,
      timestamp,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown sync error';
    errors.push(message);
    return {
      type: 'SYNC_ERROR',
      online: true,
      invoicesSynced: 0,
      attendanceSynced: 0,
      errors,
      timestamp,
    };
  }
}

parentPort?.on('message', (message: SyncWorkerMessage & { unsyncedData?: UnsyncedPayload }) => {
  if (message.type === 'START' && !isRunning) {
    isRunning = true;
    pollTimer = setInterval(() => {
      parentPort?.postMessage({ type: 'REQUEST_UNSYNCED_DATA' });
    }, config.pollIntervalMs);
    parentPort?.postMessage({ type: 'REQUEST_UNSYNCED_DATA' });
  }

  if (message.type === 'STOP' && pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
    isRunning = false;
  }

  if (message.type === 'TRIGGER_SYNC' && message.unsyncedData) {
    void executeSyncCycle(message.unsyncedData).then((result) => {
      parentPort?.postMessage(result);
    });
  }
});
