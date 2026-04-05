# 04 — Formatting Rules

> **Version**: 1.0.0  
> **Last updated**: 2026-02-28

## Purpose

Code formatting must maximize **readability per line**. Each line should contain exactly one logical unit. This makes diffs clean, reviews fast, and debugging straightforward.

---

## 1. One Property Per Line in Objects (Rule FMT1)

Object literals **MUST** place each property on its own line, even if the object is small.

```typescript
// ❌ FORBIDDEN — properties crammed on one line
const config = { name: "Marco", version: "1.0", isActive: true };

// ✅ REQUIRED — one property per line
const config = {
    name: "Marco",
    version: "1.0",
    isActive: true,
};
```

**Exception**: Single-property objects may remain on one line:

```typescript
// ✅ PERMITTED — single property
const filter = { isActive: true };
```

---

## 2. One Argument Per Line in Function Calls (Rule FMT2)

When a function call has **more than 2 arguments**, each argument **MUST** be on its own line.

```typescript
// ✅ GOOD — 1-2 arguments, single line OK
logMessage("Script injected");
matchUrl(pattern, currentUrl);

// ❌ FORBIDDEN — 3+ arguments on one line
registerScript(script.id, project.id, nextOrder, "document_idle");

// ✅ REQUIRED — one argument per line
registerScript(
    script.id,
    project.id,
    nextOrder,
    "document_idle",
);
```

---

## 3. One Parameter Per Line in Function Definitions (Rule FMT3)

When a function definition has **more than 2 parameters**, each parameter **MUST** be on its own line.

```typescript
// ✅ GOOD — 2 parameters, single line OK
function matchUrl(pattern: string, url: string): boolean { ... }

// ❌ FORBIDDEN — 3+ parameters on one line
function injectScript(tabId: number, code: string, runAt: string): Promise<void> { ... }

// ✅ REQUIRED — one parameter per line
function injectScript(
    tabId: number,
    code: string,
    runAt: string,
): Promise<void> { ... }
```

---

## 4. Trailing Commas (Rule FMT4)

Always use **trailing commas** in multi-line constructs (objects, arrays, parameters, arguments). This produces cleaner diffs.

```typescript
// ✅ REQUIRED — trailing commas
const project = {
    name: "Marco",
    isActive: true,    // ← trailing comma
};

function processScript(
    scriptId: string,
    projectId: string,
    order: number,      // ← trailing comma
): void { ... }
```

---

## 5. Import Formatting (Rule FMT5)

Imports are grouped and ordered:

1. **External packages** (node_modules)
2. **Blank line**
3. **Internal absolute imports** (`@/shared/...`, `@/background/...`)
4. **Blank line**
5. **Relative imports** (`./`, `../`)

```typescript
// ✅ REQUIRED — grouped imports
import { z } from "zod";

import { MessageType } from "@/shared/messages";
import { StoredScript } from "@/shared/types";

import { executeInjection } from "./injector";
import { buildPayload } from "./payload-builder";
```

---

## 6. Line Length (Rule FMT6)

Lines should not exceed **100 characters**. If a line is longer, break it at a logical point.

```typescript
// ❌ FORBIDDEN — too long
const errorMessage = `Failed to inject script "${script.name}" into tab ${tabId}: ${error.message}`;

// ✅ REQUIRED — broken at logical point
const errorMessage = [
    `Failed to inject script "${script.name}"`,
    `into tab ${tabId}: ${error.message}`,
].join(" ");
```

---

## 7. No Clever One-Liners (Rule FMT7)

Never compress multiple operations into a single line to save space. Each operation gets its own line.

```typescript
// ❌ FORBIDDEN — compressed operations
const result = items.filter(isActive).map(toDto).sort(byName);

// ✅ REQUIRED — one operation per line
const activeItems = items.filter(isActive);
const itemDtos = activeItems.map(toDto);
const sortedDtos = itemDtos.sort(byName);
```

```typescript
// ❌ FORBIDDEN — ternary with side effects
isReady ? start() : initialize();

// ✅ REQUIRED — explicit if
if (isReady) {
    start();
} else {
    initialize();
}
```

---

## 8. Destructuring Formatting (Rule FMT8)

When destructuring **more than 2 properties**, each property goes on its own line.

```typescript
// ✅ GOOD — 2 properties, single line OK
const { name, version } = project;

// ❌ FORBIDDEN — 3+ properties on one line
const { name, version, isActive, scripts } = project;

// ✅ REQUIRED — one per line
const {
    name,
    version,
    isActive,
    scripts,
} = project;
```

---

## Quick Reference

| Rule | Trigger | Action |
|------|---------|--------|
| FMT1 | Object with 2+ properties | One property per line |
| FMT2 | Function call with 3+ arguments | One argument per line |
| FMT3 | Function definition with 3+ params | One parameter per line |
| FMT4 | Any multi-line construct | Trailing comma |
| FMT5 | Import statements | Group by external → internal → relative |
| FMT6 | Line > 100 chars | Break at logical point |
| FMT7 | Chained operations | One operation per line |
| FMT8 | Destructuring 3+ properties | One property per line |

---

## ESLint Enforcement

| Rule | ESLint Rule / Plugin | Enforces |
|------|---------------------|----------|
| FMT1 | `object-curly-newline: [error, { multiline: true, minProperties: 2 }]` | One property per line in objects |
| FMT2 | `function-call-argument-newline: [error, "consistent"]` | Consistent argument formatting |
| FMT3 | `function-paren-newline: [error, "multiline-arguments"]` | Parameters on separate lines |
| FMT4 | `comma-dangle: [error, "always-multiline"]` | Trailing commas |
| FMT5 | `import/order: [error, { groups: ["external", "internal", "sibling"], newlines-between: "always" }]` | Import grouping and ordering |
| FMT6 | `max-len: [warn, { code: 100, ignoreUrls: true, ignoreStrings: true }]` | 100-character line limit |
| FMT7 | `newline-per-chained-call: [warn, { ignoreChainWithDepth: 1 }]` | No chained one-liners |
| FMT8 | `object-curly-newline` (same as FMT1) | Destructuring formatting |

**Plugins required**: `eslint-plugin-import`

> **Note**: A Prettier config (`.prettierrc`) can enforce FMT1–FMT4 and FMT8 more reliably. Recommended: `{ "trailingComma": "all", "printWidth": 100, "singleQuote": false, "tabWidth": 4 }`

---

## Cross-References

- [Function Standards](02-function-standards.md) — Parameter limits (Rule F2, F5, F6)
- [File Organization](05-file-organization.md) — Line count limits per file

*Formatting rules v1.1.0 — 2026-02-28*
