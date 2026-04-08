# 02 — CI Workflow

**File**: `.github/workflows/ci.yml`
**Triggers**: Push to `main`
**Concurrency**: Cancel previous in-flight builds when a new commit lands

## Pipeline Steps (in order)

```
1. Checkout          → actions/checkout@v4 (fetch-depth: 0)
2. Setup Node.js     → actions/setup-node@v4 (node 20)
3. Setup pnpm        → pnpm/action-setup@v4 (pnpm 9)
4. Install root deps → pnpm install --no-frozen-lockfile
5. Install ext deps  → cd chrome-extension && pnpm install
6. Lint              → pnpm run lint
7. Test              → pnpm run test
8. Build SDK         → pnpm run build:sdk
9. Build XPath       → pnpm run build:xpath
10. Build Controller → pnpm run build:macro-controller
11. Build Extension  → pnpm run build:extension
12. Summary          → echo status
```

## Concurrency Strategy

```yaml
concurrency:
  group: ci-main-${{ github.sha }}
  cancel-in-progress: true
```

A new push to `main` cancels any in-progress CI run. This saves runner minutes
since only the latest commit matters.

## Dependency Installation Notes

**Root** (`/`): Uses `--no-frozen-lockfile` because the lockfile may not exist
in all environments (Lovable editor doesn't generate one).

**Extension** (`chrome-extension/`): Tries `--frozen-lockfile` first (if lockfile exists),
falls back to `--no-frozen-lockfile --lockfile=false`. Also removes `pnpm-workspace.yaml`
which may contain local-only Windows store paths.

## Lint Configuration

- ESLint 9 flat config (`eslint.config.js`)
- `eslint-plugin-sonarjs` for code quality (cognitive complexity, function size)
- Zero warnings policy: `--max-warnings 0` enforced
- Different function-size limits per directory:
  - Default: 25 lines
  - React components (`src/components/`, `src/pages/`): 50 lines
  - Background/hooks/lib: 40 lines
  - Standalone scripts: 50 lines
  - Tests: unlimited

## Test Configuration

- Vitest with `vitest run` (single pass, no watch)
- jsdom environment for DOM-dependent tests
- Tests located in `src/__tests__/`, `src/test/`, and `**/__tests__/`

## What "Build Extension" Does Internally

The `build:extension` script chains several validation steps before the actual Vite build:

```
check-axios-version → lint-const-reassign → compile-instruction (×3)
→ check-standalone-dist → check-version-sync → vite build
```

See [05-build-chain.md](05-build-chain.md) for details.
