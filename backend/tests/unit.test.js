"use strict";

const User = require("../models/User");
const {
  sanitizeUsername,
  usernameBase,
  availableUsername,
} = require("../services/userProvisioning");
const { parseLimit, paginate, MAX_LIMIT } = require("../utils/pagination");
const AppError = require("../utils/AppError");

describe("Clerk profile handles", () => {
  it("folds any name into the handle rule", () => {
    expect(sanitizeUsername("Priya Nair")).toBe("priya_nair");
    expect(sanitizeUsername("priya.nair")).toBe("priya_nair");
    expect(sanitizeUsername("  --Priya--  ")).toBe("priya");
    expect(sanitizeUsername("a".repeat(30))).toHaveLength(15);
    expect(sanitizeUsername("")).toBe("");
  });

  it("prefers the Clerk username, then the email, then the id", () => {
    expect(usernameBase({ username: "priya.n", email: "x@y.com", sub: "user_1" })).toBe(
      "priya_n"
    );
    expect(usernameBase({ username: "", email: "arjun@example.com", sub: "user_2" })).toBe(
      "arjun"
    );
    expect(usernameBase({ username: "a", email: "a@b.co", sub: "user_abcdef" })).toBe(
      "user_abcdef"
    );
  });

  it("adds a suffix when the handle is already taken", async () => {
    await User.create({ username: "priya", email: "priya@example.com" });

    expect(await availableUsername("priya")).toBe("priya2");
  });

  it("keeps the suffix inside the fifteen character limit", async () => {
    const base = "a".repeat(15);
    await User.create({ username: base, email: "long@example.com" });

    const available = await availableUsername(base);

    expect(available).toBe(`${"a".repeat(14)}2`);
    expect(available.length).toBeLessThanOrEqual(15);
  });
});

describe("pagination helpers", () => {
  it("defaults and clamps the limit", () => {
    expect(parseLimit(undefined)).toBe(20);
    expect(parseLimit("0")).toBe(20);
    expect(parseLimit("abc")).toBe(20);
    expect(parseLimit("5")).toBe(5);
    expect(parseLimit("500")).toBe(MAX_LIMIT);
  });

  it("returns the last kept id as the next cursor", () => {
    const docs = [{ _id: "a" }, { _id: "b" }, { _id: "c" }];

    const page = paginate(docs, 2);

    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBe("b");
    expect(page.hasMore).toBe(true);
  });

  it("returns a null cursor on the last page", () => {
    const page = paginate([{ _id: "a" }], 2);

    expect(page.nextCursor).toBeNull();
    expect(page.hasMore).toBe(false);
  });
});

describe("AppError", () => {
  it("carries a status, a code and optional fields", () => {
    const error = AppError.validation("Check the highlighted fields.", { email: "Bad." });

    expect(error.statusCode).toBe(422);
    expect(error.code).toBe("VALIDATION_FAILED");
    expect(error.fields).toEqual({ email: "Bad." });
    expect(error.isOperational).toBe(true);
  });
});
