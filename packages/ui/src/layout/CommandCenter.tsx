/**
 * packages/ui/src/layout/CommandCenter.tsx
 * PVOT — Layer 1: Command Center (Left Sidebar, 260px)
 *
 * Contains:
 *   - PVOT wordmark
 *   - Primary navigation
 *   - Connected accounts panel with per-account sync status
 *   - "+ Add Account" trigger
 *   - Privacy mode toggle
 *   - Keyboard shortcuts legend (collapsible)
 *
 * Fully keyboard navigable. All interactive elements have explicit
 * focus-visible rings and aria labels.
 */

'use client';

import React, { useState, useCallback } from 'react';
import {
  CalendarDays, Settings, ChevronDown, ChevronRight,
  Plus, RefreshCw, AlertCircle, EyeOff, Eye,
  Keyboard, LogOut, ExternalLink,
} from 'lucide-react';
import { cn }           from '../lib/utils';
import { Button, Badge, Avatar, Divider, Tooltip, IconButton } from '../primitives';
import { useAuthStore, useUIStore, selectErrorAccounts } from '@pvot/core/stores';
import { getOAuthClient } from '@pvot/core/auth/OAuthClient';
import type { ConnectedAccount } from '@pvot/core/types';

// ─── ACCOUNT COLOR ────────────────────────────────────────────────────────────

const ACCOUNT_COLORS = [
  '#3D87FF','#10B981','#F59E0B',
  '#E879F9','#38BDF8','#FB923C','#A78BFA',
] as const;

// ─── COMMAND CENTER ───────────────────────────────────────────────────────────

interface CommandCenterProps {
  className?: string;
}

