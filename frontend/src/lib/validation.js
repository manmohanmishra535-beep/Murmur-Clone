/**
 * Client-side mirrors of the server rules. They exist for instant feedback;
 * the API validates again and remains the source of truth.
 *
 * Identity (username, email, password) is Clerk's job now, so only the profile
 * fields this app owns are validated here.
 */

export const BIO_MAX = 160;
export const DISPLAY_NAME_MAX = 50;

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

export function validateProfile(values) {
  return prune({
    displayName: validateDisplayName(values.displayName),
    bio: validateBio(values.bio),
  });
}
