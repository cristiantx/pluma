import path from "node:path";

import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@pluma/commands": path.resolve(
        __dirname,
        "../../packages/commands/src/index.ts"
      ),
      "@pluma/core": path.resolve(
        __dirname,
        "../../packages/core/src/index.ts"
      ),
      "@pluma/core-desktop": path.resolve(
        __dirname,
        "../../packages/core/src/desktop.ts"
      ),
      "@pluma/ui/settings": path.resolve(
        __dirname,
        "../../packages/ui/src/settings.ts"
      )
    }
  }
});
