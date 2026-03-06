/**
 * packages/ui/src/primitives/index.tsx
 * PVOT — UI Primitive Components
 *
 * Strict design system adherence. No magic numbers.
 * All variants map directly to tailwind.config.js tokens.
 */

import React, { forwardRef } from 'react';
import { cn } from '../lib/utils';

// ─── BUTTON ───────────────────────────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  'primary' | 'secondary' | 'ghost' | 'danger';
  size?:     'sm' | 'md' | 'lg';
  loading?:  boolean;
  iconLeft?: React.ReactNode;
  iconRight?:React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', loading, iconLeft, iconRight,
      disabled, className, children, ...props },
    ref,
  ) => {
    const base = [
      'inline-flex items-center justify-center gap-2 font-body font-medium',
      'rounded-md transition-all duration-fast ease-standard',
      'focus-ring select-none',
      'disabled:opacity-40 disabled:pointer-events-none',
    ];

    const variants = {
      primary:   'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 shadow-elev-1',
      secondary: 'bg-raised text-primary border border-rim hover:bg-overlay hover:border-divider active:bg-rim',
      ghost:     'text-secondary hover:text-primary hover:bg-raised active:bg-overlay',
      danger:    'bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 active:bg-danger/30',
    };

    const sizes = {
      sm: 'h-7 px-3 text-label-sm',
      md: 'h-9 px-4 text-ui-md',
      lg: 'h-11 px-5 text-ui-lg',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading ? (
          <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin-slow" aria-hidden="true" />
        ) : iconLeft}
        {children}
        {!loading && iconRight}
      </button>
    );
  },
);
Button.displayName = 'Button';

// ─── BADGE ────────────────────────────────────────────────────────────────────

interface BadgeProps {
  label:    string;
  variant?: 'default' | 'blue' | 'emerald' | 'amber' | 'danger' | 'outline';
  dot?:     boolean;
  size?:    'sm' | 'md';
  className?:string;
}

export function Badge({ label, variant = 'default', dot, size = 'sm', className }: BadgeProps) {
  const base = 'inline-flex items-center gap-1.5 font-body font-medium rounded-sm';

  const variants = {
    default: 'bg-rim/60 text-secondary',
    blue:    'bg-blue-900/60 text-blue-400 border border-blue-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    amber:   'bg-warning/10 text-warning border border-warning/20',
    danger:  'bg-danger/10 text-danger border border-danger/20',
    outline: 'border border-rim text-secondary',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-label-xs',
    md: 'px-2.5 py-1 text-label-sm',
  };

  return (
    <span className={cn(base, variants[variant], sizes[size], className)}>
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full flex-shrink-0',
            variant === 'emerald' ? 'bg-emerald-400 animate-dot-pulse' :
            variant === 'danger'  ? 'bg-danger' :
            variant === 'amber'   ? 'bg-warning' :
            variant === 'blue'    ? 'bg-blue-400' : 'bg-secondary',
          )}
          aria-hidden="true"
        />
      )}
      {label}
    </span>
  );
}

// ─── SKELETON ─────────────────────────────────────────────────────────────────

interface SkeletonProps {
  className?: string;
  'aria-label'?: string;
}

export function Skeleton({ className, 'aria-label': ariaLabel }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label={ariaLabel ?? 'Loading…'}
      aria-live="polite"
      className={cn('skeleton rounded-sm', className)}
    />
  );
}

export function SkeletonText({ lines = 1, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} role="status" aria-label="Loading…">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-3', i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full')}
        />
      ))}
    </div>
  );
}

// ─── AVATAR ───────────────────────────────────────────────────────────────────

interface AvatarProps {
  name:      string;
  photoUrl?: string | null;
  size?:     'xs' | 'sm' | 'md' | 'lg';
  colorIndex?: 0|1|2|3|4|5|6;
  className?: string;
}

const ACCOUNT_COLORS = [
  '#3D87FF', '#10B981', '#F59E0B',
  '#E879F9', '#38BDF8', '#FB923C', '#A78BFA',
] as const;

export function Avatar({ name, photoUrl, size = 'sm', colorIndex = 0, className }: AvatarProps) {
  const sizes = {
    xs: 'w-5 h-5 text-[10px]',
    sm: 'w-7 h-7 text-label-xs',
    md: 'w-9 h-9 text-label-sm',
    lg: 'w-11 h-11 text-body-sm',
  };

  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');

  const color = ACCOUNT_COLORS[colorIndex];

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={cn('rounded-full object-cover flex-shrink-0', sizes[size], className)}
      />
    );
  }

  return (
    <span
      aria-label={name}
      className={cn(
        'rounded-full flex-shrink-0 inline-flex items-center justify-center',
        'font-body font-semibold select-none',
        sizes[size],
        className,
      )}
      style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}30` }}
    >
      {initials}
    </span>
  );
}

// ─── DIVIDER ──────────────────────────────────────────────────────────────────

export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-0 border-t border-divider', className)} />;
}

// ─── TOOLTIP ─────────────────────────────────────────────────────────────────

interface TooltipProps {
  content:   string;
  children:  React.ReactElement;
  side?:     'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  const positions = {
    top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left:   'right-full top-1/2 -translate-y-1/2 mr-2',
    right:  'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <span className="relative group inline-flex">
      {React.cloneElement(children, { 'aria-describedby': undefined })}
      <span
        role="tooltip"
        className={cn(
          'absolute z-tooltip pointer-events-none',
          'px-2 py-1 rounded-sm text-label-xs font-body',
          'bg-overlay border border-rim text-primary whitespace-nowrap',
          'opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100',
          'transition-all duration-fast ease-standard',
          positions[side],
        )}
      >
        {content}
      </span>
    </span>
  );
}

// ─── ICON BUTTON ─────────────────────────────────────────────────────────────

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;  // aria-label (required — no visible label)
  size?: 'sm' | 'md' | 'lg';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, size = 'md', className, children, ...props }, ref) => {
    const sizes = { sm: 'w-7 h-7', md: 'w-9 h-9', lg: 'w-10 h-10' };
    return (
      <button
        ref={ref}
        aria-label={label}
        className={cn(
          'inline-flex items-center justify-center rounded-md',
          'text-secondary hover:text-primary hover:bg-raised',
          'transition-all duration-fast ease-standard focus-ring',
          'disabled:opacity-40 disabled:pointer-events-none',
          sizes[size],
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
IconButton.displayName = 'IconButton';
