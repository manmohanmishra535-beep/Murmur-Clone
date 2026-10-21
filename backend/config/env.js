"use strict";

require("dotenv").config();

const nodeEnv = process.env.NODE_ENV || "development";

const config = {
  nodeEnv,
  isProd: nodeEnv === "production",
  isTest: nodeEnv === "test",
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
  mongoUri: process.env.MONGO_URI,
  clerk: {
    secretKey: process.env.CLERK_SECRET_KEY,
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    // Supplying the PEM public key lets the API verify session tokens without
    // a round trip to Clerk on every request.
    jwtKey: process.env.CLERK_JWT_KEY,
    // Session tokens carry the origin that asked for them in "azp". The
    // frontend's origin has to be on this list or its tokens are refused;
    // CLERK_AUTHORIZED_PARTIES adds preview origins on top of CLIENT_URL.
    authorizedParties: [
      process.env.CLIENT_URL || "http://localhost:3000",
      ...(process.env.CLERK_AUTHORIZED_PARTIES || "").split(","),
    ]
      .map((value) => value.trim())
      .filter(Boolean),
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
};

config.cloudinaryEnabled = Boolean(
  config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret
);

config.clerkEnabled = Boolean(config.clerk.secretKey);

/**
 * Fail fast on boot when a required variable is missing or unsafe.
 * Called from server.js, not at import time, so tests can set env first.
 */
function assertConfig() {
  const required = ["MONGO_URI", "CLERK_SECRET_KEY"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

config.assertConfig = assertConfig;

module.exports = config;
