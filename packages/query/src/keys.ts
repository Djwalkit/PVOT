/**
 * packages/query/src/keys.ts
 * PVOT — Query Key Factory
 *
 * Centralized, type-safe query key definitions.
 * Using a factory pattern prevents typo-based cache mismatches.
 *
 * Usage:
 *   queryKeys.calendar.today(accounts, date, tz)
 *   → ['calendar', 'events', { accountIds, date, timezone }]
 *
 * This structure means:
 *   queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all() })
 *   → invalidates ALL calendar queries (e.g. on account reconnect)
 */

export const queryKeys = {
  // ── Calendar events ──────────────────────────────────────────────────────
  calendar: {
    /** Scope: all calendar queries */
    all:    ()            => ['calendar'] as const,

    /** Scope: all event queries */
    events: ()            => ['calendar', 'events'] as const,

    /** Specific: events for a given date, account set, and timezone */
    today: (
      accountIds: string[],
      date:       string,  // YYYY-MM-DD
      timezone:   string,  // IANA
    ) =>
      [
        'calendar',
        'events',
        {
          accountIds: [...accountIds].sort(),  // sort for stable keys
          date,
          timezone,
        },
      ] as const,

    /** Single account's events (used for partial invalidation) */
    forAccount: (accountId: string, date: string) =>
      ['calendar', 'events', 'account', accountId, date] as const,
  },

  // ── Google account metadata ───────────────────────────────────────────────
  account: {
    all:    ()            => ['account'] as const,
    detail: (id: string)  => ['account', id] as const,
    profile:(id: string)  => ['account', id, 'profile'] as const,
  },

  // ── User preferences ─────────────────────────────────────────────────────
  prefs: {
    all:      () => ['prefs'] as const,
    timezone: () => ['prefs', 'timezone'] as const,
  },
} as const;
