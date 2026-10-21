"use strict";

const express = require("express");
const {
  register,
  login,
  logout,
  me,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");
const {
  registerRules,
  loginRules,
  forgotPasswordRules,
  resetPasswordRules,
} = require("../validators/auth");
const validate = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimit");

const router = express.Router();

router.post("/register", authLimiter, registerRules, validate, register);
router.post("/login", authLimiter, loginRules, validate, login);
// The same strict limit covers the reset pair: it caps enumeration attempts
// and password guessing from a reset link.
router.post("/forgot-password", authLimiter, forgotPasswordRules, validate, forgotPassword);
router.post("/reset-password", authLimiter, resetPasswordRules, validate, resetPassword);
router.post("/logout", requireAuth, logout);
router.get("/me", requireAuth, me);

module.exports = router;
