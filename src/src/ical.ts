import { BusyInterval, BusyIntervalKind } from "./freebusy";
import { utcMillisFromZonedLocal } from "./time";

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

function validateIanaTimeZone(tzid: string): void {
  // Best-effort validation using Intl. Throws on invalid TZs.
  new Intl.DateTimeFormat("en-US", { timeZone: tzid });
}

function parseNumericOffsetToMinutes(raw: string): number | null {
  const match = raw.match(/^([+-])(\d{2})(\d{2})$/);
  if (!match) return null;
  const sign = match[1] === "-" ? -1 : 1;
  const hh = Number(match[2]);
  const mm = Number(match[3]);
  if (!Number.isInteger(hh) || !Number.isInteger(mm)) return null;
  if (hh < 0 || hh > 23) return null;
  if (mm < 0 || mm > 59) return null;
  return sign * (hh * 60 + mm);
}

function parseICalDateTimeToUtcMillis(
  value: string,
  tzid: string | undefined,
  isDateOnly: boolean,
  warn: (msg: string) => void,
  defaultTimeZone?: string
): number | null {
  const dateOnly = isDateOnly || !value.includes("T");

  // Date-only: YYYYMMDD
  if (dateOnly) {
    const ymd = parseYmd(value);
    if (!ymd) return null;
    const effectiveTz = defaultTimeZone;
    if (!effectiveTz) {
      // v2 requires all-day semantics anchored to owner timezone.
      return null;
    }

    try {
      validateIanaTimeZone(effectiveTz);
      return utcMillisFromZonedLocal({ year: ymd.year, month: ymd.month, day: ymd.day, hour: 0, minute: 0 }, effectiveTz);
    } catch (err) {
      warn(`Failed TZ conversion for ${effectiveTz}: ${String(err)}`);
      return null;
    }
  }

  // Date-time: YYYYMMDDTHHMMSS(Z|±HHMM)?
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z|[+-]\d{4})?$/);
  if (!match) return null;
  const [, y, mo, d, h, mi, s, suffix] = match;
  const year = Number(y);
  const month = Number(mo) - 1;
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(s);
  const utcMillis = Date.UTC(year, month, day, hour, minute, second, 0);

  if (suffix === "Z") {
    return utcMillis;
  }

  if (suffix && suffix !== "Z") {
    const offsetMinutes = parseNumericOffsetToMinutes(suffix);
    if (offsetMinutes === null) return null;
    // Local-with-offset -> UTC by subtracting the offset.
    return utcMillis - offsetMinutes * 60_000;
  }

  // Floating time (no suffix): interpret as TZID if present, otherwise owner timezone.
  const effectiveTzid = tzid ?? defaultTimeZone;
  if (effectiveTzid) {
    try {
      validateIanaTimeZone(effectiveTzid);
      return utcMillisFromZonedLocal(
        { year, month: month + 1, day, hour, minute, second, millisecond: 0 },
        effectiveTzid
      );
    } catch (err) {
      // If upstream provided TZID and it's not supported, fail hard (avoid silent wrong times).
      if (tzid) {
        throw new Error(`unsupported_tzid:${tzid}`);
      }
      warn(`Failed TZ conversion for ${effectiveTzid}: ${String(err)}`);
    }
  }

  // Fallback: assume UTC when no timezone info.
  return utcMillis;
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

function parseFreeBusyPeriod(part: string, tzid: string | undefined, warn: (msg: string) => void, defaultTimeZone?: string): BusyInterval | null {
  const [startRaw, endOrDurationRaw] = part.split("/");
  if (!startRaw || !endOrDurationRaw) return null;

  const startMsUtc = parseICalDateTimeToUtcMillis(startRaw, tzid, false, warn, defaultTimeZone);
  if (startMsUtc === null) return null;

  const durationMs = parseDuration(endOrDurationRaw);
  if (!Number.isNaN(durationMs)) {
    return { startMsUtc, endMsUtc: startMsUtc + durationMs, kind: "time" };
  }

  const endMsUtc = parseICalDateTimeToUtcMillis(endOrDurationRaw, tzid, false, warn, defaultTimeZone);
  if (endMsUtc === null) return null;
  return { startMsUtc, endMsUtc, kind: "time" };
}

