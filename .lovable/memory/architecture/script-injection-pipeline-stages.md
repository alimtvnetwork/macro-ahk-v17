# Script Injection Pipeline Stages

Updated: 2026-03-26

The project uses a structured script injection pipeline for CSP bypass:

1. **Stage 0: Dependency Resolution** — prepend dependency project scripts in topological order
2. **Stage 1: Script Resolution** — resolve script bindings to injectable code
3. **Stage 1.5: MAIN-World Namespace Bootstrap** — `bootstrapNamespaceRoot()` creates `window.RiseupAsiaMacroExt = { Projects: {} }` via direct `chrome.scripting.executeScript` in MAIN world (NO fallback). If CSP blocks this, health transitions to DEGRADED and a loud console error warns the user that Developer Guide console access won't work.
4. **Stage 2: Relay + Token Seeding** — ensure message relay content script + seed session tokens
5. **Stage 3: Wrap** — wrap each script with error isolation IIFE + SDK preamble
6. **Stage 4: Execute** — inject via `injectWithCspFallback(tabId, code, "MAIN")`. If fallback is used, a warning is logged noting that `window.marco` was created in a non-MAIN world.
7. **Stage 5a: Settings Namespace** — `RiseupAsiaMacroExt.Settings` + `docs.llmGuide`. If MAIN world injection fails, health transitions to DEGRADED with explicit error.
8. **Stage 5b: Per-Project Namespaces** — `RiseupAsiaMacroExt.Projects.<CodeName>`. Same DEGRADED transition + loud error on fallback.

This sequence ensures that:
- The `RiseupAsiaMacroExt` root object exists in MAIN world before any namespace registration
- CSP failures are surfaced loudly (console errors + health degradation) rather than silently falling back to invisible worlds
- Developer Guide console access (`RiseupAsiaMacroExt.Projects.MyProject.vars.get("key")`) works as documented on pages without CSP restrictions
