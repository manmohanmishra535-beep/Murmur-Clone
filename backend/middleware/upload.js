"use strict";

const multer = require("multer");
const AppError = require("../utils/AppError");

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/**
 * Files stay in memory so they can be streamed straight to Cloudinary:
 * nothing is written to the API container's disk.
 */
const storage = multer.memoryStorage();

function fileFilter(_req, file, cb) {
  if (ALLOWED.has(file.mimetype)) return cb(null, true);
  return cb(
    AppError.validation("Check the highlighted fields.", {
      image: "Use a JPEG, PNG, WebP or GIF image.",
    })
  );
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: 4, fields: 10 },
});

module.exports = {
  upload,
  MAX_FILE_SIZE,
  ALLOWED_IMAGE_TYPES: [...ALLOWED],
  /** Single image field, for PATCH /api/users/me. */
  singleImage: upload.single("image"),
  /** Up to 4 images per post (Phase 2). */
  postImages: upload.array("images", 4),
};
