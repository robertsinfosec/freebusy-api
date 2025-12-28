import { addDaysToZonedYmd, formatUtcIso, formatYmd, getZonedYmd, utcMillisFromZonedLocal } from "./time";

export type BusyIntervalKind = "time" | "allDay";

export interface BusyInterval {
  startMsUtc: number;
  endMsUtc: number;
  kind: BusyIntervalKind;
}

export interface WindowV2 {
  startDate: string;
  endDateInclusive: string;
  startMsUtc: number;
  endMsUtcExclusive: number;
}

/**
 * v2 window model:
 * - anchored to owner-local dates in CALENDAR_TIMEZONE
 * - returned as startDate/endDateInclusive plus UTC instants [startUtc, endUtcExclusive)
 */
export function buildWindowV2(windowWeeks: number, now: Date, calendarTimeZone: string): WindowV2 {
  const startYmd = getZonedYmd(now, calendarTimeZone);
  const totalDays = windowWeeks * 7;
  const endYmd = addDaysToZonedYmd(startYmd, totalDays - 1);
  const endExclusiveYmd = addDaysToZonedYmd(endYmd, 1);

  const startMsUtc = utcMillisFromZonedLocal({ ...startYmd, hour: 0, minute: 0 }, calendarTimeZone);
  const endMsUtcExclusive = utcMillisFromZonedLocal({ ...endExclusiveYmd, hour: 0, minute: 0 }, calendarTimeZone);

  return {
    startDate: formatYmd(startYmd),
    endDateInclusive: formatYmd(endYmd),
    startMsUtc,
    endMsUtcExclusive,
  };
}

export function clipAndMerge(intervals: BusyInterval[], windowStartMsUtc: number, windowEndMsUtcExclusive: number): BusyInterval[] {
  const relevant = intervals
    .map((interval) => {
      const startMsUtc = Math.max(interval.startMsUtc, windowStartMsUtc);
      const endMsUtc = Math.min(interval.endMsUtc, windowEndMsUtcExclusive);
      return { startMsUtc, endMsUtc, kind: interval.kind };
    })
    .filter((i) => i.endMsUtc > i.startMsUtc && i.endMsUtc > windowStartMsUtc && i.startMsUtc < windowEndMsUtcExclusive);

  relevant.sort((a, b) => a.startMsUtc - b.startMsUtc);
  const merged: BusyInterval[] = [];

  for (const current of relevant) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ ...current });
      continue;
    }

    if (current.startMsUtc <= last.endMsUtc) {
      last.endMsUtc = Math.max(last.endMsUtc, current.endMsUtc);
      if (last.kind === "time" && current.kind === "allDay") {
        last.kind = "allDay";
      }
      continue;
    }

    merged.push({ ...current });
  }

  return merged;
}

export function toResponseBusy(intervals: BusyInterval[]): { startUtc: string; endUtc: string; kind: BusyIntervalKind }[] {
  return intervals.map((i) => ({ startUtc: formatUtcIso(i.startMsUtc), endUtc: formatUtcIso(i.endMsUtc), kind: i.kind }));
}
