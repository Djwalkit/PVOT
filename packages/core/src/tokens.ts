/**
 * packages/core/src/tokens.ts
 * PVOT — Design Tokens (JavaScript)
 *
 * Mirrors tailwind.config.js exactly.
 * Used by React Native (which can't consume Tailwind directly)
 * and by any non-Tailwind render context (canvas, SVG, etc).
 *
 * RULE: If you change a value here, change it in tailwind.config.js too.
 * There is a Jest test that asserts parity between both files.
 */

// ─── COLORS ──────────────────────────────────────────────────────────────────

export const color = {
  // Surfaces
  canvas:   '#080C14',
  base:     '#0D1424',
  raised:   '#111B2E',
  overlay:  '#172036',
  rim:      '#1E2D47',
  divider:  '#243452',

  // Text
  primary:  '#E8EFF8',
  secondary:'#8BA0BE',
  muted:    '#4D6280',
  ghost:    '#2D3E57',

  // Blue accent
  blue500:  '#1A6EFA',
  blue400:  '#3D87FF',
  blue600:  '#1259D6',
  blue900:  '#071E4F',

  // Emerald
  emerald400: '#34D399',
  emerald500: '#10B981',

  // Semantic
  danger:  '#F0533A',
  warning: '#F59E0B',
  info:    '#38BDF8',

  // Account identity (7 slots, index-deterministic)
  account: [
    '#3D87FF',  // 0 blue
    '#10B981',  // 1 emerald
    '#F59E0B',  // 2 amber
    '#E879F9',  // 3 fuchsia
    '#38BDF8',  // 4 sky
    '#FB923C',  // 5 orange
    '#A78BFA',  // 6 violet
  ] as const,
} as const;

// ─── SPACING ─────────────────────────────────────────────────────────────────

export const space = {
  0:    0,
  0.5:  2,
  1:    4,
  1.5:  6,
  2:    8,
  2.5:  10,
  3:    12,
  3.5:  14,
  4:    16,
  5:    20,
  6:    24,
  7:    28,
  8:    32,
  9:    36,
  10:   40,
  12:   48,
  14:   56,
  16:   64,
  18:   72,
  20:   80,
  24:   96,
} as const;

// ─── BORDER RADIUS ────────────────────────────────────────────────────────────

export const radius = {
  none: 0,
  sm:   4,
  md:   8,
  lg:   12,
  xl:   16,
  full: 9999,
} as const;

// ─── TYPOGRAPHY ──────────────────────────────────────────────────────────────

export const font = {
  family: {
    display: 'DMSans',       // matches Tailwind font-display
    body:    'IBMPlexSans',  // matches Tailwind font-body
    mono:    'IBMPlexMono',  // matches Tailwind font-mono
  },
  size: {
    labelXs:   11,
    labelSm:   12,
    bodySm:    13,
    bodyMd:    14,
    bodyLg:    16,
    uiMd:      14,
    uiLg:      16,
    headingSm: 18,
    headingMd: 22,
    headingLg: 28,
    displaySm: 36,
  },
  lineHeight: {
    labelXs:   16,
    labelSm:   18,
    bodySm:    20,
    bodyMd:    22,
    bodyLg:    26,
    headingSm: 26,
    headingMd: 30,
    headingLg: 36,
    displaySm: 44,
  },
  weight: {
    regular:  '400',
    medium:   '500',
    semibold: '600',
    bold:     '700',
  },
} as const;

// ─── ANIMATION ───────────────────────────────────────────────────────────────

export const motion = {
  easing: {
    standard:   [0.4, 0, 0.2, 1]   as const,
    enter:      [0,   0, 0.2, 1]   as const,
    exit:       [0.4, 0, 1,   1]   as const,
    expressive: [0.34, 1.56, 0.64, 1] as const,
  },
  duration: {
    instant:  80,
    fast:     150,
    base:     220,
    moderate: 350,
    slow:     500,
  },
} as const;

// ─── SHADOWS ─────────────────────────────────────────────────────────────────
// React Native shadow props (shadowColor, shadowOffset, etc.)

export const elevation = {
  0: { shadowColor: 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
  1: { shadowColor: '#000',        shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 3,  elevation: 2 },
  2: { shadowColor: '#000',        shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 },
  3: { shadowColor: '#000',        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
} as const;

// ─── Z-INDEX ─────────────────────────────────────────────────────────────────

export const zIndex = {
  base:     0,
  raised:   10,
  dropdown: 20,
  sticky:   30,
  overlay:  40,
  modal:    50,
  toast:    60,
  tooltip:  70,
} as const;

// ─── LAYOUT CONSTANTS ────────────────────────────────────────────────────────

export const layout = {
  sidebarWidth:       260,
  contextPanelWidth:  320,
  timelineMinWidth:   480,
  mobileBottomTabHeight: 64,
  headerHeight:       56,
} as const;
