"use strict";

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  // Boot env vars before anything requires config/env.js.
  setupFiles: ["<rootDir>/tests/env.js"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  testTimeout: 30000,
  collectCoverageFrom: [
    "controllers/**/*.js",
    "middleware/**/*.js",
    "utils/**/*.js",
    "validators/**/*.js",
  ],
};
