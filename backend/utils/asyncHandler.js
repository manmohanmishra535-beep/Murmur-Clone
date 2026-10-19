"use strict";

/**
 * Wrap an async controller so a rejected promise reaches errorHandler
 * instead of crashing the process as an unhandled rejection.
 */
module.exports = function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
