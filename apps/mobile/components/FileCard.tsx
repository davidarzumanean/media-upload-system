import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { UploadSession } from '@media-upload/core'
import { formatFileSize, formatSpeed, colors } from '@media-upload/core'
import { ProgressBar } from './ProgressBar'
import { StatusBadge } from './StatusBadge'

interface FileCardProps {
  session: UploadSession
  speed?: number
  onPause: (id: string) => void
  onResume: (id: string) => void
  onCancel: (id: string) => void
  onRetry: (id: string) => void
  onDismiss: (id: string) => void
}

export function FileCard({
  session,
  speed,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onDismiss,
}: FileCardProps) {
  const { uploadId, fileDescriptor: fd, status, progress, error } = session
  const id = uploadId || fd.id
  const pct = Math.round(progress * 100)

  const showProgress = status === 'uploading' || status === 'paused' || status === 'completed'
  const showProgressBar = status === 'uploading' || status === 'paused'

  return (
    <View style={styles.card}>
      {/* ── Thumbnail + header row ─────────────────────────────────────────── */}
      <View style={styles.headerRow}>
        {fd.previewUri ? (
          <Image
            source={{ uri: fd.previewUri }}
            style={styles.thumb}
            resizeMode="cover"
            accessibilityLabel={`Preview of ${fd.name}`}
          />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Ionicons
              name={fd.mimeType.startsWith('video/') ? 'videocam' : 'document'}
              size={20}
              color="#94A3B8"
            />
          </View>
        )}

        <View style={styles.meta}>
          <View style={styles.titleRow}>
            <Text style={styles.filename} numberOfLines={1} ellipsizeMode="middle">
              {fd.name}
            </Text>
            <StatusBadge status={status} />
            {/* Dismiss button for completed / failed / canceled */}
            {(status === 'completed' || status === 'failed' || status === 'canceled') && (
              <TouchableOpacity
                onPress={() => onDismiss(id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Dismiss"
              >
                <Ionicons name="close" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.metaLine}>
            {formatFileSize(fd.size)}
            {fd.mimeType ? `  ·  ${fd.mimeType}` : ''}
            {showProgress && status !== 'completed' ? `  ·  ${pct}%` : ''}
            {status === 'uploading' && speed ? `  ·  ${formatSpeed(speed)}` : ''}
          </Text>
        </View>
      </View>

      {/* ── Error message ──────────────────────────────────────────────────── */}
      {status === 'failed' && error && (
        <Text style={styles.error}>{error}</Text>
      )}

      {/* ── Progress bar ──────────────────────────────────────────────────── */}
      {showProgressBar && (
        <View style={styles.progressWrapper}>
          <ProgressBar
            progress={progress}
            color={status === 'paused' ? colors.warning : colors.primary}
          />
        </View>
      )}

      {/* ── Action buttons ────────────────────────────────────────────────── */}
      <View style={styles.actions}>
        {status === 'uploading' && (
          <>
            <ActionButton label="Pause"  variant="pause"  onPress={() => onPause(id)}  />
            <ActionButton label="Cancel" variant="cancel" onPress={() => onCancel(id)} />
          </>
        )}
        {status === 'paused' && (
          <>
            <ActionButton label="Resume" variant="resume" onPress={() => onResume(id)} />
            <ActionButton label="Cancel" variant="cancel" onPress={() => onCancel(id)} />
          </>
        )}
        {status === 'failed' && (
          <ActionButton label="Retry" variant="retry" onPress={() => onRetry(id)} />
        )}
      </View>
    </View>
  )
}

type ActionVariant = 'pause' | 'resume' | 'cancel' | 'retry'

const ACTION_CONFIG: Record<ActionVariant, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  pause:  { icon: 'pause',   color: colors.warning, bg: colors.warningLight },
  resume: { icon: 'play',    color: colors.primary, bg: colors.primaryLight },
  cancel: { icon: 'close',   color: colors.error,   bg: colors.errorLight   },
  retry:  { icon: 'refresh', color: colors.primary, bg: colors.primaryLight },
}

function ActionButton({
  label,
  variant,
  onPress,
}: {
  label: string
  variant: ActionVariant
  onPress: () => void
}) {
  const isCancel = variant === 'cancel'
  const isPause = variant === 'pause'
  const color = isCancel ? colors.error : isPause ? colors.gray500 : colors.primary

  return (
    <TouchableOpacity
      style={styles.actionBtn}
      onPress={onPress}
      accessibilityLabel={label}
    >
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    flexShrink: 0,
    marginTop: 2,
  },
  thumbPlaceholder: {
    backgroundColor: '#F1F5F9', // slate-100 — structural
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  filename: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B', // slate-800 — structural
  },
  metaLine: {
    fontSize: 12,
    color: '#64748B', // slate-500 — structural
  },
  error: {
    fontSize: 12,
    color: colors.error,
    marginTop: 6,
    marginLeft: 56,
  },
  progressWrapper: {
    marginTop: 10,
    marginLeft: 56,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginLeft: 56,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
})
