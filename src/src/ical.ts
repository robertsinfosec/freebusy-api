import { BusyBlock } from "./freebusy";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DURATION_MS = 366 * DAY_MS; // Cap excessive durations to avoid pathological values.

/**
 * RFC5545 line unfolding: joins lines beginning with space/tab to the previous line.
 */
export function unfoldLines(raw: string): string[] {
  const lines = raw.split(/\r?\n/);
  const unfolded: string[] = [];
  for (const line of lines) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
      if (unfolded.length === 0) continue;
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line.trimEnd());
    }
  }
  return unfolded;
}

function getOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const lookup = Object.fromEntries(
    parts
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, parseInt(p.value, 10)])
  ) as Record<string, number>;

  const asUTC = Date.UTC(
    lookup.year,
    (lookup.month ?? 1) - 1,
    lookup.day ?? 1,
    lookup.hour ?? 0,
    lookup.minute ?? 0,
    lookup.second ?? 0
  );

  return (asUTC - date.getTime()) / 60000;
}

type Ymd = { year: number; month: number; day: number };

function parseYmd(value: string): Ymd | null {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) return null;
  const [, y, mo, d] = match;
  return { year: Number(y), month: Number(mo), day: Number(d) };
}

function ymdToString(ymd: Ymd): string {
  const mm = String(ymd.month).padStart(2, "0");
  const dd = String(ymd.day).padStart(2, "0");
  return `${ymd.year}${mm}${dd}`;
}

function addDaysToYmd(ymd: Ymd, days: number): Ymd {
  const d = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day));
  d.setUTCDate(d.getUTCDate() + days);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function parseICalDate(
  value: string,
  tzid: string | undefined,
  isDateOnly: boolean,
  warn: (msg: string) => void,
  defaultTimeZone?: string
): Date | null {
  const dateOnly = isDateOnly || !value.includes("T");

  const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!match) return null;
  const [, y, mo, d, h = "00", mi = "00", s = "00", z] = match;

  const year = Number(y);
  const month = Number(mo) - 1;
  const day = Number(d);
  const hour = dateOnly ? 0 : Number(h);
  const minute = dateOnly ? 0 : Number(mi);
  const second = dateOnly ? 0 : Number(s);

  if (z) {
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }

  const effectiveTzid = tzid ?? (dateOnly ? defaultTimeZone : undefined);
  if (effectiveTzid) {
    try {
      const utcMillis = Date.UTC(year, month, day, hour, minute, second);
      const offsetMinutes = getOffsetMinutes(new Date(utcMillis), effectiveTzid);
      return new Date(utcMillis - offsetMinutes * 60_000);
    } catch (err) {
      warn(`Failed TZ conversion for ${effectiveTzid}: ${String(err)}`);
    }
  }

  // Fallback: assume UTC when no timezone info.
  return new Date(Date.UTC(year, month, day, hour, minute, second));
}

/**
 * Parses an RFC5545 duration (subset) and returns milliseconds, capped for safety.
 */
export function parseDuration(value: string): number {
  const match = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match) return NaN;
  const [, d, h, m, s] = match;
  const days = d ? Number(d) : 0;
  const hours = h ? Number(h) : 0;
  const minutes = m ? Number(m) : 0;
  const seconds = s ? Number(s) : 0;
  const totalMs = (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
  return Math.min(totalMs, MAX_DURATION_MS);
}

function parseFreeBusyPeriod(part: string, tzid: string | undefined, warn: (msg: string) => void): BusyBlock | null {
  const [startRaw, endOrDurationRaw] = part.split("/");
  if (!startRaw || !endOrDurationRaw) return null;

  const start = parseICalDate(startRaw, tzid, false, warn);
  if (!start) return null;

  const durationMs = parseDuration(endOrDurationRaw);
  if (!Number.isNaN(durationMs)) {
    return { start, end: new Date(start.getTime() + durationMs) };
  }

  const end = parseICalDate(endOrDurationRaw, tzid, false, warn);
  if (!end) return null;
  return { start, end };
}

