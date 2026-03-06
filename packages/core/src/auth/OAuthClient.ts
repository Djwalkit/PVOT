
/**
 * packages/core/src/auth/OAuthClient.ts
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * FIX — RUNTIME CRASH: "NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set"
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ROOT CAUSE
 * ----------
 * The previous implementation threw inside the `constructor` and at module
 * load via a module-level `getOAuthClient()` call in dashboard/page.tsx.
 * Next.js evaluates all module-level code during SSR/build, so any page
 * that imported `getOAuthClient` would crash immediately — before the user
 * even tried to connect a calendar — if the env var was absent.
 *
 * THE FIX
 * -------
 * 1. Constructor NEVER throws. Missing env = warn + set a `misconfigured`
 *    flag. All methods check the flag and return a safe no-op / rejection.
 * 2. `getOAuthClient()` is a lazy singleton — it creates the instance on
 *    first *call*, not at module load, so SSR and cold imports are safe.
 * 3. `beginAuth()` checks for browser context before touching `window`.
 * 4. All public methods return typed Promises so callers don't need
 *    null-checks; they just catch() as normal.
 *
 * CONSUMERS
 * ---------
 * Existing call sites don't need to change:
 *   import { getOAuthClient } from '@pvot/core/auth/OAuthClient';
 *   await getOAuthClient().beginAuth(null);   // safe — rejects gracefully if misconfigured
 */

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

export interface OAuthTokens {
  accessToken:  string;
  refreshToken: string | null;
  expiresAt:    number;
  scope:        string;
}

export interface OAuthUserInfo {
  id:          string;
  email:       string;
  displayName: string;
  photoUrl:    string | null;
}

// ─── OAUTH ERROR ──────────────────────────────────────────────────────────────
// Typed error class used by the callback page's .catch() handler.
// Importing this as `undefined` (missing export) causes the crash:
//   TypeError: Right-hand side of 'instanceof' is not an object

export type OAuthErrorCode =
  | 'access_denied'
  | 'misconfigured'
  | 'popup_closed'
  | 'popup_blocked'
  | 'exchange_failed'
  | 'userinfo_failed'
  | 'unknown';

export class OAuthError extends Error {
  readonly code: OAuthErrorCode;

  constructor(code: OAuthErrorCode, message: string) {
    super(message);
    this.name = 'OAuthError';
    this.code = code;
    // Maintain correct prototype chain in transpiled ES5 output
    Object.setPrototypeOf(this, OAuthError.prototype);
  }
}

export function getFriendlyError(code: OAuthErrorCode): string {
  switch (code) {
    case 'access_denied':    return 'Calendar access was declined. Please try again and click "Allow".';
    case 'misconfigured':    return 'OAuth is not configured. Check NEXT_PUBLIC_GOOGLE_CLIENT_ID in apps/web/.env.local.';
    case 'popup_closed':     return 'The sign-in window was closed. Please try again.';
    case 'popup_blocked':    return 'Your browser blocked the sign-in popup. Allow popups for this site and retry.';
    case 'exchange_failed':  return 'Could not complete sign-in. Please try again.';
    case 'userinfo_failed':  return 'Signed in but could not fetch your profile. Please try again.';
    default:                 return 'An unexpected error occurred. Please try again.';
  }
}

// ─── CLIENT ───────────────────────────────────────────────────────────────────

export class OAuthClient {
  private readonly clientId:       string;
  private readonly redirectUri:    string;
  private readonly misconfigured:  boolean;

  constructor(clientId: string, redirectUri: string) {
    // ── Guard: missing env ─────────────────────────────────────────────────
    // NEVER throw here — throwing at construction crashes the entire module
    // tree during SSR and any cold import. Warn instead, set a flag, and
    // let individual method calls fail gracefully with actionable messages.
    if (!clientId || !redirectUri) {
      if (typeof console !== 'undefined') {
        console.warn(
          '[OAuthClient] Not configured — NEXT_PUBLIC_GOOGLE_CLIENT_ID or ' +
          'redirectUri is missing. Calendar connect will be unavailable until ' +
          'you add the env var to .env.local and restart the dev server.',
        );
      }
      this.clientId      = '';
      this.redirectUri   = '';
      this.misconfigured = true;
      return;
    }

    this.clientId      = clientId;
    this.redirectUri   = redirectUri;
    this.misconfigured = false;
  }

