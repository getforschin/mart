import winston from 'winston';

const logLevel = process.env.LOG_LEVEL ?? 'info';

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: 'central-backend' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          const metaString = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
          return `[${timestamp}] [${service}] ${level}: ${message}${metaString}`;
        }),
      ),
    }),
  ],
});

export function logError(context: string, error: unknown, meta?: Record<string, unknown>): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  logger.error(`${context}: ${errorMessage}`, { stack, ...meta });
}

export function logInfo(context: string, message: string, meta?: Record<string, unknown>): void {
  logger.info(`${context}: ${message}`, meta);
}

export function logWarn(context: string, message: string, meta?: Record<string, unknown>): void {
  logger.warn(`${context}: ${message}`, meta);
}

export function logDebug(context: string, message: string, meta?: Record<string, unknown>): void {
  logger.debug(`${context}: ${message}`, meta);
}
