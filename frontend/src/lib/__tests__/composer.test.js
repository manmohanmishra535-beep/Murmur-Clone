import {
  counterTone,
  isPostable,
  POST_MAX,
  remainingCharacters,
  ringOffset,
  RING_CIRCUMFERENCE,
} from "../composer";

describe("remainingCharacters", () => {
  it("counts down from 280", () => {
    expect(remainingCharacters("")).toBe(280);
    expect(remainingCharacters("abc")).toBe(277);
    expect(remainingCharacters("x".repeat(POST_MAX))).toBe(0);
    expect(remainingCharacters("x".repeat(POST_MAX + 12))).toBe(-12);
  });
});

describe("counterTone", () => {
  it("turns amber at 20 and red below 0", () => {
    expect(counterTone(21)).toBe("normal");
    expect(counterTone(20)).toBe("warn");
    expect(counterTone(1)).toBe("warn");
    expect(counterTone(0)).toBe("warn");
    expect(counterTone(-1)).toBe("danger");
  });
});

describe("ringOffset", () => {
  it("is empty at full and full at zero", () => {
    expect(ringOffset(280)).toBe(0);
    expect(ringOffset(0)).toBeCloseTo(RING_CIRCUMFERENCE);
    expect(ringOffset(140)).toBeCloseTo(RING_CIRCUMFERENCE / 2);
  });

  it("never goes negative when the draft is over the limit", () => {
    expect(ringOffset(-40)).toBeCloseTo(RING_CIRCUMFERENCE);
  });
});

describe("isPostable", () => {
  it("needs trimmed content and a length under the limit", () => {
    expect(isPostable("")).toBe(false);
    expect(isPostable("   ")).toBe(false);
    expect(isPostable("hello")).toBe(true);
    expect(isPostable("x".repeat(POST_MAX))).toBe(true);
    expect(isPostable("x".repeat(POST_MAX + 1))).toBe(false);
  });

  it("accepts an image with empty text, like the API does", () => {
    expect(isPostable("", 1)).toBe(true);
    expect(isPostable("   ", 2)).toBe(true);
    expect(isPostable("a caption", 1)).toBe(true);
  });

  it("stays closed when there are neither images nor text", () => {
    expect(isPostable("", 0)).toBe(false);
    expect(isPostable(undefined)).toBe(false);
  });

  it("refuses a draft that is over the limit even with an image", () => {
    expect(isPostable("x".repeat(POST_MAX + 1), 1)).toBe(false);
  });
});