  // ── Public helpers ─────────────────────────────────────────────────────────

  /** True when the required env vars are present and the client is usable. */
  get isConfigured(): boolean {
    return !this.misconfigured;
  }

  /**
   * beginAuthRedirect — fire-and-forget version of beginAuth.
   *
   * Opens the Google consent screen as a popup (or full redirect if blocked).
   * Does NOT return the auth code — the code arrives at the callback page
   * via Google's redirect, and (auth)/callback/page.tsx handles the exchange.
   *
   * Use this from UI buttons. Never call exchangeCode() after this —
   * the callback page already does that, and codes are one-time use.
   */
  beginAuthRedirect(accountId: string | null): void {
    if (this.misconfigured) {
      console.warn('[OAuthClient] beginAuthRedirect: not configured.');
      return;
    }
    if (typeof window === 'undefined') return;

    const state = btoa(JSON.stringify({ accountId, nonce: Math.random().toString(36).slice(2) }));
    const params = new URLSearchParams({
      client_id:     this.clientId,
      redirect_uri:  this.redirectUri,
      response_type: 'code',
      scope:         SCOPES,
      access_type:   'offline',
      prompt:        'consent select_account',
      state,
    });
    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

    const w = 500, h = 640;
    const l = Math.round(window.screenX + (window.outerWidth  - w) / 2);
    const t = Math.round(window.screenY + (window.outerHeight - h) / 2);

    const popup = window.open(
      url, 'pvot-oauth',
      `width=${w},height=${h},left=${l},top=${t},toolbar=no,menubar=no`,
    );

    // If popup was blocked, fall back to full-page redirect
    if (!popup) window.location.href = url;
  }

