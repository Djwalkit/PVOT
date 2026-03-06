/**
 * packages/ui/src/ghost/ConflictPanel.tsx
 * PVOT — Executive Command Center · Conflict Observer Panel
 *
 * ═══════════════════════════════════════════════════════════════
 * READ-ONLY MANDATE
 * ═══════════════════════════════════════════════════════════════
 * This component is a 100% read-only observer.
 *
 * All of the following have been permanently removed:
 *   ✗ Ghost Block logic (postAllGhostBlocks, GhostBlockSuggestion)
 *   ✗ handlePostGhost / handlePostAll functions
 *   ✗ "Block" buttons, "Post" buttons, "Block all" actions
 *   ✗ Any network write calls to Google Calendar API
 *
 * The panel displays conflict information for awareness only.
 * The sole mutation permitted is local-state dismissal (dismissed
 * IDs stored in pvotStore — never sent to any external service).
 *
 * ═══════════════════════════════════════════════════════════════
 * PALETTE (strict)
 * ═══════════════════════════════════════════════════════════════
 * Canvas: #F5F4F0  Surface: #FFFFFF
 * Accent: #E8441A  Divider: #DAD6CE
 * ═══════════════════════════════════════════════════════════════
 */

'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, X, Clock, ArrowRight } from 'lucide-react';
import { usePVOTStore } from '@pvot/core/stores/pvotStore';
import type { Conflict } from '@pvot/core/engine/ConflictEngine';

// ─── STRICT DESIGN TOKENS ─────────────────────────────────────────────────────

const DS = {
  canvas:    '#F5F4F0',
  surface:   '#FFFFFF',
  accent:    '#E8441A',
  divider:   '#DAD6CE',
  textPri:   '#1A1A18',
  textSec:   '#6B6860',
  textMut:   '#A8A49F',
  red:       '#DC2626',
  redSoft:   '#FEF2F2',
  amber:     '#D4830A',
  amberSoft: '#FFF5E0',
  green:     '#2D9E5F',
  greenSoft: '#EDFAF3',
  fontBody:  '"IBM Plex Sans", system-ui, sans-serif',
  fontMono:  '"IBM Plex Mono", monospace',
  ease:      'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmtTime(utcIso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour:     '2-digit',
      minute:   '2-digit',
      hour12:   false,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }).format(new Date(utcIso));
  } catch { return '--:--'; }
}

