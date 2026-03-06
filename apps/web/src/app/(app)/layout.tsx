/**
 * apps/web/src/app/(app)/layout.tsx
 * PVOT — Executive Command Center · Unified App Shell  v14
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * v14 DESIGN UPGRADES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * HEADER — DARK COMMAND SURFACE (#16161A):
 *   The header is now visually distinct from the calendar grid.
 *   A rich near-black ground makes the clock readouts luminous and gives
 *   the product a "command centre" weight that separates it from light
 *   productivity tools.
 *
 *   Visual language:
 *     • 3px accent bar at very top (brand signature)
 *     • #16161A body — warm near-black, not harsh pure-black
 *     • Sovereign clocks: white monospace (primary), cream/muted (secondary)
 *     • City labels: accent-coloured for anchor, muted for others
 *     • Trust badge: outline-only on dark (green border, green text, no fill)
 *     • Date navigator: white ghost button, accent when today
 *     • All icons: white/cream, ghost hover ring
 *     • Connect button: accent-on-dark, full luminance
 *     • Box-shadow bottom instead of divider — no hard line into calendar
 *
 * PROTECTED DISCONNECT — TWO-STEP FLYOUT:
 *   One-click disconnect was dangerously easy for a destructive operation.
 *   The new pattern requires explicit intent:
 *
 *   Step 1 — HOVER: Amber ring around avatar + subtle log-out indicator.
 *     No red. No immediate threat. Just a gentle signal of interactivity.
 *
 *   Step 2 — CLICK: A confirmation flyout appears to the right of the sidebar,
 *     anchored to the clicked avatar. It shows:
 *       • Account avatar (recreated with full colour)
 *       • Email address
 *       • Red "Disconnect account" button (requires this explicit click)
 *       • White "Keep connected" cancel button
 *     ONLY the red button calls removeAccount().
 *
 *   The flyout closes on:
 *     • Clicking "Keep connected"
 *     • Clicking "Disconnect account" (after action)
 *     • Clicking outside the flyout
 *     • Pressing Escape
 *
 *   Pattern: identical to GitHub account revoke, Linear workspace leave,
 *   Vercel team removal — world-class standard for destructive operations.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use client';

import Link            from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard, Settings, Plus, RefreshCw,
  Eye, EyeOff, ChevronLeft, ChevronRight, LogOut,
} from 'lucide-react';
import { usePVOTStore }   from '@pvot/core/stores/pvotStore';
import { useAuthStore }   from '@pvot/core/stores';
import { AlarmOverlay }   from '@/components/AlarmOverlay';
import { useAlarmEngine } from '@/hooks/useAlarmEngine';
import { useLaneQuery }   from '@pvot/query/useLaneQuery';
import { getOAuthClient } from '@pvot/core/auth/OAuthClient';

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────

const DS = {
  // Calendar surface (warm beige family)
  canvas:   '#F5F4F0',
  sidebar:  '#EDEBE5',
  surface:  '#FFFFFF',
  divider:  '#DAD6CE',

  // Header surface (dark command)
  command:     '#16161A',   // warm near-black header ground
  commandEdge: '#2A2A30',   // slightly lighter for internal borders
  commandMut:  'rgba(255,255,255,0.30)', // muted text on dark
  commandSub:  'rgba(255,255,255,0.55)', // secondary text on dark
  commandPri:  'rgba(255,255,255,0.92)', // primary text on dark

  // Brand
  accent:   '#E8441A',
  green:    '#2D9E5F',
  amber:    '#D4830A',
  red:      '#DC2626',

  // Calendar text
  textPri:  '#1A1A18',
  textSec:  '#6B6860',
  textMut:  '#A8A49F',

  fontBody: '"IBM Plex Sans", system-ui, sans-serif',
  fontMono: '"IBM Plex Mono", monospace',
  ease:     'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

const ACCENT_PALETTE = [
  '#E8441A', '#2D9E5F', '#7C3AED', '#0891B2', '#D4830A',
] as const;

const ACCOUNT_COLORS = [
  DS.accent, '#D4830A', '#2D9E5F', '#7C3AED', '#0891B2',
];

// ─── CITY LABEL ───────────────────────────────────────────────────────────────

function cityFromTz(tz: string): string {
  const parts = tz.split('/');
  return (parts[parts.length - 1] || tz).replace(/_/g, ' ');
}

// ─── SOVEREIGN LIVE CLOCK ─────────────────────────────────────────────────────
//
// Renders on dark header surface. Primary clock: white time + accent city.
// Secondary clocks: muted time + muted city. All driven via DOM ref — zero
// re-renders per second.

function SovereignClock({
  tz, isPrimary, color, offsetRef,
}: {
  tz:        string;
  isPrimary: boolean;
  color:     string;
  offsetRef: React.MutableRefObject<number>;
}) {
  const timeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hour: '2-digit', minute: '2-digit',
      second: '2-digit', hour12: false,
    });
    const tick = () => {
      if (timeRef.current)
        timeRef.current.textContent = fmt.format(new Date(Date.now() + offsetRef.current));
    };
    tick();
    const iv = setInterval(tick, 1_000);
    return () => clearInterval(iv);
  }, [tz]);

  return (
    <div style={{
      display:     'flex',
      alignItems:  'center',
      paddingLeft: isPrimary ? 0 : 14,
      marginLeft:  isPrimary ? 0 : 2,
      borderLeft:  isPrimary ? 'none' : `1px solid ${DS.commandEdge}`,
      flexShrink:  0,
    }}>
      {/* Colour accent bar — 2px vertical rule */}
      <div style={{
        width: 2, borderRadius: 1, background: color,
        alignSelf: 'stretch', minHeight: 20, marginRight: 8, flexShrink: 0,
        opacity: isPrimary ? 1 : 0.55,
      }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {/* City + anchor label */}
        <span style={{
          fontFamily:    DS.fontBody,
          fontSize:      8,
          fontWeight:    700,
          letterSpacing: '0.10em',
          textTransform: 'uppercase' as const,
          color:         isPrimary ? color : DS.commandMut,
          lineHeight:    1,
          whiteSpace:    'nowrap',
        }}>
          {cityFromTz(tz)}{isPrimary ? '\u00a0·\u00a0ANCHOR' : ''}
        </span>

        {/* Time display — luminous white monospace */}
        <span ref={timeRef} suppressHydrationWarning style={{
          fontFamily:    DS.fontMono,
          fontSize:      14,
          fontWeight:    700,
          color:         isPrimary ? DS.commandPri : DS.commandSub,
          letterSpacing: '-0.025em',
          lineHeight:    1,
        }}>
          --:--:--
        </span>
      </div>
    </div>
  );
}

