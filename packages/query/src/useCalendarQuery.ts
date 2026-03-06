/**
 * packages/query/src/useCalendarQuery.ts
 * PVOT — Core Calendar Data Hook
 *
 * This hook is the single source of truth for all calendar data in the UI.
 * It orchestrates:
 *   1. Fetching from all connected accounts concurrently (Promise.allSettled)
 *   2. Partial success: surfacing data from working accounts + error states
 *      for failed ones — NEVER crashing the UI on a single account failure
 *   3. Normalization → conflict annotation → sorted output
 *   4. Aggressive caching with offline persistence
 *
 * Usage:
 *   const { data, isLoading, isFetching, accountStatuses } = useCalendarQuery();
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore }             from '@pvot/core/stores';
import { useUIStore }               from '@pvot/core/stores';
import { normalizeEvents }          from '@pvot/core/calendar/EventNormalizer';
import { annotateConflicts }        from '@pvot/core/calendar/ConflictDetector';
import { getCalendarService }       from '@pvot/core/calendar/GoogleCalendarService';
import { getTokenRefresher }        from '@pvot/core/auth/TokenRefresher';
import { getOAuthClient }           from '@pvot/core/auth/OAuthClient';
import { getTokenStore }            from '@pvot/core/auth/TokenStore';
import { todayInTimezone }          from '@pvot/core/timezone/TimezoneUtils';
import type {
  CalendarQueryResult,
  AccountFetchResult,
  ConnectedAccount,
  AccountErrorCode,
} from '@pvot/core/types';
import { queryKeys, CACHE_KEYS, GC_TIMES } from './keys';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

// User's configured timezone — in a real app, read from prefs store.
// For now: detect from browser.
function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// ─── FETCHER ──────────────────────────────────────────────────────────────────

/**
 * The query function. Called by React Query when data is stale or missing.
 * Implements the Promise.allSettled partial success pattern.
 */
async function fetchAllAccounts(
  accounts:     ConnectedAccount[],
  date:         string,
  userTimezone: string,
): Promise<CalendarQueryResult> {
  if (accounts.length === 0) {
    return {
      meetings:        [],
      accountStatuses: [],
      fetchedAt:       new Date().toISOString(),
      date,
      timezone:        userTimezone,
    };
  }

  // Build services
  const oauthClient = getOAuthClient();
  const tokenStore  = getTokenStore();
  const refresher   = getTokenRefresher(oauthClient, tokenStore);
  const calService  = getCalendarService(refresher);

  // ── Fetch all accounts concurrently — partial failure is acceptable ─────────
  const fetchResults = await Promise.allSettled(
    accounts.map((account) =>
      calService.fetchDayEvents(account.id, date, userTimezone),
    ),
  );

  // ── Collect results and build per-account status ───────────────────────────
  const accountStatuses: AccountFetchResult[] = [];
  const allMeetings = [];

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const result  = fetchResults[i];

    if (result.status === 'fulfilled') {
      const normalized = normalizeEvents(result.value, account, userTimezone);
      allMeetings.push(...normalized);
      accountStatuses.push({
        accountId: account.id,
        status:    'fulfilled',
        count:     normalized.length,
        error:     null,
      });
    } else {
      // Classify the error for the reconnect badge
      const error  = classifyError(result.reason);
      accountStatuses.push({
        accountId: account.id,
        status:    'rejected',
        count:     0,
        error,
      });
    }
  }

  // ── Sort all meetings chronologically (across accounts) ────────────────────
  allMeetings.sort(
    (a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime(),
  );

  // ── Annotate conflicts (after sort — ConflictDetector needs chronological order) ──
  const annotatedMeetings = annotateConflicts(allMeetings);

  return {
    meetings:        annotatedMeetings,
    accountStatuses,
    fetchedAt:       new Date().toISOString(),
    date,
    timezone:        userTimezone,
  };
}

// ─── HOOK ─────────────────────────────────────────────────────────────────────

export function useCalendarQuery(overrideDate?: string) {
  const accounts    = useAuthStore((s) => s.accounts);
  const activeIds   = useUIStore((s) => s.activeAccountIds);
  const viewDate    = useUIStore((s) => s.viewDate);

  const timezone    = getUserTimezone();
  const date        = overrideDate ?? viewDate;

  // Filter by active account selection
  const filteredAccounts = activeIds === 'all'
    ? accounts
    : accounts.filter((a) => activeIds.includes(a.id));

  const accountIds = filteredAccounts.map((a) => a.id);

  const query = useQuery<CalendarQueryResult>({
    queryKey:  queryKeys.calendar.today(accountIds, date, timezone),
    queryFn:   () => fetchAllAccounts(filteredAccounts, date, timezone),
    staleTime: date === todayInTimezone(timezone)
      ? CACHE_KEYS.TODAY_EVENTS  // Today: refresh every 5 min
      : CACHE_KEYS.PAST_EVENTS,  // Past days: refresh every hour
    gcTime:    GC_TIMES.TODAY_EVENTS,
    enabled:   accounts.length > 0,
    // Don't show error state for partial failures — accountStatuses handles that
    throwOnError: false,
  });

  return {
    // Data
    meetings:        query.data?.meetings ?? [],
    accountStatuses: query.data?.accountStatuses ?? [],
    fetchedAt:       query.data?.fetchedAt ?? null,
    timezone,

    // Loading states — both matter for the UI
    isLoading:   query.isLoading,   // true on first load with no cache
    isFetching:  query.isFetching,  // true on background revalidation
    isError:     query.isError,     // true only if ALL accounts failed
    error:       query.error,

    // Derived: are there any account-level errors?
    hasPartialErrors: (query.data?.accountStatuses ?? []).some(
      (s) => s.status === 'rejected',
    ),

    // Refetch trigger (for manual pull-to-refresh)
    refetch: query.refetch,
  };
}

// ─── PREFETCH HOOK ───────────────────────────────────────────────────────────
// Call on dashboard mount to pre-warm tomorrow's data

export function useCalendarPrefetch() {
  const queryClient = useQueryClient();
  const accounts    = useAuthStore((s) => s.accounts);
  const timezone    = getUserTimezone();

  const prefetchTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];

    queryClient.prefetchQuery({
      queryKey: queryKeys.calendar.today(accounts.map((a) => a.id), tomorrowDate, timezone),
      queryFn:  () => fetchAllAccounts(accounts, tomorrowDate, timezone),
      staleTime: CACHE_KEYS.PAST_EVENTS,
    });
  };

  return { prefetchTomorrow };
}

// ─── ERROR CLASSIFIER ─────────────────────────────────────────────────────────

function classifyError(error: unknown): AccountErrorCode {
  if (!error) return 'fetch_failed';

  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as any)?.code;

  if (code === 'RATE_LIMITED' || msg.includes('429')) return 'rate_limited';
  if (code === 'REFRESH_INVALID' || msg.includes('token_expired')) return 'token_expired';
  if (code === 'FORBIDDEN' || msg.includes('403')) return 'scope_changed';
  return 'fetch_failed';
}
