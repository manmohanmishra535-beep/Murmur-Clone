/**
 * Clerk's SDK throws an object with an `errors` array; each entry has a short
 * `message` and a friendlier `longMessage`. Collapse it to one line for a form.
 */
export function clerkErrorMessage(error, fallback = "Something went wrong. Try again.") {
  const first = error && Array.isArray(error.errors) ? error.errors[0] : null;
  return (
    (first && (first.longMessage || first.message)) ||
    (error && error.message) ||
    fallback
  );
}

/** True when a sign-in was refused because no account uses that address. */
export function isIdentifierNotFound(error) {
  const first = error && Array.isArray(error.errors) ? error.errors[0] : null;
  return Boolean(first && first.code === "form_identifier_not_found");
}

/**
 * True when Clerk refused to start a new sign-in/sign-up because the browser
 * already holds a session. The page should follow that session instead of
 * showing "you're already signed in" as a form error.
 */
export function isSessionExists(error) {
  const first = error && Array.isArray(error.errors) ? error.errors[0] : null;
  return Boolean(first && first.code === "session_exists");
}

/**
 * The instance's password policy, so the hint matches what Clerk will enforce.
 * `__internal_environment` is the only client-side handle on user settings; the
 * fallbacks are Clerk's own defaults and only apply before the SDK loads.
 */
export function passwordPolicy(clerk) {
  const settings = clerk?.__internal_environment?.userSettings?.passwordSettings;
  const min = Number(settings?.min_length);
  const max = Number(settings?.max_length);
  return {
    minLength: Number.isInteger(min) && min > 0 ? min : 8,
    maxLength: Number.isInteger(max) && max > 0 ? max : 72,
  };
}

export function passwordHint({ minLength }) {
  return `At least ${minLength} characters.`;
}

/** True once the SDK has told us the instance's real rule. */
export function hasPasswordPolicy(clerk) {
  return Boolean(clerk?.__internal_environment?.userSettings?.passwordSettings);
}

export function validatePassword(value, { minLength, maxLength }) {
  const password = String(value || "");
  if (password.length < minLength) return `Use at least ${minLength} characters.`;
  if (password.length > maxLength) {
    return `Keep your password to ${maxLength} characters or fewer.`;
  }
  return "";
}
