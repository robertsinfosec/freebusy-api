import { describe, expect, it } from "vitest";
import {
  addDaysToZonedYmd,
  buildZonedWindow,
  formatIsoInTimeZone,
  formatUtcIso,
  formatYmd,
  getZonedYmd,
  utcMillisFromZonedLocal,
} from "../src/time";

const TZ_NY = "America/New_York";
const TZ_UTC = "UTC";
const TZ_TOKYO = "Asia/Tokyo";

describe("time helpers", () => {
  it("formatYmd zero-pads month/day", () => {
    expect(formatYmd({ year: 2025, month: 1, day: 2 })).toBe("2025-01-02");
  });

  it("getZonedYmd returns owner-local date", () => {
    // 04:00Z on Jan 1 is 23:00 previous day in New York (winter).
    const ymd = getZonedYmd(new Date("2025-01-01T04:00:00.000Z"), TZ_NY);
    expect(ymd).toEqual({ year: 2024, month: 12, day: 31 });
  });

  it("addDaysToZonedYmd crosses month boundaries", () => {
    expect(addDaysToZonedYmd({ year: 2025, month: 1, day: 31 }, 1)).toEqual({ year: 2025, month: 2, day: 1 });
  });

  it("utcMillisFromZonedLocal converts local midnight to correct UTC instant", () => {
    const ms = utcMillisFromZonedLocal({ year: 2025, month: 1, day: 1, hour: 0, minute: 0 }, TZ_NY);
    expect(new Date(ms).toISOString()).toBe("2025-01-01T05:00:00.000Z");
  });

  it("utcMillisFromZonedLocal reflects DST offset changes", () => {
    // 2025-03-10 is after US DST start (EDT -04:00)
    const ms = utcMillisFromZonedLocal({ year: 2025, month: 3, day: 10, hour: 0, minute: 0 }, TZ_NY);
    expect(new Date(ms).toISOString()).toBe("2025-03-10T04:00:00.000Z");
  });

  it("formatIsoInTimeZone includes local time and offset", () => {
    const d = new Date("2025-01-01T05:00:00.123Z");
    const iso = formatIsoInTimeZone(d, TZ_NY);
    expect(iso.startsWith("2025-01-01T00:00:00.123")).toBe(true);
    expect(iso.endsWith("-05:00")).toBe(true);
  });

  it("formatIsoInTimeZone uses +00:00 for UTC", () => {
    const d = new Date("2025-01-01T00:00:00.000Z");
    const iso = formatIsoInTimeZone(d, TZ_UTC);
    expect(iso.startsWith("2025-01-01T00:00:00.000")).toBe(true);
    expect(iso.endsWith("+00:00")).toBe(true);
  });

  it("formatIsoInTimeZone uses positive offsets for zones ahead of UTC", () => {
    const d = new Date("2025-01-01T00:00:00.000Z");
    const iso = formatIsoInTimeZone(d, TZ_TOKYO);
    expect(iso.endsWith("+09:00")).toBe(true);
  });

  it("formatUtcIso formats Dates and millis as UTC ISO", () => {
    const d = new Date("2025-01-01T00:00:00.000Z");
    expect(formatUtcIso(d)).toBe("2025-01-01T00:00:00.000Z");
    expect(formatUtcIso(d.getTime())).toBe("2025-01-01T00:00:00.000Z");
  });

  it("buildZonedWindow returns inclusive end-of-day window in owner timezone", () => {
    const { windowStart, windowEnd } = buildZonedWindow(1, new Date("2025-01-01T12:00:00.000Z"), TZ_NY);

    // Start is local midnight Jan 1 => 05:00Z.
    expect(windowStart.toISOString()).toBe("2025-01-01T05:00:00.000Z");
    // End is local 23:59:59.999 on Jan 7 => 04:59:59.999Z on Jan 8.
    expect(windowEnd.toISOString()).toBe("2025-01-08T04:59:59.999Z");
  });

  it("handles ambiguous local times around DST fall-back", () => {
    // 2025-11-02 in America/New_York has an ambiguous 01:30 local time.
    // We accept either possible UTC instant; the key is that the conversion is stable and DST-safe.
    const ms = utcMillisFromZonedLocal({ year: 2025, month: 11, day: 2, hour: 1, minute: 30 }, TZ_NY);
    const iso = new Date(ms).toISOString();
    expect(["2025-11-02T05:30:00.000Z", "2025-11-02T06:30:00.000Z"]).toContain(iso);
  });

  it("supports explicit seconds and milliseconds", () => {
    const ms = utcMillisFromZonedLocal({ year: 2025, month: 1, day: 1, hour: 0, minute: 0, second: 1, millisecond: 2 }, TZ_UTC);
    expect(new Date(ms).toISOString()).toBe("2025-01-01T00:00:01.002Z");
  });

  it("handles nonexistent local times around DST spring-forward", () => {
    // 2025-03-09 in America/New_York skips 02:00 -> 03:00.
    const ms = utcMillisFromZonedLocal({ year: 2025, month: 3, day: 9, hour: 2, minute: 30 }, TZ_NY);
    const iso = new Date(ms).toISOString();
    // The conversion should be deterministic and finite; the exact resolution choice is implementation-dependent.
    expect(typeof ms).toBe("number");
    expect(Number.isFinite(ms)).toBe(true);
    expect(iso.endsWith("Z")).toBe(true);
  });
});
