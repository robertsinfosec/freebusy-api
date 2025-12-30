import { describe, expect, it } from "vitest";
import { parseDuration, parseFreeBusy, unfoldLines } from "../src/ical";

const warn = () => {};
const OWNER_TZ = "America/New_York";

describe("unfoldLines", () => {
  it("joins folded ical lines", () => {
    const input = "BEGIN:VFREEBUSY\r\nFREEBUSY:20251219T140000Z/20251219T150000Z,\r\n 20251220T090000Z/20251220T093000Z\r\nEND:VFREEBUSY";
    const unfolded = unfoldLines(input);
    expect(unfolded).toEqual([
      "BEGIN:VFREEBUSY",
      "FREEBUSY:20251219T140000Z/20251219T150000Z,20251220T090000Z/20251220T093000Z",
      "END:VFREEBUSY",
    ]);
  });
});

describe("parseDuration", () => {
  it("parses hours and minutes", () => {
    expect(parseDuration("PT1H30M")).toBe(90 * 60 * 1000);
  });

  it("parses days", () => {
    expect(parseDuration("P1DT1H")).toBe(25 * 60 * 60 * 1000);
  });

  it("returns NaN for unparseable duration strings", () => {
    expect(Number.isNaN(parseDuration("not-a-duration"))).toBe(true);
  });

  it("caps extremely long durations", () => {
    // Cap is 366 days.
    expect(parseDuration("P9999D")).toBe(366 * 24 * 60 * 60 * 1000);
  });

  it("returns NaN for unsupported week-based durations", () => {
    expect(Number.isNaN(parseDuration("P1W"))).toBe(true);
  });

  it("parses seconds", () => {
    expect(parseDuration("PT30S")).toBe(30 * 1000);
  });
});

