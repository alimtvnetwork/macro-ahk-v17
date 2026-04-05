/**
 * MacroLoop Controller — Auth Token Resolution & Persistence
 * Phase 5B: Extracted from auth.ts
 * Phase 6: for-of conversions, newline-before-return, curly braces (CQ13–CQ15)
 *
 * @see spec/06-coding-guidelines/02-typescript-immutability-standards.md
 */

import { toErrorMessage } from './error-utils';
import { log } from './logging';
import {
  getLastSessionBridgeSource,
  SESSION_BRIDGE_KEYS,
  setLastSessionBridgeSource,
} from './shared-state';

// ============================================
// Token validation utilities
// ============================================

export function normalizeBearerToken(raw: string): string {
  return (raw || '').trim().replace(/^Bearer\s+/i, '');
}

export function isJwtToken(raw: string): boolean {
  const token = normalizeBearerToken(raw);

  return token.startsWith('eyJ') && token.split('.').length === 3;
}

export function isUsableToken(raw: string): boolean {
  const token = normalizeBearerToken(raw);
  const isTooShort = !token || token.length < 10;

  if (isTooShort) {
    return false;
  }

  const hasWhitespace = /\s/.test(token);

  if (hasWhitespace) {
    return false;
  }

  const isJsonLike = token[0] === '{' || token[0] === '[';

  if (isJsonLike) {
    return false;
  }

  return isJwtToken(token);
}

export function extractBearerTokenFromUnknown(raw: unknown): string {
  const isNotString = typeof raw !== 'string';

  if (isNotString) {
    return '';
  }

  const normalized = normalizeBearerToken(raw as string);

  if (isUsableToken(normalized)) {
    return normalized;
  }

  try {
    const parsed = JSON.parse(raw as string) as Record<string, unknown>;
    const isObject = parsed !== null && typeof parsed === 'object';

    if (isObject) {
      const candidates = [parsed.token, parsed.access_token, parsed.authToken, parsed.sessionId];

      for (const candidate of candidates) {
        const isNotStringCandidate = typeof candidate !== 'string';

        if (isNotStringCandidate) {
          continue;
        }

        const nested = normalizeBearerToken(candidate as string);

        if (isUsableToken(nested)) {
          return nested;
        }
      }
    }
  } catch (_e) {
    // ignore parse errors
  }

  return '';
}

// ============================================
// Last token source tracking (CQ11: singleton)
// ============================================

class TokenSourceState {
  private _source = 'none';

  get value(): string {
    return this._source;
  }

  set value(src: string) {
    this._source = src;
  }
}

const tokenSourceState = new TokenSourceState();

/** Current token source label — read via LAST_TOKEN_SOURCE, write via setLastTokenSource */
export { tokenSourceState };

/**
 * @deprecated Use tokenSourceState.value instead for new code.
 * Kept as a getter-backed export for backward compatibility with 12+ consumer files.
 */
export function getLastTokenSource(): string {
  return tokenSourceState.value;
}

export function setLastTokenSource(src: string): void {
  tokenSourceState.value = src;
}

// ============================================
// Session Bridge Token
// ============================================

export function getBearerTokenFromSessionBridge(): string {
  try {
    for (const key of SESSION_BRIDGE_KEYS) {
      const raw = localStorage.getItem(key) || '';
      const token = extractBearerTokenFromUnknown(raw);
      const hasToken = !!token;

      if (hasToken) {
        const isNewSource = getLastSessionBridgeSource() !== key;

        if (isNewSource) {
          setLastSessionBridgeSource(key);
          log('resolveToken: using bearer token from localStorage[' + key + ']', 'success');
        }

        return token;
      }

      const hasNonUsableValue = raw.length >= 10;

      if (hasNonUsableValue) {
        log('resolveToken: ignoring non-usable value in localStorage[' + key + ']', 'warn');
      }
    }

    const supabaseToken = scanSupabaseLocalStorage();
    const hasSupabaseToken = !!supabaseToken;

    if (hasSupabaseToken) {
      return supabaseToken;
    }
  } catch (e: unknown) {
    log('resolveToken: localStorage bridge unavailable — ' + toErrorMessage(e), 'warn');
  }

  return '';
}

/**
 * Scans localStorage for Supabase auth keys matching `sb-*-auth-token*`.
 */
function scanSupabaseLocalStorage(): string {
  try {
    const keys: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      if (key) {
        keys.push(key);
      }
    }

    for (const key of keys) {
      const isSupabaseAuthKey = key.startsWith('sb-') && key.includes('-auth-token');

      if (!isSupabaseAuthKey) {
        continue;
      }

      const raw = localStorage.getItem(key) || '';
      const isTooShort = !raw || raw.length < 20;

      if (isTooShort) {
        continue;
      }

      const token = extractSupabaseTokenFromRaw(key, raw);
      const hasToken = !!token;

      if (hasToken) {
        return token;
      }
    }
  } catch (scanErr) {
    log('resolveToken: Supabase localStorage scan failed — ' + ((scanErr as Error)?.message || scanErr), 'warn');
  }

  return '';
}

