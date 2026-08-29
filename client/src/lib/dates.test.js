import { describe, expect, it } from "vitest";
import { formatDate, monthBounds } from "./dates";
describe("date utilities", () => {
  it("returns month bounds", () =>
    expect(monthBounds(new Date(2026, 7, 14))).toEqual({
      from: "2026-08-01",
      to: "2026-09-01",
    }));
  it("handles invalid dates", () =>
    expect(formatDate("not-a-date")).toBe("Date unavailable"));
});
