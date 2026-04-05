# Memory: project/documentation-hierarchy
Updated: 2026-03-30

Project documentation is consolidated in the `spec/` directory using a numbered hierarchy:

| Folder | Content |
|--------|---------|
| `00-overview/` | Master docs, architecture overview, version history |
| `02-data-and-api/` | Data schemas, API samples, DB join specs, JSON schema guides |
| `01-app-issues/` | Bug reports, issue tracking, debugging notes |
| `03-tasks/` | Roadmap, task breakdowns, feature planning |
| `04-macro-controller/` | Macro controller specs: credits, workspaces, UI, TS migrations |
| `05-chrome-extension/` | Extension architecture, build, message protocol, testing |
| `06-coding-guidelines/` | Unified coding standards (TS, Go, PHP, Chrome, engineering) |
| `07-devtools-and-injection/` | DevTools injection, SDK conventions, per-project architecture |
| `08-features/` | Feature specs: PStore, advanced automation, cross-project sync |
| `09-imported/` | Imported external specs: error management, WordPress, PowerShell |
| `10-prompts/` | AI prompt samples and prompt folder structure |
| `archive/` | Legacy AHK specs, performance audits, XMind files |

## Conventions

- Folders `00–10` ordered by dependency/priority, no gaps.
- File naming: kebab-case, descriptive. No duplicate prefix numbers.
- Single source of truth: each topic in exactly one folder.
- Cross-references use relative paths. Historical specs go to `archive/`.
- Full index: `spec/README.md`. Migration history: `spec/spec-reorganization-plan.md`.
