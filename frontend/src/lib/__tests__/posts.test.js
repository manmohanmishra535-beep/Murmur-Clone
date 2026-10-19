import { flattenPages, isOwnPost, withoutPost } from "../posts";

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
