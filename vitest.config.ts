import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/e2e/**"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./apps/funnels/src", import.meta.url)),
    },
  },
});
