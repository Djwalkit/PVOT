/**
 * packages/query/src/queryClient.ts
 * PVOT — React Query (TanStack) Global Configuration
 *
 * Single QueryClient instance shared across web and mobile.
 * Configured for aggressive caching (offline-first) and
 * graceful degradation (no global error toasts for partial failures).
 */

import {
  QueryClient,
  QueryCache,
  MutationCache,
} from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

// ─── CACHE TTL STRATEGY ───────────────────────────────────────────────────────
//
// staleTime: how long to consider data "fresh" (no background refetch)
// gcTime:    how long to keep unused data in memory before garbage collection
//
// Calendar events for the current day: aggressive background refresh.
// Past days: treat as immutable, long gcTime for offline access.

export const CACHE_KEYS = {
  TODAY_EVENTS:   5  * 60 * 1000,  // stale after 5 min
  PAST_EVENTS:    60 * 60 * 1000,  // stale after 1 hour
  ACCOUNT_LIST:   Infinity,         // never stale (user-managed)
} as const;

export const GC_TIMES = {
  TODAY_EVENTS: 24 * 60 * 60 * 1000,  // keep for 24h (offline support)
  PAST_EVENTS:  7  * 24 * 60 * 60 * 1000, // keep for 7 days
} as const;

// ─── QUERY CLIENT ─────────────────────────────────────────────────────────────

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime:            CACHE_KEYS.TODAY_EVENTS,
        gcTime:               GC_TIMES.TODAY_EVENTS,
        refetchOnWindowFocus: true,
        refetchOnReconnect:   true,
        retry: (failureCount, error: any) => {
          // Never retry 401/403 — token issues need explicit user action
          if (error?.status === 401 || error?.status === 403) return false;
          // Retry rate limits with backoff (up to 2x)
          if (error?.status === 429) return failureCount < 2;
          // Retry network errors up to 2x
          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
        // Don't throw globally — each query handles its own error state
        throwOnError: false,
      },
      mutations: {
        throwOnError: false,
      },
    },

    queryCache: new QueryCache({
      onError: (error, query) => {
        // Global error telemetry hook (plug in Sentry here)
        if (process.env.NODE_ENV === 'development') {
          console.error('[PVOT QueryCache]', query.queryKey, error);
        }
      },
    }),

    mutationCache: new MutationCache({
      onError: (error) => {
        if (process.env.NODE_ENV === 'development') {
          console.error('[PVOT MutationCache]', error);
        }
      },
    }),
  });
}

// Singleton for web — import this in the root Provider
export const queryClient = createQueryClient();

// ─── PERSISTENCE (web only — localStorage sync) ───────────────────────────────

const PERSIST_KEY = 'pvot-query-cache';
const MAX_AGE     = 24 * 60 * 60 * 1000; // 24 hours

export function setupQueryPersistence(client: QueryClient): void {
  if (typeof window === 'undefined') return; // skip SSR

  const persister = createSyncStoragePersister({
    storage: window.localStorage,
    key:     PERSIST_KEY,
    // Throttle writes to avoid thrashing localStorage on rapid updates
    throttleTime: 1000,
    serialize:   JSON.stringify,
    deserialize: JSON.parse,
  });

  persistQueryClient({
    queryClient:  client,
    persister,
    maxAge:       MAX_AGE,
    buster:       process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev',
    // Only persist calendar event queries, not auth/token queries
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => {
        const key = query.queryKey[0] as string;
        return key === 'calendar' && query.state.status === 'success';
      },
    },
  });
}
