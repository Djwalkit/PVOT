/**
 * packages/ui/src/index.ts
 * PVOT UI — Package Barrel Export
 *
 * Consumers import from '@pvot/ui' and get everything they need.
 * Tree-shaking removes unused exports in production builds.
 */

// Primitives
export * from './primitives/index';

// Calendar components
export { MeetingCard, MeetingCardSkeleton } from './calendar/MeetingCard';
export { UnifiedTimeline }                  from './calendar/UnifiedTimeline';

// Layout components
export { CommandCenter } from './layout/CommandCenter';
export { ContextPanel }  from './layout/ContextPanel';

// Utilities
export * from './lib/utils';
