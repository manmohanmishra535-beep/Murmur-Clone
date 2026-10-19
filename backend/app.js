"use strict";

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const morgan = require("morgan");

const config = require("./config/env");
const routes = require("./routes");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const { globalLimiter } = require("./middleware/rateLimit");

const app = express();

// The API sits behind a proxy in every deployed environment, which the rate
// limiter needs to read the real client IP from X-Forwarded-For.
app.set("trust proxy", 1);
app.disable("x-powered-by");

// 1. Security headers first, so even error responses carry them.
app.use(helmet());

// 2. One allowed origin, cookies on.
app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
  })
);

// 3. Small JSON bodies; posts with images go through multipart instead.
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));
app.use(cookieParser());

// 4. Strip $ and . operators so user input cannot reach a query object.
app.use(mongoSanitize());

if (!config.isTest) {
  app.use(morgan(config.isProd ? "combined" : "dev"));
}

// 5. Global rate limit for /api, with a stricter one on auth inside the router.
app.use("/api", globalLimiter, routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
