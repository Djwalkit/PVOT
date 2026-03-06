/**
 * apps/web/src/app/(app)/settings/page.tsx
 * PVOT — Sovereign Console  v16
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * v16 — HOME ZONE CLOCKS: FULL WORLD CITY SEARCH
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * HomeZonesCard city search — powered by searchCities() from
 * @pvot/core/timezone/TimezoneUtils (packages/core/src/timezone/TimezoneUtils.ts)
 *
 * • All 418 IANA timezones searchable
 * • Dropdown portalled to document.body — never clipped by any parent
 * • Grouped by region (Africa · Europe · Asia …) when search is empty
 * • Live local time + GMT offset shown per city in dropdown
 * • Already-pinned cities excluded from results automatically
 * • Keyboard: ↑/↓ navigate, Enter selects, Escape closes
 * • Clear (×) button in search input
 * • ▲/▼ reorder pinned zones, × to remove
 * • First pinned zone = Anchor timezone (shown with badge)
 *
 * Users can type ANY of:
 *   "Lagos"    → Africa/Lagos
 *   "Africa"   → all 52 African cities
 *   "GMT+3"    → every GMT+3 zone worldwide
 *   "Indiana"  → America/Indiana/* sub-zones
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ALL OTHER SECTIONS (v15, unchanged)
 * ═══════════════════════════════════════════════════════════════════════════
 * • Executive Identity  — Edit Profile modal (localStorage persisted)
 * • Meeting Intelligence — dismissible AlarmBanner + Breather Warning
 * • Temporal Boundaries  — Work Hour Shading start/end selects
 * • Calendar Workspaces  — connect / disconnect accounts
 * • Security & Sovereignty — Privacy Obfuscation toggle
 * • Lane Aliases & Order — rename + reorder calendar lanes
 */

'use client';

import React, {
  useState, useMemo, useRef, useEffect, useCallback,
  type RefObject, type KeyboardEvent as RKE,
} from 'react';
import ReactDOM from 'react-dom';

import { usePVOTStore }        from '@pvot/core/stores/pvotStore';
import { useAuthStore }        from '@pvot/core/stores';
import { useConnectAccount }   from '@pvot/core/auth/useConnectAccount';
import {
  searchCities,
  groupByRegion,
  ALL_CITIES,
  type CityOption,
} from '@pvot/core/timezone/TimezoneUtils';

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────

const P = {
  canvas:     '#F5F4F0',
  surface:    '#FFFFFF',
  off:        '#F8F6F2',
  divider:    '#DAD6CE',
  text:       '#1A1A18',
  dim:        '#6C6860',
  muted:      '#A8A49F',
  accent:     '#E8441A',
  accentSoft: '#FFEDE6',
  green:      '#2D9E5F',
  greenSoft:  '#EDFAF3',
  red:        '#DC2626',
  redSoft:    '#FEF2F2',
  amber:      '#D97706',
  amberSoft:  '#FFFBEB',
  purple:     '#7C3AED',
  purpleSoft: '#F3EEFF',
  purpleMid:  '#DDD6FE',
  ease:       'cubic-bezier(0.4,0,0.2,1)',
} as const;

// ─── GLOBAL CSS ───────────────────────────────────────────────────────────────

