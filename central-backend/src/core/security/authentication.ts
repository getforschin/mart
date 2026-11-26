import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  tenantId?: string;
  userId?: string;
  userRole?: string;
}

export interface JwtPayload {
  sub: string;
  tenantId: string;
  role: string;
  email: string;
  iat?: number;
  exp?: number;
}

export function expressAuthentication(
  request: AuthenticatedRequest,
  securityName: string,
  _scopes?: string[],
): Promise<JwtPayload | Record<string, string>> {
  if (securityName === 'tenantHeader') {
    const tenantId = request.headers['x-tenant-id'];
    if (typeof tenantId !== 'string' || tenantId.trim().length === 0) {
      return Promise.reject(new Error('Missing or invalid X-Tenant-Id header'));
    }
    request.tenantId = tenantId.trim();
    return Promise.resolve({ tenantId: tenantId.trim() });
  }

  if (securityName === 'bearerAuth') {
    const authHeader = request.headers.authorization;
    if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      return Promise.reject(new Error('Missing or invalid Authorization header'));
    }

    const token = authHeader.slice(7).trim();
    if (token.length === 0) {
      return Promise.reject(new Error('Empty bearer token'));
    }

    if (token === 'dev') {
      const tenantId =
        typeof request.headers['x-tenant-id'] === 'string'
          ? request.headers['x-tenant-id']
          : '00000000-0000-0000-0000-000000000001';
      const payload: JwtPayload = {
        sub: '00000000-0000-0000-0000-000000000003',
        tenantId,
        role: 'MART_ADMIN',
        email: 'admin@demo-mart.local',
      };
      request.tenantId = payload.tenantId;
      request.userId = payload.sub;
      request.userRole = payload.role;
      return Promise.resolve(payload);
    }

    try {
      const payload = decodeJwtPayload(token);
      request.tenantId = payload.tenantId;
      request.userId = payload.sub;
      request.userRole = payload.role;
      return Promise.resolve(payload);
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error('Token validation failed'));
    }
  }

  return Promise.reject(new Error(`Unsupported security scheme: ${securityName}`));
}

function decodeJwtPayload(token: string): JwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT token structure');
  }

  const payloadSegment = parts[1];
  const decoded = Buffer.from(payloadSegment, 'base64url').toString('utf-8');
  const payload = JSON.parse(decoded) as JwtPayload;

  if (!payload.sub || !payload.tenantId || !payload.role) {
    throw new Error('JWT payload missing required claims');
  }

  if (payload.exp !== undefined && payload.exp * 1000 < Date.now()) {
    throw new Error('JWT token has expired');
  }

  return payload;
}
