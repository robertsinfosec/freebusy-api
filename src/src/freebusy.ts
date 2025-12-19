export interface BusyBlock {
  start: Date;
  end: Date;
}

const MINUTE_MS = 60_000;
const WINDOW_DAYS = 28;

export function buildWindow(now: Date = new Date()): { windowStart: Date; windowEnd: Date } {
  const roundedStart = new Date(Math.floor(now.getTime() / MINUTE_MS) * MINUTE_MS);
  const windowEnd = new Date(roundedStart.getTime() + WINDOW_DAYS * 24 * 60 * MINUTE_MS);
  return { windowStart: roundedStart, windowEnd };
}

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

export function toResponseBlocks(blocks: BusyBlock[]): { start: string; end: string }[] {
  return blocks.map((block) => ({ start: block.start.toISOString(), end: block.end.toISOString() }));
}
