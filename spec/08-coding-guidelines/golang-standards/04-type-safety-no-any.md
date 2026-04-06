# Go Type Safety: No `any` or `interface{}` Policy

> **Spec ID:** GO-TYPE-SAFETY-001  
> **Created:** 2026-03-22  
> **Status:** Active

---

## Rule

**`any` and `interface{}` are prohibited in production Go code.** Every variable, parameter, return type, and struct field must use a specific type or a bounded generic (`T comparable`, `T fmt.Stringer`, etc.).

### Exceptions

| Exception | Allowed Pattern | Rationale |
|-----------|----------------|-----------|
| File I/O / JSON unmarshalling | `any` as initial decode target | Unknown structure from external sources |
| Test files (`_test.go`) | Unrestricted | Test flexibility |
| Third-party library boundaries | Match library signatures | Can't control external APIs |

### Prohibited Patterns

```go
// ❌ BAD: Untyped return
func GetData() (any, error) { ... }

// ❌ BAD: Untyped map
func Process(data map[string]any) { ... }

// ❌ BAD: Untyped slice
func Collect() []any { ... }

// ❌ BAD: Untyped struct field
type Response struct {
    Data any `json:"data"`
}

// ❌ BAD: Untyped function parameter
func Broadcast(event string, data any) { ... }
```

### Required Patterns

```go
// ✅ GOOD: Typed return
func GetSettings(ctx context.Context, siteId int64) (*SiteSettings, *apperror.AppError) { ... }

// ✅ GOOD: Typed struct
type SiteHealthResponse struct {
    WpVersion  string `json:"wpVersion"`
    PhpVersion string `json:"phpVersion"`
    DbStatus   bool   `json:"dbAvailable"`
}

// ✅ GOOD: Generic when type varies legitimately
func WrapResult[T any](data T) Result[T] { ... }

// ✅ GOOD: Bounded generic
func FindById[T comparable](items []T, id T) (T, bool) { ... }

// ✅ GOOD: Interface with methods (not empty interface)
type Broadcaster interface {
    Send(event string, payload EventPayload)
}
```

### Generic Result Pattern

Replace `(any, *apperror.AppError)` returns with:

```go
// Typed result — eliminates any from handler signatures
type Result[T any] struct {
    Value T
    Err   *apperror.AppError
}

// For handler factories
type HandlerFunc[T any] func(ctx context.Context) (T, *apperror.AppError)
type SiteHandlerFunc[T any] func(ctx context.Context, siteId int64) (T, *apperror.AppError)
```

---

## Audit Results (2026-03-22)

### ✅ Already Compliant

| Category | Files | Notes |
|----------|-------|-------|
| `pkg/apperror` | Result.go, ResultMap.go, ResultSlice.go | Already fully generic `Result[T]`, `ResultMap[K,V]`, `ResultSlice[T]` |
| `pkg/dbutil` | Query.go, Result.go, ResultSet.go, Exec.go | Already fully generic. `...any` in SQL args matches `database/sql` signature (exception) |
| `pkg/apperror` Cast/Match | Cast.go, Match.go | `any` input justified — type assertion utility & panic recovery |
| Response builders | Response.go | `respondSuccess[T]`, `respondCreated[T]`, `respondList[T]` already generic |
| Envelope builders | envelope/Envelope.go | `Success[T]`, `Created[T]`, `List[T]` already generic at input |

### ⚠️ Justified Exceptions (no action needed)

| Category | Count | Reason |
|----------|-------|--------|
| `Response.Results any` | 1 field | Go doesn't support generic struct fields without making Response generic — would break shared `envelope.Write(w, Response)` pattern. The builders are generic at input. |
| `EnvelopeUnwrap.go` `map[string]any` | 3 uses | Parsing unknown PHP JSON — file I/O exception |
| `respondJson` / `isServiceMissing` / `isBodyInvalid` / `decodeJsonSilent` | 4 uses | JSON decode target & nil-check on arbitrary services — standard Go patterns |

### 🔴 Actual Violations Requiring Fix

