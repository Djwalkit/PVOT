/**
 * packages/ui/src/slider/TimeTravelerSlider.tsx
 * PVOT — Time Traveler Slider  v16
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * v16 — CITY JUMP: FULL WORLD SEARCH (418 IANA cities)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Click "🌍 City Jump" in the slider strip to expand the city search panel.
 *
 * Users can type ANY of:
 *   "Lagos"        → Africa/Lagos
 *   "Africa"       → all 52 African cities
 *   "GMT+3"        → every GMT+3 zone worldwide
 *   "Indiana"      → America/Indiana/* sub-zones
 *   "Asia"         → all 82 Asian cities
 *
 * The dropdown renders via ReactDOM.createPortal → document.body so it is
 * never clipped by the dark command-strip container.
 *
 * Keyboard: ↑/↓ navigate list, Enter selects top result, Escape closes.
 *
 * On city select: offset snaps so the chosen city shows `at HH:00` local.
 * Changing the hour field re-applies immediately when a city is selected.
 *
 * ─── IMPORTS from packages/core/src/timezone/TimezoneUtils.ts ───────────
 *   searchCities(query, exclude?) — returns CityOption[]
 *   groupByRegion(cities)        — for grouped empty-state display
 *   ALL_CITIES                   — for showing total count in placeholder
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PRESERVED FROM v15 (unchanged)
 * ═══════════════════════════════════════════════════════════════════════════
 * • Custom pointer-drag slider (±12h window, 5-min snap)
 * • LIVE / WARP pill with animated pulse dot
 * • Zone clocks from homeZones rendered at virtual time
 * • ↩ Back to live button
 * • Double-click handle or pill to snap back to now
 * • Dark #1C1B1A command-strip background + #2C2B29 border
 */

'use client';

import React, {
  useState, useMemo, useRef, useEffect, useCallback,
  type RefObject, type KeyboardEvent as RKE,
} from 'react';
import ReactDOM from 'react-dom';
import { usePVOTStore } from '@pvot/core/stores/pvotStore';
import {
  searchCities,
  groupByRegion,
  ALL_CITIES,
  type CityOption,
} from '@pvot/core/timezone/TimezoneUtils';

// ─── TOKENS ───────────────────────────────────────────────────────────────────

const C = {
  bg:         '#1C1B1A',
  bgDeep:     '#161514',
  strip:      '#2C2B29',
  track:      '#3A3835',
  surface:    '#2A2927',
  surfaceHvr: '#333130',
  text:       '#F0EEE9',
  dim:        '#9B978F',
  muted:      '#625E58',
  divider:    '#3A3835',
  accent:     '#DA3E16',
  amber:      '#B96C08',
  amberSoft:  '#FFF3DC',
  purple:     '#783AE1',
  purpleSoft: '#241E3A',
  purpleMid:  '#C4B5FD',
  ease:       'cubic-bezier(0.4,0,0.2,1)',
} as const;

const ZONE_COLORS = [C.accent, C.amber, '#228E4B', C.purple, '#008CAC'];
const WINDOW_MS   = 12 * 60 * 60 * 1000; // ±12 h

// ─── PORTAL STYLES ────────────────────────────────────────────────────────────

