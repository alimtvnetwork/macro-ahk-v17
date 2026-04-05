# Suggestions & Improvements Tracker

**Last Updated**: 2026-04-05
**Current AHK Version**: v7.23
**Current Extension Version**: v2.5.0
**Macro Controller Version**: v7.38
**Active Codebase**: `marco-script-ahk-v7.latest/`

---

## Workflow Convention

### Location
All suggestions tracked in this single file: `.lovable/memory/suggestions/01-suggestions-tracker.md`

### Suggestion Format
Each suggestion includes:
- **ID**: `S-NNN` (sequential)
- **createdAt**: Date suggestion was created
- **source**: Who/what suggested it (Lovable, user, risk report)
- **affectedProject**: Which controller/module
- **description**: What to do
- **rationale**: Why it matters
- **status**: `open` | `inProgress` | `done`
- **priority**: High | Medium | Low
- **completionNotes**: (filled when done)

### Completion Handling
When a suggestion is completed:
1. Update status to `done` and add completionNotes
2. Move entry to "Completed Suggestions" table below
3. Keep the ID permanently (no reuse)

---

## Active (Pending) Suggestions

### S-021: Chrome Extension Test Coverage Expansion
- **createdAt**: 2026-03-14
- **source**: Lovable
- **affectedProject**: Chrome extension (`tests/`) + React UI (`src/popup/`, `src/options/`)
- **description**: React UI smoke tests added (35 new tests). Further coverage ongoing — deeper integration tests needed. Target: 900+ tests for PopupApp, OptionsApp, ProjectsSection, ProjectEditor, DiagnosticsPanel.
- **status**: open
- **priority**: Medium

### S-046: TS Migration V2 — Phase 02 Class Architecture
- **createdAt**: 2026-03-21
- **source**: Spec (`ts-migration-v2/02-class-architecture.md`)
- **affectedProject**: Macro controller
- **description**: Refactor to class-based modules, remove window globals.
- **status**: open
- **priority**: High

### S-047: TS Migration V2 — Phase 04 Performance & Logging
- **createdAt**: 2026-03-21
- **source**: Spec (`ts-migration-v2/04-performance-logging.md`)
- **affectedProject**: Macro controller
- **description**: Configurable logging, DOM caching, observer throttling.
- **status**: open
- **priority**: High

### S-048: TS Migration V2 — Phase 05 JSON Config Pipeline
- **createdAt**: 2026-03-21
- **source**: Spec (`ts-migration-v2/05-json-config-pipeline.md`)
- **affectedProject**: Macro controller
- **description**: JSON-driven config pipeline for macro controller settings.
- **status**: open
- **priority**: Medium

### S-049: E2E Verification of React UI Unification (Step 10)
- **createdAt**: 2026-03-16
- **source**: Unification checklist
- **affectedProject**: Chrome extension
- **description**: Manual E2E verification: load extension in Chrome, verify popup, options, CRUD, script injection, XPath recorder, log export, SQLite bundle, context menu, hot-reload, preview environment.
- **status**: open (blocked — requires manual Chrome testing)
- **priority**: High

### S-051: TS Migration V2 — Phase 03 React Feasibility Evaluation
- **createdAt**: 2026-03-21
- **source**: Spec (`ts-migration-v2/03-react-feasibility.md`)
- **affectedProject**: Macro controller
- **description**: Evaluate feasibility of migrating macro controller UI to React. Deferred pending modularization.
- **status**: open
- **priority**: Medium

### S-052: Issue 52/53 E2E Verification (Prompt Click)
- **createdAt**: 2026-04-01
- **source**: Issue tracker
- **affectedProject**: Macro controller prompts
- **description**: Issues 52 (prompt click does nothing) and 53 (prompt click only works on 2nd item) have code fixes but need E2E verification in live environment.
- **status**: open (blocked — requires manual Chrome testing)
- **priority**: Medium

### S-053: Injection Pipeline Waterfall Diagram
- **createdAt**: 2026-04-05
- **source**: Lovable
- **affectedProject**: Documentation
- **description**: Created Mermaid diagram of the full Run Scripts → Injection pipeline waterfall. Covers all 5 stages, CSP fallback, and namespace registration.
- **status**: done
- **priority**: Low
- **completionNotes**: Output at `/mnt/documents/run-scripts-injection-pipeline.mmd`

### S-054: compile-instruction.mjs Preamble Regex Fix
- **createdAt**: 2026-04-05
- **source**: Build error
- **affectedProject**: Build pipeline (`scripts/compile-instruction.mjs`)
- **description**: Fixed preamble const regex to tolerate leading whitespace and use non-greedy value capture, preventing `LOVABLE_BASE_URL is not defined` errors during SDK instruction compilation.
- **status**: done
- **priority**: Critical
- **completionNotes**: v2.5.0 — regex updated with `^\s*` prefix and `.+?` non-greedy match

---

## Completed Suggestions (Summary)