export function CommandCenter({ className }: CommandCenterProps) {
  const accounts         = useAuthStore((s) => s.accounts);
  const removeAccount    = useAuthStore((s) => s.removeAccount);
  const privacyMode      = useUIStore((s) => s.privacyMode);
  const togglePrivacy    = useUIStore((s) => s.togglePrivacy);
  const activeAccountIds = useUIStore((s) => s.activeAccountIds);
  const setActiveAccounts= useUIStore((s) => s.setActiveAccounts);

  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [connectingNew,  setConnectingNew] = useState(false);

  const errorAccounts = selectErrorAccounts({ accounts } as any);

  const handleAddAccount = useCallback(async () => {
    setConnectingNew(true);
    try {
      await getOAuthClient().beginAuth(null);
    } finally {
      setConnectingNew(false);
    }
  }, []);

  const handleReconnect = useCallback(async (accountId: string) => {
    await getOAuthClient().beginAuth(accountId);
  }, []);

  const handleRemove = useCallback(
    async (account: ConnectedAccount) => {
      removeAccount(account.id);
    },
    [removeAccount],
  );

  const toggleAccountFilter = useCallback(
    (id: string) => {
      if (activeAccountIds === 'all') {
        setActiveAccounts([id]);
      } else if (activeAccountIds.includes(id)) {
        const next = activeAccountIds.filter((a) => a !== id);
        setActiveAccounts(next.length === 0 ? 'all' : next);
      } else {
        setActiveAccounts([...activeAccountIds, id]);
      }
    },
    [activeAccountIds, setActiveAccounts],
  );

  return (
    <aside
      aria-label="Command Center"
      className={cn(
        'flex flex-col h-full bg-base border-r border-divider',
        'w-sidebar flex-shrink-0',
        className,
      )}
    >
      {/* ── Wordmark ───────────────────────────────────────────────────────── */}
      <header className="flex items-center h-14 px-5 border-b border-divider flex-shrink-0">
        <span className="font-display font-bold text-heading-sm text-primary tracking-tight select-none">
          PV<span className="text-blue-500">O</span>T
        </span>
        {errorAccounts.length > 0 && (
          <span className="ml-auto">
            <Badge label={`${errorAccounts.length}`} variant="danger" dot />
          </span>
        )}
      </header>

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <nav aria-label="Primary navigation" className="px-3 pt-4 pb-2 flex-shrink-0">
        <NavItem icon={<CalendarDays className="w-4 h-4" />} label="Today" active />
        <NavItem icon={<Settings className="w-4 h-4" />}     label="Settings" />
      </nav>

      <Divider className="mx-3 my-2" />

      {/* ── Accounts Panel ─────────────────────────────────────────────────── */}
      <section aria-label="Connected accounts" className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-label-xs font-body font-medium text-muted uppercase tracking-widest">
            Workspaces
          </span>
          <Tooltip content="Sync all accounts">
            <IconButton label="Sync all accounts" size="sm">
              <RefreshCw className="w-3.5 h-3.5" />
            </IconButton>
          </Tooltip>
        </div>

        {accounts.length === 0 ? (
          <EmptyAccountsState onAdd={handleAddAccount} isLoading={connectingNew} />
        ) : (
          <ul role="list" className="space-y-1">
            {accounts.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                isFiltered={
                  activeAccountIds !== 'all' &&
                  !activeAccountIds.includes(account.id)
                }
                onToggleFilter={() => toggleAccountFilter(account.id)}
                onReconnect={() => handleReconnect(account.id)}
                onRemove={() => handleRemove(account)}
              />
            ))}
          </ul>
        )}

        {/* Add account button */}
        {accounts.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAddAccount}
            loading={connectingNew}
            iconLeft={<Plus className="w-3.5 h-3.5" />}
            className="w-full mt-3 justify-start text-muted hover:text-secondary"
            aria-label="Connect another Google account"
          >
            Add workspace
          </Button>
        )}
      </section>

      <Divider className="mx-3" />

      {/* ── Footer tools ───────────────────────────────────────────────────── */}
      <footer className="px-3 py-3 flex-shrink-0 space-y-1">
        {/* Privacy toggle */}
        <button
          onClick={togglePrivacy}
          aria-pressed={privacyMode}
          aria-label={privacyMode ? 'Disable privacy mode' : 'Enable privacy mode (blur sensitive data)'}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md',
            'text-body-sm font-body transition-all duration-fast ease-standard',
            'focus-ring',
            privacyMode
              ? 'bg-warning/10 text-warning border border-warning/20'
              : 'text-secondary hover:text-primary hover:bg-raised',
          )}
        >
          {privacyMode
            ? <EyeOff className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            : <Eye    className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          }
          <span>{privacyMode ? 'Privacy on' : 'Privacy mode'}</span>
          {privacyMode && (
            <Badge label="Active" variant="amber" size="sm" className="ml-auto" />
          )}
        </button>

        {/* Keyboard shortcuts */}
        <button
          onClick={() => setShortcutsOpen((v) => !v)}
          aria-expanded={shortcutsOpen}
          aria-controls="keyboard-shortcuts"
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md',
            'text-body-sm font-body text-secondary hover:text-primary hover:bg-raised',
            'transition-all duration-fast ease-standard focus-ring',
          )}
        >
          <Keyboard className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span>Shortcuts</span>
          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 ml-auto text-muted transition-transform duration-fast',
              shortcutsOpen && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </button>

        {shortcutsOpen && (
          <div
            id="keyboard-shortcuts"
            role="region"
            aria-label="Keyboard shortcuts"
            className="bg-canvas rounded-md border border-rim px-3 py-2.5 space-y-2 animate-fade-in"
          >
            {SHORTCUTS.map(({ key, desc }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-label-xs font-body text-muted">{desc}</span>
                <kbd className="text-label-xs font-mono text-secondary bg-raised border border-rim px-1.5 py-0.5 rounded-sm">
                  {key}
                </kbd>
              </div>
            ))}
          </div>
        )}
      </footer>
    </aside>
  );
}

// ─── NAV ITEM ────────────────────────────────────────────────────────────────

function NavItem({
  icon, label, active,
}: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <a
      href="#"
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-md',
        'text-body-sm font-body transition-all duration-fast ease-standard focus-ring',
        active
          ? 'bg-blue-500/10 text-blue-400 font-medium'
          : 'text-secondary hover:text-primary hover:bg-raised',
      )}
    >
      <span aria-hidden="true" className={active ? 'text-blue-400' : 'text-muted'}>
        {icon}
      </span>
      {label}
      {active && (
        <span className="ml-auto w-1 h-4 rounded-full bg-blue-500" aria-hidden="true" />
      )}
    </a>
  );
}

// ─── ACCOUNT ROW ─────────────────────────────────────────────────────────────