function fmtOverlap(minutes: number): string {
  if (minutes < 60) return `${minutes}m overlap`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h overlap` : `${h}h ${m}m overlap`;
}

// ─── CONFLICT CARD ────────────────────────────────────────────────────────────

function ConflictCard({ conflict }: { conflict: Conflict }) {
  const [expanded, setExpanded]   = useState(false);
  const dismissConflict           = usePVOTStore(s => s.dismissConflict);

  const overlapStart = fmtTime(conflict.overlapStart);
  const overlapEnd   = fmtTime(conflict.overlapEnd);

  return (
    <div style={{
      borderRadius:  8,
      overflow:      'hidden',
      marginBottom:  8,
      background:    DS.surface,
      border:        `1.5px solid ${DS.red}30`,
      boxShadow:     `0 1px 4px ${DS.red}0A`,
    }}>
      {/* Red top stripe */}
      <div style={{ height: 3, background: DS.red }} />

      {/* Collapsed header — always visible */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width:          '100%',
          display:        'flex',
          alignItems:     'flex-start',
          justifyContent: 'space-between',
          padding:        '10px 12px',
          textAlign:      'left',
          background:     'none',
          border:         'none',
          cursor:         'pointer',
          gap:            8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0, flex: 1 }}>
          <AlertTriangle style={{
            width: 13, height: 13, color: DS.red, flexShrink: 0, marginTop: 1,
          }} />
          <div style={{ minWidth: 0 }}>
            {/* Event A */}
            <p style={{
              fontFamily:   DS.fontBody,
              fontSize:     11,
              fontWeight:   700,
              color:        DS.textPri,
              lineHeight:   1.3,
              marginBottom: 1,
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}>
              {conflict.eventA.title || 'Untitled'}
            </p>

            {/* Vs line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 1 }}>
              <div style={{ width: 12, height: 1, background: DS.divider }} />
              <span style={{
                fontFamily:    DS.fontBody,
                fontSize:      9,
                color:         DS.textMut,
                fontWeight:    500,
                letterSpacing: '0.04em',
              }}>
                overlaps
              </span>
            </div>

            {/* Event B */}
            <p style={{
              fontFamily:   DS.fontBody,
              fontSize:     11,
              fontWeight:   600,
              color:        DS.textSec,
              lineHeight:   1.3,
              marginBottom: 4,
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}>
              {conflict.eventB.title || 'Untitled'}
            </p>

            {/* Overlap span */}
            <div style={{
              display:       'inline-flex',
              alignItems:    'center',
              gap:           4,
              padding:       '2px 7px',
              borderRadius:  4,
              background:    DS.redSoft,
              border:        `1px solid ${DS.red}30`,
            }}>
              <Clock style={{ width: 9, height: 9, color: DS.red, flexShrink: 0 }} />
              <span style={{
                fontFamily:    DS.fontMono,
                fontSize:      9,
                fontWeight:    600,
                color:         DS.red,
                letterSpacing: '0.02em',
              }}>
                {overlapStart}
              </span>
              <ArrowRight style={{ width: 8, height: 8, color: DS.red }} />
              <span style={{
                fontFamily:    DS.fontMono,
                fontSize:      9,
                fontWeight:    600,
                color:         DS.red,
                letterSpacing: '0.02em',
              }}>
                {overlapEnd}
              </span>
              <span style={{
                fontFamily: DS.fontBody,
                fontSize:   9,
                color:      DS.red,
                fontWeight: 500,
              }}>
                · {fmtOverlap(conflict.overlapMins)}
              </span>
            </div>
          </div>
        </div>

        {/* Expand / dismiss controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 4 }}>
          {expanded
            ? <ChevronUp   style={{ width: 13, height: 13, color: DS.textMut }} />
            : <ChevronDown style={{ width: 13, height: 13, color: DS.textMut }} />
          }
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          padding:    '0 12px 12px',
          borderTop:  `1px solid ${DS.divider}`,
        }}>
          {/* Event detail rows */}
          {[
            { event: conflict.eventA, label: 'Event A' },
            { event: conflict.eventB, label: 'Event B' },
          ].map(({ event, label }) => (
            <div key={event.id} style={{
              marginTop:    10,
              padding:      '9px 10px',
              borderRadius: 6,
              background:   DS.canvas,
              border:       `1px solid ${DS.divider}`,
            }}>
              <div style={{
                display:      'flex',
                alignItems:   'center',
                gap:          5,
                marginBottom: 4,
              }}>
                <span style={{
                  fontFamily:    DS.fontBody,
                  fontSize:      8,
                  fontWeight:    700,
                  color:         DS.textMut,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}>
                  {label}
                </span>
                {event.videoLink && (
                  <a
                    href={event.videoLink.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{
                      fontFamily:     DS.fontBody,
                      fontSize:       9,
                      fontWeight:     700,
                      color:          DS.green,
                      background:     DS.greenSoft,
                      border:         `1px solid ${DS.green}40`,
                      padding:        '1px 6px',
                      borderRadius:   3,
                      textDecoration: 'none',
                    }}
                  >
                    Join ↗
                  </a>
                )}
              </div>
              <p style={{
                fontFamily: DS.fontBody,
                fontSize:   12,
                fontWeight: 600,
                color:      DS.textPri,
                lineHeight: 1.3,
                marginBottom: 3,
              }}>
                {event.title || 'Untitled'}
              </p>
              <span style={{
                fontFamily:    DS.fontMono,
                fontSize:      10,
                fontWeight:    500,
                color:         DS.textSec,
                letterSpacing: '0.02em',
              }}>
                {fmtTime(event.startUtc)} → {fmtTime(event.endUtc)}
              </span>
            </div>
          ))}

          {/* Read-only advisory */}
          <div style={{
            marginTop:    10,
            padding:      '7px 10px',
            borderRadius: 5,
            background:   DS.amberSoft,
            border:       `1px solid ${DS.amber}30`,
            display:      'flex',
            alignItems:   'flex-start',
            gap:          6,
          }}>
            <span style={{ fontSize: 11, flexShrink: 0, marginTop: 0 }}>💡</span>
            <p style={{
              fontFamily: DS.fontBody,
              fontSize:   10,
              color:      DS.amber,
              fontWeight: 500,
              lineHeight: 1.45,
            }}>
              This is a read-only view. Resolve this conflict directly in Google Calendar.
            </p>
          </div>

          {/* Dismiss — local state only, no API call */}
          <button
            onClick={() => dismissConflict(conflict.id)}
            style={{
              marginTop:    10,
              width:        '100%',
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              gap:          5,
              padding:      '7px',
              borderRadius: 6,
              background:   'transparent',
              border:       `1px solid ${DS.divider}`,
              fontFamily:   DS.fontBody,
              color:        DS.textMut,
              fontSize:     11,
              fontWeight:   500,
              cursor:       'pointer',
              transition:   `all 0.12s ${DS.ease}`,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = DS.canvas;
              (e.currentTarget as HTMLElement).style.borderColor = DS.textMut;
              (e.currentTarget as HTMLElement).style.color = DS.textSec;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.borderColor = DS.divider;
              (e.currentTarget as HTMLElement).style.color = DS.textMut;
            }}
          >
            <X style={{ width: 12, height: 12 }} />
            Dismiss from view
          </button>
        </div>
      )}
    </div>
  );
}

// ─── CONFLICT PANEL ───────────────────────────────────────────────────────────

export function ConflictPanel() {
  const conflicts          = usePVOTStore(s => s.conflicts);
  const dismissedConflicts = usePVOTStore(s => s.dismissedConflicts);

  const active = (conflicts ?? []).filter(
    c => !(dismissedConflicts ?? []).includes(c.id),
  );

  if (active.length === 0) return null;

  return (
    <div style={{
      width:          300,
      flexShrink:     0,
      display:        'flex',
      flexDirection:  'column',
      borderLeft:     `1px solid ${DS.divider}`,
      background:     DS.canvas,
      overflow:       'hidden',
      fontFamily:     DS.fontBody,
    }}>
      {/* Panel header */}
      <div style={{
        display:       'flex',
        alignItems:    'center',
        gap:           8,
        padding:       '11px 14px',
        borderBottom:  `1px solid ${DS.divider}`,
        background:    DS.surface,
        flexShrink:    0,
      }}>
        <div style={{
          width:          28,
          height:         28,
          borderRadius:   7,
          flexShrink:     0,
          background:     DS.redSoft,
          border:         `1px solid ${DS.red}30`,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
        }}>
          <AlertTriangle style={{ width: 14, height: 14, color: DS.red }} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontFamily: DS.fontBody, fontSize: 12, fontWeight: 700, color: DS.textPri, lineHeight: 1.2 }}>
            Schedule Conflicts
          </p>
          <p style={{ fontFamily: DS.fontBody, fontSize: 10, color: DS.textMut, lineHeight: 1.2 }}>
            {active.length} overlap{active.length !== 1 ? 's' : ''} detected
          </p>
        </div>
        {/* Count badge */}
        <div style={{
          minWidth:       22,
          height:         22,
          borderRadius:   11,
          background:     DS.red,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          padding:        '0 6px',
        }}>
          <span style={{ fontFamily: DS.fontBody, fontSize: 11, fontWeight: 800, color: '#fff' }}>
            {active.length}
          </span>
        </div>
      </div>

      {/* Read-only notice */}
      <div style={{
        padding:      '8px 14px',
        background:   DS.greenSoft,
        borderBottom: `1px solid ${DS.green}22`,
        display:      'flex',
        alignItems:   'center',
        gap:          6,
        flexShrink:   0,
      }}>
        <span style={{ fontSize: 10, flexShrink: 0 }}>🔒</span>
        <p style={{ fontFamily: DS.fontBody, fontSize: 9, fontWeight: 600, color: DS.green, lineHeight: 1.4 }}>
          Observer only · No changes are made to your calendar
        </p>
      </div>

      {/* Conflict list */}
      <div style={{
        flex:           1,
        overflowY:      'auto',
        padding:        '10px 10px 60px',
        scrollbarWidth: 'thin',
        scrollbarColor: `${DS.divider} transparent`,
      }}>
        {active.map(conflict => (
          <ConflictCard key={conflict.id} conflict={conflict} />
        ))}
      </div>
    </div>
  );
}