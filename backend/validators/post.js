"use strict";

const { body } = require("express-validator");

const POST_MAX = 280;

/**
 * POST /api/posts is multipart/form-data when images are attached, so content
 * always arrives as a string. Rules from the engineering docs:
 * "1 to 280 characters after trimming, or an image with empty text".
 */
const createPostRules = [
  body("content")
    .optional({ values: "null" })
    .isString()
    .withMessage("Write your post as plain text.")
    .bail()
    .trim()
    .isLength({ max: POST_MAX })
    .withMessage(`Keep your post to ${POST_MAX} characters.`),

  // Its own chain, so it runs even when content was not sent at all: an
  // image-only post is valid, a completely empty post is not.
  body("content").custom((value, { req }) => {
    const text = typeof value === "string" ? value.trim() : "";
    const files = Array.isArray(req.files) ? req.files : [];
    if (!text && files.length === 0) {
      throw new Error("Write something, or add an image.");
    }
    return true;
  }),
];

/** PATCH /api/posts/:id edits text only; images are set when the post is created. */
const updatePostRules = [
  body("content")
    .exists({ values: "null" })
    .withMessage("Write something to save.")
    .bail()
    .isString()
    .withMessage("Write your post as plain text.")
    .bail()
    .trim()
    .isLength({ max: POST_MAX })
    .withMessage(`Keep your post to ${POST_MAX} characters.`)
    .isLength({ min: 1 })
    .withMessage("Write something to save."),
];

/**
 * POST /api/posts/:id/repost - a repost may carry a comment, or nothing at all,
 * so content is optional here where createPostRules requires text or an image.
 */
const repostRules = [
  body("content")
    .optional({ values: "null" })
    .isString()
    .withMessage("Write your repost as plain text.")
    .bail()
    .trim()
    .isLength({ max: POST_MAX })
    .withMessage(`Keep your repost to ${POST_MAX} characters.`),
];

module.exports = { POST_MAX, createPostRules, updatePostRules, repostRules };
