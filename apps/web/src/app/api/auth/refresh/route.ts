/**
 * apps/web/src/app/api/auth/refresh/route.ts
 * Server-side token refresh — keeps GOOGLE_CLIENT_SECRET out of the browser.
 */

import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export async function POST(req: NextRequest) {
  const { refreshToken } = await req.json();

  if (!refreshToken) {
    return NextResponse.json({ error: 'missing_refresh_token' }, { status: 400 });
  }

  const body = new URLSearchParams({
    client_id:     process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    grant_type:    'refresh_token',
    refresh_token: refreshToken,
  });

  const res  = await fetch(GOOGLE_TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('[/api/auth/refresh] Google error:', data);
    return NextResponse.json({ error: data.error ?? 'refresh_failed' }, { status: 400 });
  }

  return NextResponse.json(data);
}