describe("parseFreeBusy", () => {
  it("parses multiple periods and parameters", () => {
    const ical = [
      "BEGIN:VFREEBUSY",
      "FREEBUSY;FBTYPE=BUSY:20251219T140000Z/20251219T150000Z,20251220T120000Z/PT30M",
      "FREEBUSY;TZID=America/New_York:20251221T090000/20251221T100000",
      "END:VFREEBUSY",
    ].join("\r\n");

    const blocks = parseFreeBusy(ical, warn, OWNER_TZ);
    expect(blocks).toHaveLength(3);
    expect(new Date(blocks[0].startMsUtc).toISOString()).toBe("2025-12-19T14:00:00.000Z");
    expect(new Date(blocks[0].endMsUtc).toISOString()).toBe("2025-12-19T15:00:00.000Z");
    expect(blocks[0].kind).toBe("time");
    expect(blocks[1].endMsUtc - blocks[1].startMsUtc).toBe(30 * 60 * 1000);
    // 09:00 in America/New_York on 2025-12-21 is 14:00Z (EST).
    expect(new Date(blocks[2].startMsUtc).toISOString()).toBe("2025-12-21T14:00:00.000Z");
  });

  it("ignores blocks outside VFREEBUSY", () => {
    const ical = [
      "BEGIN:VEVENT",
      "FREEBUSY:20251219T140000Z/20251219T150000Z",
      "END:VEVENT",
    ].join("\n");

    const blocks = parseFreeBusy(ical, warn);
    expect(blocks).toHaveLength(0);
  });

  it("parses VEVENT all-day and duration fallbacks", () => {
    const ical = [
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20251224",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "DTSTART:20251225T100000Z",
      "DURATION:PT2H",
      "END:VEVENT",
    ].join("\r\n");

    const blocks = parseFreeBusy(ical, warn, OWNER_TZ);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].kind).toBe("allDay");
    expect(new Date(blocks[0].startMsUtc).toISOString()).toBe("2025-12-24T05:00:00.000Z");
    expect(new Date(blocks[0].endMsUtc).toISOString()).toBe("2025-12-25T05:00:00.000Z");
    expect(blocks[1].kind).toBe("time");
    expect(new Date(blocks[1].startMsUtc).toISOString()).toBe("2025-12-25T10:00:00.000Z");
    expect(new Date(blocks[1].endMsUtc).toISOString()).toBe("2025-12-25T12:00:00.000Z");
  });

  it("parses VEVENT with TZID and converts to UTC", () => {
    const ical = [
      "BEGIN:VEVENT",
      "DTSTART;TZID=America/New_York:20251224T120000",
      "DTEND;TZID=America/New_York:20251224T130000",
      "END:VEVENT",
    ].join("\r\n");

    const blocks = parseFreeBusy(ical, warn, OWNER_TZ);
    expect(blocks).toHaveLength(1);
    expect(new Date(blocks[0].startMsUtc).toISOString()).toBe("2025-12-24T17:00:00.000Z");
    expect(new Date(blocks[0].endMsUtc).toISOString()).toBe("2025-12-24T18:00:00.000Z");
  });

  it("parses VEVENT all-day with implicit end", () => {
    const ical = [
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20251224",
      "END:VEVENT",
    ].join("\r\n");

    const blocks = parseFreeBusy(ical, warn, OWNER_TZ);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe("allDay");
    expect(new Date(blocks[0].startMsUtc).toISOString()).toBe("2025-12-24T05:00:00.000Z");
    expect(new Date(blocks[0].endMsUtc).toISOString()).toBe("2025-12-25T05:00:00.000Z");
  });

  it("parses VEVENT all-day (VALUE=DATE) using default timezone when TZID is missing", () => {
    const ical = [
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20260101",
      "END:VEVENT",
    ].join("\r\n");

    const blocks = parseFreeBusy(ical, warn, OWNER_TZ);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe("allDay");
    // Local midnight ET is 05:00Z in winter.
    expect(new Date(blocks[0].startMsUtc).toISOString()).toBe("2026-01-01T05:00:00.000Z");
    // All-day implicit end is next local midnight (half-open interval).
    expect(new Date(blocks[0].endMsUtc).toISOString()).toBe("2026-01-02T05:00:00.000Z");
  });

  it("drops all-day VEVENTs when no owner timezone is provided", () => {
    const ical = [
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20260101",
      "END:VEVENT",
    ].join("\r\n");

    const blocks = parseFreeBusy(ical, warn);
    expect(blocks).toHaveLength(0);
  });

  it("warns and drops date-only conversions when owner timezone is invalid", () => {
    const warnings: string[] = [];
    const warnCapture = (m: string) => warnings.push(m);

    const ical = [
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20260101",
      "END:VEVENT",
    ].join("\r\n");

    const blocks = parseFreeBusy(ical, warnCapture, "Not/A_TimeZone");
    expect(blocks).toHaveLength(0);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("parses numeric offset timestamps (±HHMM)", () => {
    const ical = [
      "BEGIN:VEVENT",
      "DTSTART:20260101T000000-0500",
      "DTEND:20260101T010000-0500",
      "END:VEVENT",
    ].join("\r\n");

    const blocks = parseFreeBusy(ical, warn, OWNER_TZ);
    expect(blocks).toHaveLength(1);
    expect(new Date(blocks[0].startMsUtc).toISOString()).toBe("2026-01-01T05:00:00.000Z");
    expect(new Date(blocks[0].endMsUtc).toISOString()).toBe("2026-01-01T06:00:00.000Z");
  });

  it("treats floating DATE-TIME as owner timezone", () => {
    const ical = [
      "BEGIN:VEVENT",
      "DTSTART:20260105T100000",
      "DTEND:20260105T110000",
      "END:VEVENT",
    ].join("\r\n");

    const blocks = parseFreeBusy(ical, warn, OWNER_TZ);
    expect(blocks).toHaveLength(1);
    // 10:00 in America/New_York (winter) => 15:00Z.
    expect(new Date(blocks[0].startMsUtc).toISOString()).toBe("2026-01-05T15:00:00.000Z");
    expect(new Date(blocks[0].endMsUtc).toISOString()).toBe("2026-01-05T16:00:00.000Z");
  });

  it("warns and falls back to UTC when floating DATE-TIME timezone conversion fails", () => {
    const warnings: string[] = [];
    const warnCapture = (m: string) => warnings.push(m);

    const ical = [
      "BEGIN:VEVENT",
      "DTSTART:20260105T100000",
      "DTEND:20260105T110000",
      "END:VEVENT",
    ].join("\r\n");

    const blocks = parseFreeBusy(ical, warnCapture, "Not/A_TimeZone");
    expect(blocks).toHaveLength(1);
    // Falls back to treating the floating time as UTC.
    expect(new Date(blocks[0].startMsUtc).toISOString()).toBe("2026-01-05T10:00:00.000Z");
    expect(new Date(blocks[0].endMsUtc).toISOString()).toBe("2026-01-05T11:00:00.000Z");
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("uses a 1-hour default when VEVENT has no DTEND or DURATION", () => {
    const ical = [
      "BEGIN:VEVENT",
      "DTSTART:20251225T100000Z",
      "END:VEVENT",
    ].join("\r\n");

    const blocks = parseFreeBusy(ical, warn, OWNER_TZ);
    expect(blocks).toHaveLength(1);
    expect(new Date(blocks[0].startMsUtc).toISOString()).toBe("2025-12-25T10:00:00.000Z");
    expect(new Date(blocks[0].endMsUtc).toISOString()).toBe("2025-12-25T11:00:00.000Z");
  });

  it("produces different UTC instants across DST for same local time", () => {
    const ical = [
      "BEGIN:VEVENT",
      "DTSTART;TZID=America/New_York:20260303T100000",
      "DTEND;TZID=America/New_York:20260303T110000",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "DTSTART;TZID=America/New_York:20260310T100000",
      "DTEND;TZID=America/New_York:20260310T110000",
      "END:VEVENT",
    ].join("\r\n");

    const blocks = parseFreeBusy(ical, warn, OWNER_TZ);
    expect(blocks).toHaveLength(2);
    // Before DST (EST -05): 10:00 => 15:00Z
    expect(new Date(blocks[0].startMsUtc).toISOString()).toBe("2026-03-03T15:00:00.000Z");
    // After DST (EDT -04): 10:00 => 14:00Z
    expect(new Date(blocks[1].startMsUtc).toISOString()).toBe("2026-03-10T14:00:00.000Z");
  });

  it("ignores invalid numeric offset timestamps", () => {
    const ical = [
      "BEGIN:VEVENT",
      "DTSTART:20260101T000000+9999",
      "DTEND:20260101T010000+9999",
      "END:VEVENT",
    ].join("\r\n");

    const blocks = parseFreeBusy(ical, warn, OWNER_TZ);
    expect(blocks).toHaveLength(0);
  });

  it("throws when TZID is provided but unsupported", () => {
    const ical = [
      "BEGIN:VEVENT",
      "DTSTART;TZID=Bad/Zone:20260101T100000",
      "DTEND;TZID=Bad/Zone:20260101T110000",
      "END:VEVENT",
    ].join("\r\n");

    expect(() => parseFreeBusy(ical, warn, OWNER_TZ)).toThrow(/unsupported_tzid/);
  });

  it("ignores DTSTART/DTEND lines with unparseable date values", () => {
    const ical = [
      "BEGIN:VEVENT",
      "UID:bad-date",
      "DTSTART;TZID=America/New_York:NOTADATE",
      "DTEND:ALSOBAD",
      "END:VEVENT",
    ].join("\n");

    const blocks = parseFreeBusy(ical, warn, OWNER_TZ);
    expect(blocks).toHaveLength(0);
  });
});
