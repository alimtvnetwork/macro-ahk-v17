# RC1–RC4 + P1–P2 Lint Scripts

## lint-readable-conditions.sh

Automated linter for [Readable Conditions (RC1–RC4)](../03-readable-conditions.md) and [Boolean Standards (P1–P2)](../02-boolean-standards.md) compliance on Go source files.

### Usage

```bash
# Lint all Go files in current directory
./scripts/lint-readable-conditions.sh .

# Lint only git-staged files (pre-commit mode)
./scripts/lint-readable-conditions.sh --staged
```

### Pre-commit Hook Setup

```bash
# Option 1: Direct hook
cp scripts/lint-readable-conditions.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

# Option 2: Add to existing pre-commit hook
echo './scripts/lint-readable-conditions.sh --staged' >> .git/hooks/pre-commit
```

### CI Integration (GitHub Actions)

```yaml
- name: RC1-RC4 + P1-P2 Lint
  run: |
    chmod +x ./scripts/lint-readable-conditions.sh
    ./scripts/lint-readable-conditions.sh .
```

### Rules Checked

| Rule | What it flags |
|------|---------------|
| RC1 | Inline `!` negation at `if` site (except exemptions) |
| RC2 | Raw comparisons (`>`, `==`, `!=`, `len()`) in `if` |
| RC3 | Compound `&&` / `\|\|` in `if` without named intermediates |
| RC4 | Missing blank line between named boolean declaration and `if` |
| P1 | Negative boolean function names (`IsNot*`, `HasNo*`) |
| P2 | Negative-word boolean variable names (`isNot*`, `hasNo*`, `not*`, `no*`) |

### RC Exemptions (auto-skipped)

- `if err != nil` — idiomatic error check
- `if !ok` — comma-ok pattern
- `if !requireService(...)` / `!decodeJSON(...)` — handler guards
- `if !strings.HasPrefix(...)` — single-use stdlib negation

### P1–P2 Exemptions (enum variant checkers)

The following function names are **exempt** from P1 because they match enum variant names (per Boolean Standards §1 exception). To add new exemptions, edit the `P1_EXEMPT_VARIANTS` array in the script.

| Exempt Name | Reason |
|-------------|--------|
| `IsNotFound` | Matches `NotFound` enum variant |
| `IsNotSet` | Matches `NotSet` enum variant |
| `IsNotApplicable` | Matches `NotApplicable` enum variant |
| `IsUnknown` | Matches `Unknown` enum variant |
| `IsUndefined` | Matches `Undefined` enum variant |
| `IsUnspecified` | Matches `Unspecified` enum variant |
| `IsNone` | Matches `None` enum variant |
| `IsInvalid` | Matches `Invalid` enum variant |
| `IsInactive` | Matches `Inactive` enum variant |
| `IsDisconnected` | Matches `Disconnected` enum variant |
| `IsUnavailable` | Matches `Unavailable` enum variant |
| `IsUnsupported` | Matches `Unsupported` enum variant |
| `IsUninitialized` | Matches `Uninitialized` enum variant |
| `IsUnresolved` | Matches `Unresolved` enum variant |
| `IsIncomplete` | Matches `Incomplete` enum variant |

### Cross-References

- [Readable Conditions spec](../03-readable-conditions.md)
- [Boolean Standards](../02-boolean-standards.md)
- [RC Compliance Report](../04-rc-compliance-report.md)
