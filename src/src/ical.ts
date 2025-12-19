import { BusyBlock } from "./freebusy";

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

function warnForTZID(tzid: string | undefined, warn: (msg: string) => void) {
  if (tzid) {
    warn(`TZID=${tzid} present; treating as UTC`);
  }
}

function parseICalDate(value: string, tzid: string | undefined, warn: (msg: string) => void): Date | null {
  // Format: YYYYMMDDTHHMMSSZ? or YYYYMMDD
  const dateTimeMatch = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (dateTimeMatch) {
    const [, y, mo, d, h, mi, s, z] = dateTimeMatch;
    const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
    if (!z && tzid) warnForTZID(tzid, warn);
    return new Date(iso);
  }
  const dateMatch = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateMatch) {
    const [, y, mo, d] = dateMatch;
    const iso = `${y}-${mo}-${d}T00:00:00Z`;
    if (tzid) warnForTZID(tzid, warn);
    return new Date(iso);
  }
  return null;
}

export function parseDuration(value: string): number {
  const match = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match) return NaN;
  const [, d, h, m, s] = match;
  const days = d ? Number(d) : 0;
  const hours = h ? Number(h) : 0;
  const minutes = m ? Number(m) : 0;
  const seconds = s ? Number(s) : 0;
  return (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
}

function parsePeriod(part: string, tzid: string | undefined, warn: (msg: string) => void): BusyBlock | null {
  const [startRaw, endOrDurationRaw] = part.split("/");
  if (!startRaw || !endOrDurationRaw) return null;

  const start = parseICalDate(startRaw, tzid, warn);
  if (!start) return null;

  const durationMs = parseDuration(endOrDurationRaw);
  if (!Number.isNaN(durationMs)) {
    return { start, end: new Date(start.getTime() + durationMs) };
  }

  const end = parseICalDate(endOrDurationRaw, tzid, warn);
  if (!end) return null;
  return { start, end };
}

export function parseFreeBusy(icalText: string, warn: (msg: string) => void = () => {}): BusyBlock[] {
  const unfolded = unfoldLines(icalText);
  const busy: BusyBlock[] = [];
  let inComponent = false;

  for (const line of unfolded) {
    if (line.toUpperCase() === "BEGIN:VFREEBUSY") {
      inComponent = true;
      continue;
    }
    if (line.toUpperCase() === "END:VFREEBUSY") {
      inComponent = false;
      continue;
    }
    if (!inComponent) continue;
    if (!line.toUpperCase().startsWith("FREEBUSY")) continue;

    const [propPart, valuePart] = line.split(/:(.+)/, 2);
    if (!valuePart) continue;

    const params = propPart.split(";").slice(1);
    const tzidParam = params.find((p) => p.toUpperCase().startsWith("TZID="));
    const tzid = tzidParam ? tzidParam.split("=")[1] : undefined;

    const periods = valuePart.split(",");
    for (const periodPart of periods) {
      const parsed = parsePeriod(periodPart, tzid, warn);
      if (parsed && parsed.end > parsed.start) {
        busy.push(parsed);
      }
    }
  }

  return busy;
}
