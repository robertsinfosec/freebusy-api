import { describe, expect, it } from "vitest";
import { buildWindowV2, clipAndMerge, toResponseBusy } from "../src/freebusy";

const TZ = "America/New_York";

describe("buildWindowV2", () => {
  it("anchors dates in owner TZ and returns UTC [start,end) instants", () => {
    const now = new Date("2025-01-01T12:00:45Z");
    const window = buildWindowV2(4, now, TZ);
    expect(window.startDate).toBe("2025-01-01");
    expect(window.endDateInclusive).toBe("2025-01-28");
    // 2025-01-01 is EST (UTC-05:00): local midnight is 05:00Z.
    expect(new Date(window.startMsUtc).toISOString()).toBe("2025-01-01T05:00:00.000Z");
    // Exclusive end is local midnight on 2025-01-29, which is 05:00Z.
    expect(new Date(window.endMsUtcExclusive).toISOString()).toBe("2025-01-29T05:00:00.000Z");
  });
});

describe("clipAndMerge", () => {
  const windowStartMsUtc = new Date("2025-01-01T00:00:00Z").getTime();
  const windowEndMsUtcExclusive = new Date("2025-01-29T00:00:00Z").getTime();

  it("clips to window and merges overlaps/adjacent", () => {
    const blocks = [
      { startMsUtc: new Date("2024-12-31T23:30:00Z").getTime(), endMsUtc: new Date("2025-01-01T00:30:00Z").getTime(), kind: "time" as const },
      { startMsUtc: new Date("2025-01-01T10:00:00Z").getTime(), endMsUtc: new Date("2025-01-01T11:00:00Z").getTime(), kind: "time" as const },
      { startMsUtc: new Date("2025-01-01T11:00:00Z").getTime(), endMsUtc: new Date("2025-01-01T12:00:00Z").getTime(), kind: "time" as const },
      { startMsUtc: new Date("2025-02-01T12:00:00Z").getTime(), endMsUtc: new Date("2025-02-01T13:00:00Z").getTime(), kind: "time" as const },
    ];

    const merged = clipAndMerge(blocks, windowStartMsUtc, windowEndMsUtcExclusive);
    expect(merged).toHaveLength(2);
    expect(new Date(merged[0].startMsUtc).toISOString()).toBe("2025-01-01T00:00:00.000Z");
    expect(new Date(merged[0].endMsUtc).toISOString()).toBe("2025-01-01T00:30:00.000Z");
    expect(new Date(merged[1].startMsUtc).toISOString()).toBe("2025-01-01T10:00:00.000Z");
    expect(new Date(merged[1].endMsUtc).toISOString()).toBe("2025-01-01T12:00:00.000Z");
  });
});

describe("toResponseBusy", () => {
  it("serializes UTC instants with trailing Z", () => {
    const blocks = [{ startMsUtc: new Date("2025-01-01T10:00:00Z").getTime(), endMsUtc: new Date("2025-01-01T11:00:00Z").getTime(), kind: "time" as const }];
    const result = toResponseBusy(blocks);
    expect(result[0].startUtc).toBe("2025-01-01T10:00:00.000Z");
    expect(result[0].endUtc).toBe("2025-01-01T11:00:00.000Z");
    expect(result[0].kind).toBe("time");
  });
});
