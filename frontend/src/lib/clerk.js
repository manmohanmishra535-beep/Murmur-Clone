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
