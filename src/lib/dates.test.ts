import { describe, expect, it } from "vitest";
import {
  addDays,
  enumerateDateWindow,
  formatDataAge,
  formatDuration,
  isIsoDate,
} from "@/lib/dates";

describe("dates", () => {
  it("adds days across month boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("validates real ISO dates", () => {
    expect(isIsoDate("2026-11-15")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("15-11-2026")).toBe(false);
  });

  it("builds a seven day flexible window", () => {
    const dates = enumerateDateWindow("2026-11-15", 3);
    expect(dates).toHaveLength(7);
    expect(dates[0]).toBe("2026-11-12");
    expect(dates[6]).toBe("2026-11-18");
  });

  it("formats durations and data age in Spanish", () => {
    expect(formatDuration(750)).toBe("12 h 30 min");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(120)).toBe("2 h");
    expect(formatDataAge(3)).toBe("hace 3 h");
    expect(formatDataAge(26)).toBe("hace 1 día");
    expect(formatDataAge(72)).toBe("hace 3 días");
  });
});
