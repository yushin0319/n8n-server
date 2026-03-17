import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["workflows/code-nodes/**/*.test.ts"],
  },
});