const CSS = `
  .pvot-settings { font-family: var(--font-sans,'IBM Plex Sans',system-ui,sans-serif); }
  .pvot-settings * { box-sizing: border-box; }
  @keyframes pvot-spin { to { transform: rotate(360deg); } }

  /* ── City dropdown portal ── */
  .pvot-hz-drop {
    position: fixed; z-index: 99999;
    background: #fff;
    border: 1.5px solid #DDD6FE;
    border-radius: 14px;
    box-shadow: 0 20px 50px rgba(0,0,0,.16), 0 4px 14px rgba(0,0,0,.08);
    display: flex; flex-direction: column; overflow: hidden;
    font-family: var(--font-sans,'IBM Plex Sans',system-ui,sans-serif);
  }
  .pvot-hz-drop-head {
    padding: 7px 14px 5px;
    font-size: 8px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase;
    color: #D97706; background: #FFFBEB;
    border-bottom: 1px solid #FDE68A;
    flex-shrink: 0; display: flex; align-items: center; justify-content: space-between;
  }
  .pvot-hz-drop-sub {
    font-size: 8px; font-weight: 700; color: #A8A49F;
    letter-spacing: .04em; text-transform: none;
    font-family: var(--font-mono,'IBM Plex Mono',monospace);
  }
  .pvot-hz-drop-list { overflow-y: auto; flex: 1; max-height: 300px; }
  .pvot-hz-drop-list::-webkit-scrollbar { width: 4px; }
  .pvot-hz-drop-list::-webkit-scrollbar-thumb { background: #FDE68A; border-radius: 10px; }
  .pvot-hz-region {
    padding: 5px 14px 3px;
    font-size: 7px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase;
    color: #7C3AED; background: #F3EEFF;
    border-bottom: 1px solid #EDE9FE; border-top: 1px solid #EDE9FE;
  }
  .pvot-hz-item {
    width: 100%; padding: 9px 14px;
    border: none; border-bottom: 1px solid #F8F6F2;
    background: transparent; cursor: pointer; text-align: left;
    display: grid; grid-template-columns: 1fr auto;
    align-items: center; gap: 10px;
    font-family: var(--font-sans,'IBM Plex Sans',system-ui,sans-serif);
    transition: background .08s; outline: none;
  }
  .pvot-hz-item:last-child { border-bottom: none; }
  .pvot-hz-item:hover, .pvot-hz-item.pvot-hz-focused { background: #FFF7ED; }
  .pvot-hz-item-left { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .pvot-hz-item-name { font-size: 13px; font-weight: 700; color: #1A1A18; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pvot-hz-item-iana { font-size: 9px; color: #A8A49F; font-family: var(--font-mono,'IBM Plex Mono',monospace); }
  .pvot-hz-item-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
  .pvot-hz-item-offset { font-size: 9px; font-weight: 700; font-family: var(--font-mono,'IBM Plex Mono',monospace); color: #D97706; background: #FFFBEB; padding: 1px 5px; border-radius: 4px; border: 1px solid #FDE68A; }
  .pvot-hz-item-time { font-size: 9px; color: #A8A49F; font-family: var(--font-mono,'IBM Plex Mono',monospace); }
  .pvot-hz-drop-empty { padding: 20px 16px; text-align: center; font-size: 12px; color: #A8A49F; line-height: 1.6; }

  /* ── Profile modal ── */
  .pvot-modal-overlay {
    position: fixed; inset: 0; z-index: 10000;
    background: rgba(0,0,0,.45);
    display: flex; align-items: center; justify-content: center; padding: 24px;
  }
  .pvot-modal {
    background: #fff; border-radius: 20px;
    width: 100%; max-width: 480px;
    box-shadow: 0 24px 60px rgba(0,0,0,.2); overflow: hidden;
  }

  /* ── Select arrow ── */
  .pvot-select {
    appearance: none; -webkit-appearance: none;
    width: 100%; background: #F8F6F2; border: 1px solid #DAD6CE; border-radius: 12px;
    padding: 8px 32px 8px 12px; font-size: 11px; font-weight: 700; color: #1A1A18;
    cursor: pointer; outline: none;
    font-family: var(--font-sans,'IBM Plex Sans',system-ui,sans-serif);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23A8A49F'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right .6rem center; background-size: .9rem;
  }
`;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function nowInTz(tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date());
  } catch { return '--:--'; }
}

const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

// ─── ICONS ────────────────────────────────────────────────────────────────────

const Ic = {
  User:   () => <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeWidth="2"/></svg>,
  Bell:   () => <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeWidth="2"/></svg>,
  Globe:  () => <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 002 2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2"/></svg>,
  Clock:  () => <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2"/></svg>,
  Link:   () => <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" strokeWidth="2"/></svg>,
  Shield: () => <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeWidth="2"/></svg>,
  Tag:    () => <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" strokeWidth="2"/></svg>,
  Bolt:   () => <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth="2.5"/></svg>,
  Info:   () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2"/></svg>,
  Edit:   () => <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeWidth="2"/></svg>,
  Check:  () => <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  X:      () => <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5"/></svg>,
  Plus:   () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 6v6m0 0v6m0-6h6m0-0H6" strokeWidth="2.5"/></svg>,
  Search: () => <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2.5"/></svg>,
};

// ─── PRIMITIVES ───────────────────────────────────────────────────────────────

