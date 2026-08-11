import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

const alias = { "@": path.resolve(__dirname, "src") };

/**
 * Two projects, because the two kinds of test need different environments:
 * server logic runs in Node (fast, no DOM), component tests need jsdom.
 * Both mirror the `src/` tree under `tests/` (decisions.md §27).
 */
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "server",
          environment: "node",
          include: ["tests/server/**/*.test.ts"],
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "ui",
          environment: "jsdom",
          setupFiles: ["./tests/setup/dom.ts"],
          include: ["tests/{components,features,app,lib}/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});
