import {
  canFollow,
  flattenPages,
  isOwnPost,
  withCommentCount,
  withFollow,
  withLike,
  withoutComment,
  withoutPost,
} from "../posts";

function pages(...itemLists) {
  return {
    pages: itemLists.map((items, index) => ({ items, nextCursor: index === itemLists.length - 1 ? null : "c" })),
    pageParams: itemLists.map((_value, index) => index),
  };
}

describe("flattenPages", () => {
  it("joins every page into one list, in order", () => {
    const data = pages([{ _id: "1" }, { _id: "2" }], [{ _id: "3" }]);
    expect(flattenPages(data).map((post) => post._id)).toEqual(["1", "2", "3"]);
  });

  it("returns an empty list before the first load", () => {
    expect(flattenPages(undefined)).toEqual([]);
    expect(flattenPages({})).toEqual([]);
    expect(flattenPages({ pages: undefined })).toEqual([]);
  });

  it("tolerates a page with no items key", () => {
    expect(flattenPages({ pages: [{ nextCursor: null }] })).toEqual([]);
  });
});

describe("isOwnPost", () => {
  it("compares the author with the viewer", () => {
    expect(isOwnPost({ author: { _id: "abc" } }, "abc")).toBe(true);
    expect(isOwnPost({ author: { _id: "abc" } }, "def")).toBe(false);
  });

  it("handles an unpopulated author id", () => {
    expect(isOwnPost({ author: "abc" }, "abc")).toBe(true);
  });

  it("is false without a viewer", () => {
    expect(isOwnPost({ author: { _id: "abc" } }, undefined)).toBe(false);
    expect(isOwnPost(null, "abc")).toBe(false);
  });
});

describe("withoutPost", () => {
  it("drops the post from every page and keeps the shape", () => {
    const data = pages([{ _id: "1" }, { _id: "2" }], [{ _id: "3" }]);

    const next = withoutPost(data, "2");

    expect(flattenPages(next).map((post) => post._id)).toEqual(["1", "3"]);
    expect(next.pages).toHaveLength(2);
    expect(next.pages[0].nextCursor).toBe("c");
  });

  it("returns the data untouched when there is nothing cached", () => {
    expect(withoutPost(undefined, "1")).toBeUndefined();
  });
});

describe("withLike", () => {
  it("likes a post and moves the count with it", () => {
    const post = { _id: "1", likedByMe: false, likeCount: 4 };

    const liked = withLike(post, true);

    expect(liked).toEqual({ _id: "1", likedByMe: true, likeCount: 5 });
    expect(post.likeCount).toBe(4);
  });

  it("unlikes a post and moves the count back", () => {
    expect(withLike({ _id: "1", likedByMe: true, likeCount: 5 }, false)).toEqual({
      _id: "1",
      likedByMe: false,
      likeCount: 4,
    });
  });

  it("never counts below zero", () => {
    expect(withLike({ _id: "1", likedByMe: true, likeCount: 0 }, false).likeCount).toBe(0);
  });

  it("is a no-op when the post already has that state", () => {
    // The optimistic write and the server's confirm must not add up.
    expect(withLike({ _id: "1", likedByMe: true, likeCount: 3 }, true).likeCount).toBe(3);
  });

  it("treats a missing count as zero", () => {
    expect(withLike({ _id: "1" }, true)).toEqual({ _id: "1", likedByMe: true, likeCount: 1 });
  });
});

describe("withCommentCount", () => {
  it("adds and removes a reply from the count", () => {
    expect(withCommentCount({ commentCount: 2 }, 1).commentCount).toBe(3);
    expect(withCommentCount({ commentCount: 2 }, -1).commentCount).toBe(1);
  });

  it("stops at zero", () => {
    expect(withCommentCount({ commentCount: 0 }, -1).commentCount).toBe(0);
    expect(withCommentCount({}, 1).commentCount).toBe(1);
  });
});

describe("withoutComment", () => {
  it("drops one reply and keeps the pages", () => {
    const data = pages([{ _id: "a" }, { _id: "b" }], [{ _id: "c" }]);

    const next = withoutComment(data, "a");

    expect(flattenPages(next).map((comment) => comment._id)).toEqual(["b", "c"]);
    expect(next.pages).toHaveLength(2);
  });

  it("passes uncached data through", () => {
    expect(withoutComment(undefined, "a")).toBeUndefined();
  });
});

describe("withFollow", () => {
  it("follows and moves the follower count", () => {
    const user = { _id: "u1", isFollowing: false, followerCount: 2 };

    const next = withFollow(user, true);

    expect(next).toEqual({ _id: "u1", isFollowing: true, followerCount: 3 });
    expect(user.followerCount).toBe(2);
  });

  it("unfollows and moves it back", () => {
    expect(withFollow({ _id: "u1", isFollowing: true, followerCount: 3 }, false)).toEqual({
      _id: "u1",
      isFollowing: false,
      followerCount: 2,
    });
  });

  it("is a no-op when the state already matches", () => {
    expect(withFollow({ _id: "u1", isFollowing: true, followerCount: 3 }, true).followerCount).toBe(3);
  });

  it("never counts below zero", () => {
    expect(withFollow({ _id: "u1", isFollowing: true }, false).followerCount).toBe(0);
  });
});

describe("canFollow", () => {
  it("is true for someone else while signed in", () => {
    expect(canFollow({ _id: "u1" }, "u2")).toBe(true);
  });

  it("is false on your own account", () => {
    expect(canFollow({ _id: "u1" }, "u1")).toBe(false);
  });

  it("is false when signed out or without a user", () => {
    expect(canFollow({ _id: "u1" }, undefined)).toBe(false);
    expect(canFollow(null, "u2")).toBe(false);
  });
});
