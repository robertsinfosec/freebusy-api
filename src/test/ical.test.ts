import { describe, expect, it } from "vitest";
import { parseDuration, parseFreeBusy, unfoldLines } from "../src/ical";

const warn = () => {};

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
});

describe("parseFreeBusy", () => {
  it("parses multiple periods and parameters", () => {
    const ical = [
      "BEGIN:VFREEBUSY",
      "FREEBUSY;FBTYPE=BUSY:20251219T140000Z/20251219T150000Z,20251220T120000Z/PT30M",
      "FREEBUSY;TZID=America/New_York:20251221T090000/20251221T100000",
      "END:VFREEBUSY",
    ].join("\r\n");

    const blocks = parseFreeBusy(ical, warn);
    expect(blocks).toHaveLength(3);
    expect(blocks[0].start.toISOString()).toBe("2025-12-19T14:00:00.000Z");
    expect(blocks[0].end.toISOString()).toBe("2025-12-19T15:00:00.000Z");
    expect(blocks[1].end.getTime() - blocks[1].start.getTime()).toBe(30 * 60 * 1000);
    expect(blocks[2].start.toISOString()).toBe("2025-12-21T14:00:00.000Z");
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

    const blocks = parseFreeBusy(ical, warn);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].start.toISOString()).toBe("2025-12-24T00:00:00.000Z");
    expect(blocks[0].end.toISOString()).toBe("2025-12-25T00:00:00.000Z");
    expect(blocks[1].start.toISOString()).toBe("2025-12-25T10:00:00.000Z");
    expect(blocks[1].end.toISOString()).toBe("2025-12-25T12:00:00.000Z");
  });

  it("parses VEVENT with TZID and converts to UTC", () => {
    const ical = [
      "BEGIN:VEVENT",
      "DTSTART;TZID=America/New_York:20251224T120000",
      "DTEND;TZID=America/New_York:20251224T130000",
      "END:VEVENT",
    ].join("\r\n");

    const blocks = parseFreeBusy(ical, warn);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].start.toISOString()).toBe("2025-12-24T17:00:00.000Z");
    expect(blocks[0].end.toISOString()).toBe("2025-12-24T18:00:00.000Z");
  });

  it("parses VEVENT all-day with implicit end", () => {
    const ical = [
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20251224",
      "END:VEVENT",
    ].join("\r\n");

    const blocks = parseFreeBusy(ical, warn);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].start.toISOString()).toBe("2025-12-24T00:00:00.000Z");
    expect(blocks[0].end.toISOString()).toBe("2025-12-25T00:00:00.000Z");
  });

  it("parses VEVENT with TZID and converts to UTC", () => {
    const ical = [
      "BEGIN:VEVENT",
      "DTSTART;TZID=America/New_York:20251224T120000",
      "DTEND;TZID=America/New_York:20251224T130000",
      "END:VEVENT",
    ].join("\r\n");

    const blocks = parseFreeBusy(ical, warn);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].start.toISOString()).toBe("2025-12-24T17:00:00.000Z");
    expect(blocks[0].end.toISOString()).toBe("2025-12-24T18:00:00.000Z");
  });
});