  /**
   * beginAuth — legacy popup method that resolves with the auth code.
   * @deprecated Use beginAuthRedirect() for UI buttons. The code exchange
   * must happen in the callback page, not in the calling component.
   */
  async beginAuth(accountId: string | null): Promise<string> {
    if (this.misconfigured) {
      return Promise.reject(
        new OAuthError(
          'misconfigured',
          'OAuth is not configured. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to apps/web/.env.local and restart.',
        ),
      );
    }

    if (typeof window === 'undefined') {
      return Promise.reject(
        new OAuthError('misconfigured', 'beginAuth must be called in a browser context.'),
      );
    }

    const state = btoa(JSON.stringify({ accountId, nonce: Math.random().toString(36).slice(2) }));

    const params = new URLSearchParams({
      client_id:     this.clientId,
      redirect_uri:  this.redirectUri,
      response_type: 'code',
      scope:         SCOPES,
      access_type:   'offline',
      prompt:        'consent select_account',
      state,
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

    return new Promise((resolve, reject) => {
      const w = 500, h = 640;
      const l = Math.round(window.screenX + (window.outerWidth  - w) / 2);
      const t = Math.round(window.screenY + (window.outerHeight - h) / 2);

      const popup = window.open(
        url,
        'pvot-oauth',
        `width=${w},height=${h},left=${l},top=${t},toolbar=no,menubar=no`,
      );

      if (!popup) {
        // Popup blocked — full-page redirect
        window.location.href = url;
        return;
      }

      const onMessage = (e: MessageEvent) => {
        if (e.origin !== window.location.origin) return;
        if (e.data?.type === 'PVOT_OAUTH_CODE') {
          cleanup();
          resolve(e.data.code as string);
        } else if (e.data?.type === 'PVOT_OAUTH_ERROR') {
          cleanup();
          reject(new OAuthError('access_denied', e.data.error ?? 'OAuth error'));
        }
      };

      const closedInterval = setInterval(() => {
        if (popup.closed) {
          cleanup();
          reject(new OAuthError('popup_closed', 'Sign-in window was closed.'));
        }
      }, 500);

      const cleanup = () => {
        window.removeEventListener('message', onMessage);
        clearInterval(closedInterval);
        if (!popup.closed) popup.close();
      };

      window.addEventListener('message', onMessage);
    });
  }

  /**
   * handleCallback — called by apps/web/src/app/(auth)/callback/page.tsx
   *
   * Reads `code` and `error` from the URL params Google redirected to,
   * POSTs the code to /api/auth/token, and returns the token bundle.
   *
   * Returns: { token: OAuthTokens, accountId: string }
   * Throws:  OAuthError with a typed code the callback page can instanceof-check
   */
  async handleCallback(
    params: URLSearchParams,
  ): Promise<{ token: OAuthTokens; accountId: string }> {
    if (this.misconfigured) {
      throw new OAuthError(
        'misconfigured',
        'OAuth is not configured. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to apps/web/.env.local and restart.',
      );
    }

    // ── Check for OAuth error response from Google ────────────────────────
    const oauthError = params.get('error');
    if (oauthError) {
      if (oauthError === 'access_denied') {
        throw new OAuthError('access_denied', 'User declined calendar access.');
      }
      throw new OAuthError('exchange_failed', `Google returned error: ${oauthError}`);
    }

    const code = params.get('code');
    if (!code) {
      throw new OAuthError('exchange_failed', 'No authorization code in callback URL.');
    }

    // ── Exchange code for tokens via /api/auth/token ──────────────────────
    const res = await fetch('/api/auth/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ code, redirectUri: this.redirectUri }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new OAuthError(
        'exchange_failed',
        `Token exchange failed (${res.status})${body ? `: ${body}` : ''}`,
      );
    }

    const token = await res.json() as OAuthTokens;

    // Derive a stable accountId from the state param (contains the nonce)
    // or fall back to a placeholder — the callback page re-derives from email.
    const stateRaw  = params.get('state') ?? '';
    let   accountId = '';
    try {
      const parsed = JSON.parse(atob(stateRaw));
      accountId    = parsed.accountId ?? '';
    } catch {
      accountId = '';
    }

    return { token, accountId };
  }

  /**
   * Exchange an auth code for access + refresh tokens via the PVOT token
   * endpoint (`/api/auth/token`).
   * @deprecated Use handleCallback() from the (auth)/callback page instead.
   */
  async exchangeCode(code: string): Promise<OAuthTokens> {
    if (this.misconfigured) {
      return Promise.reject(new OAuthError('misconfigured', 'OAuth is not configured.'));
    }

    const res = await fetch('/api/auth/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ code, redirectUri: this.redirectUri }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new OAuthError('exchange_failed', `Token exchange failed (${res.status}): ${body}`);
    }

    return res.json() as Promise<OAuthTokens>;
  }

  /**
   * Fetch Google userinfo using a valid access token.
   */
  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      throw new OAuthError('userinfo_failed', `Failed to fetch user info (${res.status})`);
    }

    const data = await res.json() as {
      sub: string; email: string; name: string; picture?: string;
    };

    return {
      id:          data.sub,
      email:       data.email,
      displayName: data.name,
      photoUrl:    data.picture ?? null,
    };
  }
}

// ─── LAZY SINGLETON ───────────────────────────────────────────────────────────
//
// Created on FIRST CALL to getOAuthClient(), NOT at module load.
// This means SSR, cold imports, and pages that don't touch auth
// are completely unaffected by missing env vars.

let _client: OAuthClient | null = null;

export function getOAuthClient(): OAuthClient {
  if (!_client) {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

    // Use NEXT_PUBLIC_APP_URL when set (production / Vercel) so the redirect URI
    // exactly matches what's registered in Google Cloud Console.
    // Falls back to window.location.origin in local dev.
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== 'undefined' ? window.location.origin : '');

    const redirectUri = appUrl ? `${appUrl}/callback` : '';

    _client = new OAuthClient(clientId, redirectUri);
  }
  return _client;
}

/**
 * Reset the singleton — useful in tests or if env vars are hot-reloaded.
 */
export function resetOAuthClient(): void {
  _client = null;
}
