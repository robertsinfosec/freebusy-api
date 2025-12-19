import { describe, expect, it } from "vitest";
import { buildWindow, clipAndMerge, toResponseBlocks } from "../src/freebusy";

describe("buildWindow", () => {
  it("rounds down to the nearest minute and extends 28 days", () => {
    const now = new Date("2025-01-01T12:00:45Z");
    const { windowStart, windowEnd } = buildWindow(now);
    expect(windowStart.toISOString()).toBe("2025-01-01T12:00:00.000Z");
    expect(windowEnd.toISOString()).toBe("2025-01-29T12:00:00.000Z");
  });
});

describe("clipAndMerge", () => {
  const windowStart = new Date("2025-01-01T00:00:00Z");
  const windowEnd = new Date("2025-01-29T00:00:00Z");

  it("clips to window and merges overlaps/adjacent", () => {
    const blocks = [
      { start: new Date("2024-12-31T23:30:00Z"), end: new Date("2025-01-01T00:30:00Z") },
      { start: new Date("2025-01-01T10:00:00Z"), end: new Date("2025-01-01T11:00:00Z") },
      { start: new Date("2025-01-01T11:00:00Z"), end: new Date("2025-01-01T12:00:00Z") },
      { start: new Date("2025-02-01T12:00:00Z"), end: new Date("2025-02-01T13:00:00Z") },
    ];

    const merged = clipAndMerge(blocks, windowStart, windowEnd);
    expect(merged).toHaveLength(2);
    expect(merged[0].start.toISOString()).toBe("2025-01-01T00:00:00.000Z");
    expect(merged[0].end.toISOString()).toBe("2025-01-01T00:30:00.000Z");
    expect(merged[1].start.toISOString()).toBe("2025-01-01T10:00:00.000Z");
    expect(merged[1].end.toISOString()).toBe("2025-01-01T12:00:00.000Z");
  });
});

describe("toResponseBlocks", () => {
  it("serializes dates to ISO strings", () => {
    const blocks = [
      { start: new Date("2025-01-01T10:00:00Z"), end: new Date("2025-01-01T11:00:00Z") },
    ];
    const result = toResponseBlocks(blocks);
    expect(result[0].start).toBe("2025-01-01T10:00:00.000Z");
    expect(result[0].end).toBe("2025-01-01T11:00:00.000Z");
  });
});