// ─── ALARM WIRE ───────────────────────────────────────────────────────────────

function AlarmWire() {
  const { lanes } = useLaneQuery();
  useAlarmEngine(lanes.flatMap(l => l.events).filter(Boolean));
  return null;
}

// ─── HEADER ICON BUTTON (dark surface) ───────────────────────────────────────

function HeaderIconBtn({
  onClick, title, active = false, children,
}: { onClick: () => void; title?: string; active?: boolean; children: React.ReactNode }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} title={title}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 28, borderRadius: 7, cursor: 'pointer',
        background: active
          ? `${DS.accent}30`
          : hov ? 'rgba(255,255,255,0.10)' : 'transparent',
        border: `1px solid ${active
          ? `${DS.accent}70`
          : hov ? 'rgba(255,255,255,0.18)' : 'transparent'}`,
        color:  active ? DS.accent : hov ? DS.commandPri : DS.commandSub,
        transition: `all 0.12s ${DS.ease}`,
      }}
    >
      {children}
    </button>
  );
}

// ─── SIDEBAR NAV BUTTON ───────────────────────────────────────────────────────

function NavBtn({
  href, active, icon, label,
}: { href: string; active: boolean; icon: React.ReactNode; label: string }) {
  const [hov, setHov] = useState(false);
  return (
    <Link href={href} title={label}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 34, height: 34, borderRadius: 8, textDecoration: 'none',
        background: active ? `${DS.accent}18` : hov ? `${DS.textMut}14` : 'transparent',
        border: `1px solid ${active ? `${DS.accent}50` : 'transparent'}`,
        color:  active ? DS.accent : hov ? DS.textSec : DS.textMut,
        transition: `all 0.12s ${DS.ease}`,
      }}
    >
      {icon}
    </Link>
  );
}