const PORTAL_CSS = `
.pvot-tt-drop {
  position: fixed; z-index: 99999;
  background: #1C1B1A;
  border: 1.5px solid #3A3835;
  border-radius: 12px;
  box-shadow: 0 20px 50px rgba(0,0,0,.6), 0 4px 14px rgba(0,0,0,.4);
  display: flex; flex-direction: column; overflow: hidden;
  font-family: var(--font-sans,"IBM Plex Sans",system-ui,sans-serif);
}
.pvot-tt-drop-head {
  padding: 6px 12px 5px;
  font-size: 8px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase;
  color: #783AE1; background: #241E3A;
  border-bottom: 1px solid #3A3835;
  flex-shrink: 0; display: flex; align-items: center; justify-content: space-between;
}
.pvot-tt-drop-sub {
  font-size: 8px; font-weight: 700; color: #625E58;
  letter-spacing: .04em; text-transform: none;
  font-family: var(--font-mono,"IBM Plex Mono",monospace);
}
.pvot-tt-drop-list { overflow-y: auto; flex: 1; max-height: 280px; }
.pvot-tt-drop-list::-webkit-scrollbar { width: 4px; }
.pvot-tt-drop-list::-webkit-scrollbar-thumb { background: #3A3835; border-radius: 10px; }
.pvot-tt-drop-region {
  padding: 4px 12px 3px;
  font-size: 7px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase;
  color: #B96C08; background: #1F1A10;
  border-bottom: 1px solid #2A2210; border-top: 1px solid #2A2210;
}
.pvot-tt-drop-item {
  width: 100%; padding: 8px 12px;
  border: none; border-bottom: 1px solid #232220;
  background: transparent; cursor: pointer; text-align: left;
  display: grid; grid-template-columns: 1fr auto;
  align-items: center; gap: 10px;
  font-family: var(--font-sans,"IBM Plex Sans",system-ui,sans-serif);
  transition: background .07s; outline: none;
}
.pvot-tt-drop-item:last-child { border-bottom: none; }
.pvot-tt-drop-item:hover, .pvot-tt-drop-item.pvot-tt-focused { background: #241E3A; }
.pvot-tt-drop-left { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.pvot-tt-drop-city { font-size: 12px; font-weight: 700; color: #F0EEE9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pvot-tt-drop-iana { font-size: 9px; color: #625E58; font-family: var(--font-mono,"IBM Plex Mono",monospace); }
.pvot-tt-drop-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
.pvot-tt-drop-offset { font-size: 9px; font-weight: 700; font-family: var(--font-mono,"IBM Plex Mono",monospace); color: #B96C08; background: #1F1A10; padding: 1px 5px; border-radius: 4px; border: 1px solid #2A2210; }
.pvot-tt-drop-time { font-size: 9px; color: #625E58; font-family: var(--font-mono,"IBM Plex Mono",monospace); }
.pvot-tt-drop-empty { padding: 18px 14px; text-align: center; font-size: 12px; color: #625E58; line-height: 1.6; }
`;

let _styleInjected = false;
function ensureStyle() {
  if (_styleInjected || typeof document === 'undefined') return;
  const el = document.createElement('style');
  el.textContent = PORTAL_CSS;
  document.head.appendChild(el);
  _styleInjected = true;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmtTime(offsetMs: number, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(Date.now() + offsetMs));
  } catch { return '--:--'; }
}

function fmtOffset(ms: number): string {
  if (ms === 0) return 'LIVE';
  const h = Math.round(ms / 3_600_000);
  return h > 0 ? `+${h}h` : `${h}h`;
}

/** ms offset so chosen city shows targetHour:00 local */
function msForCityHour(targetHour: number, tz: string): number {
  try {
    const fp  = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false,
    }).formatToParts(new Date());
    const curH = Number(fp.find(p => p.type === 'hour')?.value   ?? 0);
    const curM = Number(fp.find(p => p.type === 'minute')?.value ?? 0);
    let diff   = (targetHour - curH) * 60 - curM;
    if (diff >  720) diff -= 1440;
    if (diff < -720) diff += 1440;
    return diff * 60_000;
  } catch { return 0; }
}

// ─── CITY PORTAL DROPDOWN ─────────────────────────────────────────────────────