function extractSupabaseTokenFromRaw(key: string, raw: string): string {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const accessToken = parsed.access_token;

    if (typeof accessToken === 'string' && isUsableToken(accessToken)) {
      setLastSessionBridgeSource(key);
      log('resolveToken: ✅ Found Supabase auth in localStorage[' + key + '] (access_token len=' + accessToken.length + ')', 'success');

      return accessToken;
    }

    const session = (parsed.currentSession || parsed.session) as Record<string, unknown> | undefined;
    const hasSessionToken = session !== undefined && typeof session.access_token === 'string' && isUsableToken(session.access_token as string);

    if (hasSessionToken) {
      setLastSessionBridgeSource(key);
      log('resolveToken: ✅ Found Supabase auth in localStorage[' + key + '].session.access_token', 'success');

      return session!.access_token as string;
    }
  } catch (_jsonErr) {
    const token = normalizeBearerToken(raw);

    if (isUsableToken(token)) {
      setLastSessionBridgeSource(key);
      log('resolveToken: ✅ Found raw token in localStorage[' + key + '] (len=' + token.length + ')', 'success');

      return token;
    }
  }

  return '';
}

// ============================================
// Cookie Token & Session Cookie Names
// ============================================

const FALLBACK_SESSION_COOKIE_NAMES = [
  'lovable-session-id-v2',
  'lovable-session-id.id',
  '__Secure-lovable-session-id.id',
  '__Host-lovable-session-id.id',
  'lovable-session-id',
];

const COOKIE_DIAGNOSTIC_COOLDOWN_MS = 60_000;

// CQ11: Encapsulate diagnostic timestamp in singleton
class CookieDiagnosticState {
  private _lastAt = 0;

  get lastAt(): number {
    return this._lastAt;
  }

  set lastAt(v: number) {
    this._lastAt = v;
  }
}

const cookieDiagState = new CookieDiagnosticState();

/**
 * Reads session cookie names from project namespace cookie bindings.
 * Always appends fallback names so diagnostics and resolution stay resilient.
 */
/** Extract session cookie names from a single project namespace. */
function extractSessionNamesFromProject(ns: any): string[] {
  if (!ns?.cookies?.bindings) return [];
  const names: string[] = [];
  for (const binding of ns.cookies.bindings) {
    if (binding.role === 'session' && binding.cookieName) {
      names.push(binding.cookieName);
    }
  }
  return names;
}

export function getSessionCookieNames(): string[] {
  try {
    const root = RiseupAsiaMacroExt;
    if (!root?.Projects) return FALLBACK_SESSION_COOKIE_NAMES;

    const names: string[] = [];
    for (const projectKey of Object.keys(root.Projects)) {
      names.push(...extractSessionNamesFromProject(root.Projects[projectKey]));
    }
    return Array.from(new Set(names.concat(FALLBACK_SESSION_COOKIE_NAMES)));
  } catch (_e) {
    return FALLBACK_SESSION_COOKIE_NAMES;
  }
}

/** Search cookies for a matching session token. */
function findTokenInCookies(cookies: string[], sessionNames: string[]): { token: string; hasTarget: boolean } {
  for (const cookieStr of cookies) {
    const trimmedCookie = cookieStr.trim();
    for (const sessionName of sessionNames) {
      const prefix = sessionName + '=';
      if (trimmedCookie.indexOf(prefix) !== 0) continue;
      const normalized = normalizeBearerToken(trimmedCookie.substring(prefix.length));
      if (isUsableToken(normalized)) {
        log('getBearerTokenFromCookie: Found usable token in document.cookie[' + sessionName + '] (len=' + normalized.length + ')', 'success');
        return { token: normalized, hasTarget: true };
      }
    }
  }
  return { token: '', hasTarget: false };
}

export function getBearerTokenFromCookie(): string {
  const fn = 'getBearerTokenFromCookie';

  try {
    const rawCookie = document.cookie || '';
    const cookies = rawCookie ? rawCookie.split(';') : [];
    const sessionNames = getSessionCookieNames();

    const result = findTokenInCookies(cookies, sessionNames);
    if (result.token) return result.token;

    const now = Date.now();
    const shouldLogDiagnostics = (now - cookieDiagState.lastAt) >= COOKIE_DIAGNOSTIC_COOLDOWN_MS;
    if (!shouldLogDiagnostics) return '';

    cookieDiagState.lastAt = now;
    logCookieDiagnostics(fn, cookies, sessionNames, rawCookie, result.hasTarget);
  } catch (e: unknown) {
    log(fn + ': EXCEPTION reading cookies: ' + toErrorMessage(e), 'error');
    log(fn + ': This may happen in sandboxed iframes or restricted contexts', 'error');
  }

  return '';
}

