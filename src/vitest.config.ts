import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      thresholds: {
        // Target "very high" coverage for open sourcing.
        lines: 95,
        statements: 95,
        functions: 95,
        branches: 90,
      },
    },
  },
});
