export interface BusyBlock {
  start: Date;
  end: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Returns a deterministic window starting at 00:00:00 UTC today and extending the provided weeks.
 */
export function buildWindow(forwardWeeks: number, now: Date = new Date()): { windowStart: Date; windowEnd: Date } {
  const startOfDayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const totalDays = forwardWeeks * 7;
  const windowEnd = new Date(startOfDayUtc.getTime() + totalDays * DAY_MS - 1); // 23:59:59.999 of last day
  return { windowStart: startOfDayUtc, windowEnd };
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
 * Converts busy blocks to ISO8601 strings for responses.
 */
export function toResponseBlocks(blocks: BusyBlock[]): { start: string; end: string }[] {
  return blocks.map((block) => ({ start: block.start.toISOString(), end: block.end.toISOString() }));
}
