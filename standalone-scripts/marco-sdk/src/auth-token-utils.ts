/**
 * Riseup Macro SDK — Auth Token Utilities
 *
 * Static utility class for JWT token validation, normalization,
 * and extraction from various storage sources.
 *
 * These utilities are site-agnostic and reusable across any
 * website using JWT bearer tokens.
 *
 * @see spec/13-features/cross-project-sync.md — Shared asset model
 * @see standalone-scripts/macro-controller/src/auth-resolve.ts — Consumer
 */

/**
 * Pure, stateless auth token utilities.
 * Exposed on `window.marco.authUtils` for runtime access by consumers.
 */
export class AuthTokenUtils {
    /**
     * Strip "Bearer " prefix and whitespace from a raw token string.
     */
    static normalizeBearerToken(raw: string): string {
        return (raw || "").trim().replace(/^Bearer\s+/i, "");
    }

    /**
     * Check if a string looks like a JWT (starts with eyJ, has 3 dot-separated parts).
     */
    static isJwtToken(raw: string): boolean {
        const token = AuthTokenUtils.normalizeBearerToken(raw);

        return token.startsWith("eyJ") && token.split(".").length === 3;
    }

    /**
     * Validate that a token is usable: non-empty, no whitespace, not JSON, and is a JWT.
     */
    static isUsableToken(raw: string): boolean {
        const token = AuthTokenUtils.normalizeBearerToken(raw);

        if (!token || token.length < 10) {
            return false;
        }

        if (/\s/.test(token)) {
            return false;
        }

        if (token[0] === "{" || token[0] === "[") {
            return false;
        }

        return AuthTokenUtils.isJwtToken(token);
    }

    /**
     * Extract a bearer token from an unknown value.
     * Handles raw strings, JSON objects with token/access_token/authToken/sessionId fields.
     */
    static extractBearerTokenFromUnknown(raw: unknown): string {
        if (typeof raw !== "string") {
            return "";
        }

        const normalized = AuthTokenUtils.normalizeBearerToken(raw);
        if (AuthTokenUtils.isUsableToken(normalized)) {
            return normalized;
        }

        try {
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            if (parsed === null || typeof parsed !== "object") {
                return "";
            }

            const candidates = [
                parsed.token,
                parsed.access_token,
                parsed.authToken,
                parsed.sessionId,
            ];

            for (const candidate of candidates) {
                if (typeof candidate !== "string") {
                    continue;
                }

                const nested = AuthTokenUtils.normalizeBearerToken(candidate);
                if (AuthTokenUtils.isUsableToken(nested)) {
                    return nested;
                }
            }
        } catch (e) {
            console.debug(
                "[AuthTokenUtils] extractBearerTokenFromUnknown: value is not parseable JSON, skipping object extraction —",
                e instanceof Error ? e.message : String(e),
            );
        }

        return "";
    }
}
