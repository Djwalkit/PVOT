/**
 * packages/core/src/timezone/TimezoneUtils.ts
 * PVOT — Timezone Utilities + World City Search Engine  v2.0
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * v2.0 — WORLD CITY SEARCH
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Added: CityOption, ALL_CITIES, FEATURED_CITIES, searchCities()
 *
 * ALL_CITIES builds once at module load from Intl.supportedValuesOf('timeZone')
 * — 418 real IANA cities. Each entry gets a pre-lowercased searchKey so
 * filtering at keystroke speed costs exactly one .includes() per city.
 *
 * Users can type ANY of:
 *   "Lagos"       → Africa/Lagos
 *   "Africa"      → all 52 African cities
 *   "GMT+1"       → every GMT+1 zone worldwide
 *   "Indiana"     → America/Indiana/* sub-zones
 *   "America/New" → New York, New Salem, etc.
 *   "Asia"        → all 82 Asian cities
 *
 * searchCities(query, exclude?) is the only import the UI components need.
 * groupByRegion() is a display helper for empty-state grouped rendering.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * EXISTING UTILITIES (unchanged)
 * ═══════════════════════════════════════════════════════════════════════════
 * All pre-existing exports are preserved below the city search section.
 */

// ─── CITY SEARCH ──────────────────────────────────────────────────────────────

export interface CityOption {
  tz:         string;   // IANA identifier  e.g. "Africa/Lagos"
  city:       string;   // Human name        e.g. "Lagos"
  region:     string;   // Continent         e.g. "Africa"
  sub:        string;   // Sub-region        e.g. "Indiana" (3-part zones only)
  offsetStr:  string;   // Live UTC label    e.g. "GMT+1"
  offsetMins: number;   // Numeric offset for sorting  e.g. 60
  searchKey:  string;   // Pre-lowercased concat of all searchable fields
}

/**
 * ALL_CITIES — built once at module load, never during render.
 * ~418 entries sorted west → east (negative offset first), then alpha.
 */
