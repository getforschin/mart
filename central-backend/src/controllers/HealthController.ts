import { Controller, Get, Route, Tags, SuccessResponse } from 'tsoa';
import { healthService } from '../core/services/health.service';
import { HealthCheckDto } from '../dtos';

@Route('api/v1/health')
@Tags('Health')
export class HealthController extends Controller {
  @Get()
  @SuccessResponse(200, 'Service health status')
  public async getHealth(): Promise<HealthCheckDto> {
    const health = await healthService.getHealthStatus();
    const statusCode = health.status === 'unhealthy' ? 503 : 200;
    this.setStatus(statusCode);
    return health;
  }
}
