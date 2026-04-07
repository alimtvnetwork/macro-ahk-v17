## Plan: Update 05-injection-lifecycle.md to match the diagram

The current spec has an outdated 7-stage model. The diagram shows a significantly different pipeline. Here's what needs to change:

### Step 1: Rewrite the spec to match the diagram's pipeline stages
The new stage structure from the diagram:
- **Pre-pipeline**: User trigger (Run / Force Run), toast, cache gate
- **Stage 0a**: ensureBuiltinScriptsExist (self-heal built-in scripts)
- **Stage 0b**: prependDependencyScripts (topological sort)
- **Stage 1**: resolveInjectionRequestScripts (load code + config + theme)
- **Stage 2**: Tab Environment Prep — parallel: 2a namespace bootstrap, 2b relay, 2c token seeding
- **Stage 3**: Wrap + Execute prep — CSS sequential mode OR batch mode, IIFE wrapping, cache storage
- **Stage 4**: Execute in Tab — Blob injection (primary), CSP fallback to textContent, last-resort ISOLATED world
- **Stage 5**: Populate Data Namespaces — 5a Settings + llmGuide, 5b Projects per CodeName
- **Post-pipeline**: Log mirroring, performance budget check, 6-global verification, toast result

### Step 2: Explicitly document removed/not-implemented items
- **REMOVED**: Old "Stage 5: Script-to-Script Communication" (now implicit via namespace)
- **REMOVED**: Old "Stage 7: Dynamic Loading (Runtime)" — not in current pipeline diagram
- **REMOVED**: Templates preamble (`window.__MARCO_TEMPLATES__`) — no longer in asset order
- **REMOVED**: Prompts SQLite seeding from asset injection order (removed in v7.43)
- **CHANGED**: CSP fallback is now 3-tier (Blob → textContent → ISOLATED) not simple script element

### Step 3: Update supporting sections
- Update Asset Injection Order to match diagram (CSS → config/theme JSON → JS)
- Update Path Resolution to reflect chrome.storage.local model (not file paths)
- Add Cache Gate section
- Add Post-Pipeline Verification section

Each step will be done as you say "next".