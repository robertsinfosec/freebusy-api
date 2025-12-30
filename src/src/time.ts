function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getZonedParts(date: Date, timeZone: string): ZonedParts {
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

  return {
    year: lookup.year,
    month: lookup.month,
    day: lookup.day,
    hour: lookup.hour,
    minute: lookup.minute,
    second: lookup.second,
  };
}

export type ZonedYmd = { year: number; month: number; day: number };

export function formatYmd(ymd: ZonedYmd): string {
  return `${ymd.year}-${pad2(ymd.month)}-${pad2(ymd.day)}`;
}

export function getZonedYmd(date: Date, timeZone: string): ZonedYmd {
  const parts = getZonedParts(date, timeZone);
  return { year: parts.year, month: parts.month, day: parts.day };
}

export function addDaysToZonedYmd(ymd: ZonedYmd, days: number): ZonedYmd {
  const d = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day));
  d.setUTCDate(d.getUTCDate() + days);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function getOffsetMinutes(date: Date, timeZone: string): number {
  const zoned = getZonedParts(date, timeZone);
  const asUTC = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second);
  return Math.round((asUTC - date.getTime()) / 60000);
}

export function formatIsoInTimeZone(date: Date, timeZone: string): string {
  const zoned = getZonedParts(date, timeZone);
  const ms = date.getMilliseconds();
  const offsetMinutes = getOffsetMinutes(date, timeZone);

  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const offH = pad2(Math.floor(abs / 60));
  const offM = pad2(abs % 60);

  return `${zoned.year}-${pad2(zoned.month)}-${pad2(zoned.day)}T${pad2(zoned.hour)}:${pad2(zoned.minute)}:${pad2(zoned.second)}.${pad3(ms)}${sign}${offH}:${offM}`;
}

type LocalDateTime = {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

function localDateTimeToUtcMillis(local: LocalDateTime, timeZone: string): number {
  const utcGuess = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second, local.millisecond);

  // Convert local -> UTC by subtracting the zone offset at (or near) that instant.
  const offset1 = getOffsetMinutes(new Date(utcGuess), timeZone);
  let utcMillis = utcGuess - offset1 * 60_000;

  // One more pass to handle DST changes at the boundary.
  const offset2 = getOffsetMinutes(new Date(utcMillis), timeZone);
  if (offset2 !== offset1) {
    utcMillis = utcGuess - offset2 * 60_000;
  }

  return utcMillis;
}

export function utcMillisFromZonedLocal(
  local: { year: number; month: number; day: number; hour: number; minute: number; second?: number; millisecond?: number },
  timeZone: string
): number {
  return localDateTimeToUtcMillis(
    {
      year: local.year,
      month: local.month,
      day: local.day,
      hour: local.hour,
      minute: local.minute,
      second: local.second ?? 0,
      millisecond: local.millisecond ?? 0,
    },
    timeZone
  );
}

export function formatUtcIso(input: Date | number): string {
  const date = typeof input === "number" ? new Date(input) : input;
  return date.toISOString();
}

export function buildZonedWindow(forwardWeeks: number, now: Date, timeZone: string): { windowStart: Date; windowEnd: Date } {
  const zonedNow = getZonedParts(now, timeZone);
  const startYmd = { year: zonedNow.year, month: zonedNow.month, day: zonedNow.day };

  const windowStart = new Date(
    localDateTimeToUtcMillis(
      { ...startYmd, hour: 0, minute: 0, second: 0, millisecond: 0 },
      timeZone
    )
  );

  const totalDays = forwardWeeks * 7;
  const endYmd = addDaysToZonedYmd(startYmd, totalDays - 1);
  const windowEnd = new Date(
    localDateTimeToUtcMillis(
      { ...endYmd, hour: 23, minute: 59, second: 59, millisecond: 999 },
      timeZone
    )
  );

  return { windowStart, windowEnd };
}