function logCookieDiagnostics(
  fn: string,
  cookies: string[],
  sessionNames: string[],
  rawCookie: string,
  hasTargetCookie: boolean,
): void {
  const cookieNames = cookies.map(function (c: string) {
    return c.trim().split('=')[0];
  });

  log(fn + ': === COOKIE DIAGNOSTIC START ===', 'info');
  log(fn + ': Session cookie names (from namespace): [' + sessionNames.join(', ') + ']', 'info');
  log(fn + ': document.cookie accessible: ' + (typeof document.cookie === 'string' ? 'YES' : 'NO'), 'info');
  log(fn + ': Total cookies visible to JS: ' + cookies.length, 'info');
  log(fn + ': Cookie names visible: [' + cookieNames.join(', ') + ']', 'info');
  log(fn + ': Raw cookie string length: ' + rawCookie.length + ' chars', 'info');

  if (!hasTargetCookie) {
    log(fn + ': Session cookie NOT found in document.cookie (expected: HttpOnly)', 'info');
    log(fn + ': Auth should resolve via Supabase localStorage scan or extension bridge', 'info');
  }

  log(fn + ': === COOKIE DIAGNOSTIC END ===', 'info');
}

// ============================================
// Token Persistence & Auth Badge
// ============================================

// ============================================
// Token timestamp helpers (Phase A: Auth Bridge)
// ============================================

const TOKEN_SAVED_AT_KEY = 'marco_token_saved_at';

/** Read the timestamp when the token was last persisted. */
export function getTokenSavedAt(): number {
  try {
    const raw = localStorage.getItem(TOKEN_SAVED_AT_KEY) || '0';

    return parseInt(raw, 10) || 0;
  } catch (_e) {
    return 0;
  }
}

/** Save token + timestamp atomically to localStorage. */
export function saveTokenWithTimestamp(token: string): void {
  localStorage.setItem('marco_bearer_token', token);
  localStorage.setItem('lovable-session-id', token);
  localStorage.setItem(TOKEN_SAVED_AT_KEY, String(Date.now()));
  log('[AuthBridge] Token persisted with timestamp', 'info');
}

/** Compute the age of the cached token in milliseconds. */
export function getTokenAge(): number {
  const savedAt = getTokenSavedAt();

  if (savedAt === 0) {
    return Infinity;
  }

  return Date.now() - savedAt;
}

export function persistResolvedBearerToken(token: string): boolean {
  const normalized = normalizeBearerToken(token);
  const isNotUsable = !isUsableToken(normalized);

  if (isNotUsable) {
    log('resolveToken: rejected non-JWT token candidate', 'warn');

    return false;
  }

  try {
    saveTokenWithTimestamp(normalized);
    updateAuthBadge(true, tokenSourceState.value || 'persisted');

    return true;
  } catch (e: unknown) {
    log('resolveToken: failed to persist token to localStorage — ' + toErrorMessage(e), 'warn');

    return false;
  }
}

export function updateAuthBadge(hasToken: boolean, source: string): void {
  const badge = document.getElementById('loop-auth-badge');
  const hasBadge = badge !== null;

  if (!hasBadge) {
    return;
  }

  if (hasToken) {
    badge!.textContent = '🟢';
    badge!.title = 'Auth: token available (' + (source || 'unknown') + ') — click to refresh';
  } else {
    badge!.textContent = '🔴';
    badge!.title = 'Auth: no token — click to refresh';
  }
}

// ============================================
// Synchronous token resolver (primary entry point)
// ============================================

export function resolveToken(): string {
  const sessionToken = getBearerTokenFromSessionBridge();
  const hasToken = !!sessionToken;

  if (hasToken) {
    tokenSourceState.value = 'localStorage[' + getLastSessionBridgeSource() + ']';

    return sessionToken;
  }

  tokenSourceState.value = 'none';

  return '';
}

// v7.39: markBearerTokenExpired now actually clears cached token (RCA-5 fix)
export function markBearerTokenExpired(controller: string): void {
  log('[' + controller + '] Bearer token expired (401/403) — clearing cached token', 'warn');

  try {
    for (const key of SESSION_BRIDGE_KEYS) {
      localStorage.removeItem(key);
    }
  } catch (_e) {
    /* ignore */
  }

  updateAuthBadge(false, 'expired');
}

// v7.25: Invalidate a specific session bridge key
export function invalidateSessionBridgeKey(token: string): string {
  const normalizedTarget = normalizeBearerToken(token);
  const removedKeys: string[] = [];

  for (const key of SESSION_BRIDGE_KEYS) {
    try {
      const stored = localStorage.getItem(key) || '';
      const normalizedStored = extractBearerTokenFromUnknown(stored);
      const isMatch = normalizedStored !== '' && normalizedStored === normalizedTarget;

      if (isMatch) {
        localStorage.removeItem(key);
        removedKeys.push(key);
      }
    } catch (_e) {
      /* ignore */
    }
  }

  const hasRemoved = removedKeys.length > 0;

  if (hasRemoved) {
    log('Token fallback: invalidated localStorage[' + removedKeys.join(', ') + ']', 'warn');
  }

  return removedKeys.join(',');
}
