
/**
 * packages/core/src/stores/index.ts
 * PVOT — Auth Store
 *
 * Holds connected Google accounts. Persisted to localStorage so accounts
 * survive page refreshes. Each account carries its OAuth tokens so the
 * calendar query layer can refresh them as needed.
 *
 * Shape used everywhere:
 *   useAuthStore(s => s.accounts)          → ConnectedAccount[]
 *   useAuthStore(s => s.addAccount)        → (account) => void
 *   useAuthStore(s => s.removeAccount)     → (id) => void
 *   useAuthStore(s => s.updateAccount)     → (id, patch) => void
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── TYPES ────────────────────────────────────────────────────────────────────
// This shape must match @pvot/core/types ConnectedAccount exactly.
// The callback page constructs this object directly.

export interface ConnectedAccount {
  id:            string;          // 12-char SHA-256 hex of email
  email:         string;
  displayName:   string;
  photoUrl:      string | null;
  provider?:     'google' | 'microsoft';
  colorIndex:    number;          // assigned by addAccount for lane colour
  status:        'active' | 'error' | 'refreshing';
  errorCode:     string | null;
  errorMessage:  string | null;
  lastSyncedAt:  string | null;   // ISO string
  addedAt:       string;          // ISO string
  // Token fields — optional, TokenStore is the primary token source
  accessToken?:  string;
  refreshToken?: string | null;
  expiresAt?:    number;
  scope?:        string;
}

interface AuthState {
  accounts:      ConnectedAccount[];
  addAccount:    (account: ConnectedAccount) => void;
  removeAccount: (id: string) => void;
  updateAccount: (id: string, patch: Partial<ConnectedAccount>) => void;
}

// ─── STORE ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accounts: [],

      addAccount: (account) =>
        set((s) => {
          // Replace if same id already exists (re-auth)
          const filtered = s.accounts.filter((a) => a.id !== account.id);
          // Assign the next available colour slot
          const colorIndex = account.colorIndex ?? filtered.length % 5;
          return { accounts: [...filtered, { ...account, colorIndex }] };
        }),

      removeAccount: (id) =>
        set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) })),

      updateAccount: (id, patch) =>
        set((s) => ({
          accounts: s.accounts.map((a) =>
            a.id === id ? { ...a, ...patch } : a,
          ),
        })),
    }),
    {
      name: 'pvot-auth-v1',
      partialize: (state) => ({ accounts: state.accounts }),
      // Sync across tabs/windows — when the OAuth popup writes the new account
      // to localStorage, the dashboard tab picks it up immediately without refresh.
      // Use default localStorage — Zustand handles JSON serialization internally.
      // Custom storage was double-parsing JSON and preventing cross-tab sync.
    },
  ),
);
