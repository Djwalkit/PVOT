/**
 * packages/core/src/calendar/GoogleCalendarService.ts
 * PVOT — Google Calendar API Service
 *
 * Fetches events for a single account.
 * Handles 401 by triggering a force-refresh via TokenRefresher.
 * Each account fetch is fully isolated — a failure here affects only
 * that account's result in the Promise.allSettled aggregation.
 */

import type { GoogleCalendarEvent, GoogleCalendarListItem } from '../types';
import type { TokenRefresher }                              from '../auth/TokenRefresher';
import { getDayBoundsUtc }                                  from '../timezone/TimezoneUtils';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const BASE_URL  = 'https://www.googleapis.com/calendar/v3';
const MAX_RESULTS = 100; // per-calendar maximum

// ─── SERVICE ──────────────────────────────────────────────────────────────────

export class GoogleCalendarService {
  constructor(private readonly refresher: TokenRefresher) {}

  /**
   * Fetch all events for a given account on a given date.
   * Queries all writable + read-only calendars (not just 'primary').
   *
   * @param accountId    - The PVOT account ID
   * @param date         - YYYY-MM-DD
   * @param userTimezone - IANA timezone for day-boundary calculation
   */
  async fetchDayEvents(
    accountId:    string,
    date:         string,
    userTimezone: string,
  ): Promise<GoogleCalendarEvent[]> {
    const token = await this.refresher.getValidToken(accountId);

    // Step 1: Get the list of calendars for this account
    const calendars = await this._fetchCalendars(accountId, token);

    const { timeMin, timeMax } = getDayBoundsUtc(date, userTimezone);

    // Step 2: Fetch events from all calendars concurrently
    const results = await Promise.allSettled(
      calendars.map((cal) =>
        this._fetchCalendarEvents(accountId, token, cal.id, timeMin, timeMax),
      ),
    );

    // Step 3: Collect fulfilled results, skip failed calendars
    const allEvents: GoogleCalendarEvent[] = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        allEvents.push(...r.value);
      } else {
        console.warn(
          `[GoogleCalendarService] Failed to fetch calendar "${calendars[i]?.id}" ` +
          `for account "${accountId}":`,
          r.reason,
        );
      }
    });

    // Deduplicate by event ID (events can appear in multiple calendars)
    return deduplicateById(allEvents);
  }

  // ─── PRIVATE ──────────────────────────────────────────────────────────────

  private async _fetchCalendars(
    accountId: string,
    token: string,
  ): Promise<GoogleCalendarListItem[]> {
    const res = await this._apiFetch(
      accountId,
      token,
      `${BASE_URL}/users/me/calendarList?minAccessRole=reader&maxResults=100`,
    );

    const items: GoogleCalendarListItem[] = res.items ?? [];

    // Only fetch from calendars where we have actual read access
    return items.filter(
      (c) => c.accessRole === 'owner' || c.accessRole === 'writer' || c.accessRole === 'reader',
    );
  }

  private async _fetchCalendarEvents(
    accountId: string,
    token:     string,
    calendarId: string,
    timeMin:   string,
    timeMax:   string,
  ): Promise<GoogleCalendarEvent[]> {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents:  'true',      // Expand recurring events
      orderBy:       'startTime',
      maxResults:    String(MAX_RESULTS),
      // Include conferenceData for video link extraction
      fields: [
        'items(id,summary,description,location,status,htmlLink,start,end',
        'attendees,organizer,recurringEventId,recurrence',
        'conferenceData/entryPoints)',
      ].join(','),
    });

    const res = await this._apiFetch(
      accountId,
      token,
      `${BASE_URL}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    );

    return res.items ?? [];
  }

  /**
   * Authenticated fetch with automatic 401 retry (one retry only).
   * If the first attempt returns 401, force-refresh the token and retry.
   */
  private async _apiFetch(
    accountId: string,
    token:     string,
    url:       string,
    isRetry:   boolean = false,
  ): Promise<any> {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept:        'application/json',
      },
    });

    if (res.status === 401 && !isRetry) {
      // Token rejected — force refresh and retry once
      const newToken = await this.refresher.forceRefresh(accountId);
      return this._apiFetch(accountId, newToken, url, true);
    }

    if (res.status === 429) {
      throw new CalendarAPIError('RATE_LIMITED', `Rate limit exceeded for account "${accountId}"`);
    }

    if (res.status === 403) {
      throw new CalendarAPIError('FORBIDDEN', `Insufficient scope for account "${accountId}"`);
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new CalendarAPIError(
        'FETCH_FAILED',
        `Google Calendar API error: ${body?.error?.message ?? res.status}`,
      );
    }

    return res.json();
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function deduplicateById(events: GoogleCalendarEvent[]): GoogleCalendarEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}

export class CalendarAPIError extends Error {
  constructor(
    public readonly code: 'RATE_LIMITED' | 'FORBIDDEN' | 'FETCH_FAILED',
    message: string,
  ) {
    super(message);
    this.name = 'CalendarAPIError';
  }
}

// ─── SINGLETON FACTORY ────────────────────────────────────────────────────────

let _service: GoogleCalendarService | null = null;

export function getCalendarService(refresher: TokenRefresher): GoogleCalendarService {
  if (!_service) _service = new GoogleCalendarService(refresher);
  return _service;
}
