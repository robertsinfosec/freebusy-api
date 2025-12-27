import { describe, expect, it, vi } from "vitest";

async function importVersionWithGenerated(buildVersion: unknown) {
  vi.resetModules();
  vi.doMock("../src/version.generated", () => ({
    BUILD_VERSION: buildVersion,
  }));
  return await import("../src/version");
}

describe("getBuildVersion", () => {
  it("returns BUILD_VERSION when it looks valid", async () => {
    const { getBuildVersion } = await importVersionWithGenerated("25.1227.1305");
    expect(getBuildVersion()).toBe("25.1227.1305");
  });

  it("falls back to 0.0.0 when BUILD_VERSION is missing/invalid", async () => {
    const { getBuildVersion, FALLBACK_VERSION } = await importVersionWithGenerated(" ");
    expect(getBuildVersion()).toBe(FALLBACK_VERSION);
    expect(FALLBACK_VERSION).toBe("0.0.0");
  });

  it("falls back to 0.0.0 when BUILD_VERSION is not a string", async () => {
    const { getBuildVersion } = await importVersionWithGenerated(1234);
    expect(getBuildVersion()).toBe("0.0.0");
  });
});