function SectionCard({ icon, iconBg, iconColor, title, children }: {
  icon: React.ReactNode; iconBg: string; iconColor: string;
  title: string; children: React.ReactNode;
}) {
  return (
    <div style={{ background: P.surface, border: `1px solid ${P.divider}`, borderRadius: 20, boxShadow: '0 1px 3px rgba(0,0,0,.04)', marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', background: P.off, borderRadius: '20px 20px 0 0', borderBottom: `1px solid ${P.divider}` }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
        <span style={{ fontSize: 11, fontWeight: 900, color: P.text, letterSpacing: '.1em', textTransform: 'uppercase' }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on}
      style={{ width: 40, height: 20, borderRadius: 10, padding: 2, border: 'none', cursor: 'pointer', background: on ? P.accent : P.divider, display: 'flex', alignItems: 'center', flexShrink: 0, transition: `background .2s ${P.ease}` }}>
      <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,.25)', marginLeft: on ? 'auto' : 0, transition: `margin .2s ${P.ease}` }}/>
    </button>
  );
}

function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="pvot-select">
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ─── HOME ZONE CITY DROPDOWN PORTAL ──────────────────────────────────────────

function HzDrop({
  anchorRef, isOpen, onClose, onSelect, results, query, focusIdx, setFocusIdx,
}: {
  anchorRef:   RefObject<HTMLElement | null>;
  isOpen:      boolean;
  onClose:     () => void;
  onSelect:    (c: CityOption) => void;
  results:     CityOption[];
  query:       string;
  focusIdx:    number;
  setFocusIdx: (i: number) => void;
}) {
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const listRef = useRef<HTMLDivElement>(null);

  const updatePos = useCallback(() => {
    if (!anchorRef.current) return;
    const r      = anchorRef.current.getBoundingClientRect();
    const estH   = Math.min(results.length * 40 + 36, 340);
    const spaceB = window.innerHeight - r.bottom;
    const top    = spaceB > estH ? r.bottom + 4 : r.top - estH - 4;
    setPos({ top, left: r.left, width: r.width });
  }, [anchorRef, results.length]);

  useEffect(() => {
    if (!isOpen) return;
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => { window.removeEventListener('scroll', updatePos, true); window.removeEventListener('resize', updatePos); };
  }, [isOpen, updatePos]);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e: MouseEvent) => {
      if (anchorRef.current?.contains(e.target as Node)) return;
      if (document.getElementById('pvot-hz-drop')?.contains(e.target as Node)) return;
      onClose();
    };
    const t = setTimeout(() => document.addEventListener('mousedown', h), 60);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', h); };
  }, [isOpen, onClose, anchorRef]);

  useEffect(() => {
    if (!listRef.current || focusIdx < 0) return;
    (listRef.current.querySelector(`[data-idx="${focusIdx}"]`) as HTMLElement | null)?.scrollIntoView({ block: 'nearest' });
  }, [focusIdx]);

  if (!isOpen || typeof document === 'undefined') return null;

  const grouped = !query.trim() ? groupByRegion(results) : null;
  const hLabel  = query.trim() ? `${results.length} cities` : 'Global Cities';
  const hSub    = query.trim() ? `"${query.trim()}"` : `${ALL_CITIES.length} worldwide`;

  return ReactDOM.createPortal(
    <div id="pvot-hz-drop" className="pvot-hz-drop" style={{ top: pos.top, left: pos.left, width: Math.max(pos.width, 320) }}>
      <div className="pvot-hz-drop-head">
        <span>{hLabel}</span>
        <span className="pvot-hz-drop-sub">{hSub}</span>
      </div>
      <div className="pvot-hz-drop-list" ref={listRef}>
        {results.length === 0 ? (
          <div className="pvot-hz-drop-empty">
            No cities found for "{query}"<br/>
            <span style={{ fontSize: 10 }}>Try: Africa · Asia · Europe · GMT+3</span>
          </div>
        ) : grouped ? (
          grouped.map(({ region, items }) => (
            <React.Fragment key={region}>
              <div className="pvot-hz-region">{region}</div>
              {items.map(c => {
                const idx = results.indexOf(c);
                return <HzItem key={c.tz} c={c} idx={idx} focused={idx === focusIdx} onHover={setFocusIdx} onSelect={onSelect} />;
              })}
            </React.Fragment>
          ))
        ) : (
          results.map((c, idx) => (
            <HzItem key={c.tz} c={c} idx={idx} focused={idx === focusIdx} onHover={setFocusIdx} onSelect={onSelect} />
          ))
        )}
      </div>
    </div>,
    document.body,
  );
}

function HzItem({ c, idx, focused, onHover, onSelect }: {
  c: CityOption; idx: number; focused: boolean;
  onHover: (i: number) => void; onSelect: (c: CityOption) => void;
}) {
  return (
    <button className={`pvot-hz-item${focused ? ' pvot-hz-focused' : ''}`} data-idx={idx}
      onMouseEnter={() => onHover(idx)} onClick={() => onSelect(c)}>
      <div className="pvot-hz-item-left">
        <span className="pvot-hz-item-name">{c.sub ? `${c.city}, ${c.sub}` : c.city}</span>
        <span className="pvot-hz-item-iana">{c.tz}</span>
      </div>
      <div className="pvot-hz-item-right">
        <span className="pvot-hz-item-offset">{c.offsetStr}</span>
        <span className="pvot-hz-item-time">{nowInTz(c.tz)}</span>
      </div>
    </button>
  );
}

// ─── 1. EXECUTIVE IDENTITY ────────────────────────────────────────────────────

interface Profile { displayName: string; email: string; jobTitle: string; company: string; phone: string; }
const dflt = (): Profile => ({ displayName: '', email: '', jobTitle: '', company: '', phone: '' });
function loadProfile(fb: Partial<Profile> = {}): Profile {
  try { const r = localStorage.getItem('pvot-profile-v1'); return r ? { ...dflt(), ...JSON.parse(r) } : { ...dflt(), ...fb }; }
  catch { return dflt(); }
}
function saveProfile(p: Profile) { try { localStorage.setItem('pvot-profile-v1', JSON.stringify(p)); } catch {} }

function PField({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 9, fontWeight: 900, color: P.muted, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 5 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '10px 12px', background: P.off, border: `1px solid ${P.divider}`, borderRadius: 10, fontSize: 13, color: P.text, fontFamily: 'var(--font-sans)', outline: 'none' }}
        onFocus={e => { e.currentTarget.style.borderColor = P.accent; }}
        onBlur={e  => { e.currentTarget.style.borderColor = P.divider; }}
      />
    </div>
  );
}

