# Spec Directory Index

> Reorganized: 2026-03-30 · See [spec-reorganization-plan.md](./spec-reorganization-plan.md) for migration history.

---

| Folder | Description |
|--------|-------------|
| **[00-overview/](./00-overview/)** | Master docs, README, architecture overview, version history, folder policy |
| **[01-app-issues/](./01-app-issues/)** | Bug reports, issue tracking, debugging notes, root cause analysis |
| **[02-data-and-api/](./02-data-and-api/)** | Data schemas, API response samples, DB join specs, JSON schema guides |
| **[03-tasks/](./03-tasks/)** | Roadmap, task breakdowns, feature planning |
| **[04-macro-controller/](./04-macro-controller/)** | Macro controller specs: credit system, workspace management, UI, TS migrations |
| **[05-chrome-extension/](./05-chrome-extension/)** | Chrome extension architecture, build system, message protocol, testing |
| **[06-coding-guidelines/](./06-coding-guidelines/)** | Unified coding standards: TypeScript, Go, PHP, Chrome extension, engineering |
| **[07-devtools-and-injection/](./07-devtools-and-injection/)** | DevTools injection, SDK conventions, per-project architecture, assets pipeline |
| **[08-features/](./08-features/)** | Feature specs: PStore marketplace, advanced automation, cross-project sync |
| **[09-imported/](./09-imported/)** | Imported external specs: error management, WordPress, PowerShell, etc. |
| **[10-prompts/](./10-prompts/)** | AI prompt samples, prompt folder structure |
| **[archive/](./archive/)** | Legacy AHK specs, performance audits, XMind files |

---

## Conventions

- **Numbering**: Folders `00–10` are ordered by dependency/priority. No gaps.
- **File naming**: kebab-case, descriptive names. No duplicate prefix numbers.
- **Single source**: Each spec topic lives in exactly one folder. No cross-folder duplication.
- **Cross-references**: Use relative paths from the referencing file.
- **Archive**: Historical/superseded specs go in `archive/`. Never delete — archive instead.
