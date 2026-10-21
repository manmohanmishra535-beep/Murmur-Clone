"use strict";

const config = require("../config/env");

let transport;

/**
 * Created lazily and only when SMTP is configured: a laptop with no mail
 * server must still boot, and no test should open a socket just by requiring
 * this file.
 */
function getTransport() {
  if (transport !== undefined) return transport;

  if (!config.mailEnabled) {
    transport = null;
    return transport;
  }

  // Required here rather than at the top so the dependency is only touched on
  // the path that needs it.
  const nodemailer = require("nodemailer");
  transport = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    // Port 465 is implicit TLS; 587 starts plain and upgrades with STARTTLS.
    secure: config.mail.port === 465,
    auth: config.mail.user
      ? { user: config.mail.user, pass: config.mail.pass }
      : undefined,
  });

  return transport;
}

/**
 * Returns true when the message was handed to an SMTP server. A failure is
 * logged, not thrown: a mail outage must not turn a valid request into a 500,
 * and the caller's answer stays the same either way.
 */
async function sendMail({ to, subject, text }) {
  const mailer = getTransport();

  if (!mailer) {
    // Tests assert on the response and the stored hash; printing every link
    // would only bury the suite's own output.
    if (!config.isTest) {
      console.log(
        `[api] mail not sent (SMTP not configured)\nTo: ${to}\nSubject: ${subject}\n\n${text}\n`
      );
    }
    return false;
  }

  try {
    await mailer.sendMail({ from: config.mail.from, to, subject, text });
    return true;
  } catch (error) {
    console.error("[api] mail failed:", error.message);
    return false;
  }
}

function sendPasswordResetEmail({ to, username, url }) {
  return sendMail({
    to,
    subject: "Reset your Murmur password",
    text: [
      `Hi ${username},`,
      "",
      "Someone asked to reset the password for this Murmur account.",
      "The link below works once and expires in 30 minutes:",
      "",
      url,
      "",
      "If this was not you, you can ignore this message. Your password has not changed.",
      "",
      "— Murmur",
    ].join("\n"),
  });
}

module.exports = { sendMail, sendPasswordResetEmail };
