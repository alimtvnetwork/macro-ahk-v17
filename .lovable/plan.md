## Error Logging & Type Safety — ✅ COMPLETE

**Spec**: `spec/10-macro-controller/ts-migration-v2/08-error-logging-and-type-safety.md`

| Task | Description | Status |
|------|-------------|--------|
| T1 | Create `NamespaceLogger` class in SDK | ✅ Complete |
| T2 | Update `globals.d.ts` with full namespace + Logger types | ✅ Complete |
| T3 | Fix all 16 swallowed errors (S1–S16) | ✅ Complete |
| T4 | Eliminate all `any` types (5 files) | ✅ Complete |
| T5 | Migrate controller `log(msg, 'error')` calls to `Logger.error()` | ✅ Complete |
| T6 | Verify: `tsc --noEmit` passes, ESLint zero errors | ✅ Complete |

---

## Constants Enum Reorganization — ✅ COMPLETE

Grouped 85+ constants into 8 string enums in `types/`: DomId, DataAttr, StyleId, StorageKey, ApiPath, PromptCacheKey, Label, CssFragment. 317 enum references across 56 files.

---

## Rename Preset Persistence — ✅ COMPLETE

**Spec**: `spec/10-macro-controller/ts-migration-v2/07-rename-persistence-indexeddb.md`

| Task | Description | Status |
|------|-------------|--------|
| 1 | Create generic `ProjectKvStore` module (IndexedDB) | ✅ `project-kv-store.ts` |
| 2 | Create `RenamePresetStore` module | ✅ `rename-preset-store.ts` |
| 3 | Add `buildPresetRow()` UI helper | ✅ `bulk-rename-fields.ts` (previously done) |
| 4 | Integrate persistence into `bulk-rename.ts` | ✅ (previously done) |
| 5 | Update barrel exports | ✅ `workspace-rename.ts` simplified to barrel |
| 6 | Version bump | ❌ Pending |