function ProfileModal({ initial, onSave, onClose }: { initial: Profile; onSave: (p: Profile) => void; onClose: () => void }) {
  const [form, setForm] = useState(initial);
  const set = (k: keyof Profile) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  useEffect(() => {
    const h = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  const initials = form.displayName ? form.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';
  return ReactDOM.createPortal(
    <div className="pvot-modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pvot-modal">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: `1px solid ${P.divider}`, background: P.off }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic.Edit /></div>
            <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase', color: P.text }}>Edit Profile</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: P.muted, padding: 4, lineHeight: 0, borderRadius: 6 }}><Ic.X /></button>
        </div>
        <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#EFF6FF', border: `2px solid ${P.divider}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#2563EB', flexShrink: 0 }}>{initials}</div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: P.text, margin: '0 0 2px' }}>{form.displayName || 'Your Name'}</p>
            <p style={{ fontSize: 11, color: P.muted, margin: 0 }}>{form.jobTitle || 'PVOT Executive'}{form.company ? ` · ${form.company}` : ''}</p>
          </div>
        </div>
        <div style={{ padding: '16px 24px 4px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <PField label="Display Name" value={form.displayName} onChange={set('displayName')} placeholder="Your full name" />
            <PField label="Email" value={form.email} onChange={set('email')} placeholder="you@company.com" type="email" />
            <PField label="Job Title" value={form.jobTitle} onChange={set('jobTitle')} placeholder="Chief Executive" />
            <PField label="Company" value={form.company} onChange={set('company')} placeholder="Acme Corp" />
          </div>
          <PField label="Phone" value={form.phone} onChange={set('phone')} placeholder="+44 7700 900000" type="tel" />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '16px 24px', borderTop: `1px solid ${P.divider}`, background: P.off }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${P.divider}`, background: P.surface, fontSize: 12, fontWeight: 700, color: P.dim, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => { saveProfile(form); onSave(form); }} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: P.accent, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(232,68,26,.3)' }}>
            <Ic.Check /> Save Profile
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function IdentityCard() {
  const accounts = useAuthStore(s => s.accounts);
  const primary  = accounts[0] as any;
  const [profile, setProfile] = useState<Profile>(() => loadProfile({ displayName: primary?.displayName ?? '', email: primary?.email ?? '' }));
  const [editOpen, setEditOpen] = useState(false);
  const displayName = profile.displayName || primary?.displayName || 'No Account Connected';
  const initials = displayName !== 'No Account Connected'
    ? displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : '?';
  return (
    <>
      <SectionCard icon={<Ic.User />} iconBg="#EFF6FF" iconColor="#2563EB" title="Executive Identity">
        <div style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#EFF6FF', border: `2px solid ${P.divider}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#2563EB', flexShrink: 0, overflow: 'hidden' }}>
            {primary?.photoUrl ? <img src={primary.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: P.text, lineHeight: 1.2, margin: '0 0 3px' }}>{displayName}</h3>
            <p style={{ fontSize: 11, color: P.muted, margin: 0 }}>
              {profile.jobTitle ? `${profile.jobTitle}${profile.company ? ` · ${profile.company}` : ''}` : 'PVOT Command Centre'}
            </p>
          </div>
          <button onClick={() => setEditOpen(true)} style={{ padding: '8px 16px', background: P.off, border: `1px solid ${P.divider}`, borderRadius: 10, fontSize: 11, fontWeight: 700, color: P.text, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Ic.Edit /> Edit Profile
          </button>
        </div>
      </SectionCard>
      {editOpen && <ProfileModal initial={profile} onSave={p => { setProfile(p); setEditOpen(false); }} onClose={() => setEditOpen(false)} />}
    </>
  );
}

// ─── 2. MEETING INTELLIGENCE ──────────────────────────────────────────────────

function AlarmBanner() {
  const activeAlarms = usePVOTStore(s => (s as any).activeAlarms ?? []);
  const dismissAlarm = usePVOTStore(s => (s as any).dismissAlarm);
  const snoozeAlarm  = usePVOTStore(s => (s as any).snoozeAlarm);
  if (!activeAlarms.length) return null;
  return (
    <div style={{ marginBottom: 16, border: '1.5px solid #FECACA', borderRadius: 14, overflow: 'hidden', background: '#FEF2F2' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #FECACA', background: '#FEE2E2' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>🔔</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#991B1B', letterSpacing: '.05em' }}>
            {activeAlarms.length} Active Alarm{activeAlarms.length > 1 ? 's' : ''}
          </span>
        </div>
        <button onClick={() => activeAlarms.forEach((a: any) => dismissAlarm(a.meetingId))} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #FECACA', background: '#fff', fontSize: 10, fontWeight: 700, color: '#991B1B', cursor: 'pointer' }}>Dismiss All</button>
      </div>
      {activeAlarms.map((alarm: any, i: number) => (
        <div key={alarm.meetingId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: i < activeAlarms.length - 1 ? '1px solid #FECACA' : 'none' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#991B1B', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alarm.meetingTitle || 'Upcoming Meeting'}</p>
            <p style={{ fontSize: 10, color: '#B91C1C', margin: 0 }}>{alarm.startsInMins !== undefined ? `Starts in ${alarm.startsInMins} min` : 'Starting soon'}</p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button onClick={() => snoozeAlarm(alarm.meetingId)} style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #FECACA', background: '#fff', fontSize: 10, fontWeight: 700, color: P.amber, cursor: 'pointer' }}>Snooze</button>
            <button onClick={() => dismissAlarm(alarm.meetingId)} style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #FECACA', background: '#fff', fontSize: 10, fontWeight: 700, color: '#991B1B', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Ic.X /> Dismiss</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function MeetingIntelligenceCard() {
  const cfg = usePVOTStore(s => (s as any).alarmConfig ?? {});
  const upd = usePVOTStore(s => (s as any).updateAlarmConfig ?? (() => {}));
  const lead     = String(cfg.gentlePingMins ?? 5);
  const acoustic = cfg.soundSignature  ?? 'professional';
  const breather = cfg.breatherWarning ?? true;
  return (
    <SectionCard icon={<Ic.Bell />} iconBg="#FEF2F2" iconColor="#DC2626" title="Meeting Intelligence">
      <div style={{ padding: 24 }}>
        <AlarmBanner />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: P.text, margin: '0 0 2px' }}>Predictive Notifications</p>
            <p style={{ fontSize: 10, color: P.muted, margin: 0 }}>Master temporal alert orchestration.</p>
          </div>
          <Toggle on={cfg.enabled ?? true} onChange={v => upd({ enabled: v })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          <div>
            <label style={{ display: 'block', fontSize: 8, fontWeight: 900, color: P.muted, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>Alert Lead Time</label>
            <Sel value={lead} onChange={v => upd({ gentlePingMins: Number(v) })} options={[{value:'2',label:'2 minutes before'},{value:'5',label:'5 minutes before'},{value:'10',label:'10 minutes before'},{value:'15',label:'15 minutes before'}]} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 8, fontWeight: 900, color: P.muted, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>Acoustic Signature</label>
            <Sel value={acoustic} onChange={v => upd({ soundSignature: v })} options={[{value:'zen',label:'Zen (Subtle Wave)'},{value:'professional',label:'Professional (Executive Chime)'},{value:'urgent',label:'Urgent (Frequency Pulse)'}]} />
          </div>
        </div>
        <div style={{ padding: 16, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 16, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.red, boxShadow: '0 1px 3px rgba(0,0,0,.1)', flexShrink: 0 }}><Ic.Bolt /></div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#991B1B', margin: 0 }}>Breather Warning</p>
              <Toggle on={breather} onChange={v => upd({ breatherWarning: v })} />
            </div>
            <p style={{ fontSize: 10, color: '#B91C1C', lineHeight: 1.5, margin: 0 }}>Notify if cross-lane meetings have &lt;5 min gap. Protects against cognitive switch fatigue.</p>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ─── 3. HOME ZONE CLOCKS ──────────────────────────────────────────────────────

function HomeZonesCard() {
  const homeZones    = usePVOTStore(s => s.homeZones ?? []);
  const setHomeZones = usePVOTStore(s => s.setHomeZones);

  const [query,    setQuery]    = useState('');
  const [isOpen,   setIsOpen]   = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);

  const wrapRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Exclude already-pinned timezones from results
  const excluded = useMemo(
    () => new Set(homeZones.map((z: any) => z.timezone ?? z.tz ?? z)),
    [homeZones],
  );

  const results = useMemo(() => searchCities(query, excluded), [query, excluded]);
  useEffect(() => { setFocusIdx(-1); }, [results]);

  const addZone = useCallback((c: CityOption) => {
    // homeZones may be string[] or object[] — normalise to string[]
    const current = homeZones.map((z: any) => z.timezone ?? z.tz ?? z) as string[];
    setHomeZones([...current, c.tz] as any);
    setQuery('');
    setIsOpen(false);
    setFocusIdx(-1);
    inputRef.current?.focus();
  }, [homeZones, setHomeZones]);

  const removeZone = (tz: string) => {
    const next = homeZones.filter((z: any) => (z.timezone ?? z.tz ?? z) !== tz);
    setHomeZones(next as any);
  };

  const move = (i: number, dir: -1 | 1) => {
    const arr = [...homeZones];
    const j   = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    setHomeZones(arr as any);
  };

  const handleKey = (e: RKE<HTMLInputElement>) => {
    if (!isOpen) { if (e.key !== 'Escape') setIsOpen(true); return; }
    if      (e.key === 'ArrowDown') { e.preventDefault(); setFocusIdx(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setFocusIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter')     { e.preventDefault(); const c = results[focusIdx >= 0 ? focusIdx : 0]; if (c) addZone(c); }
    else if (e.key === 'Escape')    { setIsOpen(false); setFocusIdx(-1); }
  };

  return (
    <SectionCard icon={<Ic.Globe />} iconBg="#FFFBEB" iconColor="#D97706" title="Home Zone Clocks">
      <div style={{ padding: 24 }}>

        {/* Pinned zones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
          {homeZones.length === 0 && (
            <div style={{ padding: 14, borderRadius: 10, textAlign: 'center', background: P.canvas, border: `1px dashed ${P.divider}` }}>
              <span style={{ fontSize: 12, color: P.muted, fontStyle: 'italic' }}>
                No clocks pinned — search any city below to add.
              </span>
            </div>
          )}
          {homeZones.map((z: any, i: number) => {
            const tz       = z.timezone ?? z.tz ?? z;
            const meta     = ALL_CITIES.find(c => c.tz === tz);
            const cityName = meta?.city ?? String(tz).split('/').pop()?.replace(/_/g, ' ') ?? tz;
            const isAnchor = i === 0;
            return (
              <div key={tz} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, background: isAnchor ? '#FFF7ED' : P.off, border: `1px solid ${isAnchor ? '#FFEDD5' : P.divider}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: P.text }}>
                      {meta?.sub ? `${cityName}, ${meta.sub}` : cityName}
                    </span>
                    {isAnchor && (
                      <span style={{ fontSize: 7, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.1em', background: '#FED7AA', color: '#C2410C', padding: '2px 5px', borderRadius: 3 }}>Anchor</span>
                    )}
                    {meta?.offsetStr && (
                      <span style={{ fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)', color: P.amber, background: P.amberSoft, border: '1px solid #FDE68A', padding: '1px 5px', borderRadius: 4 }}>{meta.offsetStr}</span>
                    )}
                  </div>
                  <span style={{ fontSize: 9, color: P.muted, fontFamily: 'var(--font-mono)' }}>{tz}</span>
                </div>
                {/* Live time */}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: isAnchor ? '#C2410C' : P.dim, flexShrink: 0 }} suppressHydrationWarning>
                  {nowInTz(tz)}
                </span>
                {/* Reorder */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
                  <button onClick={() => move(i, -1)} disabled={i === 0} style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? P.divider : P.muted, fontSize: 10, padding: '1px 3px' }}>▲</button>
                  <button onClick={() => move(i,  1)} disabled={i === homeZones.length - 1} style={{ background: 'none', border: 'none', cursor: i === homeZones.length - 1 ? 'default' : 'pointer', color: i === homeZones.length - 1 ? P.divider : P.muted, fontSize: 10, padding: '1px 3px' }}>▼</button>
                </div>
                {/* Remove */}
                <button onClick={() => removeZone(tz)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: P.muted, padding: 4, borderRadius: 6, lineHeight: 0 }}
                  onMouseEnter={e => { const b = e.currentTarget; b.style.color = P.red; b.style.background = P.redSoft; }}
                  onMouseLeave={e => { const b = e.currentTarget; b.style.color = P.muted; b.style.background = 'none'; }}>
                  <Ic.X />
                </button>
              </div>
            );
          })}
        </div>

        {/* Search input */}
        <div ref={wrapRef} style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', lineHeight: 0, color: isOpen ? P.amber : P.muted, pointerEvents: 'none', zIndex: 1, transition: 'color .15s' }}>
            <Ic.Search />
          </span>
          <input
            ref={inputRef}
            value={query}
            placeholder={`Search ${ALL_CITIES.length} global cities — Lagos, GMT+3, Africa, Asia…`}
            onFocus={() => setIsOpen(true)}
            onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
            onKeyDown={handleKey}
            style={{ width: '100%', padding: '11px 36px 11px 38px', background: P.surface, border: `1.5px solid ${isOpen ? P.amber : P.divider}`, borderRadius: 12, fontSize: 13, color: P.text, fontFamily: 'var(--font-sans)', outline: 'none', transition: 'border-color .15s' }}
          />
          {query && (
            <button onClick={() => { setQuery(''); setIsOpen(true); inputRef.current?.focus(); }}
              style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: P.muted, padding: 3, lineHeight: 0 }}>
              <Ic.X />
            </button>
          )}
        </div>

        {!isOpen && homeZones.length === 0 && (
          <p style={{ fontSize: 10, color: P.muted, margin: '8px 0 0', lineHeight: 1.5 }}>
            Type a city, continent, or GMT offset · First added becomes your Anchor timezone
          </p>
        )}
      </div>

      {/* Portal dropdown — outside any overflow:hidden parent */}
      <HzDrop
        anchorRef={wrapRef as RefObject<HTMLElement | null>}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSelect={addZone}
        results={results}
        query={query}
        focusIdx={focusIdx}
        setFocusIdx={setFocusIdx}
      />
    </SectionCard>
  );
}

// ─── 4. TEMPORAL BOUNDARIES ───────────────────────────────────────────────────

function TemporalBoundariesCard() {
  const wh  = usePVOTStore(s => (s as any).workHours    ?? { enabled: true, start: '08:00', end: '18:00' });
  const set = usePVOTStore(s => (s as any).setWorkHours ?? (() => {}));
  const upd = (p: object) => set({ ...wh, ...p });
  return (
    <SectionCard icon={<Ic.Clock />} iconBg="#FFF7ED" iconColor="#EA580C" title="Temporal Boundaries">
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: P.text, margin: '0 0 2px' }}>Work Hour Shading</p>
            <p style={{ fontSize: 10, color: P.muted, margin: 0 }}>Visually dim hours outside your focus window.</p>
          </div>
          <Toggle on={wh.enabled} onChange={v => upd({ enabled: v })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 8, fontWeight: 900, color: P.muted, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>Day Start</label>
            <Sel value={wh.start} onChange={v => upd({ start: v })} options={HOURS.map(h => ({ value: h, label: h }))} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 8, fontWeight: 900, color: P.muted, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>Day End</label>
            <Sel value={wh.end} onChange={v => upd({ end: v })} options={HOURS.map(h => ({ value: h, label: h }))} />
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ─── 5. CALENDAR WORKSPACES ───────────────────────────────────────────────────

function WorkspacesCard() {
  const accounts      = useAuthStore(s => s.accounts) as any[];
  const removeAccount = useAuthStore(s => (s as any).removeAccount ?? (() => {}));
  const { connect, isConnecting, error, clearError } = useConnectAccount();

  const syncedLabel = (acc: any) => {
    if (acc.lastSyncedAt) {
      const m = Math.round((Date.now() - new Date(acc.lastSyncedAt).getTime()) / 60_000);
      if (m < 1) return 'Synced just now';
      if (m < 60) return `Synced ${m}m ago`;
      return `Synced ${Math.floor(m / 60)}h ago`;
    }
    return acc.status === 'active' ? 'Synced just now' : 'Not synced';
  };

  const initials = (acc: any) =>
    (acc.displayName || acc.email || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const disconnect = (acc: any) => {
    if (window.confirm(`Disconnect ${acc.email || acc.displayName}?\n\nThis removes all calendar data for this workspace from PVOT.`))
      removeAccount(acc.id);
  };

  return (
    <SectionCard icon={<Ic.Link />} iconBg="#F0FDF4" iconColor="#16A34A" title="Calendar Workspaces">
      <>
        {/* Error banner */}
        {error && (
          <div style={{ margin: '0 20px', padding: '10px 14px', background: P.redSoft, border: `1px solid #FECACA`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: P.red, flex: 1, lineHeight: 1.5 }}>{error}</span>
            <button onClick={clearError} style={{ background: 'none', border: 'none', cursor: 'pointer', color: P.red, padding: 2, lineHeight: 0, flexShrink: 0 }}><Ic.X /></button>
          </div>
        )}

        {accounts.length === 0 && !error ? (
          <div style={{ padding: '32px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: P.text, margin: '0 0 4px' }}>No accounts connected</p>
            <p style={{ fontSize: 11, color: P.muted, margin: 0 }}>Connect a Google account to start syncing your calendars.</p>
          </div>
        ) : accounts.map((acc: any, i: number) => (
          <div key={acc.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px', borderBottom: i < accounts.length - 1 ? `1px solid ${P.divider}` : 'none' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#1D4ED8', overflow: 'hidden' }}>
              {acc.photoUrl ? <img src={acc.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(acc)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: P.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{acc.email || acc.displayName}</p>
                <span style={{ fontSize: 7, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase', background: P.off, border: `1px solid ${P.divider}`, color: P.muted, padding: '1px 4px', borderRadius: 3, flexShrink: 0 }}>{acc.provider ?? 'GOOGLE'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: P.green }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: P.green }}>{syncedLabel(acc)}</span>
              </div>
            </div>
            <button
              onClick={() => disconnect(acc)}
              style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${P.divider}`, background: P.surface, fontSize: 10, fontWeight: 700, color: P.red, cursor: 'pointer', flexShrink: 0 }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = P.redSoft; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = P.surface; }}
            >
              Disconnect
            </button>
          </div>
        ))}

        <div style={{ padding: '16px 20px', background: P.off, borderTop: `1px solid ${P.divider}` }}>
          <button
            onClick={() => connect()}
            disabled={isConnecting}
            style={{
              width: '100%', padding: 14,
              background: isConnecting ? P.divider : P.accent,
              color: '#fff', border: 'none', borderRadius: 12,
              fontSize: 13, fontWeight: 700, cursor: isConnecting ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: isConnecting ? 'none' : '0 4px 12px rgba(232,68,26,.3)',
              transition: 'all .15s',
              opacity: isConnecting ? 0.7 : 1,
            }}
          >
            {isConnecting ? (
              <>
                <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'pvot-spin .6s linear infinite', flexShrink: 0 }} />
                Connecting…
              </>
            ) : (
              <><Ic.Plus /> Add Professional Workspace</>
            )}
          </button>
        </div>
      </>
    </SectionCard>
  );
}

// ─── 6. SECURITY ──────────────────────────────────────────────────────────────

function SecurityCard() {
  const privacyMode    = usePVOTStore(s => (s as any).privacyMode    ?? false);
  const setPrivacyMode = usePVOTStore(s => (s as any).setPrivacyMode ?? (() => {}));
  return (
    <SectionCard icon={<Ic.Shield />} iconBg="#F5F3FF" iconColor="#7C3AED" title="Security & Sovereignty">
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: P.text, margin: '0 0 2px' }}>Privacy Obfuscation</p>
            <p style={{ fontSize: 10, color: P.muted, margin: 0 }}>Redact titles and participants for secure sharing.</p>
          </div>
          <Toggle on={privacyMode} onChange={setPrivacyMode} />
        </div>
        <div style={{ padding: 16, background: P.purpleSoft, border: `1px solid ${P.purpleMid}40`, borderRadius: 12, display: 'flex', gap: 16 }}>
          <div style={{ color: P.purple, flexShrink: 0, marginTop: 2 }}><Ic.Info /></div>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#4C1D95', lineHeight: 1.6, margin: 0 }}>
            Sovereign Protocol: PVOT is a read-only observer. Data is processed locally in-memory. We never modify workspace data or store meeting contents.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

// ─── 7. LANE ALIASES ──────────────────────────────────────────────────────────

function LaneAliasesCard() {
  const laneConfigs  = usePVOTStore(s => (s as any).laneConfigs  ?? []);
  const setLaneLabel = usePVOTStore(s => (s as any).setLaneLabel  ?? (() => {}));
  const reorderLanes = usePVOTStore(s => (s as any).reorderLanes  ?? (() => {}));
  const accounts     = useAuthStore(s => s.accounts) as any[];
  const lanes = useMemo(() =>
    accounts.map(acc => { const cfg = laneConfigs.find((l: any) => l.accountId === acc.id); return cfg ? { acc, cfg } : null; })
      .filter(Boolean)
      .sort((a: any, b: any) => (a.cfg.order ?? 0) - (b.cfg.order ?? 0)) as { acc: any; cfg: any }[],
    [accounts, laneConfigs],
  );
  const [editId, setEditId]   = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  if (!lanes.length) return null;
  const ACCENTS = [P.accent, P.amber, P.green, P.purple, '#0891B2'];
  return (
    <SectionCard icon={<Ic.Tag />} iconBg="#F5F3FF" iconColor={P.purple} title="Lane Aliases & Order">
      <div style={{ padding: '10px 20px 4px' }}>
        <p style={{ fontSize: 11, color: P.muted, marginBottom: 12, lineHeight: 1.5 }}>Custom aliases appear in lane headers without breaking calendar sync.</p>
      </div>
      {lanes.map(({ acc, cfg }, i) => {
        const col   = ACCENTS[i % ACCENTS.length]!;
        const label = cfg.customLabel || acc.displayName || acc.email.split('@')[0];
        const isEd  = editId === acc.id;
        return (
          <div key={acc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: i < lanes.length - 1 ? `1px solid ${P.divider}` : 'none' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0 }}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              {isEd ? (
                <input autoFocus value={editVal}
                  onChange={e => setEditVal(e.target.value)}
                  onBlur={() => { setLaneLabel(acc.id, editVal.trim() || null); setEditId(null); }}
                  onKeyDown={e => { if (e.key === 'Enter') { setLaneLabel(acc.id, editVal.trim() || null); setEditId(null); } if (e.key === 'Escape') setEditId(null); }}
                  style={{ border: `1px solid ${col}`, borderRadius: 6, padding: '4px 8px', fontSize: 12, fontWeight: 600, color: P.text, background: P.surface, outline: 'none', width: '100%' }}
                />
              ) : (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, color: P.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {label}
                    {cfg.customLabel && <span style={{ marginLeft: 6, fontSize: 8, fontWeight: 800, color: col, background: col + '18', padding: '1px 5px', borderRadius: 3, letterSpacing: '.06em', textTransform: 'uppercase' }}>ALIAS</span>}
                  </div>
                  <div style={{ fontSize: 10, color: P.muted }}>{acc.email}</div>
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
              <button onClick={() => i > 0 && reorderLanes(acc.id, lanes[i-1].acc.id)} disabled={i===0} style={{ background: 'none', border: 'none', padding: '3px 5px', cursor: i===0?'default':'pointer', color: i===0?P.divider:P.muted, fontSize: 11 }}>▲</button>
              <button onClick={() => i < lanes.length-1 && reorderLanes(acc.id, lanes[i+1].acc.id)} disabled={i===lanes.length-1} style={{ background: 'none', border: 'none', padding: '3px 5px', cursor: i===lanes.length-1?'default':'pointer', color: i===lanes.length-1?P.divider:P.muted, fontSize: 11 }}>▼</button>
            </div>
            <button onClick={() => isEd ? (setLaneLabel(acc.id, editVal.trim() || null), setEditId(null)) : (setEditId(acc.id), setEditVal(cfg.customLabel ?? ''))}
              style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${col}44`, background: isEd ? col : 'transparent', color: isEd ? '#fff' : col, fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              {isEd ? 'Save' : 'Rename'}
            </button>
          </div>
        );
      })}
    </SectionCard>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="pvot-settings" style={{ height: '100%', background: P.canvas, overflowY: 'auto', padding: '40px 40px 80px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ marginBottom: 48 }}>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: P.text, letterSpacing: '-.04em', margin: '0 0 6px' }}>
              Sovereign Console
            </h1>
            <p style={{ fontSize: 12, color: P.muted, fontWeight: 500, margin: 0 }}>
              Global Configuration ·{' '}
              <span style={{ fontSize: 9, fontWeight: 900, color: P.accent, letterSpacing: '.15em', textTransform: 'uppercase' }}>
                PVOT V16 · {ALL_CITIES.length} Cities Indexed
              </span>
            </p>
          </div>

          <IdentityCard />
          <MeetingIntelligenceCard />
          <HomeZonesCard />
          <TemporalBoundariesCard />
          <WorkspacesCard />
          <SecurityCard />
          <LaneAliasesCard />
        </div>
      </div>
    </>
  );
}
