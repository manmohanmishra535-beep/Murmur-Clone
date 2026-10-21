"use strict";

const { generateKeyPairSync } = require("crypto");

// Environment for the test run. Values are intentionally fake: the database is
// the in-memory server started in tests/setup.js.
process.env.NODE_ENV = "test";
// Keep the SDK's one-time telemetry notice out of the suite's output.
process.env.CLERK_TELEMETRY_DISABLED = "1";
process.env.MONGO_URI = "mongodb://127.0.0.1:27017/murmur-test";
process.env.CLIENT_URL = "http://localhost:3000";
process.env.PORT = "5051";

// A throwaway Clerk instance identity. The keys only need the format Clerk's
// parser expects; nothing in the suite talks to Clerk.
const instance = Buffer.from("test-clerk.example.com$").toString("base64");
process.env.CLERK_SECRET_KEY = `sk_test_${instance}`;
process.env.CLERK_PUBLISHABLE_KEY = `pk_test_${instance}`;

// Session tokens are signed with this pair and the API verifies them with the
// public half, which is exactly what CLERK_JWT_KEY does in production.
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
process.env.CLERK_JWT_KEY = publicKey.export({ type: "spki", format: "pem" });
process.env.TEST_CLERK_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" });
