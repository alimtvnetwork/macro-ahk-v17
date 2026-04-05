# Plan — Automation Engine + Storage UI Redesign

**Updated**: 2026-04-03  
**Status**: Phase 05 V2 JSON config validation complete. Issue 90 fixed. Extension v2.01.0.  
**Extension Version**: v1.60.0 | **Macro Controller**: v7.42

---

## Active Work — Credit Monitoring + Prompts Pipeline Update

### Phase A: Auth Bridge — TTL-Aware `getBearerToken()`

**Goal**: Add a public `getBearerToken(options?)` to auth system. Checks token age vs configurable TTL. Returns cached or refreshes from cookie.

| Step | File | Change | Status |
|------|------|--------|--------|
| A1 | `02-macro-controller-config.json` | Add `authBridge.tokenTtlMs` (default 120000) | ✅ |
| A2 | `src/types/config-types.ts` | Add `AuthBridgeConfig` interface | ✅ |
| A3 | `src/auth-resolve.ts` | Add `getTokenSavedAt()`, `saveTokenWithTimestamp()`, `getTokenAge()` helpers | ✅ |
| A4 | `src/auth-recovery.ts` | Add `getBearerToken(options?)` — TTL check + force flag + `getRawToken()` | ✅ |
| A5 | `src/auth.ts` | Re-export `getBearerToken`, `getRawToken`, `GetBearerTokenOptions` | ✅ |

### Phase B: Credit Fetch — Retry-Once-On-Refresh + Loading State

**Goal**: Use `getBearerToken()` (TTL-aware), add loading state, retry once with force-refresh on 401/403, focus workspace on success.

| Step | File | Change | Status |
|------|------|--------|--------|
| B1 | `src/credit-fetch.ts` | Replace `resolveTokenWithRecovery()` with `getBearerToken()`, force on retry | ✅ |
| B2 | `src/ui/panel-controls.ts` | Credits button uses `getBearerToken()`, extracted `setCreditBtnLoading()`, removed `isTokenExpired` | ✅ |

### Phase C: Prompts Pipeline — Dual Cache + Manual Load (No SWR)

**Goal**: Remove SWR. Load from IndexedDB on open. Manual "Load" button. Dual cache (JsonCopy + HtmlCopy).

| Step | File | Change | Status |
|------|------|--------|--------|
| C1 | `src/ui/prompt-cache.ts` | Dual-record (JsonCopy + HtmlCopy), removed TTL, generic IDB helpers, DB_VERSION→3 | ✅ |
| C2 | `src/ui/prompt-loader.ts` | Removed `_backgroundRevalidate()`, added `forceLoadFromDb()`, `saveHtmlCopy()` | ✅ |
| C3 | `src/ui/prompt-dropdown.ts` | Added "🔄 Load" button in header, saves HtmlCopy after render | ✅ |

### Coding Standards (all phases)

- **Max 8 lines** per function body
- **Max 3 parameters** (use options objects)
- **Explicit types** — no `any`, no `unknown`
- **PascalCase** for types, camelCase for functions/vars
- **Logging** at every decision point
- **Atomic functions** — single responsibility

---

## Issue Tracker

| # | Issue | Severity | Spec | Status |
|---|---|---|---|---|
| 76 | Cookie namespace binding gap | High | `spec/01-app-issues/76-cookie-namespace-binding-gap.md` | ✅ |
| 77 | Live script hot-reload from extension | Enhancement | `spec/01-app-issues/77-live-script-hot-reload.md` | ✅ |
| 79 | Migrate `window.__*` globals to namespace | Standards | `spec/01-app-issues/79-migrate-window-globals-to-namespace.md` | ✅ |
| 80 | Auth bridge returns no token on preview tabs | P0 | `spec/01-app-issues/80-auth-token-bridge-null-on-preview.md` | ✅ |
| 81 | Auth still fails due stale runtime macro bundle | P0 | `spec/01-app-issues/81-auth-no-token-stale-macro-bundle.md` | ✅ |
| 83 | Globals not injected + auth cookie header stripped | P0 | `spec/01-app-issues/83-dependency-globals-auth-fixes.md` | ✅ |
| 85 | SDK Notifier, Config Seeding & Database Overhaul | P1 | `spec/01-app-issues/85-sdk-notifier-config-seeding-database-overhaul.md` | ✅ |
| 86 | SDK Notifier, Config & DB Overhaul (consolidated) | P1 | `spec/01-app-issues/86-sdk-notifier-config-db-overhaul.md` | ✅ |
| 87 | Injection Pipeline Performance (≤500ms) | P0 | `spec/01-app-issues/87-injection-pipeline-performance/` | ✅ |
| 88 | IndexedDB Injection Cache & Script UI Not Loading | P1 | `spec/01-app-issues/88-indexeddb-injection-cache.md` | ✅ |
| 90 | Prompt click pastes wrong prompt text | P1 | `spec/01-app-issues/90-prompt-click-target-mismatch.md` | ✅ |

