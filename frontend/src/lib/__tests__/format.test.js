import { compactNumber, joinedDate, relativeTime } from "../format";

describe("compactNumber", () => {
  it("keeps thousands separators below 10,000", () => {
    expect(compactNumber(0)).toBe("0");
    expect(compactNumber(42)).toBe("42");
    expect(compactNumber(1284)).toBe("1,284");
    expect(compactNumber(9999)).toBe("9,999");
  });

  it("uses compact units above 9,999", () => {
    expect(compactNumber(10000)).toBe("10K");
    expect(compactNumber(10200)).toBe("10.2K");
    expect(compactNumber(318000)).toBe("318K");
    expect(compactNumber(1_250_000)).toBe("1.3M");
  });
});

describe("relativeTime", () => {
  const now = new Date("2026-10-19T12:00:00.000Z").getTime();

  it("counts up through now, minutes, hours and days", () => {
    expect(relativeTime("2026-10-19T11:59:45.000Z", now)).toBe("now");
    expect(relativeTime("2026-10-19T11:55:00.000Z", now)).toBe("5m");
    expect(relativeTime("2026-10-19T10:00:00.000Z", now)).toBe("2h");
    expect(relativeTime("2026-10-16T12:00:00.000Z", now)).toBe("3d");
  });

  it("falls back to a calendar date after a week", () => {
    expect(relativeTime("2026-03-04T12:00:00.000Z", now)).toBe("Mar 4");
    expect(relativeTime("2024-03-04T12:00:00.000Z", now)).toBe("Mar 4, 2024");
  });
});

describe("joinedDate", () => {
  it("renders the profile header line", () => {
    expect(joinedDate("2024-03-04T12:00:00.000Z")).toBe("Joined March 2024");
  });
});
