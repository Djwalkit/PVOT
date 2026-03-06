/**
 * packages/core/src/auth/TokenRefresher.ts
 */

import type { OAuthToken }         from '../types';
import { OAuthClient, OAuthError } from './OAuthClient';
import { TokenStore }              from './TokenStore';
import { useAuthStore }            from '../stores';

export class TokenRefresher {
  private readonly _inFlight = new Map<string, Promise<OAuthToken>>();

  constructor(
    private readonly oauthClient: OAuthClient,
    private readonly tokenStore:  TokenStore,
  ) {}

  async getValidToken(accountId: string): Promise<string> {
    const stored = await this.tokenStore.get(accountId);

    if (!stored) {
      throw new TokenError('NO_TOKEN', accountId, 'No token found. Account requires authentication.');
    }

    if (!isExpired(stored)) {
      return stored.accessToken;
    }

    return this._refreshWithLock(accountId, stored.refreshToken);
  }

  async forceRefresh(accountId: string): Promise<string> {
    const stored = await this.tokenStore.get(accountId);
    if (!stored) {
      throw new TokenError('NO_TOKEN', accountId, 'Cannot refresh: no stored token.');
    }
    return this._refreshWithLock(accountId, stored.refreshToken);
  }

  private async _refreshWithLock(accountId: string, refreshToken: string): Promise<string> {
    const existing = this._inFlight.get(accountId);
    if (existing) {
      const token = await existing;
      return token.accessToken;
    }

    const refreshPromise = this._doRefresh(accountId, refreshToken);
    this._inFlight.set(accountId, refreshPromise);

    try {
      const newToken = await refreshPromise;
      return newToken.accessToken;
    } finally {
      this._inFlight.delete(accountId);
    }
  }

  private async _doRefresh(accountId: string, refreshToken: string): Promise<OAuthToken> {
    useAuthStore.getState().updateStatus(accountId, 'refreshing');

    try {
      const newToken = await this.oauthClient.refreshToken(refreshToken);
      await this.tokenStore.save(accountId, newToken);
      useAuthStore.getState().updateStatus(accountId, 'active');
      return newToken;
    } catch (err) {
      if (err instanceof OAuthError && err.code === 'REFRESH_INVALID') {
        await this.tokenStore.remove(accountId);
        useAuthStore.getState().updateStatus(accountId, 'error', 'token_expired');
        throw new TokenError('REFRESH_INVALID', accountId, 'Refresh token revoked. Re-authentication required.');
      }
      useAuthStore.getState().updateStatus(accountId, 'error', 'fetch_failed');
      throw err;
    }
  }
}

function isExpired(token: OAuthToken, bufferMs = 2 * 60 * 1000): boolean {
  return Date.now() >= token.expiresAt - bufferMs;
}

export class TokenError extends Error {
  constructor(
    public readonly code: 'NO_TOKEN' | 'REFRESH_INVALID' | 'REFRESH_FAILED',
    public readonly accountId: string,
    message: string,
  ) {
    super(message);
    this.name = 'TokenError';
  }
}

let _refresher: TokenRefresher | null = null;

export function getTokenRefresher(
  oauthClient: OAuthClient,
  tokenStore:  TokenStore,
): TokenRefresher {
  if (!_refresher) _refresher = new TokenRefresher(oauthClient, tokenStore);
  return _refresher;
}

export function resetTokenRefresher(): void {
  _refresher = null;
}