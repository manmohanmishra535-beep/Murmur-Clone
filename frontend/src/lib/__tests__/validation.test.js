import { validateBio, validateDisplayName, validateProfile } from "../validation";

describe("profile fields", () => {
  it("caps display name at 50 and bio at 160", () => {
    expect(validateDisplayName("x".repeat(50))).toBe("");
    expect(validateDisplayName("x".repeat(51))).toMatch(/50/);
    expect(validateBio("x".repeat(160))).toBe("");
    expect(validateBio("x".repeat(161))).toMatch(/160/);
  });
});

describe("profile payload", () => {
  it("returns only the fields that failed", () => {
    expect(validateProfile({ displayName: "Priya Nair", bio: "Chai." })).toEqual({});

    const errors = validateProfile({ displayName: "x".repeat(51), bio: "x".repeat(161) });
    expect(Object.keys(errors).sort()).toEqual(["bio", "displayName"]);
  });

  it("accepts an empty profile", () => {
    expect(validateProfile({ displayName: "", bio: "" })).toEqual({});
  });
});
