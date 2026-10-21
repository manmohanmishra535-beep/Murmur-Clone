"use strict";

const { body } = require("express-validator");

const usernameRule = body("username")
  .trim()
  .toLowerCase()
  .matches(/^[a-z0-9_]{3,15}$/)
  .withMessage("Use 3 to 15 letters, numbers or underscores.");

const emailRule = body("email")
  .trim()
  .toLowerCase()
  .isEmail()
  .withMessage("Enter a full address, like name@example.com.")
  .isLength({ max: 254 })
  .withMessage("That email is too long.");

const passwordRule = body("password")
  .isString()
  .withMessage("Choose a password.")
  .isLength({ min: 8, max: 72 })
  .withMessage("Use at least 8 characters.");

const registerRules = [usernameRule, emailRule, passwordRule];

const loginRules = [
  body("email").trim().toLowerCase().notEmpty().withMessage("Enter your email."),
  body("password").isString().notEmpty().withMessage("Enter your password."),
];

const forgotPasswordRules = [emailRule];

const resetPasswordRules = [
  body("token").isString().trim().notEmpty().withMessage("That reset link is missing its token."),
  passwordRule,
];

module.exports = {
  registerRules,
  loginRules,
  forgotPasswordRules,
  resetPasswordRules,
  usernameRule,
  emailRule,
  passwordRule,
};
