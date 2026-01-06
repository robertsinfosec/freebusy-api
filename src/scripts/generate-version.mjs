import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function buildVersionEastern(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "2-digit",
    month: "numeric",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(date);
  const getPart = (type) => parts.find((p) => p.type === type)?.value;

  const yy = getPart("year");
  const m = getPart("month");
  const dd = getPart("day");
  const h = getPart("hour");
  const mm = getPart("minute");

  const hour = Number(h);
  const minute = Number(mm);

  // Encode time as an integer (HHmm) without leading zeros.
  // Examples:
  // - 00:05 -> 5
  // - 00:10 -> 10
  // - 01:00 -> 100
  // - 08:05 -> 805
  // - 22:04 -> 2204
  const hhmm = String(hour * 100 + minute);

  return `${yy}.${m}${dd}.${hhmm}`;
}

function isValidVersion(v) {
  // Accept our timestamp-based version: YY.Mdd.HHmmInt
  // - middle: Mdd (month is 1-12, day is 01-31) => 3-4 digits, never starts with 0
  // - patch: integer HHmm without leading zeros (except literal 0)
  return /^\d{2}\.[1-9]\d{2,3}\.(?:0|[1-9]\d{0,3})$/.test(v);
}

async function safeWriteFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const projectDir = path.resolve(scriptDir, "..");

  const generatedTs = path.join(projectDir, "src", "version.generated.ts");

  const fallback = "0.0.0";

  try {
    const version = buildVersionEastern();
    if (!isValidVersion(version)) {
      throw new Error(`generated version did not validate: ${version}`);
    }

    await safeWriteFile(generatedTs, `export const BUILD_VERSION = ${JSON.stringify(version)};\n`);

    console.info(`[version] generated ${version}`);
    console.info(`[version] wrote ${path.relative(projectDir, generatedTs)} export BUILD_VERSION`);
  } catch (err) {
    console.warn("[version] failed to generate version; using fallback", err);
    await safeWriteFile(generatedTs, `export const BUILD_VERSION = ${JSON.stringify(fallback)};\n`);
  }
}

await main();
