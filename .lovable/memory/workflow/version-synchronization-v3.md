# Memory: workflow/version-synchronization-v3
Updated: 2026-04-05

The extension version is 2.5.0, synchronized exactly across `chrome-extension/manifest.json` (`version` and `version_name`), `src/shared/constants.ts`, `src/options/sections/AboutSection.tsx`, `standalone-scripts/macro-controller/src/instruction.ts`, and `standalone-scripts/marco-sdk/src/instruction.ts`. Version consistency is validated via `scripts/check-version-sync.mjs`, which checks both manifest fields explicitly. The marco-sdk version was unified from independent semver (1.3.0) to match the extension version starting at v2.5.0.
