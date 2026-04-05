# Contributing Guide

Guidelines for contributing to the Marco Chrome Extension.

---

## Branch Conventions

| Branch | Purpose |
|--------|---------|
| `main` | Stable release branch — always deployable |
| `release/v*` | Release candidates, tagged and versioned |
| `feat/<name>` | New features (`feat/smart-workspace-switch`) |
| `fix/<name>` | Bug fixes (`fix/injection-focus-steal`) |
| `refactor/<name>` | Code restructuring, no behavior change |
| `docs/<name>` | Documentation-only changes |

- Branch from `main` for all work.
- Keep branches short-lived — merge or rebase within a few days.
- Delete branches after merge.

---

## Versioning

Versions are strictly aligned across:
- Chrome extension manifest (`manifest.json`)
- All standalone macro-controller scripts

Any code change must bump at least a minor version everywhere. See the [Version History](spec/00-overview/10-version-history-summary.md) and [CHANGELOG](CHANGELOG.md) for release notes.

> ⚠️ The `.release` folder must remain unmodified.

---

## Code Style

### TypeScript / React

- **Strict TypeScript** — no `any` unless absolutely necessary (document why).
- **Functional components** with hooks. No class components.
- **Named exports** preferred over default exports.
- Use **semantic Tailwind tokens** (`bg-primary`, `text-foreground`) — never raw colors (`bg-blue-500`, `text-white`).
- Components go in `src/components/`, grouped by feature.
- Hooks go in `src/hooks/`.
- Keep files under ~200 lines. Extract when they grow.

### Naming

| Item | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `WorkspaceDropdown.tsx` |
| Hooks | camelCase, `use` prefix | `useWorkspaceCredits.ts` |
| Utilities | camelCase | `formatCredits.ts` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| CSS classes | kebab-case via Tailwind | `text-muted-foreground` |

### PowerShell (Build Scripts)

- Use approved verbs (`Get-`, `Set-`, `Invoke-`).
- Parameters with `[CmdletBinding()]` and typed params.
- Verbose output behind `-Verbose` or project `-v` flag.

---

## Pull Request Process

1. **Create a branch** from `main` using the naming convention above.
2. **Make focused changes** — one feature or fix per PR.
3. **Test locally**:
   ```sh
   pnpm lint
   pnpm test
   .\run.ps1 -q    # quick build to verify extension compiles
   ```
4. **Update docs** if your change affects:
   - Build flags → update `readme.md`
   - Version bump → update `CHANGELOG.md` and version strings
   - Specs → update relevant file in `spec/`
5. **Open PR** with a clear title and description:
   - What changed and why
   - How to test
   - Screenshots for UI changes
6. **Address review feedback** promptly.
7. **Squash merge** into `main` — keep history clean.

---

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body]
```

| Type | When |
|------|------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change, no new behavior |
| `docs` | Documentation only |
| `build` | Build system or dependencies |
| `test` | Adding or updating tests |
| `chore` | Maintenance, config changes |

Examples:
```
feat(workspace): add smart switching to skip depleted
fix(injection): resolve focus-steal on detached console
docs(readme): add build flag reference table
build(ps1): add -q quick mode flag
```

---

## Project Structure Rules

- **`src/`** — React options UI and shared modules only.
- **`chrome-extension/`** — MV3 extension code (background, content scripts, popup).
- **`standalone-scripts/`** — Injectable scripts, independent of React build.
- **`spec/`** — All documentation. One topic per folder, no duplicates.
- **`scripts/ps-modules/`** — PowerShell build modules.

Do not add backend server code (Node.js, Python, etc.) to the project — this is a client-side extension.

---

## Need Help?

- Check `spec/` for architecture docs and issue write-ups.
- Review [CHANGELOG.md](CHANGELOG.md) for recent changes.
- Look at existing code for patterns before introducing new ones.
