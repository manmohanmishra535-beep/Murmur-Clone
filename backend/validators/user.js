"use strict";

const { body } = require("express-validator");

/**
 * PATCH /api/users/me is multipart/form-data when an avatar is attached, so
 * every field is optional and arrives as a string.
 */
const updateMeRules = [
  body("displayName")
    .optional({ values: "null" })
    .isString()
    .withMessage("Enter your name.")
    .trim()
    .isLength({ max: 50 })
    .withMessage("Keep your display name to 50 characters."),

  body("bio")
    .optional({ values: "null" })
    .isString()
    .withMessage("Write your bio as plain text.")
    .trim()
    .isLength({ max: 160 })
    .withMessage("Keep your bio to 160 characters."),
];

module.exports = { updateMeRules };
