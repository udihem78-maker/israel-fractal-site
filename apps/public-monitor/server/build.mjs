import { build } from "esbuild";
import { rm } from "node:fs/promises";

await rm(new URL("./dist", import.meta.url), { recursive: true, force: true });
await build({
  entryPoints: ["src/index.ts"],
  outdir: "dist",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  sourcemap: true,
  // Bundle our TypeScript workspace packages; keep runtime dependencies native.
  external: ["express", "pino", "pino-http", "pg", "csv-parse", "drizzle-orm", "drizzle-zod", "zod"],
});
