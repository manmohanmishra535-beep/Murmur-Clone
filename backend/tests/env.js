"use strict";

// Environment for the test run. Values are intentionally fake: the database is
// the in-memory server started in tests/setup.js.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-validation-0123456789";
process.env.JWT_EXPIRES_IN = "1h";
process.env.MONGO_URI = "mongodb://127.0.0.1:27017/murmur-test";
process.env.CLIENT_URL = "http://localhost:3000";
process.env.PORT = "5051";
