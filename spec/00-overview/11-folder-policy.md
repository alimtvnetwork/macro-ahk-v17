# 11 — Folder Policy

**Last Updated**: 2026-03-19

---

## Rule: Active Codebase Only

**The active codebase is `chrome-extension/`, `src/`, and `standalone-scripts/`.**

All AHK version folders have been moved to `skipped/` and are **read-only archives**. Do NOT read, modify, or reference any files in them:

- ⛔ `skipped/` — All archived AHK folders (DO NOT read, edit, or browse)
- ⛔ `skipped/Archives/` — Original AHK v1 (historical only)
- ⛔ `skipped/marco-script-ahk-v6.55/` — Archived v6.55 baseline
- ⛔ `skipped/marco-script-ahk-v7.9.32/` — Archived v7.9.32 snapshot
- ⛔ `skipped/marco-script-ahk-v7.latest/` — Former active AHK codebase (replaced by Chrome extension)

### AI Instructions

1. **Do NOT read** any file from `skipped/` — not even for reference
2. **Do NOT open** or browse `skipped/` folders
3. **Do NOT copy** code from `skipped/` — all active code is in `chrome-extension/`, `src/`, `standalone-scripts/`
4. **ONLY edit** files inside the active folders listed below
5. **Exception**: Only touch `skipped/` if the user gives a **specific, explicit instruction** to do so

### What CAN Be Edited

- ✅ `chrome-extension/` — Chrome extension source code
- ✅ `src/` — Shared React components and platform adapters
- ✅ `standalone-scripts/` — Standalone JS scripts (macro controller)
- ✅ `spec/` — Shared specification files
- ✅ `.lovable/memory/` — Memory and workflow files
- ✅ `memory/` — PRD and keyboard shortcuts memory
- ✅ Root-level files (`plan.md`, `readme.txt`, etc.)

### Exceptions

- A new major version folder may be created if a full rewrite is requested.
- `skipped/` folders may be referenced **only** if the user explicitly instructs it.

### Why

The project has transitioned from AHK desktop automation to a Chrome extension architecture. The AHK codebase is complete and stable but no longer the active development target. Previous AI sessions repeatedly modified wrong version folders, causing confusion and wasted effort. All AHK folders are now in `skipped/` to prevent this permanently.
