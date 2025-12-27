import { BUILD_VERSION } from "./version.generated";

const FALLBACK_VERSION = "0.0.0";

function isValidVersionString(version: string): boolean {
  const v = version.trim();
  if (!v) return false;

  // Primary expected format: YY.MMDD.HHmm
  if (/^\d{2}\.\d{4}\.\d{4}$/.test(v)) return true;

  // Secondary: allow conventional semver-ish strings in case we ever switch formats.
  if (/^\d+\.\d+\.\d+/.test(v)) return true;

  return false;
}

export function getBuildVersion(): string {
  try {
    if (typeof BUILD_VERSION !== "string") return FALLBACK_VERSION;
    const trimmed = BUILD_VERSION.trim();
    if (!isValidVersionString(trimmed)) return FALLBACK_VERSION;
    return trimmed;
  } catch {
    return FALLBACK_VERSION;
  }
}

export { FALLBACK_VERSION };