function CityDrop({
  anchorRef, isOpen, onClose, onSelect, results, query, focusIdx, setFocusIdx, offsetMs,
}: {
  anchorRef:   RefObject<HTMLElement | null>;
  isOpen:      boolean;
  onClose:     () => void;
  onSelect:    (c: CityOption) => void;
  results:     CityOption[];
  query:       string;
  focusIdx:    number;
  setFocusIdx: (i: number) => void;
  offsetMs:    number;
}) {
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const listRef = useRef<HTMLDivElement>(null);

  const updatePos = useCallback(() => {
    if (!anchorRef.current) return;
    const r   = anchorRef.current.getBoundingClientRect();
    const estH = Math.min(results.length * 38 + 36, 316);
    // Open upward — slider lives at bottom of screen
    setPos({ top: r.top - estH - 6, left: r.left, width: r.width });
  }, [anchorRef, results.length]);

  useEffect(() => {
    if (!isOpen) return;
    ensureStyle();
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [isOpen, updatePos]);

  // Outside-click close
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: MouseEvent) => {
      if (anchorRef.current?.contains(e.target as Node)) return;
      if (document.getElementById('pvot-tt-drop')?.contains(e.target as Node)) return;
      onClose();
    };
    const t = setTimeout(() => document.addEventListener('mousedown', h), 60);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', h); };
  }, [isOpen, onClose, anchorRef]);

  // Scroll focused item into view
  useEffect(() => {
    if (!listRef.current || focusIdx < 0) return;
    (listRef.current.querySelector(`[data-idx="${focusIdx}"]`) as HTMLElement | null)
      ?.scrollIntoView({ block: 'nearest' });
  }, [focusIdx]);

  if (!isOpen || typeof document === 'undefined') return null;

  const grouped = !query.trim() ? groupByRegion(results) : null;
  const hLabel  = query.trim() ? `${results.length} cities` : 'Global Cities';
  const hSub    = query.trim() ? `"${query.trim()}"` : `${ALL_CITIES.length} worldwide`;

  return ReactDOM.createPortal(
    <div id="pvot-tt-drop" className="pvot-tt-drop"
      style={{ top: pos.top, left: pos.left, width: Math.max(pos.width, 300) }}>
      <div className="pvot-tt-drop-head">
        <span>{hLabel}</span>
        <span className="pvot-tt-drop-sub">{hSub}</span>
      </div>
      <div className="pvot-tt-drop-list" ref={listRef}>
        {results.length === 0 ? (
          <div className="pvot-tt-drop-empty">
            No results for "{query}"<br/>
            <span style={{ fontSize: 10 }}>Try: Africa · Asia · GMT+3 · Europe</span>
          </div>
        ) : grouped ? (
          grouped.map(({ region, items }) => (
            <React.Fragment key={region}>
              <div className="pvot-tt-drop-region">{region}</div>
              {items.map(c => {
                const idx = results.indexOf(c);
                return (
                  <CityDropItem key={c.tz} c={c} idx={idx}
                    focused={idx === focusIdx}
                    onHover={setFocusIdx}
                    onSelect={onSelect}
                    offsetMs={offsetMs}
                  />
                );
              })}
            </React.Fragment>
          ))
        ) : (
          results.map((c, idx) => (
            <CityDropItem key={c.tz} c={c} idx={idx}
              focused={idx === focusIdx}
              onHover={setFocusIdx}
              onSelect={onSelect}
              offsetMs={offsetMs}
            />
          ))
        )}
      </div>
    </div>,
    document.body,
  );
}