function parseFreeBusyComponents(unfolded: string[], warn: (msg: string) => void): BusyBlock[] {
  const busy: BusyBlock[] = [];
  let inComponent = false;

  for (const line of unfolded) {
    const upper = line.toUpperCase();
    if (upper === "BEGIN:VFREEBUSY") {
      inComponent = true;
      continue;
    }
    if (upper === "END:VFREEBUSY") {
      inComponent = false;
      continue;
    }
    if (!inComponent) continue;
    if (!upper.startsWith("FREEBUSY")) continue;

    const [propPart, valuePart] = line.split(/:(.+)/, 2);
    if (!valuePart) continue;

    const params = propPart.split(";").slice(1);
    const tzidParam = params.find((p) => p.toUpperCase().startsWith("TZID="));
    const tzid = tzidParam ? tzidParam.split("=")[1] : undefined;

    const periods = valuePart.split(",");
    for (const periodPart of periods) {
      const parsed = parseFreeBusyPeriod(periodPart, tzid, warn);
      if (parsed && parsed.end > parsed.start) {
        busy.push(parsed);
      }
    }
  }

  return busy;
}

function parseEventComponents(unfolded: string[], warn: (msg: string) => void, defaultTimeZone?: string): BusyBlock[] {
  const events: BusyBlock[] = [];
  let inEvent = false;
  let current: { start?: Date; end?: Date; startIsDateOnly?: boolean; startYmd?: Ymd; startTimeZone?: string } = {};
  let currentDuration: number | undefined;

  for (const line of unfolded) {
    const upper = line.toUpperCase();

    if (upper === "BEGIN:VEVENT") {
      inEvent = true;
      current = {};
      currentDuration = undefined;
      continue;
    }
    if (upper === "END:VEVENT") {
      if (inEvent && current.start) {
        const isAllDay = Boolean(current.startIsDateOnly);
        const durationMs = currentDuration;

        const computedAllDayEnd =
          current.startYmd && current.startTimeZone
            ? (parseICalDate(ymdToString(addDaysToYmd(current.startYmd, 1)), current.startTimeZone, true, warn) ??
              new Date(current.start.getTime() + DAY_MS))
            : new Date(current.start.getTime() + DAY_MS);

        const defaultEnd = isAllDay
          ? computedAllDayEnd
          : new Date(current.start.getTime() + 60 * 60 * 1000);
        const endValue = current.end
          ? current.end
          : typeof durationMs === "number" && !Number.isNaN(durationMs)
            ? new Date(current.start.getTime() + durationMs)
            : defaultEnd;

        const end = isAllDay && endValue.getTime() === current.start.getTime() ? computedAllDayEnd : endValue;

        if (end && end > current.start) {
          events.push({ start: current.start, end });
        }
      }
      inEvent = false;
      currentDuration = undefined;
      continue;
    }
    if (!inEvent) continue;

    if (upper.startsWith("DTSTART")) {
      const tzidMatch = line.match(/TZID=([^;:]+)/);
      const isDateOnly = upper.includes("VALUE=DATE") || !line.includes("T");
      const dateMatch = line.match(/[:;](\d{8}(T\d{6}Z?)?)/);
      if (dateMatch) {
        const parsed = parseICalDate(dateMatch[1], tzidMatch?.[1], isDateOnly, warn, defaultTimeZone);
        if (parsed) {
          current.start = parsed;
          current.startIsDateOnly = isDateOnly;
          if (isDateOnly) {
            current.startYmd = parseYmd(dateMatch[1]) ?? undefined;
            current.startTimeZone = tzidMatch?.[1] ?? defaultTimeZone;
          }
        }
      }
    } else if (upper.startsWith("DTEND")) {
      const tzidMatch = line.match(/TZID=([^;:]+)/);
      const isDateOnly = upper.includes("VALUE=DATE") || !line.includes("T");
      const dateMatch = line.match(/[:;](\d{8}(T\d{6}Z?)?)/);
      if (dateMatch) {
        const parsed = parseICalDate(dateMatch[1], tzidMatch?.[1], isDateOnly, warn, defaultTimeZone);
        if (parsed) {
          current.end = parsed;
        }
      }
    } else if (upper.startsWith("DURATION")) {
      const dur = parseDuration(line.split(/:(.+)/, 2)[1] ?? "");
      if (!Number.isNaN(dur)) {
        currentDuration = dur;
      }
    }
  }

  return events;
}

export function parseFreeBusy(icalText: string, warn: (msg: string) => void = () => {}, defaultTimeZone?: string): BusyBlock[] {
  const unfolded = unfoldLines(icalText);
  const busyFromFreeBusy = parseFreeBusyComponents(unfolded, warn);
  const busyFromEvents = parseEventComponents(unfolded, warn, defaultTimeZone);
  return [...busyFromFreeBusy, ...busyFromEvents];
}
