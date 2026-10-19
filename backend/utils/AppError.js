"use strict";

/**
 * Every failure the API returns on purpose is an AppError, which carries the
 * status, the machine-readable code and optional per-field messages.
 * errorHandler turns anything else into a generic 500.
 */
class AppError extends Error {
  constructor(statusCode, code, message, fields) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    if (fields) this.fields = fields;
    this.isOperational = true;
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(code, message, fields) {
    return new AppError(400, code, message, fields);
  }

  static unauthenticated(message = "Log in to continue.") {
    return new AppError(401, "UNAUTHENTICATED", message);
  }

  static forbidden(message = "You do not have access to that.") {
    return new AppError(403, "FORBIDDEN", message);
  }

  static notFound(message = "That resource does not exist.") {
    return new AppError(404, "NOT_FOUND", message);
  }

  static validation(message = "Check the highlighted fields.", fields) {
    return new AppError(422, "VALIDATION_FAILED", message, fields);
  }
}

module.exports = AppError;
