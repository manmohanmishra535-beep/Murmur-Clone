"use strict";

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const morgan = require("morgan");
const { randomUUID } = require("crypto");

const config = require("./config/env");
const routes = require("./routes");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const { globalLimiter } = require("./middleware/rateLimit");

const app = express();

// A request id, echoed to the caller and printed with the log line, so a report
// from production can be matched to an entry in the host's log stream. The
// docs' error shape is left alone; the id travels in the header.
const REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

app.use((req, res, next) => {
  const offered = req.get("x-request-id");
  // Only accept a header that cannot forge or split a log line.
  req.id = offered && REQUEST_ID.test(offered) ? offered : randomUUID();
  res.set("X-Request-Id", req.id);
  next();
});

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
  // One line per request, prefixed with the id the response carried, so the
  // host's log stream and a support report can be lined up.
  morgan.token("id", (req) => req.id);
  app.use(
    morgan(
      config.isProd
        ? ":id :remote-addr :method :url :status :res[content-length] - :response-time ms"
        : ":id :method :url :status - :response-time ms"
    )
  );
}

// 5. Global rate limit for /api, with a stricter one on auth inside the router.
app.use("/api", globalLimiter, routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
