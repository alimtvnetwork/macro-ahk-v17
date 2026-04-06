# Codebase Type Safety Remediation Plan

> **Created:** 2026-02-12  
> **Priority:** CRITICAL  
> **Spec Reference:** `spec/04-typescript-standards/readme.md` v2.0.0  
> **Goal:** Eliminate all `any`, untyped `unknown`, `Record<string, unknown>` in API signatures, and magic strings/numbers

---

## Audit Summary

| Category | Count | Severity |
|----------|-------|----------|
| `catch (err: any)` | 11 | 🔴 Critical |
| `as any` type assertions | 5 | 🔴 Critical |
| `getQueryData<any>` | 1 | 🔴 Critical |
| `unknown` in API method signatures | 18 | 🔴 Critical |
| `Record<string, unknown>` in API params/returns | 14 | 🔴 Critical |
| `request<unknown>` (untyped endpoints) | 8 | 🟡 High |
| `unknown` in envelope/client internals | 6 | 🟢 Acceptable (parse boundaries) |
| Magic strings (status checks, action types) | ~50+ | 🟡 High |
| Magic numbers (staleTime, limits, intervals) | ~20+ | 🟡 High |

**Total violations: ~130+**

---

## Phase 1: API Type Definitions (Priority: 🔴 CRITICAL)

Create specific interfaces to replace `Record<string, unknown>` and `unknown` in `src/lib/api/`.

### P1.1 — Snapshot operation types

**File:** `src/lib/api/types.ts`

Create:
```typescript
type SnapshotScope = "all" | "wordpress" | "content" | "custom";
type SnapshotType = "full" | "incremental";

interface CreateSnapshotOptions {
  name?: string;
  scope?: SnapshotScope;
  snapshotType?: SnapshotType;
  parentId?: number;
  tables?: string[];
  workerCount?: number;
}

interface SnapshotOperationResult {
  id: number;
  status: string;
  message?: string;
  snapshotId?: number;
  filename?: string;
}

interface RestoreSnapshotOptions {
  mode?: "full" | "selective";
  tables?: string[];
  preBackup?: boolean;
}

interface CleanupSnapshotOptions {
  dryRun?: boolean;
  maxAge?: number;
  maxCount?: number;
}

interface CleanupSnapshotResult {
  deleted: number;
  dryRun: boolean;
  candidates?: string[];
}

interface SnapshotImportResult {
  id: number;
  filename: string;
  tables: number;
  totalRows: number;
}
```

### P1.2 — Site Health types

**File:** `src/lib/api/types.ts`

Create:
```typescript
interface SiteHealthCheck {
  siteId: number;
  status: SiteHealthStatus;
  checks: SiteHealthCheckItem[];
  score: number;
  checkedAt: string;
}

interface SiteHealthSummary {
  siteId: number;
  siteName: string;
  status: SiteHealthStatus;
  score: number;
  lastCheckedAt: string;
}

interface SiteHealthStats {
  totalSites: number;
  healthy: number;
  warning: number;
  critical: number;
  avgScore: number;
}

type SiteHealthStatus = "healthy" | "warning" | "critical" | "unknown";
```

### P1.3 — E2E Test types

**File:** `src/lib/api/types.ts`

Create:
```typescript
interface E2ESuite {
  id: string;
  name: string;
  description?: string;
  caseCount: number;
}

interface E2ECase {
  id: string;
  suiteId: string;
  name: string;
  status: E2ECaseStatus;
}

interface E2ERun {
  runId: string;
  status: E2ERunStatus;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  startedAt: string;
  endedAt?: string;
  results?: E2ETestResult[];
}

type E2ECaseStatus = "pending" | "running" | "passed" | "failed" | "skipped";
type E2ERunStatus = "pending" | "running" | "completed" | "aborted" | "failed";
```

### P1.4 — Update `methods.ts` signatures

Replace all `Record<string, unknown>` params and `request<unknown>` calls with the specific types from P1.1–P1.3.

---

## Phase 2: Eliminate `catch (err: any)` (Priority: 🔴 CRITICAL)

**Pattern:** Replace all 11 occurrences with bare `catch (err)` + `instanceof` narrowing.

| File | Line(s) | Current | Fix |
|------|---------|---------|-----|
| `SnapshotRetentionPolicy.tsx` | 80 | `catch (err: any)` | `catch (err) { const msg = err instanceof Error ? err.message : String(err); }` |
| `SnapshotRestoreDialog.tsx` | 67 | `catch (err: any)` | Same pattern |
| `Settings.tsx` | 896 | `catch (err: any)` | Same pattern |
| `RemoteSnapshotsPanel.tsx` | 217, 331 | `catch (err: any)` | Same pattern |
| `SyncProgressDialog.tsx` | 423 | `catch (err: any)` | Same pattern |
| `SnapshotSettingsTab.tsx` | 613, 627, 642 | `catch (err: any)` | Same pattern |

---

## Phase 3: Eliminate `as any` Assertions (Priority: 🔴 CRITICAL)

