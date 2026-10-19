"use strict";

const mongoose = require("mongoose");
const config = require("./env");

// Queries are only issued after connectDB() resolves. Buffer commands stay on
// because disabling them races Mongoose's automatic model init on connection
// open, which fails on Windows during boot.
mongoose.set("strictQuery", true);

async function connectDB(uri = config.mongoUri) {
  if (!uri) throw new Error("MONGO_URI is not set.");

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  console.log(`[db] connected to ${redact(uri)}`);
  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

function connectionState() {
  return mongoose.connection.readyState === 1 ? "connected" : "disconnected";
}

/** Hide credentials before logging a connection string. */
function redact(uri) {
  return String(uri).replace(/\/\/[^@]*@/, "//***:***@");
}

module.exports = { connectDB, disconnectDB, connectionState };
