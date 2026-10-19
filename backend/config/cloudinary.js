"use strict";

const { v2: cloudinary } = require("cloudinary");
const config = require("./env");

if (config.cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true,
  });
} else if (!config.isTest) {
  console.warn(
    "[cloudinary] CLOUDINARY_* is not configured. Image uploads are disabled until it is."
  );
}

/** Folders keep post and avatar assets apart so either can be cleared independently. */
const FOLDERS = {
  avatars: "murmur/avatars",
  posts: "murmur/posts",
};

/**
 * Upload a multer memory buffer to Cloudinary without touching disk.
 * Resolves with the raw Cloudinary result ({ secure_url, public_id, ... }).
 */
function uploadBuffer(buffer, folder, options = {}) {
  if (!config.cloudinaryEnabled) {
    const error = new Error("Image uploads are not configured on this server.");
    error.code = "UPLOADS_DISABLED";
    return Promise.reject(error);
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image", ...options },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(buffer);
  });
}

/** Best effort delete; a missing asset must never fail the request. */
async function destroyImage(publicId) {
  if (!publicId || !config.cloudinaryEnabled) return null;
  try {
    return await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error(`[cloudinary] failed to delete ${publicId}:`, error.message);
    return null;
  }
}

module.exports = { cloudinary, FOLDERS, uploadBuffer, destroyImage };
