/**
 * packages/core/src/auth/TokenStore.ts
 * PVOT — OAuth Token Store
 *
 * Persists and retrieves OAuth tokens so the calendar service can
 * make authenticated requests without re-prompting for consent.
 *
 * The callback page calls:
 *   const tokenStore = getTokenStore();
 *   await tokenStore.save(accountId, token);
 *
 * The calendar/refresh layer calls:
 *   const token = await tokenStore.load(accountId);
 *   await tokenStore.save(accountId, refreshedToken);
 *   await tokenStore.remove(accountId);
 *
 * Storage: localStorage under the key `pvot-tokens-v1:{accountId}`
 *
 * Note: storing access tokens in localStorage is acceptable for an MVP.
 * Production should use httpOnly cookies or a server-side session store.
 */

import type { OAuthTokens } from './OAuthClient';

const PREFIX = 'pvot-tokens-v1:';

export class TokenStore {
  /** Persist (or overwrite) tokens for an account. */
  async save(accountId: string, token: OAuthTokens): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(PREFIX + accountId, JSON.stringify(token));
    } catch (e) {
      console.warn('[TokenStore] Failed to save token:', e);
    }
  }

  /** Alias for save() — matches the existing TokenRefresher API. */
  async set(accountId: string, token: OAuthTokens): Promise<void> {
    return this.save(accountId, token);
  }

  /** Load tokens for an account. Returns null if not found or malformed. */
  async load(accountId: string): Promise<OAuthTokens | null> {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(PREFIX + accountId);
      if (!raw) return null;
      return JSON.parse(raw) as OAuthTokens;
    } catch {
      return null;
    }
  }

  /** Alias for load() — matches the existing TokenRefresher API. */
  async get(accountId: string): Promise<OAuthTokens | null> {
    return this.load(accountId);
  }

  /** Remove tokens (on disconnect or auth error). */
  async remove(accountId: string): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(PREFIX + accountId);
    } catch {}
  }

  /** Alias for remove() — matches the existing TokenRefresher API. */
  async delete(accountId: string): Promise<void> {
    return this.remove(accountId);
  }

  /** List all stored account IDs. */
  async listAccountIds(): Promise<string[]> {
    if (typeof localStorage === 'undefined') return [];
    const ids: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(PREFIX)) {
          ids.push(key.slice(PREFIX.length));
        }
      }
    } catch {}
    return ids;
  }

  /** True if tokens exist and haven't expired. */
  async isValid(accountId: string): Promise<boolean> {
    const token = await this.load(accountId);
    if (!token) return false;
    // Consider expired 60 seconds before actual expiry
    return token.expiresAt > Date.now() + 60_000;
  }
}

// ─── SINGLETON ────────────────────────────────────────────────────────────────

let _store: TokenStore | null = null;

export function getTokenStore(): TokenStore {
  if (!_store) _store = new TokenStore();
  return _store;
}