function CityDropItem({ c, idx, focused, onHover, onSelect, offsetMs }: {
  c: CityOption; idx: number; focused: boolean;
  onHover: (i: number) => void;
  onSelect: (c: CityOption) => void;
  offsetMs: number;
}) {
  return (
    <button
      className={`pvot-tt-drop-item${focused ? ' pvot-tt-focused' : ''}`}
      data-idx={idx}
      onMouseEnter={() => onHover(idx)}
      onClick={() => onSelect(c)}
    >
      <div className="pvot-tt-drop-left">
        <span className="pvot-tt-drop-city">
          {c.sub ? `${c.city}, ${c.sub}` : c.city}
        </span>
        <span className="pvot-tt-drop-iana">{c.tz}</span>
      </div>
      <div className="pvot-tt-drop-right">
        <span className="pvot-tt-drop-offset">{c.offsetStr}</span>
        <span className="pvot-tt-drop-time">{fmtTime(offsetMs, c.tz)}</span>
      </div>
    </button>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export function TimeTravelerSlider() {
  const homeZones           = usePVOTStore(s => s.homeZones);
  const timeTravelOffset    = usePVOTStore(s => s.timeTravelOffset);
  const setTimeTravelOffset = usePVOTStore(s => s.setTimeTravelOffset);

  // ── City Jump state ──────────────────────────────────────────────────
  const [expanded,  setExpanded]  = useState(false);
  const [query,     setQuery]     = useState('');
  const [dropOpen,  setDropOpen]  = useState(false);
  const [focusIdx,  setFocusIdx]  = useState(-1);
  const [selected,  setSelected]  = useState<CityOption | null>(null);
  const [jumpHour,  setJumpHour]  = useState('09');

  const wrapRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchCities(query), [query]);
  useEffect(() => { setFocusIdx(-1); }, [results]);

  const selectCity = useCallback((c: CityOption) => {
    setSelected(c);
    setQuery(c.city);
    setDropOpen(false);
    setFocusIdx(-1);
    const h = Math.max(0, Math.min(23, parseInt(jumpHour, 10) || 9));
    setTimeTravelOffset(msForCityHour(h, c.tz));
  }, [jumpHour, setTimeTravelOffset]);

  const handleKey = (e: RKE<HTMLInputElement>) => {
    if (!dropOpen) { if (e.key !== 'Escape') setDropOpen(true); return; }
    if      (e.key === 'ArrowDown') { e.preventDefault(); setFocusIdx(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setFocusIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter')     { e.preventDefault(); const c = results[focusIdx >= 0 ? focusIdx : 0]; if (c) selectCity(c); }
    else if (e.key === 'Escape')    { setDropOpen(false); setFocusIdx(-1); }
  };

  // ── Slider drag ──────────────────────────────────────────────────────
  const isLive    = timeTravelOffset === 0;
  const sliderPct = ((timeTravelOffset + WINDOW_MS) / (2 * WINDOW_MS)) * 100;
  const trackRef  = useRef<HTMLDivElement>(null);
  const dragging  = useRef(false);

  const snapOffset = (pct: number) =>
    Math.round(((pct / 100) * 2 * WINDOW_MS - WINDOW_MS) / 300_000) * 300_000;

  const onMove = useCallback((e: PointerEvent) => {
    if (!dragging.current || !trackRef.current) return;
    const r = trackRef.current.getBoundingClientRect();
    setTimeTravelOffset(snapOffset(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100))));
  }, [setTimeTravelOffset]);

  const onUp = useCallback(() => {
    dragging.current = false;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup',   onUp);
  }, [onMove]);

  const startDrag = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);
  }, [onMove, onUp]);

  const onTrackClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const r = trackRef.current.getBoundingClientRect();
    setTimeTravelOffset(snapOffset(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100))));
  }, [setTimeTravelOffset]);

  const sortedZones = [...homeZones].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div style={{ flexShrink: 0, background: C.bg, borderTop: `1px solid ${C.strip}` }}>

      {/* ── City Jump panel (toggled by 🌍 button) ─────────────────────── */}
      {expanded && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 16px', borderBottom: `1px solid ${C.strip}`,
        }}>
          <span style={{
            fontSize: 8, fontWeight: 900, letterSpacing: '.12em',
            textTransform: 'uppercase', color: C.muted,
            flexShrink: 0, whiteSpace: 'nowrap',
          }}>
            CITY JUMP
          </span>

          {/* Search input */}
          <div ref={wrapRef} style={{ flex: 1, position: 'relative', minWidth: 0 }}>
            <span style={{
              position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
              lineHeight: 0, color: dropOpen ? C.purple : C.muted,
              pointerEvents: 'none', zIndex: 1, transition: 'color .15s',
            }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2.5"/>
              </svg>
            </span>
            <input
              ref={inputRef}
              value={query}
              placeholder={`${ALL_CITIES.length} cities — Lagos, Africa, GMT+3…`}
              onFocus={() => setDropOpen(true)}
              onChange={e => { setQuery(e.target.value); setSelected(null); setDropOpen(true); }}
              onKeyDown={handleKey}
              style={{
                width: '100%', padding: '7px 28px 7px 28px',
                background: C.surface,
                border: `1px solid ${dropOpen ? C.purple : C.divider}`,
                borderRadius: 8, fontSize: 11, color: C.text,
                fontFamily: 'var(--font-sans,"IBM Plex Sans",system-ui,sans-serif)',
                outline: 'none', transition: 'border-color .15s',
              }}
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setSelected(null); setDropOpen(true); inputRef.current?.focus(); }}
                style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 2, lineHeight: 0 }}
              >
                <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5"/></svg>
              </button>
            )}
          </div>

          {/* at HH:00 */}
          <span style={{ fontSize: 10, color: C.muted, fontWeight: 600, flexShrink: 0 }}>at</span>
          <input
            type="number" min={0} max={23} value={jumpHour}
            onChange={e => {
              setJumpHour(e.target.value);
              if (selected) {
                const h = Math.max(0, Math.min(23, parseInt(e.target.value) || 9));
                setTimeTravelOffset(msForCityHour(h, selected.tz));
              }
            }}
            style={{
              width: 40, padding: '7px 4px', textAlign: 'center',
              background: C.surface, border: `1px solid ${C.divider}`,
              borderRadius: 8, fontFamily: 'var(--font-mono,"IBM Plex Mono",monospace)',
              fontSize: 12, fontWeight: 700, color: C.text, outline: 'none', flexShrink: 0,
            }}
            onFocus={e => { e.currentTarget.style.borderColor = C.purple; }}
            onBlur={e  => { e.currentTarget.style.borderColor = C.divider; }}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: C.muted, flexShrink: 0 }}>:00</span>

          {/* Jump button */}
          <button
            onClick={() => { const c = results[focusIdx >= 0 ? focusIdx : 0]; if (c) selectCity(c); }}
            style={{
              padding: '7px 12px', borderRadius: 8, border: 'none',
              background: selected || results.length > 0 ? C.purple : C.divider,
              color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer',
              flexShrink: 0, whiteSpace: 'nowrap',
            }}
          >
            Jump ↗
          </button>

          {/* Selected city chip */}
          {selected && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
              background: C.purpleSoft, border: `1px solid ${C.divider}`,
              borderRadius: 8, padding: '4px 10px',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.purpleMid }}>
                📍 {selected.city}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: C.purple }}>
                {fmtTime(timeTravelOffset, selected.tz)}
              </span>
              <button
                onClick={() => { setSelected(null); setQuery(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 1, lineHeight: 0 }}
              >
                <svg width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5"/></svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Main slider strip ───────────────────────────────────────────── */}
      <div style={{
        height: 52, display: 'flex', alignItems: 'center',
        paddingInline: 16, gap: 14,
      }}>

        {/* LIVE / WARP pill */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '5px 12px', borderRadius: 20, flexShrink: 0,
            background: isLive ? '#DA3E1622' : '#B96C0822',
            border: `1px solid ${isLive ? C.accent + '60' : C.amber + '60'}`,
            cursor: isLive ? 'default' : 'pointer', userSelect: 'none',
          }}
          title={isLive ? 'Live – showing real time' : 'Double-click to return to live'}
          onDoubleClick={() => setTimeTravelOffset(0)}
        >
          <div style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: isLive ? C.accent : C.amber,
            animation: isLive ? 'pvot-pulse 1.5s ease-in-out infinite' : 'none',
          }}/>
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '.1em',
            color: isLive ? C.accent : C.amber,
            fontFamily: '"IBM Plex Mono",monospace',
          }}>
            {isLive ? 'LIVE' : `WARP ${fmtOffset(timeTravelOffset)}`}
          </span>
        </div>

        {/* Zone clocks */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, overflow: 'hidden' }}>
          {sortedZones.map((z: any, i: number) => {
            const col  = ZONE_COLORS[i % ZONE_COLORS.length]!;
            const tzId = z.timezone ?? z.tz ?? z;
            const lbl  = z.label ?? z.city ?? String(tzId).split('/').pop()?.replace(/_/g, ' ');
            return (
              <div key={z.id ?? tzId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#6B6860', lineHeight: 1 }}>
                  {lbl}
                </span>
                <span style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 14, fontWeight: 700, color: col, letterSpacing: '-.02em', lineHeight: 1 }} suppressHydrationWarning>
                  {fmtTime(timeTravelOffset, tzId)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Slider track */}
        <div ref={trackRef} onClick={onTrackClick} style={{ flex: 1, height: 6, borderRadius: 3, background: C.track, position: 'relative', cursor: 'pointer' }}>
          {/* Fill */}
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${sliderPct}%`, borderRadius: 3, background: isLive ? `linear-gradient(90deg,${C.track},${C.accent})` : `linear-gradient(90deg,${C.track},${C.amber})`, transition: dragging.current ? 'none' : `width .1s ${C.ease}` }}/>
          {/* NOW tick */}
          <div style={{ position: 'absolute', left: '50%', top: -3, width: 2, height: 12, background: '#5A5855', transform: 'translateX(-50%)', borderRadius: 1 }}/>
          {/* Handle */}
          <div
            onPointerDown={startDrag}
            onDoubleClick={() => setTimeTravelOffset(0)}
            style={{ position: 'absolute', top: '50%', left: `${sliderPct}%`, transform: 'translate(-50%,-50%)', width: 20, height: 20, borderRadius: '50%', background: '#FFFFFF', border: `2px solid ${isLive ? C.accent : C.amber}`, boxShadow: `0 0 0 3px ${isLive ? C.accent + '30' : C.amber + '30'}`, cursor: 'grab', transition: dragging.current ? 'none' : `left .1s ${C.ease}`, zIndex: 2 }}
          />
        </div>

        {/* Back to live */}
        {!isLive && (
          <button
            onClick={() => setTimeTravelOffset(0)}
            style={{ padding: '5px 12px', borderRadius: 8, background: 'transparent', border: `1px solid ${C.divider}`, color: C.dim, fontSize: 10, fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
            onMouseEnter={e => Object.assign(e.currentTarget.style, { borderColor: C.accent, color: C.accent })}
            onMouseLeave={e => Object.assign(e.currentTarget.style, { borderColor: C.divider, color: C.dim })}
          >
            ↩ Back to live
          </button>
        )}

        {/* City Jump toggle */}
        <button
          onClick={() => { setExpanded(v => !v); if (!expanded) setTimeout(() => inputRef.current?.focus(), 50); }}
          style={{
            padding: '5px 10px', borderRadius: 8,
            border: `1px solid ${expanded ? C.purple : C.divider}`,
            background: expanded ? C.purpleSoft : 'transparent',
            color: expanded ? C.purpleMid : C.dim,
            fontSize: 10, fontWeight: 700, cursor: 'pointer',
            flexShrink: 0, whiteSpace: 'nowrap', letterSpacing: '.04em',
          }}
          onMouseEnter={e => { if (!expanded) Object.assign(e.currentTarget.style, { borderColor: C.purple, color: C.purpleMid }); }}
          onMouseLeave={e => { if (!expanded) Object.assign(e.currentTarget.style, { borderColor: C.divider, color: C.dim }); }}
        >
          🌍 City Jump
        </button>
      </div>

      {/* Portal dropdown — renders above slider, portalled outside overflow */}
      <CityDrop
        anchorRef={wrapRef as RefObject<HTMLElement | null>}
        isOpen={dropOpen && expanded}
        onClose={() => setDropOpen(false)}
        onSelect={selectCity}
        results={results}
        query={query}
        focusIdx={focusIdx}
        setFocusIdx={setFocusIdx}
        offsetMs={timeTravelOffset}
      />

      <style>{`@keyframes pvot-pulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
    </div>
  );
}