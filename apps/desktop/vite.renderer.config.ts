import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  optimizeDeps: {
    exclude: ["@pluma/core", "@pluma/editor", "@pluma/ui"]
  },
  plugins: [react({})],
  resolve: {
    alias: {
      "@pluma/core": path.resolve(
        __dirname,
        "../../packages/core/src/index.ts"
      ),
      "@pluma/editor": path.resolve(
        __dirname,
        "../../packages/editor/src/index.ts"
      ),
      "@pluma/ui": path.resolve(__dirname, "../../packages/ui/src/index.ts"),
      "@pluma/ui-styles": path.resolve(
        __dirname,
        "../../packages/ui/src/styles/index.css"
      )
    },
    dedupe: ["react", "react-dom"]
  }
});
