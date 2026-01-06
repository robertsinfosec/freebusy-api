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

  it("accepts semver-ish version strings", async () => {
    const { getBuildVersion } = await importVersionWithGenerated("1.2.3");
    expect(getBuildVersion()).toBe("1.2.3");
  });

  it("falls back to 0.0.0 when BUILD_VERSION is missing/invalid", async () => {
    const { getBuildVersion, FALLBACK_VERSION } = await importVersionWithGenerated(" ");
    expect(getBuildVersion()).toBe(FALLBACK_VERSION);
    expect(FALLBACK_VERSION).toBe("0.0.0");
  });

  it("falls back to 0.0.0 when BUILD_VERSION is an unrecognized string", async () => {
    const { getBuildVersion } = await importVersionWithGenerated("totally-not-a-version");
    expect(getBuildVersion()).toBe("0.0.0");
  });

  it("falls back to 0.0.0 when BUILD_VERSION is not a string", async () => {
    const { getBuildVersion } = await importVersionWithGenerated(1234);
    expect(getBuildVersion()).toBe("0.0.0");
  });

  it("falls back to 0.0.0 if version formatting throws", async () => {
    const { getBuildVersion } = await importVersionWithGenerated("25.1227.1305");

    const originalTrim = String.prototype.trim;
    try {
      // Force an exception inside getBuildVersion()'s try block.
      String.prototype.trim = () => {
        throw new Error("boom");
      };
      expect(getBuildVersion()).toBe("0.0.0");
    } finally {
      String.prototype.trim = originalTrim;
    }
  });

  it("accepts new optimized format strings (YY.Mdd.Hmm)", async () => {
    // 26.106.805 => Year 26, Jan 6, 8:05 AM
    const { getBuildVersion } = await importVersionWithGenerated("26.106.805");
    expect(getBuildVersion()).toBe("26.106.805");
  });

  it("accepts midnight times without leading zeros", async () => {
    const { getBuildVersion } = await importVersionWithGenerated("26.106.5");
    expect(getBuildVersion()).toBe("26.106.5");

    const { getBuildVersion: getBuildVersion2 } = await importVersionWithGenerated("26.106.10");
    expect(getBuildVersion2()).toBe("26.106.10");

    const { getBuildVersion: getBuildVersion3 } = await importVersionWithGenerated("26.106.0");
    expect(getBuildVersion3()).toBe("26.106.0");
  });
});
