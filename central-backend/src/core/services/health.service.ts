import { getDataSource } from '../database/data-source';
import { logInfo } from '../logging/logger';
import { HealthCheckDto } from '../../dtos';
import { checkRedisHealth } from '../redis/redis-client';

const START_TIME = Date.now();
const APP_VERSION = '1.0.0';

export class HealthService {
  async getHealthStatus(): Promise<HealthCheckDto> {
    const dataSource = getDataSource();
    let databaseHealthy = false;

    try {
      await dataSource.query('SELECT 1');
      databaseHealthy = true;
    } catch {
      databaseHealthy = false;
    }

    const redisHealthy = await checkRedisHealth();
    const uptimeSeconds = Math.floor((Date.now() - START_TIME) / 1000);

    let status: HealthCheckDto['status'] = 'healthy';
    if (!databaseHealthy) {
      status = 'unhealthy';
    } else if (!redisHealthy) {
      status = 'degraded';
    }

    logInfo('HealthService.getHealthStatus', 'Health check completed', {
      status,
      databaseHealthy,
      redisHealthy,
      uptimeSeconds,
    });

    return {
      status,
      database: databaseHealthy,
      redis: redisHealthy,
      uptimeSeconds,
      version: APP_VERSION,
    };
  }
}

export const healthService = new HealthService();

