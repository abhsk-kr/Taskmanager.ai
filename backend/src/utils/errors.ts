export class AppError extends Error {
  public statusCode: number;
  public field?: string;

  constructor(statusCode: number, message: string, field?: string) {
    super(message);
    this.statusCode = statusCode;
    this.field = field;
  }
}

export function badRequest(message: string, field?: string): AppError {
  return new AppError(400, message, field);
}

export function unauthorized(message = "Unauthorized"): AppError {
  return new AppError(401, message);
}

export function forbidden(message = "Forbidden"): AppError {
  return new AppError(403, message);
}

export function notFound(message = "Resource not found"): AppError {
  return new AppError(404, message);
}
