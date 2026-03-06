'use client';

/**
 * packages/core/src/auth/useConnectAccount.ts
 *
 * Opens the Google OAuth consent screen.
 * The callback page (auth)/callback/page.tsx handles the full exchange:
 *   code → tokens → userinfo → addAccount → redirect to dashboard
 *
 * This hook does NOT attempt to exchange the code itself — that caused
 * `invalid_grant` because the code was being consumed twice.
 */

import { useState, useCallback } from 'react';
import { getOAuthClient }        from './OAuthClient';

export interface UseConnectAccountResult {
  connect:      (accountIdToReplace?: string) => void;
  isConnecting: boolean;
  error:        string | null;
  clearError:   () => void;
}

export function useConnectAccount(): UseConnectAccountResult {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const connect = useCallback((accountIdToReplace?: string) => {
    setError(null);

    const client = getOAuthClient();

    if (!client.isConfigured) {
      setError(
        'Google OAuth is not configured. ' +
        'Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to apps/web/.env.local and restart.',
      );
      return;
    }

    setIsConnecting(true);

    // Open the OAuth consent screen (popup or redirect).
    // The callback page at (auth)/callback/page.tsx handles everything after:
    //   code → POST /api/auth/token → userinfo → addAccount → /dashboard
    // This hook must NOT call exchangeCode() — the code is one-time use.
    client.beginAuthRedirect(accountIdToReplace ?? null);

    // Reset isConnecting if the user closes the popup without completing auth
    const onFocus = () => {
      setTimeout(() => setIsConnecting(false), 800);
      window.removeEventListener('focus', onFocus);
    };
    window.addEventListener('focus', onFocus);
  }, []);

  return { connect, isConnecting, error, clearError: () => setError(null) };
}
