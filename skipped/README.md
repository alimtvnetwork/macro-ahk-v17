# ⛔ Skipped Folders — DO NOT EDIT OR READ

**Last Updated**: 2026-03-19

---

## Rule

All folders inside `skipped/` are **archived and inactive**. They are preserved for historical reference only.

### AI Instructions

1. **DO NOT read** any file from folders inside `skipped/`
2. **DO NOT open** or browse these folders even for reference
3. **DO NOT copy** code from these folders
4. **DO NOT modify** any file in these folders
5. **ONLY work with** `chrome-extension/`, `src/`, `standalone-scripts/`, and `spec/` folders
6. **Exception**: Only touch these folders if the user gives a **specific, explicit instruction** to do so

### What's Here

| Folder | Description | Why Skipped |
|--------|-------------|-------------|
| `marco-script-ahk-v7.latest/` | AHK v2 automation scripts (last active codebase) | Replaced by Chrome extension |
| `marco-script-ahk-v7.9.32/` | Archived AHK v7.9.32 snapshot | Historical archive |
| `marco-script-ahk-v6.55/` | Archived AHK v6.55 baseline | Historical archive |
| `Archives/` | Original AHK v1 scripts | Historical archive |

### Why

The project has transitioned from AHK desktop automation to a **Chrome extension** architecture. The AHK codebase is complete and stable but no longer the active development target. All new features and changes should be made in:

- ✅ `chrome-extension/` — Chrome extension source
- ✅ `src/` — Shared React components and platform adapters
- ✅ `standalone-scripts/` — Standalone JS scripts (macro controller)
- ✅ `spec/` — Specifications and documentation
- ✅ `.lovable/memory/` — Memory and workflow files
