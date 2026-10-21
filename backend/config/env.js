"use strict";

require("dotenv").config();

const nodeEnv = process.env.NODE_ENV || "development";

const config = {
  nodeEnv,
  isProd: nodeEnv === "production",
  isTest: nodeEnv === "test",
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
  apiUrl: process.env.API_URL || "",
  mongoUri: process.env.MONGO_URI,
  jwt: {
    secret: process.env.JWT_SECRET,
    // The engineering docs describe a 7 day token; the table shows 15m as an example.
    // 7 days is the documented default, overridable through JWT_EXPIRES_IN.
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  mail: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || "Murmur <no-reply@murmur.local>",
  },
};

config.cloudinaryEnabled = Boolean(
  config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret
);

config.mailEnabled = Boolean(config.mail.host);

/**
 * Without SMTP every reset link would vanish into the log, which makes the
 * flow unusable on a laptop. Outside production the API therefore returns the
 * link in the response so the page can offer it. Production never does.
 */
config.exposeResetUrl = !config.isProd;

/**
 * Fail fast on boot when a required variable is missing or unsafe.
 * Called from server.js, not at import time, so tests can set env first.
 */
function assertConfig() {
  const required = ["MONGO_URI", "JWT_SECRET"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  if (config.jwt.secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long.");
  }
}

config.assertConfig = assertConfig;

module.exports = config;
