/**
 * Operational error with an HTTP status code. Errors that are not
 * AppError instances are treated as unexpected and returned as 500s
 * without leaking internal details.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational = true;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}
