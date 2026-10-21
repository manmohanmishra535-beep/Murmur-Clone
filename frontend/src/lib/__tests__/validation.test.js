import {
  validateBio,
  validateDisplayName,
  validateEmail,
  validateForgotPassword,
  validateLogin,
  validatePassword,
  validateProfile,
  validateRegister,
  validateResetPassword,
  validateUsername,
} from "../validation";

describe("username", () => {
  it("accepts 3 to 15 letters, numbers and underscores", () => {
    expect(validateUsername("priya")).toBe("");
    expect(validateUsername("priya_nair")).toBe("");
    expect(validateUsername("a_1")).toBe("");
    expect(validateUsername("a".repeat(15))).toBe("");
  });

  it("rejects empty, short, long and punctuated handles", () => {
    expect(validateUsername("")).toMatch(/Pick a username/);
    expect(validateUsername("ab")).toMatch(/3 to 15/);
    expect(validateUsername("a".repeat(16))).toMatch(/3 to 15/);
    expect(validateUsername("priya!")).toMatch(/Letters, numbers/);
  });

  it("normalises case before checking", () => {
    expect(validateUsername("  Priya_Nair ")).toBe("");
  });
});

describe("email and password", () => {
  it("asks for a full address", () => {
    expect(validateEmail("")).toMatch(/Enter your email/);
    expect(validateEmail("priya@")).toMatch(/full address/);
    expect(validateEmail("priya@example.com")).toBe("");
  });

  it("enforces eight characters", () => {
    expect(validatePassword("")).toMatch(/Choose a password/);
    expect(validatePassword("short")).toMatch(/8 characters/);
    expect(validatePassword("password123")).toBe("");
  });
});

describe("profile fields", () => {
  it("caps display name at 50 and bio at 160", () => {
    expect(validateDisplayName("x".repeat(50))).toBe("");
    expect(validateDisplayName("x".repeat(51))).toMatch(/50/);
    expect(validateBio("x".repeat(160))).toBe("");
    expect(validateBio("x".repeat(161))).toMatch(/160/);
  });
});

describe("form payloads", () => {
  it("returns only the fields that failed", () => {
    expect(validateRegister({ username: "priya", email: "priya@example.com", password: "password123" })).toEqual({});

    const errors = validateRegister({ username: "p!", email: "nope", password: "short" });
    expect(Object.keys(errors).sort()).toEqual(["email", "password", "username"]);
  });

  it("validates login without touching username", () => {
    const errors = validateLogin({ email: "nope", password: "" });
    expect(Object.keys(errors).sort()).toEqual(["email", "password"]);
  });

  it("validates a profile edit", () => {
    expect(validateProfile({ displayName: "Priya Nair", bio: "Chai." })).toEqual({});
    expect(validateProfile({ displayName: "", bio: "x".repeat(161) })).toHaveProperty("bio");
  });

  it("asks only for an email when resetting", () => {
    expect(validateForgotPassword({ email: "priya@example.com" })).toEqual({});
    expect(validateForgotPassword({ email: "nope" })).toHaveProperty("email");
  });

  it("requires two matching passwords when choosing a new one", () => {
    expect(validateResetPassword({ password: "password123", confirm: "password123" })).toEqual({});

    expect(validateResetPassword({ password: "password123", confirm: "password124" })).toEqual({
      confirm: "The two passwords do not match.",
    });

    // An empty form complains once, not twice.
    expect(Object.keys(validateResetPassword({ password: "", confirm: "" }))).toEqual(["password"]);
    expect(validateResetPassword({ password: "short", confirm: "short" })).toHaveProperty("password");
  });
});