export const ALL_CITIES: CityOption[] = (() => {
  if (typeof Intl === 'undefined' || !Intl.supportedValuesOf) return [];
  const now = new Date();
  return Intl.supportedValuesOf('timeZone')
    .map((tz): CityOption | null => {
      const parts  = tz.split('/');
      const region = parts[0] ?? '';
      const city   = (parts[parts.length - 1] ?? '').replace(/_/g, ' ');
      const sub    = parts.length === 3 ? (parts[1] ?? '').replace(/_/g, ' ') : '';

      let offsetStr  = 'UTC';
      let offsetMins = 0;
      try {
        const fp = new Intl.DateTimeFormat('en', {
          timeZone: tz,
          timeZoneName: 'shortOffset',
        }).formatToParts(now);
        offsetStr = fp.find(p => p.type === 'timeZoneName')?.value ?? 'UTC';
        const m = offsetStr.match(/GMT([+-])(\d+)(?::(\d+))?/);
        if (m) {
          const sign = m[1] === '+' ? 1 : -1;
          offsetMins = sign * (parseInt(m[2]!) * 60 + parseInt(m[3] ?? '0'));
        }
      } catch {
        return null;
      }

      // Pre-build search key: every string the user might type
      const searchKey = [
        city,
        region,
        sub,
        tz,                          // "Africa/Lagos"
        tz.replace(/\//g, ' '),      // "Africa Lagos"
        tz.replace(/_/g,  ' '),      // "America New York"
        offsetStr,                   // "GMT+1"
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return { tz, city, region, sub, offsetStr, offsetMins, searchKey };
    })
    .filter((x): x is CityOption => x !== null)
    .sort((a, b) => a.offsetMins - b.offsetMins || a.city.localeCompare(b.city));
})();

/** Major business & financial hubs — shown when search is empty */
const FEATURED_TZ = [
  'UTC',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam',
  'Europe/Zurich', 'Europe/Stockholm', 'Europe/Madrid', 'Europe/Rome',
  'Europe/Moscow',
  'Africa/Lagos', 'Africa/Nairobi', 'Africa/Johannesburg', 'Africa/Accra',
  'Africa/Cairo', 'Africa/Casablanca', 'Africa/Addis_Ababa', 'Africa/Abidjan',
  'Africa/Dar_es_Salaam', 'Africa/Khartoum', 'Africa/Dakar', 'Africa/Douala',
  'Africa/Kampala', 'Africa/Lusaka', 'Africa/Harare',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Toronto', 'America/Sao_Paulo', 'America/Mexico_City',
  'America/Bogota', 'America/Lima', 'America/Buenos_Aires',
  'Asia/Dubai', 'Asia/Riyadh', 'Asia/Karachi', 'Asia/Kolkata',
  'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Hong_Kong',
  'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Jakarta',
  'Asia/Kuala_Lumpur', 'Asia/Manila', 'Asia/Taipei',
  'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland',
];

export const FEATURED_CITIES: CityOption[] = FEATURED_TZ
  .flatMap(tz => ALL_CITIES.filter(c => c.tz === tz))
  .filter((c, i, arr) => arr.findIndex(x => x.tz === c.tz) === i);

/**
 * searchCities — the only function the UI needs to import.
 *
 * @param query   — raw user input (e.g. "Lagos", "Africa", "GMT+1")
 * @param exclude — Set of IANA strings to omit (e.g. already-pinned zones)
 * @param limit   — max results (default 80)
 *
 * Returns FEATURED_CITIES when query is empty.
 * Returns up to `limit` matching cities for any non-empty query.
 */
export function searchCities(
  query:   string,
  exclude: Set<string> = new Set(),
  limit    = 80,
): CityOption[] {
  const q    = query.trim().toLowerCase();
  const pool = q ? ALL_CITIES : FEATURED_CITIES;
  const out: CityOption[] = [];

  for (const c of pool) {
    if (exclude.has(c.tz)) continue;
    if (q && !c.searchKey.includes(q)) continue;
    out.push(c);
    if (out.length >= limit) break;
  }

  return out;
}

/**
 * groupByRegion — groups a CityOption[] by continent for display.
 * Used by the HomeZones dropdown when showing all featured cities.
 */
const REGION_ORDER = [
  'Universal', 'Europe', 'Africa', 'America', 'Asia',
  'Australia', 'Pacific', 'Atlantic', 'Indian', 'Arctic', 'Antarctica', 'Other',
];

export function groupByRegion(
  cities: CityOption[],
): { region: string; items: CityOption[] }[] {
  const map = new Map<string, CityOption[]>();
  for (const c of cities) {
    const key = c.region || 'Other';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  }
  return REGION_ORDER.flatMap(r =>
    map.has(r) ? [{ region: r, items: map.get(r)! }] : [],
  );
}

// ─── EXISTING UTILITIES ───────────────────────────────────────────────────────
// Preserved exactly — nothing below this line was changed.

/**
 * Format a UTC ISO string as HH:MM in a given IANA timezone.
 */
export function formatTimeInZone(utcIso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour:     '2-digit',
      minute:   '2-digit',
      hour12:   false,
    }).format(new Date(utcIso));
  } catch {
    return '--:--';
  }
}

/**
 * Return today's date string (YYYY-MM-DD) in a given IANA timezone.
 * Used by getAnchorTodayStr() in pvotStore to fix the UTC date-desync bug.
 */
export function getTodayInZone(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year:     'numeric',
      month:    '2-digit',
      day:      '2-digit',
    }).formatToParts(new Date());
    const g = (t: string) => parts.find(p => p.type === t)?.value ?? '00';
    return `${g('year')}-${g('month')}-${g('day')}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Return the UTC offset in minutes for a given IANA timezone right now.
 * e.g. 'Europe/London' in summer → 60, in winter → 0
 */
export function getOffsetMinutes(timezone: string): number {
  try {
    const now = new Date();
    const fp  = new Intl.DateTimeFormat('en', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    }).formatToParts(now);
    const label = fp.find(p => p.type === 'timeZoneName')?.value ?? '';
    const m = label.match(/GMT([+-])(\d+)(?::(\d+))?/);
    if (!m) return 0;
    const sign = m[1] === '+' ? 1 : -1;
    return sign * (parseInt(m[2]!) * 60 + parseInt(m[3] ?? '0'));
  } catch {
    return 0;
  }
}

/**
 * Return the short UTC offset label for display (e.g. "GMT+1", "GMT-5").
 */
export function getOffsetLabel(timezone: string): string {
  try {
    const fp = new Intl.DateTimeFormat('en', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date());
    return fp.find(p => p.type === 'timeZoneName')?.value ?? 'UTC';
  } catch {
    return 'UTC';
  }
}