import Redis from 'ioredis';
import { logError, logInfo } from '../logging/logger';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (redisClient === null) {
    redisClient = process.env.REDIS_URL
      ? new Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: 3,
          lazyConnect: true,
          retryStrategy: (times: number) => Math.min(times * 200, 3000),
        })
      : new Redis({
          host: process.env.REDIS_HOST ?? 'localhost',
          port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
          password: process.env.REDIS_PASSWORD || undefined,
          maxRetriesPerRequest: 3,
          lazyConnect: true,
          retryStrategy: (times: number) => Math.min(times * 200, 3000),
        });

    redisClient.on('connect', () => {
      logInfo('RedisClient', 'Connected to Redis');
    });

    redisClient.on('error', (error: Error) => {
      logError('RedisClient', error);
    });
  }
  return redisClient;
}

export async function connectRedis(): Promise<boolean> {
  try {
    const client = getRedisClient();
    if (client.status === 'wait') {
      await client.connect();
    }
    const pong = await client.ping();
    return pong === 'PONG';
  } catch (error) {
    logError('RedisClient.connectRedis', error);
    return false;
  }
}

export async function publishNotification(channel: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const client = getRedisClient();
    await client.publish(channel, JSON.stringify(payload));
  } catch (error) {
    logError('RedisClient.publishNotification', error, { channel });
  }
}

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const client = getRedisClient();
    if (client.status !== 'ready') {
      await connectRedis();
    }
    const result = await client.ping();
    return result === 'PONG';
  } catch (error) {
    logError('RedisClient.checkRedisHealth', error);
    return false;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient !== null) {
    await redisClient.quit();
    redisClient = null;
    logInfo('RedisClient', 'Disconnected from Redis');
  }
}