| Category | Count | Files | Priority |
|----------|-------|-------|----------|
| Handler factory `GetService func() any` | ~12 | HandlerFactory.go, HandlerFactoryGetters.go | 🔴 High |
| Adapter interface `(any, *AppError)` returns | ~27 | AdapterSite.go + adapter implementations | 🔴 High |
| Service methods returning `any` | ~40 | RemoteLogs.go, RemoteSiteSettings.go, RemoteUsers.go, etc. | 🔴 High |
| `map[string]any` in service params | ~15 | UpdateRemoteSiteSettings, etc. | 🟡 Medium |
| `[]any` in handler responses | ~10 | HandlerFactory.go empty results | 🟡 Medium |
| WebSocket `data any` broadcast | ~8 | Hub.go, EventTypes.go, AdapterSiteWs.go | 🟡 Medium |
| Logger formatting | ~5 | Logger.go, LoggerFormat.go | 🟢 Low |

**Actionable violations: ~117 across ~35 files** (down from 259 — 142 were already compliant or justified exceptions)

---

## Revised Refactoring Plan

### Phase G-1: pkg/apperror + pkg/dbutil ✅ Already Done
Both packages already use proper generics.

### Phase G-2: Response & Envelope Layer ✅ Already Done  
Builder functions already generic. `Response.Results any` is a justified exception.

### Phase G-3: Handler Factory + Service Getters ✅ Done (2026-03-22)
- Replaced `GetService func() any` → `IsReady func() bool` in all config structs
- Made all 6 factory functions generic `[T any]` — callbacks now return `(T, *AppError)`
- Replaced `func() any` legacy wrappers with `func() bool` readiness checks
- ~25 `any` eliminated from factory infrastructure
- See `.lovable/plans/handler-factory-generic-refactoring.md` for details

### Phase G-4: Adapter Interfaces + Service Returns ✅ Done (2026-03-22)
- Created `PhpEnvelope[T]` generic type + `UnwrapPhpResult[T]` typed unwrapper
- Created typed response structs: `LogsStatusData`, `LogsClearRequestData`, `LogsClearConfirmData`, `LogsEmailResultData`, `LogsRotationStatusData`, `HealthSummaryData`, `SiteSettingsData`, `SiteSettingsUpdateResult`
- Updated `SiteServiceInterface`: all 9 `any` returns → typed returns
- Updated service methods to use `DoApiCall[PhpEnvelope[T]]` instead of `DoApiCall[map[string]any]`
- Eliminated `UnwrapPhpEnvelope(map[string]any)` usage from all typed endpoints
- Only justified `any` remaining: `UpdateRemoteSiteSettings` input `map[string]any` (dynamic PHP settings)

### Phase G-5: Service Layer map[string]any → Typed Structs ✅ Done (2026-03-22)
- Audited all remaining `map[string]any` — all are justified exceptions:
  - `UpdateRemoteSiteSettings` param: dynamic PHP settings input (arbitrary key-value)
  - `SiteSettingsUpdateResult.Updated`: dynamic key-value pairs from PHP response
  - `EnvelopeUnwrap.go`: parsing unknown PHP JSON (file I/O exception)
  - `toJson(v any)`: matches `json.Marshal` signature (library boundary)
- No actionable violations remaining

### Phase G-6: WebSocket + Logger ✅ Done
- Typed broadcast payload with `BroadcastPayload` interface
- Typed logger format args

---

### Final Violation Count (all phases complete)

| Category | Status |
|----------|--------|
| Handler factory infrastructure `any` | ✅ Eliminated (G-3) |
| Adapter interface `(any, *AppError)` returns | ✅ Eliminated (G-4) |
| Service methods returning `any` | ✅ Eliminated (G-4) |
| `map[string]any` in service params | ✅ All justified (G-5) |
| WebSocket `data any` broadcast | ✅ Eliminated (G-6) |
| Logger formatting | ✅ Matches `log/slog` pattern (justified) |
| **Remaining actionable violations** | **0** |

*Reference: `.lovable/plan.md` Phase G (Type Safety)*