---

## Completed Phases

| Phase | Description | Status |
|---|---|---|
| 9 | Namespace Migration (Issue 79) | ✅ |
| 10 | Auth Stabilization (Issue 80) | ✅ |
| 11 | Issue 85: JSON Schema Meta Engine | ✅ |
| 12 | Spec 21: Advanced Automation (types, engine, UI, persistence, drag-drop) | ✅ |
| 13 | Spec 55: Storage UI Redesign (4 categories, search, bulk ops) | ✅ |
| 14 | Issue 86: SDK Notifier, Config Seeding, DB Overhaul (13 tasks) | ✅ |
| 15 | Issue 87: Injection Pipeline Performance (8 optimization tasks) | ✅ |

---

## Pending Work — TS Migration V2

| Phase | Spec File | Priority | Status | Objective |
|---|---|---|---|---|
| 01 | `ts-migration-v2/01-initialization-fix.md` | Critical | ✅ Done (v1.75.0) | Fix startup race condition |
| 02 | `ts-migration-v2/02-class-architecture.md` | High | ✅ Done | Class-based modules with DI |
| 03 | `ts-migration-v2/03-react-feasibility.md` | Medium | ✅ Not Proceeding | React not justified for macro UI |
| 04 | `ts-migration-v2/04-performance-logging.md` | High | ✅ Done | Configurable logging, DOM caching |
| 05 | `ts-migration-v2/05-json-config-pipeline.md` | Medium | ✅ Done | JSON config pipeline replacing INI |
| 06 | `ts-migration-v2/06-http-to-sdk-migration.md` | High | ✅ Done (v1.74.0) | SDK wrappers replacing raw fetch |

---

## Active Work — ESLint Zero-Warning Zero-Error

**Baseline** (2026-04-02): 568 errors, 822 warnings (1390 total)
**Current** (2026-04-02): **0 errors, 0 warnings** ✅ — All groups complete

### Execution Summary

| Group | Phases | Errors Fixed | Warnings Fixed | Cumulative |
|---|---|---|---|---|
| **A** | 1A–1I | −16 | −29 | 1345 |
| **B** | 2A–2B | 0 | −152 | 1193 |
| **C** | 3A | −446 | 0 | 747 |
| **D** | 4A–4C | −106 | 0 | 641 |
| **E** | 5A–5B | 0 | −411 | 230 |
| **F** | 6A–6D | 0 | −230 | **0** |

**🎉 Target achieved: 1390 → 0 (zero errors, zero warnings)**

---

## Notes

- Issue 85 delivered the JSON-driven schema meta engine with three per-project SQLite meta tables, idempotent migration, and dual-format doc generation.
- Spec 21 Phases 1-2 fully implemented: execution engine, all step types, condition evaluators, visual builder UI, and 46 unit tests.
- Spec 55 (Phase 13) complete — Storage UI has 4 category cards, per-category search/filter, cross-category search bar, and JSON export.
- Issue 86 consolidates: SDK notifier regression, config seeding, trace button placement, and project database panel overhaul.
- Issue 88: IndexedDB injection cache with auto-invalidation on deploy and manual invalidation button in popup.
- ESLint SonarJS: Integrated 2026-04-01 with tuned thresholds and dead-code rules disabled for SDK/injection architecture compatibility.
- Version sync: Extension v1.60.0, validated via `scripts/check-version-sync.mjs`.
- Axios pinned to `1.14.0` per supply-chain security policy (`spec/02-data-and-api/axios-version-control.md`).
- **Reliability report v2**: Overall AI handoff success at 91% (up from 89%). See `.lovable/memory/workflow/05-reliability-risk-report-v2.md`.
- **ESLint cleanup**: Started 2026-04-02. Macro-controller reduced from 42→7 warnings. Full zero-target plan created with 6 groups (A–F).
