/**
 * Phase 18: canonical SourceLocation enum. Lives in its own module to break a
 * circular import between vision.ts and itemLocation.ts (vision imports the
 * STATIC_MAP classifier; classifier needs the enum shape).
 *
 * Schema-fixed at these three; any expansion (counter, spice rack, deep freeze)
 * requires a ROADMAP decision.
 */
export const SOURCE_LOCATIONS = ['fridge', 'pantry', 'freezer'] as const;
export type SourceLocation = (typeof SOURCE_LOCATIONS)[number];
