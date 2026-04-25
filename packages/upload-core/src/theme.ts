/**
 * Shared design tokens — imported by both apps/web (via CSS @theme) and
 * apps/mobile (directly in StyleSheet definitions).
 *
 * Web: these values are mirrored in src/index.css @theme so Tailwind utility
 * classes (`bg-primary`, `text-warning`, …) resolve to the same hex codes.
 *
 * Mobile: import `colors` from '@media-upload/core' and use in StyleSheet.create().
 */
export const colors = {
  // ── Brand / primary ────────────────────────────────────────────────────────
  primary: '#3b82f6', // blue-600  — buttons, links, progress bars
  primaryLight: '#EFF6FF', // blue-50   — tinted backgrounds
  primaryDark: '#2563eb', // blue-800  — button hover / active

  // ── Semantic status ────────────────────────────────────────────────────────
  success: '#10B981', // emerald-500 — completed state
  successLight: '#ECFDF5', // emerald-50  — completed badge background

  warning: '#F59E0B', // amber-500  — paused state
  warningLight: '#FFFBEB', // amber-50   — paused badge background

  error: '#EF4444', // red-500    — failed/error state
  errorLight: '#FEF2F2', // red-50     — error badge background

  // ── Neutral grays ──────────────────────────────────────────────────────────
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray700: '#374151',
  gray900: '#111827',

  white: '#FFFFFF',
} as const
