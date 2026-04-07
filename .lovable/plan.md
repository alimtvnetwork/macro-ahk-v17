## Diagram vs Code — Gap Analysis & Implementation Plan

### What ALREADY matches (no changes needed)
- ✅ Pre-pipeline: `performance.now()` start, active tab query, pipeline START log
- ✅ Loading toast: spinner injected immediately
- ✅ Stage 0a: `ensureBuiltinScriptsExist` with self-heal
- ✅ Stage 0b: `prependDependencyScripts` with topological sort
- ✅ Stage 1: `resolveInjectionRequestScripts` with HARD ERROR on unresolvable
- ✅ Stage 1 early exit: pipeline halts if zero scripts resolved
- ✅ Stage 2: `Promise.all([bootstrapNamespaceRoot, ensureRelayInjected, seedTokensIntoTab])`
- ✅ Stage 3: CSS check → sequential mode, or batch mode (wrap + combine)
- ✅ Stage 4: Blob injection as primary method in `csp-fallback.ts`
- ✅ Stage 5: Settings + Project namespaces (parallel)
- ✅ Post: Performance budget check, `verifyPostInjectionGlobals` (6 globals), log mirroring, final toast (success/warn/error)

### GAPS — Code changes needed

#### Phase 1: Add Force Run + Cache Gate
**Gap**: Diagram shows `forceReload` flag and IndexedDB cache gate that skips Stages 0–3 on cache HIT. Code has `injection-cache.ts` but does NOT use it as a pipeline cache gate — every run always goes through all stages.

Tasks:
1. Add `forceReload` flag support to `handleInjectScripts` (accept from message, log FORCE RUN)
2. After toast, add cache gate: check IndexedDB for cached wrapped payload by version key
3. On HIT → skip Stages 0–3, jump to Stage 4 with cached payload
4. On MISS/CORRUPT → proceed normally
5. After Stage 3 combine → store wrapped payload in IndexedDB cache
6. On forceReload → delete cached entry before proceeding to Stage 0a
7. Update popup to pass `forceReload` flag on Force Run button click

#### Phase 2: Align CSP Fallback Chain with Diagram
**Gap**: Diagram shows 3 tiers: Blob → textContent → ISOLATED. Code has 4+ tiers: MAIN blob → USER_SCRIPT → ISOLATED blob → ISOLATED eval. The diagram is simpler than reality.

**Recommendation**: Do NOT simplify the code — the extra tiers improve reliability. Instead, update the diagram/spec to reflect the actual 4-tier chain. This is a spec/diagram correction, not a code change.

Tasks:
1. Update spec Stage 4 to document the actual 4-tier fallback: MAIN blob → USER_SCRIPT (Chrome 135+) → ISOLATED blob → ISOLATED eval
2. Update the diagram to show 4 tiers instead of 3

#### Phase 3: Align Stage 5 Sequencing
**Gap**: Diagram shows Stage 5 runs AFTER Stage 4 results. Code runs Stage 5 IN PARALLEL with Stages 3+4 for performance.

**Recommendation**: The parallel execution is an intentional optimization. Update the diagram/spec to reflect reality rather than slowing down the code.

Tasks:
1. Update spec to note Stage 5 runs in parallel with Stage 3+4 (not after)
2. Update diagram to show parallel arrow from Stage 3+4 entry to Stage 5

### Summary
- **Phase 1** (code changes): Add forceReload + cache gate — the main missing feature
- **Phase 2** (spec/diagram update): CSP fallback chain documentation — 4 tiers not 3
- **Phase 3** (spec/diagram update): Stage 5 parallel timing — match reality

Each phase will be implemented as you say "next".