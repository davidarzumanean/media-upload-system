import { TouchableOpacity, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@media-upload/core'

interface PickerButtonProps {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
}

export function PickerButton({ icon, label, onPress }: PickerButtonProps) {
  return (
    <TouchableOpacity style={styles.btn} onPress={onPress} accessibilityLabel={label}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0', // slate-200 — structural
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
})