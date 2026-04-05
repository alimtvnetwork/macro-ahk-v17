# Marco Chrome Extension

![Chrome Extension](https://img.shields.io/badge/Platform-Chrome%20%7C%20Edge-4285F4?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853?logo=googlechrome&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-9+-F69220?logo=pnpm&logoColor=white)
![License](https://img.shields.io/badge/License-Private-red)

A Chrome/Edge browser extension with a React-based options UI, script injection engine, and modular build system.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI Framework | React 18 + TypeScript 5 |
| Styling | Tailwind CSS 3 + shadcn/ui |
| Bundler | Vite 5 |
| Extension | Chrome Manifest V3 |
| Database | IndexedDB (in-browser), sql.js |
| Testing | Vitest + Playwright |
| Package Manager | pnpm |

## Project Structure

```
├── chrome-extension/     # MV3 extension (background, content scripts, popup)
├── src/                  # React options UI + shared modules
│   ├── background/       # Service worker handlers
│   ├── components/       # UI components (shadcn + custom)
│   ├── hooks/            # React hooks
│   ├── pages/            # Route pages (Options, Popup)
│   └── platform/         # Platform adapters (preview vs extension)
├── standalone-scripts/   # Injectable standalone scripts (macro, xpath, etc.)
├── scripts/              # Build tooling
│   └── ps-modules/       # PowerShell build modules
├── spec/                 # Design specs & documentation
├── tests/                # Test suites
├── run.ps1               # Main build & deploy script
└── powershell.json       # Build configuration
```

## Quick Start

### Prerequisites

- **Node.js** v20+ (LTS recommended)
- **pnpm** v9+
- **PowerShell** 7+ (for build script)

### Development (Options UI)

```sh
pnpm install
pnpm dev
```

Opens the options page at `http://localhost:5173` with hot reload.

### Build Extension

```powershell
# Full build
.\run.ps1

# Quick build (skip git pull + no sourcemaps)
.\run.ps1 -q

# Build + deploy to Chrome profile
.\run.ps1 -d

# Deploy to specific profile
.\run.ps1 -d -pr "Profile 1"

# Deploy to Microsoft Edge
.\run.ps1 -d -e edge
```

## Build Script Flags

| Flag | Alias | Description |
|------|-------|-------------|
| `-h` | `-help` | Show help message and exit |
| `-b` | `-buildonly` | Build extension only, don't deploy |
| `-s` | `-skipbuild` | Skip build, deploy existing `dist/` |
| `-p` | `-skippull` | Skip git pull step |
| `-f` | `-force` | Clean build: remove dist, caches, node_modules |
| `-i` | `-installonly` | Install/update dependencies only |
| `-r` | `-rebuild` | Complete clean reinstall (combines `-f` + `-i`) |
| `-d` | `-deploy` | Deploy extension to browser profile |
| `-pr` | `-profile` | Chrome/Edge profile name |
| `-e` | `-browser` | Browser: `chrome` or `edge` (default: `chrome`) |
| `-w` | `-watch` | Watch mode — rebuild on file changes |
| `-dm` | `-directmode` | Direct mode — load from repo `dist/` (no copy) |
| `-pf` | `-preflight` | Preflight check — verify toolchain readiness |
| `-v` | `-verbose` | Show detailed debug output |
| `-dl` | `-downloadchrome` | Download Chrome for Testing + save to config |
| `-k` | `-kill` | Kill the target browser before deploy |
| `-nsm` | `-nosourcemap` | Skip sourcemap generation for faster builds |
| `-q` | `-quick` | Quick mode — skip pull + no sourcemaps (`-p` + `-nsm`) |

## Build Pipeline

```
[1/4] Git Pull          — fetch latest changes (skipped with -p / -q)
[2/4] Prerequisites     — verify Node.js, pnpm, configure store
[3/4] Build             — install deps → Vite build → validate manifest
[4/4] Deploy (optional) — copy dist to browser profile extension dir
```

Build guards run **in parallel** for faster verification.
Sourcemap status is logged during build (`ENABLED` / `DISABLED`).

## Testing

```sh
# Run unit tests
pnpm test

# Watch mode
pnpm test:watch

# Lint
pnpm lint
```

## Configuration

Build settings are stored in `powershell.json`:

- Project name, extension directory, dist folder
- Default browser profile
- pnpm install/build commands
- Node linker mode
- Required packages list

## License

Private — all rights reserved.
