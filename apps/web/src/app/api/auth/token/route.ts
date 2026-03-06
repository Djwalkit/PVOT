/**
 * apps/web/src/app/api/auth/token/route.ts
 * PVOT — OAuth Code Exchange Endpoint
 *
 * POST /api/auth/token
 * Body: { code: string, redirectUri: string }
 *
 * Exchanges a Google authorization code for access + refresh tokens.
 * Must run server-side because GOOGLE_CLIENT_SECRET must never be
 * exposed to the browser.
 *
 * Returns: OAuthTokens
 *   { accessToken, refreshToken, expiresAt, scope }
 */

import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export async function POST(req: NextRequest) {
  try {
    const { code, redirectUri } = await req.json() as {
      code:        string;
      redirectUri: string;
    };

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid `code`' },
        { status: 400 },
      );
    }

    const clientId     = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('[/api/auth/token] Missing env vars: NEXT_PUBLIC_GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
      return NextResponse.json(
        { error: 'Server OAuth configuration is incomplete.' },
        { status: 500 },
      );
    }

    // ── Exchange with Google ───────────────────────────────────────────────
    const body = new URLSearchParams({
      code,
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
    });

    const googleRes = await fetch(GOOGLE_TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
    });

    if (!googleRes.ok) {
      const errBody = await googleRes.text().catch(() => '');
      console.error('[/api/auth/token] Google token exchange failed:', errBody);
      return NextResponse.json(
        { error: `Google rejected the authorization code: ${googleRes.status}` },
        { status: 400 },
      );
    }

    const data = await googleRes.json() as {
      access_token:  string;
      refresh_token?: string;
      expires_in:    number;
      scope:         string;
      token_type:    string;
    };

    // ── Shape into our OAuthTokens type ───────────────────────────────────
    const tokens = {
      accessToken:  data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt:    Date.now() + data.expires_in * 1000,
      scope:        data.scope,
    };

    return NextResponse.json(tokens);

  } catch (err) {
    console.error('[/api/auth/token] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error during token exchange.' },
      { status: 500 },
    );
  }
}
