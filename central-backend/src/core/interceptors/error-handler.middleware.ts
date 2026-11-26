import { Request, Response, NextFunction } from 'express';
import { logError } from '../logging/logger';

export interface AppError extends Error {
  statusCode: number;
  errorCode: string;
  details?: Record<string, unknown>;
}

export function createAppError(
  message: string,
  statusCode: number,
  errorCode: string,
  details?: Record<string, unknown>,
): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  error.details = details;
  return error;
}

export function globalErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (isAppError(error)) {
    logError('GlobalErrorHandler', error, { errorCode: error.errorCode, details: error.details });
    res.status(error.statusCode).json({
      success: false,
      errorCode: error.errorCode,
      message: error.message,
      details: error.details,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (error instanceof Error && error.name === 'ValidateError') {
    const validateError = error as Error & { fields?: Record<string, unknown> };
    logError('GlobalErrorHandler', error, { fields: validateError.fields });
    res.status(422).json({
      success: false,
      errorCode: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: validateError.fields ?? {},
      timestamp: new Date().toISOString(),
    });
    return;
  }

  logError('GlobalErrorHandler', error);
  res.status(500).json({
    success: false,
    errorCode: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
  });
}

function isAppError(error: unknown): error is AppError {
  return (
    error instanceof Error &&
    'statusCode' in error &&
    'errorCode' in error &&
    typeof (error as AppError).statusCode === 'number'
  );
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    errorCode: 'ROUTE_NOT_FOUND',
    message: 'The requested resource was not found',
    timestamp: new Date().toISOString(),
  });
}
