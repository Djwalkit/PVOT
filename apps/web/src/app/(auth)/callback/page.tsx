/**
 * apps/web/src/app/(auth)/callback/page.tsx
 * PVOT — OAuth Callback Handler
 *
 * Google redirects here after user grants consent.
 * This page:
 *   1. Reads code + state from URL params
 *   2. Exchanges code for tokens via OAuthClient
 *   3. Fetches the user's Google profile (email, name, photo)
 *   4. Saves tokens to TokenStore (encrypted)
 *   5. Adds account to AuthStore
 *   6. Redirects to dashboard
 *
 * Shows clear, specific error states — not generic "Something went wrong".
 *
 * FIX: useRef guard prevents React StrictMode from running the exchange twice.
 * React dev mode intentionally runs effects twice to detect side-effect bugs.
 * An OAuth code is single-use — the second call always gets `invalid_grant`.
 * The ref ensures handleCallback() is called exactly once per mount.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter }                    from 'next/navigation';
import { getOAuthClient, OAuthError }   from '@pvot/core/auth/OAuthClient';
import { getTokenStore }                from '@pvot/core/auth/TokenStore';
import { useAuthStore }                 from '@pvot/core/stores';
import type { ConnectedAccount }        from '@pvot/core/types';

type CallbackState =
  | { status: 'processing' }
  | { status: 'success'; accountName: string }
  | { status: 'error';   message: string; code: string };

export default function CallbackPage() {
  const router           = useRouter();
  const addAccount       = useAuthStore((s) => s.addAccount);
  const [state, setState] = useState<CallbackState>({ status: 'processing' });

  // ── StrictMode guard ──────────────────────────────────────────────────────
  // React 18 dev mode mounts → unmounts → remounts every component.
  // This causes useEffect to fire twice, which would POST the one-time auth
  // code to /api/auth/token twice → second call always fails with invalid_grant.
  // The ref is set to true on first run; the second run exits immediately.
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const params = new URLSearchParams(window.location.search);
    handleCallback(params, addAccount)
      .then((accountName) => {
        setState({ status: 'success', accountName });
        setTimeout(() => {
          if (window.opener && !window.opener.closed) {
            // Notify the dashboard that a new account was added, then close.
            // The dashboard listens for this message and rehydrates the store.
            try {
              window.opener.postMessage(
                { type: 'PVOT_ACCOUNT_CONNECTED' },
                window.location.origin,
              );
            } catch {}
            window.close();
          } else {
            // Popup was blocked — we did a full redirect. Go to dashboard.
            router.replace('/dashboard');
          }
        }, 800);
      })
      .catch((err) => {
        const message = err instanceof OAuthError
          ? getFriendlyError(err.code)
          : 'An unexpected error occurred. Please try again.';
        setState({
          status:  'error',
          message,
          code: err instanceof OAuthError ? err.code : 'UNKNOWN',
        });
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center">
      <div className="max-w-sm w-full px-6">
        {state.status === 'processing' && <ProcessingState />}
        {state.status === 'success'    && <SuccessState name={state.accountName} />}
        {state.status === 'error'      && (
          <ErrorState
            message={state.message}
            onRetry={() => router.replace('/login')}
          />
        )}
      </div>
    </div>
  );
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────

async function handleCallback(
  params:     URLSearchParams,
  addAccount: (account: ConnectedAccount) => void,
): Promise<string> {
  const oauthClient = getOAuthClient();
  const tokenStore  = getTokenStore();

  // Exchange code for tokens
  const { token, accountId } = await oauthClient.handleCallback(params);

  // Fetch Google profile to get email/name/photo
  const profile = await fetchGoogleProfile(token.accessToken);

  // Deterministic account ID: hash of email (first 12 chars of SHA-256 hex)
  const id = await deriveAccountId(profile.email);

  // Save token to TokenStore so CalendarClient can load it
  await tokenStore.save(id, token);

  // Register account in store
  const account: ConnectedAccount = {
    id,
    email:        profile.email,
    displayName:  profile.name,
    photoUrl:     profile.picture ?? null,
    colorIndex:   0, // Zustand addAccount assigns this deterministically
    status:       'active',
    errorCode:    null,
    errorMessage: null,
    lastSyncedAt: new Date().toISOString(),
    addedAt:      new Date().toISOString(),
  };

  addAccount(account);

  return profile.name || profile.email;
}

async function fetchGoogleProfile(accessToken: string): Promise<{
  email: string;
  name:  string;
  picture?: string;
}> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to fetch Google profile');
  return res.json();
}

async function deriveAccountId(email: string): Promise<string> {
  const encoded = new TextEncoder().encode(email.toLowerCase());
  const digest  = await crypto.subtle.digest('SHA-256', encoded);
  const hex     = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hex.slice(0, 12);
}

// ─── UI STATES ────────────────────────────────────────────────────────────────

function ProcessingState() {
  return (
    <div className="flex flex-col items-center gap-5 text-center animate-fade-in">
      <div className="w-10 h-10 rounded-full border-2 border-rim border-t-blue-500 animate-spin-slow" />
      <div>
        <p className="text-body-md font-body text-primary">Connecting account</p>
        <p className="text-body-sm font-body text-secondary mt-1">Verifying authorization…</p>
      </div>
    </div>
  );
}

function SuccessState({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center gap-5 text-center animate-fade-in">
      <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
        <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <p className="text-body-md font-body text-primary">{name} connected</p>
        <p className="text-body-sm font-body text-secondary mt-1">Redirecting to dashboard…</p>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-5 text-center animate-fade-in">
      <div className="w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center">
        <svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <div>
        <p className="text-body-md font-body text-primary">Connection failed</p>
        <p className="text-body-sm font-body text-secondary mt-2">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-ui-md font-body
                   rounded-md transition-colors duration-fast focus-ring"
      >
        Try again
      </button>
    </div>
  );
}

// ─── ERROR MESSAGES ───────────────────────────────────────────────────────────

function getFriendlyError(code: string): string {
  const messages: Record<string, string> = {
    ACCESS_DENIED:         'You declined the calendar permission. PVOT requires read-only access to display your schedule.',
    CSRF_MISMATCH:         'Security check failed. This can happen if you opened multiple login tabs. Please try again.',
    PKCE_MISSING:          'Your session expired during login. Please start the connection process again.',
    TOKEN_EXCHANGE_FAILED: 'Google rejected the authorization. Please try connecting again.',
    NO_REFRESH_TOKEN:      'Google did not issue a refresh token. Please try again — you may need to revoke access first at myaccount.google.com.',
    // OAuthError codes from OAuthClient.ts
    access_denied:         'You declined calendar access. Please try again and click "Allow".',
    misconfigured:         'OAuth is not configured. Check NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env.local.',
    exchange_failed:       'Could not complete sign-in. Please try again.',
    userinfo_failed:       'Signed in but could not fetch your profile. Please try again.',
  };
  return messages[code] ?? 'An unexpected error occurred. Please try again.';
}
