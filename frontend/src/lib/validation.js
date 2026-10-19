/**
 * Client-side mirrors of the server rules. They exist for instant feedback;
 * the API validates again and remains the source of truth.
 */

export const USERNAME_PATTERN = /^[a-z0-9_]{3,15}$/;
export const PASSWORD_MIN = 8;
export const BIO_MAX = 160;
export const DISPLAY_NAME_MAX = 50;

export function validateUsername(value) {
  const username = String(value || "").trim().toLowerCase();
  if (!username) return "Pick a username.";
  if (username.length < 3 || username.length > 15) {
    return "Use 3 to 15 characters.";
  }
  if (!USERNAME_PATTERN.test(username)) {
    return "Letters, numbers and underscores only.";
  }
  return "";
}

export function validateEmail(value) {
  const email = String(value || "").trim();
  if (!email) return "Enter your email.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return "Enter a full address, like name@example.com.";
  }
  return "";
}

export function validatePassword(value, { required = true } = {}) {
  const password = String(value || "");
  if (!password) return required ? "Choose a password." : "";
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  return "";
}

export function validateDisplayName(value) {
  const name = String(value || "").trim();
  if (name.length > DISPLAY_NAME_MAX) {
    return `Keep your display name to ${DISPLAY_NAME_MAX} characters.`;
  }
  return "";
}

export function validateBio(value) {
  const bio = String(value || "").trim();
  if (bio.length > BIO_MAX) return `Keep your bio to ${BIO_MAX} characters.`;
  return "";
}

/** Drop empty messages so a clean submit produces {}. */
function prune(fields) {
  return Object.fromEntries(Object.entries(fields).filter(([, message]) => message));
}

export function validateRegister(values) {
  return prune({
    username: validateUsername(values.username),
    email: validateEmail(values.email),
    password: validatePassword(values.password),
  });
}

export function validateLogin(values) {
  return prune({
    email: validateEmail(values.email),
    password: validatePassword(values.password),
  });
}

export function validateProfile(values) {
  return prune({
    displayName: validateDisplayName(values.displayName),
    bio: validateBio(values.bio),
  });
}
