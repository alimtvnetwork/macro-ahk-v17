# 03 — Release Workflow

**File**: `.github/workflows/release.yml`
**Triggers**: Push to `release/*` branches (e.g. `release/v2.119.0`)
**Concurrency**: Never cancelled — every release commit must produce a GitHub Release

## Pipeline Steps

Steps 1–11 are identical to the CI workflow (lint → test → build).

After build, the release adds:

```
12. Package assets   → Create ZIP files for each component
13. Generate notes   → Auto-generate release notes from git history
14. GitHub Release    → Create tagged release with all assets
```

## Release Assets Produced

| Asset | Contents |
|-------|----------|
| `marco-extension-{VER}.zip` | Chrome extension dist (load unpacked) |
| `macro-controller-{VER}.zip` | Standalone macro controller |
| `marco-sdk-{VER}.zip` | SDK library |
| `xpath-{VER}.zip` | XPath utility |
| `prompts-{VER}.zip` | Prompt templates (if exists) |
| `install.sh` | Bash installer for Linux/macOS |
| `install.ps1` | PowerShell installer for Windows |
| `VERSION.txt` | Plain-text version identifier |
| `CHANGELOG.md` | Full project changelog |

## Version Extraction

The version is derived from the branch name:
```
refs/heads/release/v2.119.0  →  v2.119.0
```

This version is used for:
- ZIP filenames
- GitHub Release tag and title
- VERSION.txt content

## Release Notes Generation

Auto-generated from git commit history using conventional commit prefixes:
- `feat:` → Features section
- `fix:` → Bug Fixes section
- `refactor:`, `chore:`, `docs:`, etc. → Maintenance section

Includes an assets table and install instructions (PowerShell, Bash, manual).

## GitHub Release Action

Uses `softprops/action-gh-release@v2`:
```yaml
tag_name: v2.119.0
name: "Marco Extension v2.119.0"
body_path: release-assets/RELEASE_NOTES.md
files: release-assets/*
draft: false
prerelease: false
```

## Permissions

Release workflow needs `contents: write` to create tags and releases.
CI workflow only needs `contents: read`.
