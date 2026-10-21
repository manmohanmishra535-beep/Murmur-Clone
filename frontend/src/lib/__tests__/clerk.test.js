import {
  clerkErrorMessage,
  hasPasswordPolicy,
  isIdentifierNotFound,
  passwordHint,
  passwordPolicy,
  validatePassword,
} from "../clerk";

describe("clerkErrorMessage", () => {
  it("prefers Clerk's long message", () => {
    const error = { errors: [{ message: "Short.", longMessage: "A longer explanation." }] };
    expect(clerkErrorMessage(error)).toBe("A longer explanation.");
  });

  it("falls back to the short message", () => {
    expect(clerkErrorMessage({ errors: [{ message: "Short." }] })).toBe("Short.");
  });

  it("falls back to Error.message", () => {
    expect(clerkErrorMessage(new Error("Network down."))).toBe("Network down.");
  });

  it("uses the caller's fallback when nothing is readable", () => {
    expect(clerkErrorMessage(undefined, "Try again.")).toBe("Try again.");
  });
});

describe("isIdentifierNotFound", () => {
  it("is true only for form_identifier_not_found", () => {
    expect(
      isIdentifierNotFound({ errors: [{ code: "form_identifier_not_found" }] })
    ).toBe(true);
    expect(isIdentifierNotFound({ errors: [{ code: "form_password_incorrect" }] })).toBe(
      false
    );
    expect(isIdentifierNotFound(undefined)).toBe(false);
  });
});

describe("password policy", () => {
  const clerkWith = (min_length, max_length) => ({
    __internal_environment: {
      userSettings: { passwordSettings: { min_length, max_length } },
    },
  });

  it("reads the instance's limits", () => {
    expect(passwordPolicy(clerkWith(15, 72))).toEqual({ minLength: 15, maxLength: 72 });
  });

  it("falls back before Clerk loads", () => {
    expect(passwordPolicy(null)).toEqual({ minLength: 8, maxLength: 72 });
  });

  it("knows when the real policy is available", () => {
    expect(hasPasswordPolicy(clerkWith(15, 72))).toBe(true);
    expect(hasPasswordPolicy(null)).toBe(false);
  });

  it("writes the hint from the policy", () => {
    expect(passwordHint({ minLength: 15 })).toBe("At least 15 characters.");
  });

  it("rejects a password under the minimum", () => {
    expect(validatePassword("short", { minLength: 15, maxLength: 72 })).toBe(
      "Use at least 15 characters."
    );
    expect(validatePassword("123456789012345", { minLength: 15, maxLength: 72 })).toBe("");
  });

  it("rejects a password over the maximum", () => {
    expect(validatePassword("x".repeat(73), { minLength: 8, maxLength: 72 })).toBe(
      "Keep your password to 72 characters or fewer."
    );
  });
});
