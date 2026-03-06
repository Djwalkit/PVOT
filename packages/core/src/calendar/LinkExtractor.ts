/**
 * packages/core/src/calendar/LinkExtractor.ts
 * PVOT — Video Link Extractor
 *
 * Parses meeting descriptions and conferenceData for video call links.
 * Prioritizes Google Meet conference data (authoritative), then falls
 * back to regex scanning description/location text.
 *
 * Provider detection order:
 *   1. Google Meet (conferenceData.entryPoints — most reliable)
 *   2. Zoom    (zoom.us/j/ pattern)
 *   3. Teams   (teams.microsoft.com/l/meetup-join/)
 *   4. Webex   (webex.com/meet/ or .webex.com)
 *   5. Unknown (any other HTTPS URL found near join/meeting keywords)
 */

import type { VideoLink, GoogleCalendarEvent } from '../types';

// ─── URL PATTERNS ─────────────────────────────────────────────────────────────

const PATTERNS: Array<{
  provider: VideoLink['provider'];
  label:    string;
  regex:    RegExp;
}> = [
  {
    provider: 'zoom',
    label:    'Join on Zoom',
    regex:    /https:\/\/(?:[a-z0-9-]+\.)?zoom\.us\/j\/[^\s<>"']+/gi,
  },
  {
    provider: 'teams',
    label:    'Join on Teams',
    regex:    /https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s<>"']+/gi,
  },
  {
    provider: 'webex',
    label:    'Join on Webex',
    regex:    /https:\/\/(?:[a-z0-9-]+\.)?webex\.com\/(?:meet|join|wbxmjs\/joinservice)[^\s<>"']*/gi,
  },
  {
    provider: 'google_meet',
    label:    'Join on Google Meet',
    regex:    /https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}[^\s<>"']*/gi,
  },
];

// ─── EXTRACTOR ────────────────────────────────────────────────────────────────

/**
 * Extract all video conferencing links from a Google Calendar event.
 * Returns an array sorted by confidence: conferenceData first, then
 * text-extracted links.
 */
export function extractVideoLinks(event: GoogleCalendarEvent): VideoLink[] {
  const links: VideoLink[] = [];
  const seen  = new Set<string>();

  const add = (link: VideoLink) => {
    const normalized = normalizeUrl(link.url);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      links.push(link);
    }
  };

  // ── 1. Google conferenceData (highest confidence) ──────────────────────────
  const entryPoints = event.conferenceData?.entryPoints ?? [];
  for (const ep of entryPoints) {
    if (ep.entryPointType === 'video' && ep.uri) {
      add({
        provider: 'google_meet',
        url:      ep.uri,
        label:    ep.label ?? 'Join on Google Meet',
      });
    }
  }

  // ── 2. Scan description and location text ──────────────────────────────────
  const textFields = [
    event.description ?? '',
    event.location ?? '',
  ];

  for (const text of textFields) {
    const stripped = stripHtml(text);
    for (const { provider, label, regex } of PATTERNS) {
      const matches = stripped.matchAll(regex);
      for (const match of matches) {
        add({ provider, url: cleanUrl(match[0]), label });
      }
    }
  }

  return links;
}

/**
 * Returns the single "primary" video link — the one to surface as the
 * main Join button. Priority: Meet > Zoom > Teams > Webex > Unknown.
 */
export function getPrimaryVideoLink(event: GoogleCalendarEvent): VideoLink | null {
  const all = extractVideoLinks(event);
  if (all.length === 0) return null;

  const priority: VideoLink['provider'][] = [
    'google_meet', 'zoom', 'teams', 'webex', 'unknown',
  ];

  for (const provider of priority) {
    const found = all.find((l) => l.provider === provider);
    if (found) return found;
  }

  return all[0];
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/** Strip HTML tags (Google Calendar descriptions can contain HTML) */
function stripHtml(html: string): string {
  // Replace block-level tags with newlines to preserve URL boundaries
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n');

  // Strip remaining tags
  return withBreaks.replace(/<[^>]+>/g, ' ');
}

/** Remove trailing punctuation that was accidentally included in regex match */
function cleanUrl(url: string): string {
  return url.replace(/[.,;:!?)]+$/, '');
}

/** Normalize URL for deduplication (remove utm params, trailing slashes) */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // Remove tracking params
    ['utm_source', 'utm_medium', 'utm_campaign'].forEach((p) => u.searchParams.delete(p));
    return u.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return url.toLowerCase().trim();
  }
}

/** Map provider to its display icon name (Lucide icon names) */
export function getProviderIcon(provider: VideoLink['provider']): string {
  const icons: Record<VideoLink['provider'], string> = {
    google_meet: 'Video',
    zoom:        'Video',
    teams:       'Video',
    webex:       'Video',
    unknown:     'ExternalLink',
  };
  return icons[provider];
}

/** Map provider to a short display name */
export function getProviderName(provider: VideoLink['provider']): string {
  const names: Record<VideoLink['provider'], string> = {
    google_meet: 'Google Meet',
    zoom:        'Zoom',
    teams:       'Teams',
    webex:       'Webex',
    unknown:     'Video Call',
  };
  return names[provider];
}
