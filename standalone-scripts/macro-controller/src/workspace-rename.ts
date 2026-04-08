/**
 * MacroLoop Controller — Workspace Rename (barrel + resilient preset store)
 *
 * Phase 5: Split into focused sub-modules:
 *   - rename-forbidden-cache.ts  (forbidden workspace cache)
 *   - rename-template.ts         (numbering template engine)
 *   - rename-api.ts              (single rename PUT call)
 *   - rename-bulk.ts             (bulk rename, undo, history, delay)
 *
 * This barrel preserves backward compatibility for existing imports.
 * It also provides a self-contained preset store so builds do not depend on
 * optional split files being present in every local checkout.
 */

import { log, getDisplayProjectName, getProjectIdFromUrl } from './logging';

export {
  loadForbiddenRenameCache,
  isRenameForbidden,
  getForbiddenCount,
  clearForbiddenRenameCache,
  addForbidden,
  removeForbidden,
  hasForbidden,
} from './rename-forbidden-cache';

export { applyRenameTemplate } from './rename-template';

export { renameWorkspace } from './rename-api';

export {
  getRenameDelayMs,
  setRenameDelayMs,
  cancelRename,
  isRenameCancelled,
  getRenameAvgOpMs,
  getRenameHistory,
  updateUndoBtnVisibility,
  bulkRenameWorkspaces,
  undoLastRename,
} from './rename-bulk';

export interface RenamePreset {
  name: string;
  template: string;
  prefix: string;
  prefixEnabled: boolean;
  suffix: string;
  suffixEnabled: boolean;
  startDollar: number;
  startHash: number;
  startStar: number;
  delayMs: number;
  createdAt: number;
  updatedAt: number;
}

export interface RenamePresetStore {
  listPresets(): Promise<string[]>;
  getActivePresetName(): Promise<string>;
  setActivePresetName(name: string): Promise<void>;
  loadPreset(name: string): Promise<RenamePreset | null>;
  savePreset(name: string, preset: RenamePreset): Promise<void>;
  deletePreset(name: string): Promise<void>;
}

interface RenamePresetState {
  activePresetName: string;
  presets: Record<string, RenamePreset>;
}

const RENAME_PRESET_STORAGE_PREFIX = 'MacroController.RenamePresets.';
const DEFAULT_PRESET_NAME = 'Default';

export function createDefaultPreset(): RenamePreset {
  const now = Date.now();

  return {
    name: DEFAULT_PRESET_NAME,
    template: '',
    prefix: '',
    prefixEnabled: false,
    suffix: '',
    suffixEnabled: false,
    startDollar: 1,
    startHash: 1,
    startStar: 1,
    delayMs: 750,
    createdAt: now,
    updatedAt: now,
  };
}

function resolveRenamePresetProjectKey(): string {
  const projectId = getProjectIdFromUrl();

  return projectId || getDisplayProjectName();
}

function getRenamePresetStorageKey(projectKey: string): string {
  return RENAME_PRESET_STORAGE_PREFIX + projectKey;
}

function buildDefaultRenamePresetState(): RenamePresetState {
  return {
    activePresetName: DEFAULT_PRESET_NAME,
    presets: {
      [DEFAULT_PRESET_NAME]: createDefaultPreset(),
    },
  };
}

function readRenamePresetState(projectKey: string): RenamePresetState {
  const storageKey = getRenamePresetStorageKey(projectKey);

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return buildDefaultRenamePresetState();
    }

    const parsed = JSON.parse(raw) as Partial<RenamePresetState>;
    const state = buildDefaultRenamePresetState();
    if (typeof parsed.activePresetName === 'string' && parsed.activePresetName) {
      state.activePresetName = parsed.activePresetName;
    }
    if (parsed.presets && typeof parsed.presets === 'object') {
      state.presets = {
        ...state.presets,
        ...(parsed.presets as Record<string, RenamePreset>),
      };
    }

    return state;
  } catch (err) {
    log(
      '[WorkspaceRename] file: standalone-scripts/macro-controller/src/workspace-rename.ts | missing item: rename preset state key "' +
        storageKey +
        '" could not be parsed | reason: ' +
        String(err),
      'error',
    );

    return buildDefaultRenamePresetState();
  }
}

function writeRenamePresetState(projectKey: string, state: RenamePresetState): void {
  const storageKey = getRenamePresetStorageKey(projectKey);

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (err) {
    log(
      '[WorkspaceRename] file: standalone-scripts/macro-controller/src/workspace-rename.ts | missing item: rename preset state key "' +
        storageKey +
        '" could not be written | reason: ' +
        String(err),
      'error',
    );
  }
}

let cachedPresetStore: RenamePresetStore | null = null;
let cachedPresetProjectKey = '';

export function getRenamePresetStore(): RenamePresetStore {
  const projectKey = resolveRenamePresetProjectKey();
  if (cachedPresetStore && cachedPresetProjectKey === projectKey) {
    return cachedPresetStore;
  }

  const store: RenamePresetStore = {
    async listPresets(): Promise<string[]> {
      return Object.keys(readRenamePresetState(projectKey).presets);
    },

    async getActivePresetName(): Promise<string> {
      return readRenamePresetState(projectKey).activePresetName;
    },

    async setActivePresetName(name: string): Promise<void> {
      const state = readRenamePresetState(projectKey);
      state.activePresetName = name || DEFAULT_PRESET_NAME;
      writeRenamePresetState(projectKey, state);
    },

    async loadPreset(name: string): Promise<RenamePreset | null> {
      const state = readRenamePresetState(projectKey);

      return state.presets[name] || null;
    },

    async savePreset(name: string, preset: RenamePreset): Promise<void> {
      const state = readRenamePresetState(projectKey);
      const now = Date.now();
      state.presets[name] = {
        ...preset,
        name,
        createdAt: preset.createdAt || now,
        updatedAt: now,
      };
      writeRenamePresetState(projectKey, state);
    },

    async deletePreset(name: string): Promise<void> {
      if (name === DEFAULT_PRESET_NAME) {
        return;
      }

      const state = readRenamePresetState(projectKey);
      delete state.presets[name];
      if (state.activePresetName === name) {
        state.activePresetName = DEFAULT_PRESET_NAME;
      }
      if (!state.presets[DEFAULT_PRESET_NAME]) {
        state.presets[DEFAULT_PRESET_NAME] = createDefaultPreset();
      }
      writeRenamePresetState(projectKey, state);
    },
  };

  cachedPresetProjectKey = projectKey;
  cachedPresetStore = store;

  return store;
}
