import {
  bumpUnread,
  flattenNotifications,
  isUnread,
  notificationHref,
  notificationPhrase,
  notificationText,
  prependNotification,
  withoutNotification,
} from "../notifications";

function pages(...itemLists) {
  return {
    pages: itemLists.map((items, index) => ({
      items,
      nextCursor: index === itemLists.length - 1 ? null : "c",
    })),
    pageParams: itemLists.map((_value, index) => index),
  };
}

const LIKE = {
  _id: "n1",
  type: "like",
  read: false,
  actor: { _id: "u1", username: "arjun", displayName: "Arjun Rao" },
  post: { _id: "p1", content: "Trains were on time." },
  createdAt: "2026-01-01T10:00:00.000Z",
};

describe("notificationText", () => {
  it("reads as a sentence with the actor's name", () => {
    expect(notificationText(LIKE)).toBe("Arjun Rao liked your post");
  });

  it("falls back to the username, then to nobody in particular", () => {
    expect(notificationText({ type: "follow", actor: { username: "arjun" } })).toBe(
      "arjun followed you"
    );
    expect(notificationText({ type: "follow" })).toBe("Someone followed you");
  });

  it("gives every documented type its own wording", () => {
    expect(notificationPhrase("comment")).toBe("replied to your post");
    expect(notificationPhrase("repost")).toBe("reposted your post");
    expect(notificationPhrase("message")).toBe("sent you a message");
  });

  it("survives an unknown type and no notification at all", () => {
    expect(notificationPhrase("sticker")).toBe("did something");
    expect(notificationText(null)).toBe("");
  });
});

describe("notificationHref", () => {
  it("points at the post when there is one", () => {
    expect(notificationHref(LIKE)).toBe("/post/p1");
  });

  it("points at the chat for a message", () => {
    expect(notificationHref({ type: "message", conversation: "c1" })).toBe("/messages/c1");
  });

  it("points at the account otherwise", () => {
    expect(notificationHref({ type: "follow", actor: { username: "arjun" } })).toBe("/arjun");
    expect(notificationHref(null)).toBe("/notifications");
  });
});

describe("prependNotification", () => {
  it("puts a pushed row at the top of the first page", () => {
    const data = pages([{ _id: "old" }]);

    const next = prependNotification(data, LIKE);

    expect(flattenNotifications(next).map((item) => item._id)).toEqual(["n1", "old"]);
    expect(next.pages).toHaveLength(1);
  });

  it("ignores a row that is already in the list", () => {
    // A push and a refetch can both deliver the same notification.
    const data = pages([LIKE]);
    expect(prependNotification(data, LIKE)).toBe(data);
  });

  it("finds a duplicate on a later page too", () => {
    const data = pages([{ _id: "a" }], [LIKE]);
    expect(prependNotification(data, LIKE)).toBe(data);
  });

  it("creates the first page when the list has never loaded", () => {
    const next = prependNotification({ pages: [], pageParams: [] }, LIKE);
    expect(flattenNotifications(next).map((item) => item._id)).toEqual(["n1"]);
  });

  it("passes uncached data through", () => {
    expect(prependNotification(undefined, LIKE)).toBeUndefined();
    expect(prependNotification(pages([{ _id: "a" }]), null)).toEqual(pages([{ _id: "a" }]));
  });
});

describe("withoutNotification", () => {
  it("drops the row from wherever it sits", () => {
    const data = pages([{ _id: "a" }], [LIKE, { _id: "b" }]);

    const next = withoutNotification(data, "n1");

    expect(flattenNotifications(next).map((item) => item._id)).toEqual(["a", "b"]);
    expect(next.pages).toHaveLength(2);
  });

  it("passes uncached data through", () => {
    expect(withoutNotification(undefined, "n1")).toBeUndefined();
  });
});

describe("isUnread", () => {
  it("reads the row's own flag, and false when it is not loaded", () => {
    expect(isUnread(pages([LIKE]), "n1")).toBe(true);
    expect(isUnread(pages([{ ...LIKE, read: true }]), "n1")).toBe(false);
    expect(isUnread(pages([]), "n1")).toBe(false);
    expect(isUnread(undefined, "n1")).toBe(false);
  });
});

describe("bumpUnread", () => {
  it("moves the badge up and down", () => {
    expect(bumpUnread(3, 1)).toBe(4);
    expect(bumpUnread(3, -1)).toBe(2);
  });

  it("never goes below zero, and treats a missing count as zero", () => {
    expect(bumpUnread(0, -1)).toBe(0);
    expect(bumpUnread(undefined, 1)).toBe(1);
  });
});

describe("flattenNotifications", () => {
  it("joins every page in order and tolerates missing pieces", () => {
    expect(flattenNotifications(pages([{ _id: "a" }], [{ _id: "b" }])).map((i) => i._id)).toEqual([
      "a",
      "b",
    ]);
    expect(flattenNotifications(undefined)).toEqual([]);
    expect(flattenNotifications({ pages: [{ nextCursor: null }] })).toEqual([]);
  });
});
