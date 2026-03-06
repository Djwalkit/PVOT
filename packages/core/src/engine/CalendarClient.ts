/**
 * packages/core/src/engine/CalendarClient.ts
 * PVOT — Google Calendar API Client
 *
 * fetchDayEvents(account, date, timezone) → Meeting[]
 *
 * Token refresh flow:
 *   1. Load token from TokenStore by accountId
 *   2. If expired (or within 60s), POST /api/auth/refresh to get new token
 *   3. Save refreshed token back to TokenStore + update account in AuthStore
 *   4. Make the Google Calendar API call with a valid access token
 *
 * Falls back to account.accessToken if TokenStore has nothing (e.g. first
 * session before TokenStore was wired up).
 */

import { getTokenStore }  from '../auth/TokenStore';
import type { OAuthTokens } from '../auth/OAuthClient';
import type { ConnectedAccount } from '../stores/index';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface Meeting {
  id:          string;
  title:       string;
  startUtc:    string;   // ISO 8601
  endUtc:      string;   // ISO 8601
  isAllDay:    boolean;
  attendees:   Attendee[];
  location:    string | null;
  description: string | null;
  htmlLink:    string | null;
  colorId:     string | null;
  status:      'confirmed' | 'tentative' | 'cancelled';
  organizer:   string | null;
  accountId:   string;
  metadata:    MeetingMetadata;
}

export interface Attendee {
  email:       string;
  displayName: string | null;
  self:        boolean;
  status:      'accepted' | 'declined' | 'tentative' | 'needsAction';
}

export interface MeetingMetadata {
  isHighFatigueSwitch?: boolean;
  hasConflict?:         boolean;
  conflictIds?:         string[];
}

// ─── CLIENT ───────────────────────────────────────────────────────────────────

export class CalendarClient {
  private readonly tokenStore = getTokenStore();