// ─── DISCONNECT FLYOUT ────────────────────────────────────────────────────────
//
// Appears to the right of the sidebar, anchored vertically to the avatar.
// Contains: avatar + full email + explicit "Disconnect" red button + "Keep" cancel.
// The flyout is positioned absolutely relative to the root layout div, not the
// sidebar container, so it is never clipped.

function DisconnectFlyout({
  acc, color, topPx, onConfirm, onCancel,
}: {
  acc:       { id: string; email: string; displayName?: string; photoUrl?: string };
  color:     string;
  topPx:     number;
  onConfirm: () => void;
  onCancel:  () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
    };
    // Delay one tick so the opening click doesn't immediately close it
    const id = setTimeout(() => document.addEventListener('mousedown', fn), 0);
    return () => { clearTimeout(id); document.removeEventListener('mousedown', fn); };
  }, [onCancel]);

  // Close on Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onCancel]);

  const displayName = acc.displayName || acc.email.split('@')[0];
  const initial = displayName[0].toUpperCase();

  return (
    <div
      ref={ref}
      style={{
        position:     'fixed',
        left:         54,                    // just right of the 48px sidebar
        top:          Math.max(topPx - 8, 60), // anchored to avatar row, clamped
        zIndex:       200,
        width:        248,
        background:   DS.surface,
        border:       `1px solid ${DS.divider}`,
        borderRadius: 10,
        boxShadow:    '0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08)',
        fontFamily:   DS.fontBody,
        overflow:     'hidden',
        animation:    'pvot-flyout-in 0.14s cubic-bezier(0.2,0,0,1) both',
      }}
    >
      {/* Warning stripe at top */}
      <div style={{ height: 2, background: `linear-gradient(90deg, ${DS.red}, ${DS.accent})` }} />

      {/* Account identity */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px 12px',
        borderBottom: `1px solid ${DS.divider}`,
      }}>
        {/* Avatar */}
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: `${color}20`, border: `2px solid ${color}50`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {acc.photoUrl ? (
            <img src={acc.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontFamily: DS.fontBody, fontSize: 13, fontWeight: 800, color }}>
              {initial}
            </span>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: DS.textPri, lineHeight: 1.2, marginBottom: 2 }}>
            {displayName}
          </div>
          <div style={{ fontFamily: DS.fontMono, fontSize: 9, color: DS.textMut, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {acc.email}
          </div>
        </div>
      </div>

      {/* Warning message */}
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${DS.divider}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={DS.amber}
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p style={{ fontSize: 11, color: DS.textSec, lineHeight: 1.5 }}>
            This will remove the account and all its calendar data from PVOT. Your Google account will not be affected.
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Destructive — explicit action required */}
        <button
          onClick={onConfirm}
          style={{
            width: '100%', padding: '8px 0', borderRadius: 7,
            background: DS.red, border: `1px solid ${DS.red}`,
            color: '#fff', fontFamily: DS.fontBody, fontSize: 11, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: `background 0.1s ${DS.ease}`,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#B91C1C')}
          onMouseLeave={e => (e.currentTarget.style.background = DS.red)}
        >
          <LogOut size={12} />
          Disconnect account
        </button>

        {/* Safe exit */}
        <button
          onClick={onCancel}
          style={{
            width: '100%', padding: '8px 0', borderRadius: 7,
            background: 'transparent', border: `1px solid ${DS.divider}`,
            color: DS.textSec, fontFamily: DS.fontBody, fontSize: 11, fontWeight: 600,
            cursor: 'pointer',
            transition: `background 0.1s ${DS.ease}`,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = DS.canvas)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          Keep connected
        </button>
      </div>
    </div>
  );
}

// ─── APP LAYOUT ───────────────────────────────────────────────────────────────

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname      = usePathname();
  const accounts      = useAuthStore(s => s.accounts);
  const removeAccount = useAuthStore(s => s.removeAccount);

  // ── Store bindings ───────────────────────────────────────────────────────
  const viewDate      = usePVOTStore(s => s.viewDate);
  const setViewDate   = usePVOTStore(s => s.setViewDate);
  const goToToday     = usePVOTStore(s => s.goToToday);
  const privacyMode   = usePVOTStore(s => s.privacyMode ?? false);
  const togglePrivacy = usePVOTStore(s => s.togglePrivacy);
  const timeTravelOffset = usePVOTStore(s => s.timeTravelOffset ?? 0);

  // Mutable ref for clock DOM mutation — synced to store on every TT change
  const offsetRef = useRef<number>(0);
  useEffect(() => { offsetRef.current = timeTravelOffset; }, [timeTravelOffset]);

  // ── Lane data ─────────────────────────────────────────────────────────────
  const { isFetching, refetchAll, homeZones, timezone } = useLaneQuery();

  const BROWSER_TZ  = typeof Intl !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'UTC';
  const ribbonZones = homeZones.length > 0 ? homeZones : [BROWSER_TZ];

  // ── Auth ─────────────────────────────────────────────────────────────────
  const handleConnect = useCallback(() => {
    getOAuthClient().beginAuthRedirect(null);
  }, []);

  // ── Auto-refresh when OAuth popup signals account connected ──────────────
  // The callback popup calls window.opener.postMessage({type:'PVOT_ACCOUNT_CONNECTED'})
  // then closes itself. We listen here and rehydrate the Zustand store so the
  // new lane appears immediately without a manual page refresh.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === 'PVOT_ACCOUNT_CONNECTED') {
        // Pull the newly-written account from localStorage into React state
        (useAuthStore as any).persist?.rehydrate?.();
        refetchAll();
      }
    };
    const onStorage = (e: StorageEvent) => {
      // Fallback: storage event fires in opener when popup writes to localStorage
      if (e.key === 'pvot-auth-v1') {
        (useAuthStore as any).persist?.rehydrate?.();
        refetchAll();
      }
    };
    window.addEventListener('message', onMessage);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('storage', onStorage);
    };
  }, [refetchAll]);

  // ── Date navigator ────────────────────────────────────────────────────────
  const anchorTodayStr = (() => {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
      }).formatToParts(new Date());
      const g = (t: string) => parts.find(p => p.type === t)?.value ?? '00';
      return `${g('year')}-${g('month')}-${g('day')}`;
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  })();

  const isToday = viewDate === anchorTodayStr;

  const shiftDay = (delta: number) => {
    const dt = new Date(viewDate + 'T12:00:00Z');
    dt.setUTCDate(dt.getUTCDate() + delta);
    setViewDate(dt.toISOString().split('T')[0]);
  };

  const dateLabel = (() => {
    const d = new Date(viewDate + 'T12:00:00Z');
    const diff = Math.round(
      (d.getTime() - new Date(anchorTodayStr + 'T12:00:00Z').getTime()) / 86_400_000,
    );
    if (diff === 0)  return 'Today';
    if (diff === 1)  return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  })();

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'r' || e.key === 'R') refetchAll();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [refetchAll]);

  // ── Two-step disconnect state ─────────────────────────────────────────────
  // hoveredAccountId: shows amber ring on hover (step 1 signal)
  // confirmAccountId: shows flyout (step 2 confirmation)
  // confirmTopPx: pixel Y of the clicked avatar for flyout positioning
  const [hoveredAccountId, setHoveredAccountId]   = useState<string | null>(null);
  const [confirmAccountId, setConfirmAccountId]   = useState<string | null>(null);
  const [confirmTopPx,     setConfirmTopPx]        = useState(100);
  const avatarRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const openConfirm = (accId: string) => {
    const el = avatarRefs.current[accId];
    if (el) {
      const rect = el.getBoundingClientRect();
      setConfirmTopPx(rect.top);
    }
    setConfirmAccountId(accId);
  };

  const closeConfirm = () => setConfirmAccountId(null);

  const handleDisconnect = (accId: string) => {
    removeAccount(accId);
    closeConfirm();
  };

  const confirmAcc = confirmAccountId
    ? accounts.find(a => a.id === confirmAccountId) ?? null
    : null;

  return (
    <div style={{
      height: '100vh', width: '100vw', display: 'flex',
      flexDirection: 'column', overflow: 'hidden',
      background: DS.canvas, fontFamily: DS.fontBody,
    }}>

      {/* ════════════════════════════════════════════════════════════════════
          COMMAND HEADER — Dark surface, visually distinct from calendar
          Architecture: [3px accent bar] + [48px content row]
          ════════════════════════════════════════════════════════════════════ */}
      <header style={{
        flexShrink: 0,
        background: DS.command,
        boxShadow:  '0 1px 0 rgba(255,255,255,0.06), 0 2px 12px rgba(0,0,0,0.25)',
        zIndex:     50,
      }}>
        {/* 3px accent signature bar */}
        <div style={{
          height:     3,
          background: `linear-gradient(90deg, ${DS.accent} 0%, #FF6B35 40%, ${DS.accent}44 100%)`,
        }} />

        {/* 46px content row */}
        <div style={{
          height: 46, display: 'flex', alignItems: 'center',
          paddingInline: 14, gap: 0,
        }}>

          {/* ── Wordmark ─────────────────────────────────────────────────── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            paddingRight: 16,
            borderRight: `1px solid ${DS.commandEdge}`,
            marginRight: 16, flexShrink: 0,
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6,
              background: DS.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 0 1px ${DS.accent}80, 0 2px 8px ${DS.accent}50`,
            }}>
              <svg width="11" height="11" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1L11.5 10H1.5L6.5 1Z" fill="white" />
              </svg>
            </div>
            <span style={{
              fontFamily:    DS.fontBody,
              fontSize:      15,
              fontWeight:    800,
              letterSpacing: '-0.04em',
              color:         DS.commandPri,
            }}>
              PVOT
            </span>
          </div>

          {/* ── Sovereign Ribbon Clocks ──────────────────────────────────── */}
          <div style={{
            display: 'flex', alignItems: 'center', flex: 1,
            overflow: 'hidden', gap: 0,
          }}>
            {ribbonZones.map((tz, i) => (
              <SovereignClock
                key={tz}
                tz={tz}
                isPrimary={i === 0}
                color={ACCENT_PALETTE[i % ACCENT_PALETTE.length]}
                offsetRef={offsetRef}
              />
            ))}
          </div>

          {/* ── Trust Badge — outline-only on dark ground ────────────────── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            paddingInline: 9, paddingBlock: 4,
            borderRadius: 5,
            background: 'transparent',
            border: `1px solid ${DS.green}55`,
            marginRight: 12, flexShrink: 0,
          }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
              stroke={DS.green} strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <polyline points="9 12 11 14 15 10"/>
            </svg>
            <span style={{
              fontFamily:    DS.fontBody,
              fontSize:      8,
              fontWeight:    700,
              color:         DS.green,
              whiteSpace:    'nowrap',
              letterSpacing: '0.07em',
              textTransform: 'uppercase' as const,
            }}>
              Sovereign Read-Only
            </span>
          </div>

          {/* ── Date Navigator ───────────────────────────────────────────── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 1,
            borderLeft:  `1px solid ${DS.commandEdge}`,
            borderRight: `1px solid ${DS.commandEdge}`,
            paddingInline: 6, marginInline: 10, flexShrink: 0,
          }}>
            <HeaderIconBtn onClick={() => shiftDay(-1)} title="Previous day">
              <ChevronLeft style={{ width: 12, height: 12 }} />
            </HeaderIconBtn>

            <button
              onClick={isToday ? undefined : goToToday}
              title={isToday ? 'Viewing today' : 'Jump to today'}
              style={{
                fontFamily:  DS.fontBody,
                padding:     '4px 12px',
                borderRadius: 6,
                cursor:      isToday ? 'default' : 'pointer',
                background:  isToday ? `${DS.accent}30` : 'rgba(255,255,255,0.07)',
                border:      `1px solid ${isToday ? `${DS.accent}70` : DS.commandEdge}`,
                color:       isToday ? DS.accent : DS.commandSub,
                fontSize:    10, fontWeight: 600,
                transition:  `all 0.12s ${DS.ease}`,
                whiteSpace:  'nowrap',
                minWidth:    86,
                textAlign:   'center' as const,
              }}
            >
              {dateLabel}
            </button>

            <HeaderIconBtn onClick={() => shiftDay(1)} title="Next day">
              <ChevronRight style={{ width: 12, height: 12 }} />
            </HeaderIconBtn>
          </div>

          {/* ── Action Buttons ───────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
            <HeaderIconBtn onClick={refetchAll} title="Refresh (R)">
              <RefreshCw style={{
                width: 11, height: 11,
                ...(isFetching ? { animation: 'pvot-spin 1s linear infinite' } : {}),
              }} />
            </HeaderIconBtn>

            <HeaderIconBtn onClick={togglePrivacy} active={privacyMode}
              title={privacyMode ? 'Privacy on — content hidden' : 'Privacy off'}>
              {privacyMode
                ? <EyeOff style={{ width: 11, height: 11 }} />
                : <Eye    style={{ width: 11, height: 11 }} />
              }
            </HeaderIconBtn>

            {/* Connect account CTA — glowing accent on dark */}
            <button
              onClick={handleConnect}
              style={{
                fontFamily:  DS.fontBody,
                display:     'flex', alignItems: 'center', gap: 5,
                padding:     '6px 13px',
                borderRadius: 6,
                background:  DS.accent,
                border:      `1px solid ${DS.accent}`,
                color:       '#fff',
                fontSize:    10, fontWeight: 700,
                cursor:      'pointer',
                transition:  `all 0.12s ${DS.ease}`,
                flexShrink:  0, whiteSpace: 'nowrap',
                boxShadow:   `0 0 0 1px ${DS.accent}60, 0 2px 8px ${DS.accent}40`,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#C93910';
                e.currentTarget.style.boxShadow  = `0 0 0 1px #C9391060, 0 2px 12px ${DS.accent}60`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = DS.accent;
                e.currentTarget.style.boxShadow  = `0 0 0 1px ${DS.accent}60, 0 2px 8px ${DS.accent}40`;
              }}
            >
              <Plus style={{ width: 11, height: 11 }} />
              Connect account
            </button>
          </div>

        </div>
      </header>

      {/* ════════════════════════════════════════════════════════════════════
          BODY (sidebar + main)
          ════════════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Sidebar ────────────────────────────────────────────────────── */}
        <aside style={{
          width:      48,
          flexShrink: 0,
          display:    'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingBlock: 8,
          gap:        4,
          background: DS.sidebar,
          borderRight: `1px solid ${DS.divider}`,
        }}>
          {/* Nav buttons */}
          <NavBtn href="/dashboard" active={pathname === '/dashboard'} label="Dashboard"
            icon={<LayoutDashboard style={{ width: 15, height: 15 }} />} />
          <NavBtn href="/settings"  active={pathname === '/settings'}  label="Settings"
            icon={<Settings style={{ width: 15, height: 15 }} />} />

          {/* Account avatars */}
          {accounts.length > 0 && (
            <>
              <div style={{ width: 18, height: 1, background: DS.divider, margin: '3px 0' }} />

              {accounts.map((acc, i) => {
                const col      = ACCOUNT_COLORS[i % ACCOUNT_COLORS.length];
                const isHov    = hoveredAccountId === acc.id;
                const isPending = confirmAccountId === acc.id;

                return (
                  <div
                    key={acc.id}
                    ref={el => { avatarRefs.current[acc.id] = el; }}
                    title={isHov && !isPending ? `Manage ${acc.email}` : acc.email}
                    onClick={() => {
                      if (!isPending) openConfirm(acc.id);
                    }}
                    onMouseEnter={() => setHoveredAccountId(acc.id)}
                    onMouseLeave={() => setHoveredAccountId(null)}
                    style={{
                      position:   'relative',
                      width:      30,
                      height:     30,
                      borderRadius: '50%',
                      overflow:   'visible', // allow the ring to show outside
                      flexShrink: 0,
                      cursor:     'pointer',
                    }}
                  >
                    {/* Avatar circle */}
                    <div style={{
                      width:          '100%',
                      height:         '100%',
                      borderRadius:   '50%',
                      overflow:       'hidden',
                      background:     isPending ? `${DS.amber}20` : `${col}18`,
                      border:         `2px solid ${
                        isPending ? DS.amber
                        : isHov   ? `${DS.amber}90`
                        : `${col}60`
                      }`,
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                      transition:     `border-color 0.15s ${DS.ease}, box-shadow 0.15s ${DS.ease}`,
                      boxShadow:      (isHov || isPending)
                        ? `0 0 0 3px ${DS.amber}30`
                        : 'none',
                    }}>
                      {acc.photoUrl ? (
                        <img src={acc.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontFamily: DS.fontBody, fontSize: 10, fontWeight: 800, color: isPending ? DS.amber : col }}>
                          {(acc.displayName || acc.email)[0].toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Step 1 indicator: subtle log-out icon in bottom-right on hover
                        Amber, not red — no alarm, just affordance */}
                    {(isHov || isPending) && (
                      <div style={{
                        position:       'absolute',
                        bottom:         -2,
                        right:          -2,
                        width:          13,
                        height:         13,
                        borderRadius:   '50%',
                        background:     isPending ? DS.amber : DS.sidebar,
                        border:         `1.5px solid ${DS.amber}`,
                        display:        'flex',
                        alignItems:     'center',
                        justifyContent: 'center',
                        transition:     `background 0.12s ${DS.ease}`,
                      }}>
                        <svg width="7" height="7" viewBox="0 0 24 24" fill="none"
                          stroke={isPending ? '#fff' : DS.amber}
                          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                          <polyline points="16 17 21 12 16 7"/>
                          <line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          <div style={{ flex: 1 }} />

          {/* Builder monogram */}
          <div title="Built by djwalkit@gmail.com" style={{
            width: 26, height: 26, borderRadius: 7,
            background: `${DS.accent}15`, border: `1px solid ${DS.accent}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontFamily: DS.fontBody, fontSize: 8, fontWeight: 900, color: DS.accent }}>
              PVOT
            </span>
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {children}
        </main>
      </div>

      {/* ── Disconnect confirmation flyout (portal-level, never clipped) ──── */}
      {confirmAcc && (
  <DisconnectFlyout
    acc={{
      ...confirmAcc,
      photoUrl: confirmAcc.photoUrl ?? undefined,
    }}
    color={
      ACCOUNT_COLORS[
        accounts.findIndex(a => a.id === confirmAcc.id) %
          ACCOUNT_COLORS.length
      ]
    }
    topPx={confirmTopPx}
    onConfirm={() => handleDisconnect(confirmAcc.id)}
    onCancel={closeConfirm}
/>
      )}

      <AlarmWire />
      <AlarmOverlay />

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar              { width: 5px; height: 5px; background: transparent; }
        ::-webkit-scrollbar-track        { background: transparent; }
        ::-webkit-scrollbar-thumb        { background: ${DS.divider}; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover  { background: ${DS.textMut}; }
        body { background: ${DS.canvas}; }
        @keyframes pvot-spin    { to { transform: rotate(360deg); } }
        @keyframes pvot-pulse   { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
        @keyframes pvot-shimmer { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.25; } }
        @keyframes pvot-flyout-in {
          from { opacity: 0; transform: translateX(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateX(0)    scale(1); }
        }
      ` }} />
    </div>
  );
}