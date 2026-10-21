"use strict";

const rateLimit = require("express-rate-limit");
const config = require("../config/env");

const build = (options) =>
  rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    // Tests fire many requests from one IP on purpose.
    skip: () => config.isTest,
    handler: (_req, res) =>
      res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Try again in a few minutes.",
        },
      }),
    ...options,
  });

/** 100 requests per 15 minutes per IP across the API. */
const globalLimiter = build({ windowMs: 15 * 60 * 1000, limit: 100 });

module.exports = { globalLimiter };
