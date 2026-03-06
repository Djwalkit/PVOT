/**
 * packages/core/src/engine/GhostBlockService.ts
 * PVOT — Ghost Block Posting Service
 *
 * Posts "Unavailable" events directly to Google Calendar API.
 * 100% client-side — no proxy server.
 * Uses the stored access token for the target account.
 */

import type { GhostBlockSuggestion } from './ConflictEngine';
import { getTokenStore }             from '../auth/TokenStore';
import { getTokenRefresher }         from '../auth/TokenRefresher';
import { getOAuthClient }            from '../auth/OAuthClient';

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

export interface GhostBlockResult {
  ghostBlockId: string;
  success:      boolean;
  googleEventId?: string;
  error?:         string;
}

/**
 * Posts a single Ghost Block to a target Google Calendar.
 * Gets a fresh access token for the target account first.
 */
export async function postGhostBlock(
  ghost:       GhostBlockSuggestion,
  customTitle?: string,
): Promise<GhostBlockResult> {
  try {
    const tokenStore = getTokenStore();
    const refresher  = getTokenRefresher(getOAuthClient(), tokenStore);

    // Get a valid (possibly refreshed) token for the target account
    const token = await refresher.getValidToken(ghost.targetAccountId);

    const eventBody = {
      summary:     customTitle ?? ghost.title,
      status:      'busy',
      transparency:'opaque',          // blocks time visually in Google Calendar
      start: {
        dateTime: ghost.startUtc,
        timeZone: 'UTC',
      },
      end: {
        dateTime: ghost.endUtc,
        timeZone: 'UTC',
      },
      description: 'Automatically blocked by PVOT — conflict detected across calendars.',
      colorId:     '11',              // Tomato red — visually distinct
      extendedProperties: {
        private: {
          pvot:           'true',
          pvotType:       'ghost_block',
          pvotConflictId: ghost.sourceConflict,
        },
      },
    };

    const res = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events`,
      {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        ghostBlockId: ghost.id,
        success:      false,
        error:        err.error?.message ?? `HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    return {
      ghostBlockId:  ghost.id,
      success:       true,
      googleEventId: data.id,
    };

  } catch (err) {
    return {
      ghostBlockId: ghost.id,
      success:      false,
      error:        err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Posts ALL pending ghost blocks for a conflict simultaneously.
 * Returns results for each — partial success is acceptable.
 */
export async function postAllGhostBlocks(
  ghosts:       GhostBlockSuggestion[],
  customTitle?: string,
): Promise<GhostBlockResult[]> {
  const pending = ghosts.filter((g) => g.status === 'pending');
  return Promise.all(pending.map((g) => postGhostBlock(g, customTitle)));
}

/**
 * Delete a previously posted Ghost Block from Google Calendar.
 * Called if user wants to undo a Ghost Block.
 */
export async function deleteGhostBlock(
  accountId:     string,
  googleEventId: string,
): Promise<boolean> {
  try {
    const tokenStore = getTokenStore();
    const refresher  = getTokenRefresher(getOAuthClient(), tokenStore);
    const token      = await refresher.getValidToken(accountId);

    const res = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events/${googleEventId}`,
      {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${token.accessToken}` },
      },
    );

    return res.ok || res.status === 404; // 404 = already deleted, that's fine
  } catch {
    return false;
  }
}
