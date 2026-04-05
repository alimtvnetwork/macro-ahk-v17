/**
 * MacroController — Error Utilities
 *
 * Centralizes error message extraction from catch blocks.
 * TypeScript catch clauses use `unknown` by design — this helper
 * provides type-safe message extraction without scattered `instanceof` checks.
 *
 * Usage:
 *   catch (e: unknown) {
 *     log('Failed: ' + toErrorMessage(e), 'error');
 *   }
 */

/**
 * Extract a human-readable message from any caught value.
 * Handles Error instances, strings, and arbitrary objects.
 */
export function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  if (e !== null && e !== undefined) return String(e);
  return 'Unknown error';
}
