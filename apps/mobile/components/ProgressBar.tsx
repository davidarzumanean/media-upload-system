import { View, StyleSheet } from 'react-native'
import { colors } from '@media-upload/core'

interface ProgressBarProps {
  progress: number  // 0–1
  color?: string
}

export function ProgressBar({ progress, color = colors.primary }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, progress)) * 100

  return (
    <View style={styles.track}>
      <View
        style={[
          styles.fill,
          { width: `${pct}%` as unknown as number, backgroundColor: color },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0', // slate-200 — structural, not a semantic token
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
})
