import { postShareTitle, postUrl, sharePost } from "../share";

const post = { _id: "abc123", author: { username: "priya_nair" } };

/** The helper reads window/navigator at call time, so globals can be swapped. */
function withBrowser({ origin = "http://localhost:3001", share, writeText } = {}) {
  global.window = { location: { origin } };
  global.navigator = {};
  if (share) global.navigator.share = share;
  if (writeText) global.navigator.clipboard = { writeText };
}

afterEach(() => {
  delete global.window;
  delete global.navigator;
});

describe("postUrl", () => {
  it("builds the shared link from the post id", () => {
    expect(postUrl(post, "http://localhost:3001")).toBe("http://localhost:3001/post/abc123");
  });

  it("uses the current origin when one is not passed", () => {
    withBrowser({ origin: "https://murmur.example" });
    expect(postUrl(post)).toBe("https://murmur.example/post/abc123");
  });

  it("returns nothing for a post that is not saved yet", () => {
    expect(postUrl(null, "http://x")).toBe("");
    expect(postUrl({ author: {} }, "http://x")).toBe("");
  });
});

describe("postShareTitle", () => {
  it("names the author", () => {
    expect(postShareTitle(post)).toBe("A post by @priya_nair");
  });

  it("falls back when the author is missing", () => {
    expect(postShareTitle({})).toBe("A post on Murmur");
  });
});

describe("sharePost", () => {
  it("prefers the native share sheet", async () => {
    const calls = [];
    withBrowser({
      share: async (payload) => {
        calls.push(payload);
        return undefined;
      },
    });

    const result = await sharePost(post);

    expect(result).toEqual({ ok: true, via: "sheet" });
    expect(calls).toEqual([{ url: "http://localhost:3001/post/abc123", title: "A post by @priya_nair" }]);
  });

  it("treats a dismissed sheet as a cancellation, not a failure", async () => {
    withBrowser({
      share: async () => {
        const error = new Error("cancelled");
        error.name = "AbortError";
        throw error;
      },
      writeText: async () => {
        throw new Error("should not be reached");
      },
    });

    const result = await sharePost(post);

    expect(result).toEqual({ ok: false, reason: "cancelled", url: "http://localhost:3001/post/abc123" });
  });

  it("falls back to the clipboard when the sheet errors", async () => {
    const copied = [];
    withBrowser({
      share: async () => {
        throw new Error("no sheet here");
      },
      writeText: async (url) => {
        copied.push(url);
      },
    });

    const result = await sharePost(post);

    expect(result).toEqual({ ok: true, via: "clipboard" });
    expect(copied).toEqual(["http://localhost:3001/post/abc123"]);
  });

  it("copies the link when there is no share sheet at all", async () => {
    const copied = [];
    withBrowser({ writeText: async (url) => copied.push(url) });

    const result = await sharePost(post);

    expect(result).toEqual({ ok: true, via: "clipboard" });
    expect(copied).toEqual(["http://localhost:3001/post/abc123"]);
  });

  it("reports a failure instead of going silent when nothing works", async () => {
    withBrowser({
      writeText: async () => {
        throw new Error("clipboard blocked");
      },
    });

    const result = await sharePost(post);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("failed");
    // The caller shows this back to the reader, so it has to be the real link.
    expect(result.url).toBe("http://localhost:3001/post/abc123");
  });
});
