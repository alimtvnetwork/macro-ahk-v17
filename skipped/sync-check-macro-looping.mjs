#!/usr/bin/env node
/**
 * sync-check-macro-looping.mjs
 * 
 * Verifies that critical shared functions in both macro-looping.js files
 * (AHK vs Standalone) remain in sync. Instead of comparing the entire body
 * (which has many known architectural differences in auth/token management),
 * this extracts and compares specific critical functions that MUST be identical.
 *
 * Known architectural differences (NOT checked — intentionally divergent):
 *   - Token resolution: AHK uses getBearerTokenFromStorage, Standalone uses session bridge
 *   - Bearer Token Management: AHK has saveBearerTokenToStorage + paste UI, Standalone removed
 *   - markBearerTokenExpired: AHK has full UI injection, Standalone has log-only stub
 *   - Bearer token UI panel section: AHK has input field, Standalone removed
 *
 * Usage:  node scripts/sync-check-macro-looping.mjs
 * Exit 0 = in sync, Exit 1 = drift detected
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const AHK_PATH = resolve(root, 'marco-script-ahk-v7.latest/macro-looping.js');
const STANDALONE_PATH = resolve(root, 'standalone-scripts/macro-controller/macro-looping.js');

// ── Critical functions that MUST remain in sync ──
// These are the shared business logic functions. Auth/UI differences are excluded.
const CRITICAL_FUNCTIONS = [
  { name: 'calcTotalCredits',      signature: 'function calcTotalCredits(' },
  { name: 'calcAvailableCredits',   signature: 'function calcAvailableCredits(' },
  { name: 'calcFreeCreditAvailable', signature: 'function calcFreeCreditAvailable(' },
  { name: 'calcSegmentPercents',    signature: 'function calcSegmentPercents(' },
  { name: 'renderCreditBar',       signature: 'function renderCreditBar(' },
  { name: 'moveToWorkspace',       signature: 'function moveToWorkspace(' },
  { name: 'moveToAdjacentWorkspace', signature: 'function moveToAdjacentWorkspace(' },
  { name: 'fetchLoopCredits',      signature: 'function fetchLoopCredits(' },
  { name: 'renderLoopWorkspaceList', signature: 'function renderLoopWorkspaceList(' },
  { name: 'applyRenameTemplate',   signature: 'function applyRenameTemplate(' },
  { name: 'extractProjectIdFromUrl', signature: 'function extractProjectIdFromUrl(' },
];

/**
 * Extract a function body from source code by matching its signature
 * and counting braces to find the closing brace.
 */
function extractFunction(source, signature) {
  const idx = source.indexOf(signature);
  if (idx === -1) return null;

  let braceCount = 0;
  let started = false;
  let end = idx;

  for (let i = idx; i < source.length; i++) {
    if (source[i] === '{') { braceCount++; started = true; }
    if (source[i] === '}') { braceCount--; }
    if (started && braceCount === 0) { end = i + 1; break; }
  }

  return source.substring(idx, end);
}

/**
 * Normalize a function body for comparison:
 * - Replace AHK __PLACEHOLDER__ tokens
 * - Replace standalone config reads
 * - Normalize token resolution calls (getBearerTokenFromStorage vs resolveToken)
 * - Remove comments and normalize whitespace
 */
function normalize(text) {
  return text
    .replace(/'__[A-Z_]+__'/g, '«P»')
    .replace(/\b__[A-Z_]+__\b/g, '«P»')
    .replace(/loop(?:Ids|Timing|XPaths|Urls)\.\w+\s*\|\|\s*(?:'[^']*'|\d+)/g, '«P»')
    // Normalize token call differences
    .replace(/getBearerTokenFromStorage\(\)/g, '«TOKEN_RESOLVE»()')
    .replace(/resolveToken\(\)/g, '«TOKEN_RESOLVE»()')
    // Normalize SESSION_BRIDGE_KEYS references (AHK uses [BEARER_STORAGE_KEY], standalone uses full array)
    .replace(/SESSION_BRIDGE_KEYS/g, '«SESSION_KEYS»')
    .replace(/LAST_SESSION_BRIDGE_SOURCE/g, '«LAST_SESSION_SRC»')
    // Normalize stopPropagation differences (AHK adds it, standalone may omit)
    .replace(/\s*e\.stopPropagation\(\);?/g, '')
    // Remove single-line comments
    .replace(/\/\/[^\n]*/g, '')
    // Remove line refs
    .replace(/\(line ~\d+\)/g, '')
    // Collapse all whitespace (spaces, tabs, newlines) to single space for structure-agnostic comparison
    .replace(/\s+/g, ' ')
    .trim();
}

// --- Main ---
console.log('🔍 Comparing critical functions in macro-looping.js...\n');
console.log(`  AHK:        ${AHK_PATH}`);
console.log(`  Standalone: ${STANDALONE_PATH}\n`);

const ahkSource = readFileSync(AHK_PATH, 'utf-8');
const standaloneSource = readFileSync(STANDALONE_PATH, 'utf-8');

let passed = 0;
let failed = 0;
let missing = 0;
const failures = [];

for (const fn of CRITICAL_FUNCTIONS) {
  const ahkFn = extractFunction(ahkSource, fn.signature);
  const saFn = extractFunction(standaloneSource, fn.signature);

  if (!ahkFn && !saFn) {
    console.log(`  ⚠️  ${fn.name} — not found in either file (skipped)`);
    missing++;
    continue;
  }
  if (!ahkFn) {
    console.log(`  ❌ ${fn.name} — missing from AHK`);
    failures.push({ name: fn.name, reason: 'missing from AHK' });
    failed++;
    continue;
  }
  if (!saFn) {
    console.log(`  ❌ ${fn.name} — missing from Standalone`);
    failures.push({ name: fn.name, reason: 'missing from Standalone' });
    failed++;
    continue;
  }

  const ahkNorm = normalize(ahkFn);
  const saNorm = normalize(saFn);

  if (ahkNorm === saNorm) {
    console.log(`  ✅ ${fn.name}`);
    passed++;
  } else {
    console.log(`  ❌ ${fn.name} — DRIFT DETECTED`);
    failed++;

    // Show first difference
    const aLines = ahkNorm.split('\n');
    const sLines = saNorm.split('\n');
    for (let i = 0; i < Math.max(aLines.length, sLines.length); i++) {
      if ((aLines[i] || '') !== (sLines[i] || '')) {
        failures.push({
          name: fn.name,
          line: i + 1,
          ahk: (aLines[i] || '«EOF»').substring(0, 120),
          standalone: (sLines[i] || '«EOF»').substring(0, 120),
        });
        break;
      }
    }
  }
}

console.log(`\n── Summary ──`);
console.log(`  ✅ Passed: ${passed}`);
console.log(`  ❌ Failed: ${failed}`);
if (missing) console.log(`  ⚠️  Skipped: ${missing}`);

if (failures.length > 0) {
  console.log(`\nFirst difference in each failed function:`);
  for (const f of failures) {
    if (f.reason) {
      console.log(`  ${f.name}: ${f.reason}`);
    } else {
      console.log(`  ${f.name} (line ${f.line}):`);
      console.log(`    AHK:        ${f.ahk}`);
      console.log(`    Standalone: ${f.standalone}`);
    }
  }
}

process.exit(failed > 0 ? 1 : 0);
