"use strict";

const AppError = require("../utils/AppError");

/** Anything that reached here matched no route. */
module.exports = function notFound(req, _res, next) {
  next(new AppError(404, "NOT_FOUND", `No route matches ${req.method} ${req.originalUrl}.`));
};
