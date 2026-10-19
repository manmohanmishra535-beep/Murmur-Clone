"use strict";

const { validationResult } = require("express-validator");
const AppError = require("../utils/AppError");

/**
 * Runs after a chain of express-validator checks. A failure becomes the same
 * 422 body the frontend already knows how to map onto its fields.
 */
module.exports = function validate(req, _res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const fields = {};
  for (const error of result.array()) {
    // Keep the first message per field; the client shows one error per input.
    if (!fields[error.path]) fields[error.path] = error.msg;
  }

  return next(AppError.validation("Check the highlighted fields.", fields));
};