| ID | Description | Completed | Version | Notes |
|----|-------------|-----------|---------|-------|
| S-001 | XPath Auto-Detection for All Elements | 2026-02-17 | v4.9 | Multi-method findElement() |
| S-002 | Persist UI Across SPA Navigation | 2026-02-17 | v4.9 | MutationObserver |
| S-003 | Keyboard Shortcut Conflict Resolution | 2026-02-17 | v4.9 | Page-awareness checks |
| S-004 | Error Notifications via Tray | 2026-02-17 | v4.9 | TrayTip on failures |
| S-005 | Auto-Retry Failed Combo Steps | 2026-02-17 | v4.9 | Retry with backoff |
| S-006 | JS Execution History | 2026-02-22 | v7.9.8 | ArrowUp/Down recall |
| S-007 | Config Hot-Reload | 2026-03-14 | v7.17 | FileGetTime polling |
| S-008 | Mark Active Version in Repo | 2026-02-17 | v4.9 | README marker |
| S-009 | DevTools Error Path | 2026-02-22 | v7.9.8 | VerifyInjectionSuccess |
| S-010 | Delegate Timeout | 2026-02-21 | v7.9.7 | Deprecated; API-direct |
| S-011 | End-to-End Test Scenarios | 2026-03-14 | v7.17 | 22 suites, 150+ tests |
| S-012 | XPath Self-Healing with CSS Fallback | 2026-02-25 | v7.17 | 10 CSS selectors |
| S-013 | Config.ini Schema Validation | 2026-02-25 | v7.17 | 8 schema types |
| S-014 | Fix Cross-Reference Inconsistencies | 2026-02-25 | v7.10.3 | All refs updated |
| S-015 | Tier 1 API Removal | 2026-02-25 | v7.17 | mark-viewed POST removed |
| S-016 | Token Expiry UI on 401/403 | 2026-02-25 | v7.17 | markBearerTokenExpired |
| S-017 | Check Button Works Without API | 2026-02-25 | v7.17 | Falls through to XPath |
| S-018 | Controller Injection XPath Fix | 2026-02-25 | v7.17 | div[2]→div[3] |
| S-019 | Verbose CSS Selector Logging | 2026-02-25 | v7.17 | Per-selector logs |
| S-020 | Export Bundle | 2026-02-25 | v7.17 | Full bundle download |
| S-022 | Chrome Version Compatibility Matrix | 2026-03-15 | v1.16 | Spec file created |
| S-023 | Profile Picker Fix | 2026-03-15 | v1.16 | --profile-directory |
| S-024 | Complete React UI Unification | 2026-03-16 | v1.18 | All 12 steps done |
| S-025 | Hover Micro-Interactions | 2026-03-15 | v2.4.0 | Tailwind transitions |
| S-026 | Animate List-to-Editor Transition | 2026-03-15 | v2.4.0 | CSS keyframe animations |
| S-027 | Build Verification | 2026-03-15 | v1.17 | 6.65s build, all outputs verified |
| S-028 | Document CDP Injection Alternative | 2026-03-16 | — | Full spec created |
| S-029 | AI Onboarding Checklist | 2026-03-16 | — | spec/00-master-overview.md |
| S-030 | Startup loads workspaces immediately | 2026-03-20 | v7.36 | fetchLoopCreditsAsync on init |
| S-031 | Check button fast-path + page guard | 2026-03-20 | v7.37 | Skip bridge if token cached |
| S-032 | Changelog in controller menu | 2026-03-20 | v7.37 | Menu item shows changelog |
| S-033 | SQLite parameterized queries | 2026-03-20 | v1.49.0 | All queries parameterized |
| S-034 | Color contrast overhaul | 2026-03-20 | v7.37 | Highlighter yellow theme |
| S-035 | Auth status badge | 2026-03-20 | v7.37 | Next to version in title |
| S-036 | Auth badge click-to-refresh | 2026-03-20 | v7.37 | Manual token refresh on click |
| S-037 | Loop countdown timer | 2026-03-20 | v7.37 | Color-shifting badge |
| S-038 | Startup delay reduced 500→200ms | 2026-03-20 | v7.36 | Bridge registers synchronously |
| S-039 | Code Coverage prompts added | 2026-03-20 | v7.37 | Category: Code Coverage |
| S-040 | Prompt folder structure migration | 2026-03-21 | v1.50.0 | info.json + prompt.md per folder |
| S-041 | Build-time prompt aggregation script | 2026-03-21 | v1.50.0 | scripts/aggregate-prompts.mjs |
| S-042 | Task Next automation feature | 2026-03-21 | v7.38 | Sub-menu, presets, KV persistence |
| S-043 | Next Tasks prompt added | 2026-03-21 | v7.38 | Category: automation |
| S-044 | ESLint SonarJS Integration | 2026-04-01 | v2.3.0 | Both configs, dead-code rules off |
| S-045 | TS Migration V2 — Phase 01 Init Fix | 2026-04-01 | v1.75.0 | startup.ts reordered |
| S-050 | ESLint SonarJS Full Scan | 2026-04-05 | v2.4.0 | 0 errors, 0 warnings |
| S-053 | Injection Pipeline Diagram | 2026-04-05 | v2.5.0 | Mermaid waterfall diagram |
| S-054 | compile-instruction.mjs regex fix | 2026-04-05 | v2.5.0 | Preamble whitespace + non-greedy |

---

## Known Issues (Current)

### I-003: DevTools Requirement (LOW — mitigated)
- **severity**: Low
- **description**: Silent failure if DevTools not open
- **mitigation**: Two-branch injection, domain guards, VerifyInjectionSuccess

*No known blocking issues as of v2.5.0.*

---

## Engineering Principles Reference

See `/spec/06-coding-guidelines/engineering-standards.md` for all 26 standards.
