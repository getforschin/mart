import { Request, Response, NextFunction } from 'express';
import { getDataSource } from '../database/data-source';
import { Tenant, TenantStatus } from '../../models';
import { logError, logWarn } from '../logging/logger';

export interface TenantScopedRequest extends Request {
  tenantId?: string;
  tenant?: Tenant;
}

export async function tenantContextMiddleware(
  req: TenantScopedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const headerTenantId = req.headers['x-tenant-id'];
    const bodyTenantId =
      typeof req.body === 'object' && req.body !== null && 'tenantId' in req.body
        ? String((req.body as Record<string, unknown>).tenantId)
        : undefined;

    const tenantId =
      typeof headerTenantId === 'string' && headerTenantId.trim().length > 0
        ? headerTenantId.trim()
        : bodyTenantId;

    if (!tenantId) {
      res.status(400).json({
        success: false,
        errorCode: 'TENANT_CONTEXT_MISSING',
        message: 'Tenant context is required via X-Tenant-Id header or request body tenantId',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const tenantRepository = getDataSource().getRepository(Tenant);
    const tenant = await tenantRepository.findOne({ where: { id: tenantId } });

    if (!tenant) {
      logWarn('TenantContextMiddleware', 'Tenant not found', { tenantId });
      res.status(404).json({
        success: false,
        errorCode: 'TENANT_NOT_FOUND',
        message: `Tenant with id ${tenantId} was not found`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (tenant.status !== TenantStatus.ACTIVE) {
      logWarn('TenantContextMiddleware', 'Tenant not active', { tenantId, status: tenant.status });
      res.status(403).json({
        success: false,
        errorCode: 'TENANT_INACTIVE',
        message: `Tenant ${tenant.name} is not active (status: ${tenant.status})`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    req.tenantId = tenantId;
    req.tenant = tenant;
    next();
  } catch (error) {
    logError('TenantContextMiddleware', error);
    res.status(500).json({
      success: false,
      errorCode: 'TENANT_CONTEXT_ERROR',
      message: 'Failed to resolve tenant context',
      timestamp: new Date().toISOString(),
    });
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (req: TenantScopedRequest & { userRole?: string }, res: Response, next: NextFunction): void => {
    const userRole = req.userRole;
    if (!userRole) {
      res.status(401).json({
        success: false,
        errorCode: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required for this resource',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({
        success: false,
        errorCode: 'INSUFFICIENT_PERMISSIONS',
        message: `Role ${userRole} is not authorized for this operation`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}
