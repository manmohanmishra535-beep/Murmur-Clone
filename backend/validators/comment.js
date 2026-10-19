"use strict";

const { body } = require("express-validator");

const COMMENT_MAX = 280;

/** POST /api/posts/:id/comments - a reply is plain text, 1 to 280 characters. */
const createCommentRules = [
  body("content")
    .exists({ values: "null" })
    .withMessage("Write a reply.")
    .bail()
    .isString()
    .withMessage("Write your reply as plain text.")
    .bail()
    .trim()
    .isLength({ max: COMMENT_MAX })
    .withMessage(`Keep your reply to ${COMMENT_MAX} characters.`)
    .bail()
    .isLength({ min: 1 })
    .withMessage("Write a reply."),
];

module.exports = { COMMENT_MAX, createCommentRules };
