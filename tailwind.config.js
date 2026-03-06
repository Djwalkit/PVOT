// tailwind.config.js
// PVOT — Canonical Design System
// Every value in this file is the single source of truth.
// No hardcoded colors, spacing, or radii anywhere in the codebase.

const { fontFamily } = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './apps/web/src/**/*.{js,ts,jsx,tsx,mdx}',
    './apps/mobile/src/**/*.{js,ts,jsx,tsx}',
    './packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    // ─── OVERRIDE (not extend) spacing, radii, and type to enforce system ──
    borderRadius: {
      none: '0px',
      sm:   '4px',   // chips, badges, tight UI elements
      md:   '8px',   // cards, inputs, buttons
      lg:   '12px',  // panels, modals, drawers
      xl:   '16px',  // floating surfaces
      full: '9999px', // avatars, pill buttons
    },

    extend: {
      // ─── COLOR PALETTE ────────────────────────────────────────────────────
      // Naming: surface → container → component → interactive → accent
      colors: {
        // ── Backgrounds / Surfaces ──
        canvas:   '#080C14',   // page root — deepest navy-black
        base:     '#0D1424',   // primary surface (sidebar, panels)
        raised:   '#111B2E',   // elevated card backgrounds
        overlay:  '#172036',   // modals, popovers
        rim:      '#1E2D47',   // subtle borders on dark surfaces
        divider:  '#243452',   // horizontal rules, separators

        // ── Text ──
        primary:  '#E8EFF8',   // primary text — cool white
        secondary:'#8BA0BE',   // secondary / labels
        muted:    '#4D6280',   // disabled, placeholder
        ghost:    '#2D3E57',   // very faint, structural text

        // ── Accent: Electric Blue (primary action) ──
        blue: {
          50:  '#EEF4FF',
          100: '#D8E8FF',
          200: '#B0CFFF',
          300: '#7AADFF',
          400: '#3D87FF',
          500: '#1A6EFA',   // ← PRIMARY INTERACTIVE
          600: '#1259D6',
          700: '#0D42A8',
          800: '#0A307A',
          900: '#071E4F',
          950: '#040F2A',
        },

        // ── Accent: Emerald (success, confirmed, online) ──
        emerald: {
          400: '#34D399',
          500: '#10B981',   // ← SUCCESS STATE
          600: '#059669',
        },

        // ── Semantic ──
        danger:  '#F0533A',
        warning: '#F59E0B',
        info:    '#38BDF8',

        // ── Account Identity Colors (7 slots) ──
        // Assigned deterministically from account index, never randomly.
        account: {
          0: '#3D87FF',   // blue
          1: '#10B981',   // emerald
          2: '#F59E0B',   // amber
          3: '#E879F9',   // fuchsia
          4: '#38BDF8',   // sky
          5: '#FB923C',   // orange
          6: '#A78BFA',   // violet
        },
      },

      // ─── TYPOGRAPHY ────────────────────────────────────────────────────────
      fontFamily: {
        // Display: used for headings H1–H3
        display: ['"DM Sans"', ...fontFamily.sans],
        // Body: used for all running text
        body:    ['"IBM Plex Sans"', ...fontFamily.sans],
        // Mono: timestamps, IDs, code
        mono:    ['"IBM Plex Mono"', ...fontFamily.mono],
      },

      fontSize: {
        // Scale: 11 → 12 → 13 → 14 → 16 → 18 → 22 → 28 → 36
        // Each step has locked line-height and letter-spacing.
        'label-xs': ['11px', { lineHeight: '16px', letterSpacing: '0.06em',  fontWeight: '500' }],
        'label-sm': ['12px', { lineHeight: '18px', letterSpacing: '0.04em',  fontWeight: '500' }],
        'body-sm':  ['13px', { lineHeight: '20px', letterSpacing: '0.01em',  fontWeight: '400' }],
        'body-md':  ['14px', { lineHeight: '22px', letterSpacing: '0.005em', fontWeight: '400' }],
        'body-lg':  ['16px', { lineHeight: '26px', letterSpacing: '0em',     fontWeight: '400' }],
        'ui-md':    ['14px', { lineHeight: '20px', letterSpacing: '0.01em',  fontWeight: '500' }],
        'ui-lg':    ['16px', { lineHeight: '24px', letterSpacing: '0.005em', fontWeight: '500' }],
        'heading-sm': ['18px', { lineHeight: '26px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'heading-md': ['22px', { lineHeight: '30px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'heading-lg': ['28px', { lineHeight: '36px', letterSpacing: '-0.025em',fontWeight: '700' }],
        'display-sm': ['36px', { lineHeight: '44px', letterSpacing: '-0.03em', fontWeight: '700' }],
      },

      fontWeight: {
        regular:   '400',
        medium:    '500',
        semibold:  '600',
        bold:      '700',
      },

      // ─── SPACING ────────────────────────────────────────────────────────────
      // Base unit: 4px. All spacing is multiples of 4.
      // Named aliases for semantic clarity in component code.
      spacing: {
        px:    '1px',
        0:     '0px',
        0.5:   '2px',
        1:     '4px',
        1.5:   '6px',
        2:     '8px',
        2.5:   '10px',
        3:     '12px',
        3.5:   '14px',
        4:     '16px',
        5:     '20px',
        6:     '24px',
        7:     '28px',
        8:     '32px',
        9:     '36px',
        10:    '40px',
        12:    '48px',
        14:    '56px',
        16:    '64px',
        18:    '72px',
        20:    '80px',
        24:    '96px',
        28:    '112px',
        32:    '128px',
        // Layout slots
        sidebar:       '260px',
        'context-panel': '320px',
      },

      // ─── ANIMATION & EASING ─────────────────────────────────────────────────
      transitionTimingFunction: {
        // Standard: most UI transitions
        standard:  'cubic-bezier(0.4, 0, 0.2, 1)',
        // Enter: elements arriving on screen
        enter:     'cubic-bezier(0, 0, 0.2, 1)',
        // Exit: elements leaving screen
        exit:      'cubic-bezier(0.4, 0, 1, 1)',
        // Expressive: deliberate, noticeable motion (modals, drawers)
        expressive:'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },

      transitionDuration: {
        instant:  '80ms',
        fast:     '150ms',
        base:     '220ms',
        moderate: '350ms',
        slow:     '500ms',
      },

      keyframes: {
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in-right': {
          '0%':   { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-bottom': {
          '0%':   { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'skeleton-pulse': {
          '0%, 100%': { opacity: '0.4' },
          '50%':       { opacity: '0.7' },
        },
        'dot-pulse': {
          '0%, 100%': { transform: 'scale(1)',   opacity: '1'   },
          '50%':       { transform: 'scale(1.4)', opacity: '0.6' },
        },
        'spin-slow': {
          '0%':   { transform: 'rotate(0deg)'   },
          '100%': { transform: 'rotate(360deg)' },
        },
      },

      animation: {
        'fade-up':         'fade-up 280ms cubic-bezier(0, 0, 0.2, 1) both',
        'fade-in':         'fade-in 200ms cubic-bezier(0.4, 0, 0.2, 1) both',
        'slide-in-right':  'slide-in-right 300ms cubic-bezier(0, 0, 0.2, 1) both',
        'slide-in-bottom': 'slide-in-bottom 350ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'skeleton':        'skeleton-pulse 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        'dot-pulse':       'dot-pulse 1.4s ease infinite',
        'spin-slow':       'spin-slow 2s linear infinite',
      },

      // ─── SHADOWS ────────────────────────────────────────────────────────────
      boxShadow: {
        // Elevation system: 0 (flat) → 4 (floating)
        'elev-0': 'none',
        'elev-1': '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
        'elev-2': '0 4px 12px rgba(0,0,0,0.35), 0 2px 4px rgba(0,0,0,0.2)',
        'elev-3': '0 8px 24px rgba(0,0,0,0.4),  0 4px 8px rgba(0,0,0,0.25)',
        'elev-4': '0 20px 48px rgba(0,0,0,0.5), 0 8px 16px rgba(0,0,0,0.3)',
        // Focus ring
        'focus':  '0 0 0 3px rgba(26, 110, 250, 0.45)',
        // Account accent glow (applied inline with account color)
        'accent': '0 0 0 1px rgba(26, 110, 250, 0.3)',
      },

      // ─── LAYOUT ─────────────────────────────────────────────────────────────
      screens: {
        xs:  '390px',
        sm:  '640px',
        md:  '768px',
        lg:  '1024px',
        xl:  '1280px',
        '2xl':'1440px',
        '3xl':'1920px',
      },

      zIndex: {
        base:    '0',
        raised:  '10',
        dropdown:'20',
        sticky:  '30',
        overlay: '40',
        modal:   '50',
        toast:   '60',
        tooltip: '70',
      },
    },
  },

  plugins: [
    // Custom utility: visually hidden (a11y)
    function({ addUtilities }) {
      addUtilities({
        '.sr-only-focusable': {
          position: 'absolute',
          width:    '1px',
          height:   '1px',
          padding:  '0',
          margin:   '-1px',
          overflow: 'hidden',
          clip:     'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          borderWidth: '0',
          '&:focus': {
            position: 'static',
            width:    'auto',
            height:   'auto',
            padding:  'inherit',
            margin:   'inherit',
            overflow: 'visible',
            clip:     'auto',
            whiteSpace: 'normal',
          },
        },
        '.focus-ring': {
          outline: 'none',
          '&:focus-visible': {
            boxShadow: '0 0 0 3px rgba(26, 110, 250, 0.45)',
            borderRadius: 'inherit',
          },
        },
        '.text-balance': {
          textWrap: 'balance',
        },
      });
    },
  ],
};
