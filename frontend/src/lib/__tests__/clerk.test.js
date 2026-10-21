import { clerkErrorMessage, isIdentifierNotFound } from "../clerk";

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
