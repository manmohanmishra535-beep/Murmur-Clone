/**
 * Sharing a post link. Kept out of the components so PostList and the single
 * post page cannot drift apart, and so the failure paths are testable.
 *
 * Never fails silently: the caller always learns whether the link went
 * somewhere, so it can tell the reader what to do instead.
 */

/** The canonical, shareable URL for a post. */
export function postUrl(post, origin) {
  if (!post || !post._id) return "";
  const base =
    origin != null
      ? String(origin)
      : typeof window !== "undefined"
        ? window.location.origin
        : "";
  return `${base}/post/${post._id}`;
}

/** The title a share sheet shows. */
export function postShareTitle(post) {
  const handle = post && post.author ? post.author.username : "";
  return handle ? `A post by @${handle}` : "A post on Murmur";
}

/**
 * @returns {Promise<{ ok: true, via: "sheet" | "clipboard" } | { ok: false, reason: "cancelled" | "failed", url: string }>}
 */
export async function sharePost(post) {
  const url = postUrl(post);
  if (!url) return { ok: false, reason: "failed", url: "" };

  const title = postShareTitle(post);

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ url, title });
      return { ok: true, via: "sheet" };
    } catch (error) {
      // Dismissing the sheet is not a failure worth reporting.
      if (error && error.name === "AbortError") return { ok: false, reason: "cancelled", url };
      // Anything else falls through to the clipboard.
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return { ok: true, via: "clipboard" };
  } catch {
    return { ok: false, reason: "failed", url };
  }
}
