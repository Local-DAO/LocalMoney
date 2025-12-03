import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  minify: false,
  external: [
    "@coral-xyz/anchor",
    "@solana/web3.js",
    "@solana/spl-token",
  ],
  esbuildOptions(options) {
    options.banner = {
      js: "/* @localmoney/sdk - LocalMoney Solana Protocol SDK */",
    };
  },
});
