/**
 * apps/web/src/app/(auth)/login/page.tsx
 * PVOT — Login / Connect First Account
 *
 * Shown when the user has no connected accounts or visits unauthenticated.
 * The only action is "Connect Google Account" — no email/password.
 */

'use client';

import { useState, useCallback } from 'react';
import { CalendarDays }          from 'lucide-react';
import { getOAuthClient }        from '@pvot/core/auth/OAuthClient';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await getOAuthClient().beginAuth(null);
      // Page navigates away — no need to setLoading(false)
    } catch (err) {
      setError('Failed to initiate Google login. Please try again.');
      setLoading(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-up">

        {/* Wordmark */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-raised border border-rim mb-4">
            <CalendarDays className="w-6 h-6 text-blue-500" aria-hidden="true" />
          </div>
          <h1 className="text-heading-lg font-display text-primary tracking-tight">
            PV<span className="text-blue-500">O</span>T
          </h1>
          <p className="text-body-sm font-body text-secondary mt-2">
            Executive calendar, unified.
          </p>
        </div>

        {/* Connect card */}
        <div className="bg-base border border-divider rounded-lg p-6 space-y-5">
          <div>
            <h2 className="text-heading-sm font-display text-primary">Connect your calendar</h2>
            <p className="text-body-sm font-body text-secondary mt-1 leading-relaxed">
              PVOT requires read-only access to Google Calendar.
              No data is stored on our servers.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="px-3 py-2.5 rounded-md bg-danger/5 border border-danger/20 text-body-sm font-body text-danger"
            >
              {error}
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={loading}
            aria-busy={loading}
            className="w-full h-11 flex items-center justify-center gap-3 px-4 rounded-md
                       bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white
                       text-ui-lg font-body font-medium
                       transition-all duration-fast ease-standard
                       disabled:opacity-50 disabled:pointer-events-none
                       focus-ring"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin-slow" aria-hidden="true" />
                Connecting…
              </>
            ) : (
              <>
                {/* Google G mark (inline SVG — no asset dependency) */}
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>

          {/* Scope transparency */}
          <p className="text-label-xs font-body text-muted text-center">
            Scope:{' '}
            <code className="font-mono bg-raised px-1 py-0.5 rounded-sm text-ghost">
              calendar.readonly
            </code>
          </p>
        </div>
      </div>
    </div>
  );
}
