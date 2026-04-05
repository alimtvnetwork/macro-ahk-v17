#!/usr/bin/env node
/**
 * Generate riseup-macro-sdk.d.ts
 *
 * Writes the TypeScript declarations file to
 * standalone-scripts/marco-sdk/dist/riseup-macro-sdk.d.ts
 *
 * Usage: node scripts/generate-dts.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Dynamic import of the generator (TS via tsx/bun or pre-compiled)
const { generateDts } = await import("../src/lib/generate-dts.ts");

const outPath = resolve(root, "standalone-scripts/marco-sdk/dist/riseup-macro-sdk.d.ts");
mkdirSync(dirname(outPath), { recursive: true });

const dts = generateDts();
writeFileSync(outPath, dts, "utf-8");
console.log(`✓ Written riseup-macro-sdk.d.ts (${dts.length} chars)`);
