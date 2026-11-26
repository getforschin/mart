import { Controller } from 'tsoa';

/**
 * Base controller providing tenant-scoped context for all enterprise API controllers.
 * Concrete controllers extend this to inherit consistent TSOA registration patterns.
 */
export abstract class BaseTenantController extends Controller {
  protected resolveTenantId(explicitTenantId?: string): string {
    const headerTenantId = this.getHeader('X-Tenant-Id');
    const rawTenantId = explicitTenantId ?? headerTenantId;
    const tenantId = Array.isArray(rawTenantId) ? rawTenantId[0] : rawTenantId;

    if (!tenantId || tenantId.trim().length === 0) {
      this.setStatus(400);
      throw new Error('Tenant context is required');
    }

    return tenantId.trim();
  }
}
