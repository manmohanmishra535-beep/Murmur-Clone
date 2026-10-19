"use strict";

const jwt = require("jsonwebtoken");
const { signToken, verifyToken, resolveSameSite } = require("../utils/token");
const { parseLimit, paginate, MAX_LIMIT } = require("../utils/pagination");
const AppError = require("../utils/AppError");

describe("token helpers", () => {
  it("signs and verifies a payload in both directions", () => {
    const token = signToken("6720f1c2a9d4b3e1f0a1b2c3");
    const payload = verifyToken(token);

    expect(payload.id).toBe("6720f1c2a9d4b3e1f0a1b2c3");
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("rejects a token signed with another secret", () => {
    const foreign = jwt.sign({ id: "1" }, "a-different-secret-that-is-long-enough");

    expect(() => verifyToken(foreign)).toThrow();
  });

  it("uses SameSite=lax outside production", () => {
    expect(resolveSameSite()).toBe("lax");
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
