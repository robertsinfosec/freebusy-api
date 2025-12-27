import { buildZonedWindow, formatIsoInTimeZone } from "./time";

export interface BusyBlock {
  start: Date;
  end: Date;
}

/**
 * Returns a deterministic window starting at 00:00:00 in the requested time zone "today" and
 * extending the provided weeks through 23:59:59.999 on the final day (DST-aware).
 */
export function buildWindow(
  forwardWeeks: number,
  now: Date = new Date(),
  timeZone: string
): { windowStart: Date; windowEnd: Date } {
  return buildZonedWindow(forwardWeeks, now, timeZone);
}

/**
 * Trims busy blocks to the window and merges overlapping/contiguous entries.
 */
export function clipAndMerge(blocks: BusyBlock[], windowStart: Date, windowEnd: Date): BusyBlock[] {
  const relevant = blocks
    .map((block) => {
      const start = block.start < windowStart ? windowStart : block.start;
      const end = block.end > windowEnd ? windowEnd : block.end;
      return { start, end };
    })
    .filter((block) => block.end > block.start && block.end > windowStart && block.start < windowEnd);

  relevant.sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: BusyBlock[] = [];

  for (const block of relevant) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push(block);
      continue;
    }

    const lastEnd = last.end.getTime();
    const currentStart = block.start.getTime();
    if (currentStart <= lastEnd) {
      if (block.end.getTime() > lastEnd) {
        last.end = block.end;
      }
    } else if (currentStart === lastEnd) {
      last.end = block.end;
    } else {
      merged.push(block);
    }
  }

  return merged;
}

/**
 * Converts busy blocks to ISO8601 strings in the requested time zone.
 */
export function toResponseBlocks(
  blocks: BusyBlock[],
  timeZone: string
): { start: string; end: string }[] {
  return blocks.map((block) => ({ start: formatIsoInTimeZone(block.start, timeZone), end: formatIsoInTimeZone(block.end, timeZone) }));
}