interface AccountRowProps {
  account:        ConnectedAccount;
  isFiltered:     boolean;
  onToggleFilter: () => void;
  onReconnect:    () => void;
  onRemove:       () => void;
}

function AccountRow({
  account,
  isFiltered,
  onToggleFilter,
  onReconnect,
  onRemove,
}: AccountRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const color = ACCOUNT_COLORS[account.colorIndex];
  const isError = account.status === 'error';
  const isRefreshing = account.status === 'refreshing';

  return (
    <li>
      <div
        className={cn(
          'group flex items-center gap-2.5 px-2 py-2 rounded-md',
          'transition-all duration-fast ease-standard',
          'hover:bg-raised cursor-pointer',
          isFiltered && 'opacity-40',
        )}
      >
        {/* Clickable avatar + name — toggles filter */}
        <button
          onClick={onToggleFilter}
          aria-pressed={!isFiltered}
          aria-label={`${isFiltered ? 'Show' : 'Hide'} ${account.displayName}`}
          className="flex items-center gap-2.5 flex-1 min-w-0 focus-ring rounded-sm"
        >
          <Avatar
            name={account.displayName}
            photoUrl={account.photoUrl}
            colorIndex={account.colorIndex}
            size="sm"
          />
          <div className="flex-1 min-w-0 text-left">
            <p className="text-body-sm font-body text-primary truncate leading-tight">
              {account.displayName}
            </p>
            <p className="text-label-xs font-body text-muted truncate">
              {account.email}
            </p>
          </div>
        </button>

        {/* Status indicator */}
        <div className="flex-shrink-0">
          {isError ? (
            <Tooltip content={account.errorMessage ?? 'Connection error'} side="right">
              <button
                onClick={onReconnect}
                aria-label={`Reconnect ${account.displayName}`}
                className="text-danger hover:text-danger/80 focus-ring rounded-sm p-0.5 transition-colors duration-fast"
              >
                <AlertCircle className="w-4 h-4" />
              </button>
            </Tooltip>
          ) : isRefreshing ? (
            <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin-slow" aria-label="Refreshing" />
          ) : (
            <span
              className="w-2 h-2 rounded-full animate-dot-pulse flex-shrink-0"
              style={{ backgroundColor: color }}
              aria-label="Connected"
            />
          )}
        </div>
      </div>

      {/* Error reconnect prompt */}
      {isError && (
        <div className="mx-2 mb-1 px-2 py-1.5 rounded-sm bg-danger/5 border border-danger/15 animate-fade-in">
          <p className="text-label-xs font-body text-danger/80 mb-1.5 leading-snug">
            {account.errorMessage}
          </p>
          <button
            onClick={onReconnect}
            className="text-label-xs font-body font-medium text-danger hover:text-danger/80 transition-colors duration-fast focus-ring rounded-sm"
          >
            Reconnect →
          </button>
        </div>
      )}
    </li>
  );
}

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────

function EmptyAccountsState({ onAdd, isLoading }: { onAdd: () => void; isLoading: boolean }) {
  return (
    <div className="px-2 py-4 text-center space-y-3 animate-fade-in">
      <div className="w-10 h-10 rounded-full bg-rim mx-auto flex items-center justify-center">
        <CalendarDays className="w-5 h-5 text-muted" aria-hidden="true" />
      </div>
      <div>
        <p className="text-body-sm font-body text-secondary">No workspaces connected</p>
        <p className="text-label-xs font-body text-muted mt-1">
          Add a Google account to view your schedule.
        </p>
      </div>
      <Button
        variant="primary"
        size="sm"
        onClick={onAdd}
        loading={isLoading}
        iconLeft={<Plus className="w-3.5 h-3.5" />}
        className="w-full"
      >
        Connect Google account
      </Button>
    </div>
  );
}

// ─── KEYBOARD SHORTCUTS ───────────────────────────────────────────────────────

const SHORTCUTS = [
  { key: 'Tab',   desc: 'Navigate items'    },
  { key: 'Enter', desc: 'Select event'      },
  { key: 'Esc',   desc: 'Close panel'       },
  { key: 'P',     desc: 'Toggle privacy'    },
  { key: 'R',     desc: 'Refresh calendars' },
] as const;
