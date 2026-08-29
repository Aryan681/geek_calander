import { describe, expect, it } from "vitest";
import { calendarDateKey, formatDate, monthBounds } from "./dates";
describe("date utilities", () => {
  it("returns month bounds", () =>
    expect(monthBounds(new Date(2026, 7, 14))).toEqual({
      from: "2026-08-01",
      to: "2026-09-01",
    }));
  it("handles invalid dates", () =>
    expect(formatDate("not-a-date")).toBe("Date unavailable"));
  it.each([
    ["2026-08-01T00:00:00.000Z", "2026-08-01"],
    ["2026-08-02T23:59:59.999Z", "2026-08-02"],
    ["2026-08-31T12:00:00.000Z", "2026-08-31"],
    ["2026-09-01T00:00:00.000Z", "2026-09-01"],
    ["2026-02-01T00:00:00.000Z", "2026-02-01"],
  ])("keeps an event's calendar date from its ISO timestamp", (value, key) =>
    expect(calendarDateKey(value)).toBe(key),
  );
  it("uses local calendar components for calendar cells", () =>
    expect(calendarDateKey(new Date(2026, 7, 1))).toBe("2026-08-01"));
  it("does not create a key for malformed event dates", () =>
    expect(calendarDateKey("not-a-date")).toBeNull());
});
