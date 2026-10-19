import {
  MESSAGE_MAX,
  appendMessage,
  conversationLabel,
  dayKey,
  messagesInOrder,
  withLastMessage,
} from "../messages";

function pages(...itemLists) {
  return {
    pages: itemLists.map((items, index) => ({
      items,
      nextCursor: index === itemLists.length - 1 ? null : "c",
    })),
    pageParams: itemLists.map((_value, index) => index),
  };
}

const HELLO = {
  _id: "m1",
  conversation: "c1",
  text: "Hello there.",
  sender: { _id: "u1", username: "priya" },
  createdAt: "2026-01-01T10:00:00.000Z",
};

describe("appendMessage", () => {
  it("adds a new message to the front of the newest page", () => {
    const data = pages([{ _id: "a" }]);

    const next = appendMessage(data, HELLO);

    expect(messagesInOrder(next).map((item) => item._id)).toEqual(["a", "m1"]);
    expect(next.pages).toHaveLength(1);
  });

  it("ignores the echo of a message it already holds", () => {
    // The socket echo and the REST response both carry the same message.
    const data = pages([HELLO]);
    expect(appendMessage(data, HELLO)).toBe(data);
  });

  it("finds a duplicate on an older page", () => {
    const data = pages([{ _id: "b" }], [HELLO]);
    expect(appendMessage(data, HELLO)).toBe(data);
  });

  it("passes data it cannot use straight through", () => {
    expect(appendMessage(undefined, HELLO)).toBeUndefined();
    expect(appendMessage(pages([{ _id: "a" }]), null)).toEqual(pages([{ _id: "a" }]));
  });
});

describe("messagesInOrder", () => {
  it("reads oldest first, across pages", () => {
    // Pages arrive newest first, so page two holds the older messages.
    const data = pages([{ _id: "new" }, { _id: "mid" }], [{ _id: "old" }]);

    expect(messagesInOrder(data).map((item) => item._id)).toEqual(["old", "mid", "new"]);
  });

  it("is empty before the first load", () => {
    expect(messagesInOrder(undefined)).toEqual([]);
    expect(messagesInOrder({ pages: [{ nextCursor: null }] })).toEqual([]);
  });
});

describe("withLastMessage", () => {
  const inbox = () => ({
    items: [
      { _id: "c1", other: { username: "arjun" }, updatedAt: "2026-01-01T09:00:00.000Z" },
      { _id: "c2", other: { username: "meera" }, updatedAt: "2026-01-01T11:00:00.000Z" },
    ],
    nextCursor: null,
  });

  it("moves the conversation that just received a message to the top", () => {
    const next = withLastMessage(inbox(), HELLO);

    expect(next.items.map((item) => item._id)).toEqual(["c1", "c2"]);
    expect(next.items[0].lastMessage).toEqual(HELLO);
    expect(next.items[0].updatedAt).toBe(HELLO.createdAt);
  });

  it("leaves the inbox alone for a conversation it does not hold", () => {
    const data = inbox();
    expect(withLastMessage(data, { ...HELLO, conversation: "c9" })).toBe(data);
  });

  it("passes data it cannot use straight through", () => {
    expect(withLastMessage(undefined, HELLO)).toBeUndefined();
    expect(withLastMessage({ items: [] }, null)).toEqual({ items: [] });
    expect(withLastMessage({ pages: [] }, HELLO)).toEqual({ pages: [] });
  });
});

describe("dayKey", () => {
  it("groups messages by calendar day", () => {
    expect(dayKey("2026-01-01T23:30:00.000Z")).toBe("2026-01-01");
    expect(dayKey("2026-01-02T00:10:00.000Z")).toBe("2026-01-02");
  });

  it("is empty for nothing or nonsense", () => {
    expect(dayKey(undefined)).toBe("");
    expect(dayKey("not a date")).toBe("");
  });
});

describe("conversationLabel", () => {
  it("names the other participant", () => {
    expect(conversationLabel({ other: { username: "arjun" } })).toBe("Conversation with @arjun");
    expect(conversationLabel({})).toBe("Conversation");
    expect(conversationLabel(null)).toBe("Conversation");
  });
});

describe("MESSAGE_MAX", () => {
  it("matches the ceiling the API enforces", () => {
    expect(MESSAGE_MAX).toBe(2000);
  });
});