  /**
   * Fetch all events for a given account on a specific date.
   * Handles token refresh transparently.
   */
  async fetchDayEvents(
    account:  ConnectedAccount,
    date:     string,       // YYYY-MM-DD
    timezone: string,       // IANA tz string
  ): Promise<Meeting[]> {
    const accessToken = await this.getValidToken(account);

    // Build the day's time window in the user's timezone
    const { timeMin, timeMax } = this.dayWindow(date, timezone);

    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
    );
    url.searchParams.set('timeMin',      timeMin);
    url.searchParams.set('timeMax',      timeMax);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy',      'startTime');
    url.searchParams.set('maxResults',   '250');
    url.searchParams.set('timeZone',     timezone);
    // Request conferenceData so we can extract video join URLs
    url.searchParams.set('fields', [
      'items(id,summary,description,location,status,htmlLink,colorId',
      'start,end,organizer,attendees,recurringEventId',
      'hangoutLink,conferenceData/entryPoints)',
    ].join(','));

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept:        'application/json',
      },
    });

    if (res.status === 401) {
      // Token was rejected — force a refresh and retry once
      const freshToken = await this.refreshToken(account);
      return this.fetchWithToken(freshToken, url.toString(), account.id, timezone);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Google Calendar API error ${res.status}: ${body}`);
    }

    const data = await res.json() as GoogleCalendarListResponse;
    return this.normalizeEvents(data.items ?? [], account.id, timezone);
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async getValidToken(account: ConnectedAccount): Promise<string> {
    // 1. Try TokenStore (primary source after proper connect flow)
    const stored = await this.tokenStore.get(account.id);
    if (stored && stored.expiresAt > Date.now() + 60_000) {
      return stored.accessToken;
    }

    // 2. If stored token is expired, refresh it
    if (stored?.refreshToken) {
      const refreshed = await this.refreshToken(account, stored.refreshToken);
      return refreshed;
    }

    // 3. Fall back to account.accessToken (set by useConnectAccount)
    if (account.accessToken && account.expiresAt && account.expiresAt > Date.now() + 60_000) {
      return account.accessToken;
    }

    // 4. Try to refresh using account.refreshToken
    if (account.refreshToken) {
      const refreshed = await this.refreshToken(account, account.refreshToken);
      return refreshed;
    }

    throw new Error(
      `No valid token for account ${account.email}. Please reconnect.`,
    );
  }

  private async refreshToken(
    account:       ConnectedAccount,
    refreshToken?: string | null,
  ): Promise<string> {
    const rt = refreshToken
      ?? (await this.tokenStore.get(account.id))?.refreshToken
      ?? account.refreshToken;

    if (!rt) {
      throw new Error(
        `Cannot refresh token for ${account.email} — no refresh token available. Please reconnect.`,
      );
    }

    const res = await fetch('/api/auth/refresh', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refreshToken: rt, accountId: account.id }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Token refresh failed (${res.status}): ${body}`);
    }

    const fresh = await res.json() as OAuthTokens;

    // Persist the refreshed token
    await this.tokenStore.save(account.id, fresh);

    return fresh.accessToken;
  }

  private async fetchWithToken(
    accessToken: string,
    url:         string,
    accountId:   string,
    timezone:    string,
  ): Promise<Meeting[]> {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept:        'application/json',
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Google Calendar API error ${res.status}: ${body}`);
    }

    const data = await res.json() as GoogleCalendarListResponse;
    return this.normalizeEvents(data.items ?? [], accountId, timezone);
  }

  private dayWindow(date: string, timezone: string): { timeMin: string; timeMax: string } {
    // Build midnight-to-midnight in the user's timezone
    try {
      // Parse the date parts in the target timezone
      const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
      });

      // Create a Date at noon UTC on the given date string, then find
      // midnight boundaries by asking Intl what time it is in the target tz.
      const noon = new Date(`${date}T12:00:00Z`);
      const parts = fmt.formatToParts(noon);
      const g = (type: string) => parts.find(p => p.type === type)?.value ?? '00';

      // Midnight start: same date, 00:00:00 in target tz
      const startLocal = `${g('year')}-${g('month')}-${g('day')}T00:00:00`;
      // Midnight end: next day
      const endDate    = new Date(`${date}T12:00:00Z`);
      endDate.setUTCDate(endDate.getUTCDate() + 1);
      const endParts   = fmt.formatToParts(endDate);
      const eg         = (type: string) => endParts.find(p => p.type === type)?.value ?? '00';
      const endLocal   = `${eg('year')}-${eg('month')}-${eg('day')}T00:00:00`;

      // Convert local midnight strings to UTC ISO strings
      const timeMin = this.localToUTC(startLocal, timezone);
      const timeMax = this.localToUTC(endLocal,   timezone);

      return { timeMin, timeMax };
    } catch {
      // Fallback: treat date as UTC day
      return {
        timeMin: `${date}T00:00:00Z`,
        timeMax: `${date}T23:59:59Z`,
      };
    }
  }

  private localToUTC(localISO: string, timezone: string): string {
    // Use the browser's Intl to find the UTC offset for this local time
    try {
      const d = new Date(localISO);
      const utcMs = d.getTime();
      const localStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      }).format(d);
      // Parse back
      const [datePart, timePart] = localStr.split(', ');
      const asIfUTC = new Date(`${datePart}T${timePart}Z`);
      const offsetMs = asIfUTC.getTime() - utcMs;
      return new Date(utcMs - offsetMs).toISOString();
    } catch {
      return new Date(localISO).toISOString();
    }
  }

  private normalizeEvents(
    items:     GoogleCalendarEvent[],
    accountId: string,
    timezone:  string,
  ): Meeting[] {
    return items
      .filter(e => e.status !== 'cancelled')
      .map((e): Meeting => {
        const isAllDay   = !e.start.dateTime;
        const startUtc   = e.start.dateTime ?? `${e.start.date}T00:00:00Z`;
        const endUtc     = e.end.dateTime   ?? `${e.end.date}T23:59:59Z`;

        // Extract video join URL: prefer Google Meet conferenceData, fall back to hangoutLink
        const videoEntry = e.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video');
        const videoLink  = videoEntry?.uri ?? e.hangoutLink ?? null;

        return {
          id:          e.id,
          title:       e.summary ?? '(No title)',
          startUtc,
          endUtc,
          isAllDay,
          location:    e.location    ?? null,
          description: e.description ?? null,
          htmlLink:    e.htmlLink     ?? null,
          colorId:     e.colorId     ?? null,
          status:      (e.status as Meeting['status']) ?? 'confirmed',
          organizer:   e.organizer?.email ?? null,
          accountId,
          videoLink,
          attendees: (e.attendees ?? []).map(a => ({
            email:       a.email ?? '',
            displayName: a.displayName ?? null,
            self:        a.self ?? false,
            status:      (a.responseStatus as Attendee['status']) ?? 'needsAction',
          })),
          metadata: {},
        };
      });
  }
}

// ─── GOOGLE API RESPONSE TYPES ────────────────────────────────────────────────

interface GoogleCalendarListResponse {
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
}

interface ConferenceEntryPoint {
  entryPointType?: string;   // 'video' | 'phone' | 'sip' | 'more'
  uri?:            string;
  label?:          string;
}

interface GoogleCalendarEvent {
  id:           string;
  summary?:     string;
  description?: string;
  location?:    string;
  htmlLink?:    string;
  colorId?:     string;
  status?:      string;
  start:        { dateTime?: string; date?: string; timeZone?: string };
  end:          { dateTime?: string; date?: string; timeZone?: string };
  organizer?:   { email?: string; displayName?: string };
  attendees?:   GoogleAttendee[];
  hangoutLink?: string;
  conferenceData?: { entryPoints?: ConferenceEntryPoint[] };
}

interface GoogleAttendee {
  email?:          string;
  displayName?:    string;
  self?:           boolean;
  responseStatus?: string;
}

// ─── SINGLETON ────────────────────────────────────────────────────────────────

let _client: CalendarClient | null = null;

export function getCalendarClient(): CalendarClient {
  if (!_client) _client = new CalendarClient();
  return _client;
}
