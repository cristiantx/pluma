import path from "node:path";

import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@pluma/core": path.resolve(
        __dirname,
        "../../packages/core/src/index.ts"
      ),
      "@pluma/core-desktop": path.resolve(
        __dirname,
        "../../packages/core/src/desktop.ts"
      )
    }
  }
});
