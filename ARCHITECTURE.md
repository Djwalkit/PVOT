# PVOT — Monorepo Architecture

## Directory Structure

```
pvot/
├── apps/
│   ├── web/                        # Next.js 14 App Router
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx        # Redirect → /dashboard
│   │   │   │   ├── (auth)/
│   │   │   │   │   ├── login/page.tsx
│   │   │   │   │   └── callback/page.tsx   # OAuth redirect handler
│   │   │   │   └── (app)/
│   │   │   │       └── dashboard/page.tsx  # 3-Layer shell
│   │   │   ├── components/         # Web-only components
│   │   │   ├── hooks/              # Web-only hooks
│   │   │   └── providers/          # QueryClientProvider, ThemeProvider
│   │   ├── tailwind.config.js      # Extends root config
│   │   └── next.config.js
│   │
│   └── mobile/                     # Expo SDK 51
│       ├── src/
│       │   ├── app/                # Expo Router
│       │   │   ├── _layout.tsx
│       │   │   ├── (tabs)/
│       │   │   │   ├── index.tsx   # Timeline (primary)
│       │   │   │   ├── accounts.tsx
│       │   │   │   └── settings.tsx
│       │   │   └── event/[id].tsx  # Bottom sheet detail
│       │   └── components/         # Mobile-only components
│       └── app.json
│
├── packages/
│   ├── core/                       # Shared business logic (no React)
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   │   ├── OAuthClient.ts      # PKCE flow, token exchange
│   │   │   │   ├── TokenStore.ts       # Encrypted storage abstraction
│   │   │   │   └── TokenRefresher.ts   # Silent refresh logic
│   │   │   ├── calendar/
│   │   │   │   ├── GoogleCalendarService.ts
│   │   │   │   ├── EventNormalizer.ts  # → Meeting interface
│   │   │   │   ├── ConflictDetector.ts
│   │   │   │   └── LinkExtractor.ts    # Zoom/Meet/Teams URL parser
│   │   │   ├── timezone/
│   │   │   │   └── TimezoneUtils.ts    # Intl.DateTimeFormat wrappers
│   │   │   └── types/
│   │   │       └── index.ts            # Canonical type definitions
│   │   └── package.json
│   │
│   ├── ui/                         # Shared React component library
│   │   ├── src/
│   │   │   ├── primitives/         # Button, Badge, Avatar, Skeleton
│   │   │   ├── calendar/           # MeetingCard, Timeline, ConflictBadge
│   │   │   ├── layout/             # Panel, Sidebar, ContextPanel
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── query/                      # Shared React Query config + hooks
│       ├── src/
│       │   ├── queryClient.ts      # QueryClient singleton config
│       │   ├── keys.ts             # Query key factory
│       │   ├── useCalendarQuery.ts # Core data hook
│       │   └── usePrefetch.ts      # Background prefetch on focus
│       └── package.json
│
├── tailwind.config.js              # ROOT — canonical design tokens
├── tsconfig.base.json
├── turbo.json                      # Turborepo pipeline
└── package.json                    # pnpm workspace root
```

## State Management Architecture

### Layer 1: Server State → React Query (TanStack)
Handles all async data: fetching, caching, background refetching, 
and partial success aggregation.

```
useCalendarQuery
  └── Promise.allSettled([account1, account2, account3])
       ├── Fulfilled → normalize → merge → sort chronologically
       └── Rejected  → surface AccountError (reconnect badge)
         
Cache TTL Strategy:
  - staleTime:   5 minutes   (don't refetch if data is fresh)
  - gcTime:      24 hours    (keep in memory for offline)
  - refetchOnWindowFocus: true
  - retry: 2 (with exponential backoff)
```

### Layer 2: Client/UI State → Zustand
Handles ephemeral UI: selected event, privacy mode, sidebar state,
active account filters.

```typescript
// packages/core/src/types/store.ts
interface UIStore {
  selectedEventId: string | null;
  privacyMode:     boolean;
  sidebarOpen:     boolean;         // mobile only
  activeAccounts:  string[];        // filter by account
  setSelectedEvent: (id: string | null) => void;
  togglePrivacy:   () => void;
  toggleSidebar:   () => void;
  toggleAccount:   (accountId: string) => void;
}
```

### Layer 3: Auth State → Zustand (persisted)
Account list and token metadata (NOT the raw tokens).

```typescript
interface AuthStore {
  accounts: ConnectedAccount[];
  addAccount:    (account: ConnectedAccount) => void;
  removeAccount: (accountId: string) => void;
  updateAccount: (accountId: string, patch: Partial<ConnectedAccount>) => void;
}

interface ConnectedAccount {
  id:           string;   // SHA-256 of email for privacy
  email:        string;
  displayName:  string;
  colorIndex:   0 | 1 | 2 | 3 | 4 | 5 | 6;  // maps to account.* colors
  status:       'active' | 'error' | 'refreshing';
  errorCode:    'token_expired' | 'fetch_failed' | null;
  // Token stored separately in encrypted storage — never in Zustand
}
```

## Token Security Architecture

### Web
Raw OAuth tokens NEVER touch React state or localStorage directly.

```
OAuth Callback → SessionStorage (tab-scoped, cleared on close)
                      ↓
          AES-GCM encryption (key derived from browser fingerprint + session)
                      ↓
          Encrypted blob → localStorage (can't be read cross-origin)
                      ↓
          On read: decrypt in-memory, never serialize decrypted form
```

### Mobile (Expo)
```
OAuth Callback → expo-secure-store (iOS Keychain / Android Keystore)
                 Key: `pvot_token_${accountId}`
```

## Data Flow Diagram

```
Google Calendar API
       │
       ▼
GoogleCalendarService.fetchForAccount(token, date)
       │  (per account, run in Promise.allSettled)
       ▼
EventNormalizer.normalize(rawEvent, accountId, userTimezone)
       │  → Meeting interface (canonical type)
       ▼
ConflictDetector.annotate(meetings[])
       │  → Meeting[] with isConflict, conflictWith fields
       ▼
React Query cache
       │  (stale-while-revalidate, localStorage persist)
       ▼
useCalendarQuery() hook
       │  → { meetings, errors, isLoading, isFetching }
       ▼
Timeline Component (virtualized)
       │
       ├── MeetingCard (per meeting)
       └── AccountErrorBadge (per failed account)
```
