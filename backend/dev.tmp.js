"use strict";

/* Temporary verification harness. Not part of the repo: deleted after the check. */

process.env.NODE_ENV = "development";
process.env.PORT = "5001";
process.env.MONGO_URI = "mongodb://127.0.0.1:27017/murmur-dev-unused";
process.env.JWT_SECRET = "temporary-verification-secret-that-is-long-enough";
process.env.CLIENT_URL = "http://localhost:3001";

const path = require("path");

// Point Mongoose at an in-memory MongoDB before db.js connects.
const { MongoMemoryServer } = require("mongodb-memory-server");

async function main() {
  const mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri("murmur-verify");

  // Stub Cloudinary: uploads succeed without credentials, images are recorded
  // with a real-looking URL so the frontend renders them.
  const realCloudinary = require("./config/cloudinary");
  const cloudinaryPath = require.resolve("./config/cloudinary");
  let counter = 0;
  require.cache[cloudinaryPath] = {
    id: cloudinaryPath,
    filename: cloudinaryPath,
    loaded: true,
    exports: {
      ...realCloudinary,
      uploadBuffer: async () => {
        counter += 1;
        // A path served by the Next app itself, so next/image can actually
        // render it without Cloudinary credentials. The real secure_url shape
        // is covered by the backend tests instead.
        return {
          secure_url: "/verify-image.png",
          public_id: `murmur/posts/verify-${counter}`,
        };
      },
      destroyImage: async () => ({ result: "ok" }),
    },
  };

  const config = require("./config/env");
  const { connectDB } = require("./config/db");
  await connectDB();

  const app = require("./app");
  app.listen(config.port, () => {
    console.log(`TEMP API READY on http://localhost:${config.port} (in-memory MongoDB, Cloudinary stubbed)`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
