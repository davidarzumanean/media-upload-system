import { View, Text, StyleSheet } from 'react-native'
import type { UploadStatus } from '@media-upload/core'
import { colors } from '@media-upload/core'

interface StatusBadgeProps {
  status: UploadStatus
}

const STATUS_CONFIG: Record<
  UploadStatus,
  { label: string; bg: string; text: string }
> = {
  queued: { label: 'Queued', bg: '#F1F5F9', text: '#64748B' }, // slate-100 / slate-500
  validating: { label: 'Validating', bg: '#F1F5F9', text: '#64748B' }, // slate-100 / slate-500
  uploading: {
    label: 'Uploading',
    bg: colors.primaryLight,
    text: colors.primary,
  }, // #EFF6FF / #3B82F6
  paused: { label: 'Paused', bg: colors.warningLight, text: colors.warning }, // #FFFBEB / #F59E0B
  completed: {
    label: 'Completed',
    bg: colors.successLight,
    text: colors.success,
  }, // #ECFDF5 / #10B981
  failed: { label: 'Failed', bg: colors.errorLight, text: colors.error }, // #FEF2F2 / #EF4444
  canceled: { label: 'Canceled', bg: '#F8FAFC', text: '#94A3B8' }, // slate-50 / slate-400
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.queued
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.label, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
})
