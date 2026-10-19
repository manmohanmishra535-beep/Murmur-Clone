/**
 * Client-side mirrors of the API's upload rules, so a bad file is rejected
 * before it travels. The server checks again and remains the source of truth.
 * Rules from the engineering docs: "JPEG, PNG, WebP or GIF, up to 5 MB, up to
 * 4 per post".
 */

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const ALLOWED_IMAGE_LABEL = "JPEG, PNG, WebP or GIF";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_POST_IMAGES = 4;

export function validateImageFile(file) {
  if (!file) return "Choose an image.";
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return `Use a ${ALLOWED_IMAGE_LABEL} image.`;
  }
  if (file.size > MAX_IMAGE_BYTES) return "Images must be 5 MB or smaller.";
  return "";
}

/**
 * Check a batch against the per-post cap. Returns the message for the first
 * problem, or "" when the batch fits.
 */
export function validateImageBatch(files, alreadySelected = 0) {
  const list = Array.from(files || []);
  if (list.length + alreadySelected > MAX_POST_IMAGES) {
    return `Up to ${MAX_POST_IMAGES} images per post.`;
  }
  for (const file of list) {
    const message = validateImageFile(file);
    if (message) return message;
  }
  return "";
}
