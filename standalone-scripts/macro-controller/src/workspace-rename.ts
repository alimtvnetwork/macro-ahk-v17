/**
 * MacroLoop Controller — Workspace Rename (barrel re-export)
 *
 * Phase 5: Split into focused sub-modules:
 *   - rename-forbidden-cache.ts  (forbidden workspace cache)
 *   - rename-template.ts         (numbering template engine)
 *   - rename-api.ts              (single rename PUT call)
 *   - rename-bulk.ts             (bulk rename, undo, history, delay)
 *
 * This barrel preserves backward compatibility for all existing imports.
 */

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
