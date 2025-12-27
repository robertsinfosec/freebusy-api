import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function pad4(n) {
  return String(n).padStart(4, "0");
}

function buildVersionUtc(date = new Date()) {
  const yy = pad2(date.getUTCFullYear() % 100);
  const mmdd = pad2(date.getUTCMonth() + 1) + pad2(date.getUTCDate());
  const hhmm = pad2(date.getUTCHours()) + pad2(date.getUTCMinutes());
  return `${yy}.${mmdd}.${hhmm}`;
}

function isValidVersion(v) {
  // Accept our timestamp-based version: YY.MMDD.HHmm
  return /^\d{2}\.\d{4}\.\d{4}$/.test(v);
}

async function safeWriteFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const projectDir = path.resolve(scriptDir, "..");

  const versionFile = path.join(projectDir, "version.txt");
  const generatedTs = path.join(projectDir, "src", "version.generated.ts");

  const fallback = "0.0.0";

  try {
    const version = buildVersionUtc();
    if (!isValidVersion(version)) {
      throw new Error(`generated version did not validate: ${version}`);
    }

    await safeWriteFile(versionFile, `${version}\n`);
    await safeWriteFile(generatedTs, `export const BUILD_VERSION = ${JSON.stringify(version)};\n`);

    console.info(`[version] wrote ${path.relative(projectDir, versionFile)} = ${version}`);
    console.info(`[version] wrote ${path.relative(projectDir, generatedTs)} export BUILD_VERSION`);
  } catch (err) {
    console.warn("[version] failed to generate version; using fallback", err);
    await safeWriteFile(versionFile, `${fallback}\n`);
    await safeWriteFile(generatedTs, `export const BUILD_VERSION = ${JSON.stringify(fallback)};\n`);
  }
}

await main();