| File | Line | Current | Fix |
|------|------|---------|-----|
| `SnapshotRetentionPolicy.tsx` | 78 | `(result as any)?.deleted` | Type the `cleanupRemoteSnapshots` return as `CleanupSnapshotResult` |
| `ThemeSelector.tsx` | 149, 169 | `v as any` | Create `FontSize` and `BorderRadius` string literal types |
| `useDashboardStats.ts` | 65, 71 | `(data as any).entries` | Type the publish history response properly |
| `useDashboardStats.ts` | 77, 84, 88, 89 | `(e: any)`, `(s: any)`, `(p: any)` | Use typed array callbacks with `ErrorHistoryRecord`, `Site`, `Plugin` |
| `useTheme.ts` | 91 | `(appearance as any).sidebarTheme` | Add `sidebarTheme` to the `Settings.appearance` interface |
| `Dashboard.tsx` | 66 | `getQueryData<any>` | Use `getQueryData<DashboardStats>` with proper type |
| `BackendSection.tsx` | 368, 383, 402, 465–467 | Multiple `any` | Create typed `StackFrame` interface for Go/PHP frames |

---

## Phase 4: Make Envelope Generic (Priority: 🟡 HIGH)

**File:** `src/lib/api/envelope.ts`

```typescript
// Current
export interface RawEnvelope {
  Results: unknown[];
}

// Target
export interface RawEnvelope<T = unknown> {
  Status: EnvelopeStatus;
  Attributes: EnvelopeAttributes;
  Results: T[];
  Navigation?: EnvelopeNavigation;
  Errors?: EnvelopeErrors;
  MethodsStack?: EnvelopeMethodsStack;
}
```

The internal `unknown` for `Results` is acceptable since `parseEnvelope<T>` already provides the generic boundary. This is a parse-boundary exception.

---

## Phase 5: Constants & Enums for Magic Strings (Priority: 🟡 HIGH)

### P5.1 — Create `src/lib/constants.ts`

```typescript
// Connection
export const enum ConnectionStatus {
  Connected = "connected",
  Disconnected = "disconnected",
  Unknown = "unknown",
}

// Snapshots
export const enum SnapshotStatus {
  Complete = "complete",
  Completed = "completed",
  InProgress = "in_progress",
  Running = "running",
  Pending = "pending",
  Failed = "failed",
}

export const enum SnapshotAction {
  Create = "create",
  Restore = "restore",
  Delete = "delete",
  Export = "export",
  Import = "import",
  Cleanup = "cleanup",
}

// Activity
export const enum ActivitySource {
  Go = "go",
  WordPress = "wordpress",
}

// Publish
export const enum PublishStatus {
  Success = "success",
  Failed = "failed",
  Partial = "partial",
}

// Timing constants
export const STALE_TIME_MS = 60_000 as const;
export const SNAPSHOT_POLL_INTERVAL_MS = 5_000 as const;
export const DEFAULT_PAGE_SIZE = 25 as const;
export const TOAST_DURATION_ERROR_MS = 10_000 as const;
```

### P5.2 — Migrate all consumers

Search-and-replace all inline string comparisons with enum references.

---

## Phase 6: ActivityEntry Metadata Typing (Priority: 🟡 HIGH)

Replace `metadata: Record<string, unknown>` with a discriminated union:

```typescript
interface BaseActivityEntry<T extends ActivityType, M> {
  id: string;
  timestamp: string;
  siteId: number;
  siteName: string;
  type: T;
  action: string;
  title: string;
  metadata: M;
  source: ActivitySource;
  machineName?: string;
  version?: string;
}

type ActivityEntry =
  | BaseActivityEntry<"publish", PublishMetadata>
  | BaseActivityEntry<"snapshot", SnapshotMetadata>
  | BaseActivityEntry<"plugin", PluginMetadata>
  | BaseActivityEntry<"config", ConfigMetadata>
  | BaseActivityEntry<"connection", ConnectionMetadata>;
```

---

## Execution Order

| Priority | Phase | Effort | Dependencies |
|----------|-------|--------|--------------|
| 1 | P1 — API type definitions | Medium | None |
| 2 | P2 — Catch block fixes | Small | None |
| 3 | P3 — `as any` elimination | Small | P1 (some fixes need new types) |
| 4 | P5.1 — Constants file | Small | None |
| 5 | P1.4 — Update methods.ts | Medium | P1.1–P1.3 |
| 6 | P4 — Generic envelope | Small | None |
| 7 | P5.2 — Magic string migration | Large | P5.1 |
| 8 | P6 — Activity metadata | Medium | P5.1 |

---

## Verification

After each phase:
1. `tsc --noEmit` — zero type errors
2. Search for `\bany\b` in `src/` — zero matches (excluding comments with "any" as English word)
3. Search for `as any` — zero matches
4. Search for `catch.*any` — zero matches
5. Search for `Record<string, unknown>` in API signatures — zero matches

---

*Remediation plan v1.0.0 — 2026-02-12*
