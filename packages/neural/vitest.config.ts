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
      "intl-inflect": fileURLToPath(new URL("../intl-inflect/src/index.ts", import.meta.url)),
    },
  },
});
