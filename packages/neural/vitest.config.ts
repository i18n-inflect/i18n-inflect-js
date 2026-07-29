import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      // Test against the sibling package's sources, not its build output.
      "i18n-inflect": fileURLToPath(new URL("../i18n-inflect/src/index.ts", import.meta.url)),
    },
  },
});