function parseFreeBusyComponents(unfolded: string[], warn: (msg: string) => void, defaultTimeZone?: string): BusyInterval[] {
  const busy: BusyInterval[] = [];
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
      const parsed = parseFreeBusyPeriod(periodPart, tzid, warn, defaultTimeZone);
      if (parsed && parsed.endMsUtc > parsed.startMsUtc) {
        busy.push(parsed);
      }
    }
  }

  return busy;
}

function parseEventComponents(unfolded: string[], warn: (msg: string) => void, defaultTimeZone?: string): BusyInterval[] {
  const events: BusyInterval[] = [];
  let inEvent = false;
  let current: { startMsUtc?: number; endMsUtc?: number; kind?: BusyIntervalKind; startIsDateOnly?: boolean; startYmd?: Ymd } = {};
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
      if (inEvent && typeof current.startMsUtc === "number") {
        const isAllDay = Boolean(current.startIsDateOnly);
        const durationMs = currentDuration;

        let endMsUtc: number | undefined = current.endMsUtc;

        if (endMsUtc === undefined) {
          if (typeof durationMs === "number" && !Number.isNaN(durationMs)) {
            endMsUtc = current.startMsUtc + durationMs;
          } else if (isAllDay) {
            if (!current.startYmd || !defaultTimeZone) {
              endMsUtc = current.startMsUtc + DAY_MS;
            } else {
              const nextDayStr = ymdToString(addDaysToYmd(current.startYmd, 1));
              endMsUtc = parseICalDateTimeToUtcMillis(nextDayStr, undefined, true, warn, defaultTimeZone) ?? (current.startMsUtc + DAY_MS);
            }
          } else {
            endMsUtc = current.startMsUtc + 60 * 60 * 1000;
          }
        }

        const kind: BusyIntervalKind = isAllDay ? "allDay" : "time";
        if (endMsUtc > current.startMsUtc) {
          events.push({ startMsUtc: current.startMsUtc, endMsUtc, kind });
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
      const dateMatch = line.match(/[:;](\d{8}(T\d{6}(?:Z|[+-]\d{4})?)?)/);
      if (dateMatch) {
        const parsedMs = parseICalDateTimeToUtcMillis(dateMatch[1], tzidMatch?.[1], isDateOnly, warn, defaultTimeZone);
        if (typeof parsedMs === "number") {
          current.startMsUtc = parsedMs;
          current.startIsDateOnly = isDateOnly;
          if (isDateOnly) {
            current.startYmd = parseYmd(dateMatch[1]) ?? undefined;
          }
        }
      }
    } else if (upper.startsWith("DTEND")) {
      const tzidMatch = line.match(/TZID=([^;:]+)/);
      const isDateOnly = upper.includes("VALUE=DATE") || !line.includes("T");
      const dateMatch = line.match(/[:;](\d{8}(T\d{6}(?:Z|[+-]\d{4})?)?)/);
      if (dateMatch) {
        const parsedMs = parseICalDateTimeToUtcMillis(dateMatch[1], tzidMatch?.[1], isDateOnly, warn, defaultTimeZone);
        if (typeof parsedMs === "number") {
          current.endMsUtc = parsedMs;
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

export function parseFreeBusy(icalText: string, warn: (msg: string) => void = () => {}, defaultTimeZone?: string): BusyInterval[] {
  const unfolded = unfoldLines(icalText);
  const busyFromFreeBusy = parseFreeBusyComponents(unfolded, warn, defaultTimeZone);
  const busyFromEvents = parseEventComponents(unfolded, warn, defaultTimeZone);
  return [...busyFromFreeBusy, ...busyFromEvents];
}
