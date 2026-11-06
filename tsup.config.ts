import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  dts: false,
  shims: true,
  clean: true,
  minify: false,
  sourcemap: true,
});
