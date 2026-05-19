import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors.js";
import { ZodError } from "zod";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: true,
      message: err.message,
      ...(err.field && { field: err.field }),
    });
    return;
  }

  if (err instanceof ZodError) {
    const firstIssue = err.errors[0];
    res.status(400).json({
      error: true,
      message: firstIssue.message,
      field: firstIssue.path.join("."),
    });
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({
    error: true,
    message: "Internal server error",
  });
}
