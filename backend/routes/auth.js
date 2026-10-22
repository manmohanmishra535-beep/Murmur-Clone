"use strict";

const express = require("express");
const { verifyToken } = require("@clerk/backend");
const config = require("../config/env");
const { me } = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

/**
 * Temporary diagnostic: report why a token is rejected without leaking it.
 * Remove once the deployed Clerk configuration is confirmed.
 */
router.post("/diagnose", async (req, res) => {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    return res
      .status(400)
      .json({ error: { code: "NO_TOKEN", message: "Send a bearer token." } });
  }

  const result = {};
  try {
    const claims = await verifyToken(token, { secretKey: config.clerk.secretKey });
    result.signature = "ok";
    result.claims = { sub: claims.sub, iss: claims.iss, azp: claims.azp, exp: claims.exp };
  } catch (error) {
    result.signature = error.reason || error.message;
  }

  try {
    await verifyToken(token, {
      secretKey: config.clerk.secretKey,
      authorizedParties: config.clerk.authorizedParties,
    });
    result.parties = "ok";
  } catch (error) {
    result.parties = error.reason || error.message;
  }

  return res.json({
    data: {
      ...result,
      clientUrl: config.clientUrl,
      authorizedParties: config.clerk.authorizedParties,
      secretPrefix: String(config.clerk.secretKey || "").slice(0, 8),
      jwtKeySet: Boolean(config.clerk.jwtKey),
      publishablePrefix: String(config.clerk.publishableKey || "").slice(0, 16),
    },
  });
});

router.get("/me", requireAuth, me);

module.exports = router;
