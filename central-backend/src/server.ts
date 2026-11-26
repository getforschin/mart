import 'reflect-metadata';
import dotenv from 'dotenv';
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import fs from 'fs';
import { initializeDatabase } from './core/database/data-source';
import { connectRedis, disconnectRedis } from './core/redis/redis-client';
import { globalErrorHandler, notFoundHandler } from './core/interceptors/error-handler.middleware';
import { tenantContextMiddleware } from './core/interceptors/tenant-context.middleware';
import { logInfo, logError } from './core/logging/logger';

dotenv.config();

const PORT = parseInt(process.env.PORT ?? '3000', 10);

async function bootstrap(): Promise<void> {
  logInfo('Server', 'Initializing Mart Omnichannel Retail API');

  await initializeDatabase();
  logInfo('Server', 'Database connection established');

  const redisConnected = await connectRedis();
  logInfo('Server', `Redis connection ${redisConnected ? 'established' : 'unavailable (degraded mode)'}`);

  const app: Application = express();

  app.get('/', (_req: Request, res: Response) => {
    res.redirect('/api/docs');
  });

  app.use(helmet());
  const corsOrigins = (process.env.CORS_ORIGINS ?? '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin: corsOrigins.includes('*') ? true : corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      logInfo('HTTP', `${req.method} ${req.path}`, {
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
      });
    });
    next();
  });

  const swaggerPath = path.join(__dirname, 'swagger', 'swagger.json');
  if (fs.existsSync(swaggerPath)) {
    const swaggerDocument = JSON.parse(fs.readFileSync(swaggerPath, 'utf-8')) as Record<string, unknown>;
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    logInfo('Server', 'Swagger UI available at /api/docs');
  }

  app.use('/api/v1/sync', tenantContextMiddleware);
  app.use('/api/v1/barcode', tenantContextMiddleware);
  app.use('/api/v1/analytics', tenantContextMiddleware);
  app.use('/api/v1/dashboard', tenantContextMiddleware);
  app.use('/api/v1/catalog', tenantContextMiddleware);
  app.use('/api/v1/parties', tenantContextMiddleware);
  app.use('/api/v1/purchases', tenantContextMiddleware);
  app.use('/api/v1/stock', tenantContextMiddleware);
  app.use('/api/v1/schemes', tenantContextMiddleware);
  app.use('/api/v1/sales', tenantContextMiddleware);
  app.use('/api/v1/accounts', tenantContextMiddleware);
  app.use('/api/v1/sms', tenantContextMiddleware);
  app.use('/api/v1/ecommerce', tenantContextMiddleware);
  app.use('/api/v1/reports', tenantContextMiddleware);

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RegisterRoutes } = require('./routes/routes') as {
      RegisterRoutes: (app: Application) => void;
    };
    RegisterRoutes(app);
    logInfo('Server', 'TSOA routes registered');
  } catch (error) {
    logError('Server', error);
    logInfo('Server', 'TSOA routes not yet generated — run npm run build to generate routes');
  }

  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  const server = app.listen(PORT, () => {
    logInfo('Server', `Mart Omnichannel Retail API listening on port ${PORT}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logInfo('Server', `Received ${signal}, shutting down gracefully`);
    server.close(async () => {
      await disconnectRedis();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((error: unknown) => {
  logError('Server.bootstrap', error);
  process.exit(1);
});
