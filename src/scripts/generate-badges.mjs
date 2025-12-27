import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeBadge } from "badge-maker";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..", "..");
const badgesDir = resolve(root, "badges");
const coverageSummaryPath = resolve(root, "src", "coverage", "coverage-summary.json");

function coverageColor(pct) {
  if (pct >= 90) return "brightgreen";
  if (pct >= 80) return "green";
  if (pct >= 70) return "yellowgreen";
  if (pct >= 60) return "yellow";
  return "orange";
}

async function readCoveragePct() {
  const raw = await readFile(coverageSummaryPath, "utf8");
  const json = JSON.parse(raw);
  const pct = json?.total?.lines?.pct;
  if (!Number.isFinite(pct)) {
    throw new Error("coverage percentage missing in coverage-summary.json");
  }
  return pct;
}

async function writeBadge(filename, label, message, color) {
  const svg = makeBadge({ label, message, color });
  await mkdir(badgesDir, { recursive: true });
  await writeFile(resolve(badgesDir, filename), svg, "utf8");
}

async function main() {
  const pct = await readCoveragePct();
  await writeBadge("coverage.svg", "coverage", `${pct.toFixed(1)}%`, coverageColor(pct));
  await writeBadge("tests.svg", "tests", "passing", "brightgreen");
  console.log(`Badges written to ${badgesDir}`);
}

main().catch((err) => {
  console.error("Failed to generate badges:", err);
  process.exit(1);
});
