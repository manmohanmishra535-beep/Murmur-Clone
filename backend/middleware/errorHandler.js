"use strict";

const multer = require("multer");
const AppError = require("../utils/AppError");
const config = require("../config/env");

/** Map a driver or library error onto the API's standard error shape. */
function normalize(err) {
  if (err instanceof AppError) return err;

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return AppError.validation("Check the highlighted fields.", {
        image: "Images must be 5 MB or smaller.",
      });
    }
    if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
      return AppError.validation("Check the highlighted fields.", {
        image: "Up to 4 images per post.",
      });
    }
    return new AppError(422, "UPLOAD_FAILED", "That upload could not be processed.");
  }

  // Mongoose document validation.
  if (err.name === "ValidationError" && err.errors) {
    const fields = {};
    for (const [key, value] of Object.entries(err.errors)) fields[key] = value.message;
    return AppError.validation("Check the highlighted fields.", fields);
  }

  // A malformed ObjectId in a URL is a 404, not a crash.
  if (err.name === "CastError") {
    return AppError.notFound();
  }

  // Unique index violation.
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || "value";
    const message = `That ${field} is already taken.`;
    return new AppError(409, "ALREADY_EXISTS", message, { [field]: message });
  }

  // express.json / urlencoded
  if (err.type === "entity.too.large") {
    return new AppError(413, "PAYLOAD_TOO_LARGE", "That request body is too large.");
  }
  if (err.type === "entity.parse.failed" || err instanceof SyntaxError) {
    return AppError.badRequest("INVALID_JSON", "That request body is not valid JSON.");
  }

  // Cloudinary rejects uploads with an http_code.
  if (err.http_code) {
    return new AppError(502, "UPLOAD_FAILED", "The image could not be uploaded.");
  }

  if (err.code === "UPLOADS_DISABLED") {
    return new AppError(503, "UPLOADS_DISABLED", "Image uploads are not configured on this server.");
  }

  return new AppError(500, "INTERNAL_ERROR", "Something went wrong on our end.");
}

// eslint-disable-next-line no-unused-vars -- Express needs the 4 argument signature.
module.exports = function errorHandler(err, _req, res, _next) {
  const error = normalize(err);

  // Log the real thing server-side only; the client gets a generic message on 500.
  if (error.statusCode >= 500) {
    console.error("[error]", err);
  } else if (!config.isTest && !error.isOperational) {
    console.error("[error]", err);
  }

  const body = { error: { code: error.code, message: error.message } };
  if (error.fields) body.error.fields = error.fields;

  res.status(error.statusCode).json(body);
};
