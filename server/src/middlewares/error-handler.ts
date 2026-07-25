import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/app-error';
import { logger } from '../utils/logger';
import { isProduction } from '../config/env';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    logger.warn(err.message, { statusCode: err.statusCode, path: req.originalUrl });
    res.status(err.statusCode).json({ success: false, message: err.message });
    return;
  }

  logger.error(err.message, { stack: err.stack, path: req.originalUrl });
  res.status(500).json({
    success: false,
    message: isProduction ? 'Internal server error' : err.message,
  });
}
