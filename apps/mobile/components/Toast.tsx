import { useEffect, useRef } from 'react'
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useToastState, type ToastItem } from '@/context/ToastContext'
import { colors } from '@media-upload/core'

function AnimatedToast({
  toast,
  onDismiss,
}: {
  toast: ToastItem
  onDismiss: () => void
}) {
  const translateY = useRef(new Animated.Value(-60)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start()
  }, [opacity, translateY])

  return (
    <Animated.View
      style={[styles.toast, { transform: [{ translateY }], opacity }]}
    >
      <Ionicons name="warning" size={16} color="#DC2626" style={styles.icon} />
      <Text style={styles.message} numberOfLines={3}>
        {toast.message}
      </Text>
      <TouchableOpacity
        onPress={onDismiss}
        hitSlop={8}
        accessibilityLabel="Dismiss"
      >
        <Ionicons name="close" size={16} color="#F87171" />
      </TouchableOpacity>
    </Animated.View>
  )
}

export function Toast() {
  const { toasts, removeToast } = useToastState()
  const insets = useSafeAreaInsets()

  if (toasts.length === 0) return null

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { top: insets.top + 8 }]}
    >
      {toasts.map((toast) => (
        <AnimatedToast
          key={toast.id}
          toast={toast}
          onDismiss={() => removeToast(toast.id)}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: colors.gray900,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  icon: {
    marginTop: 1,
    flexShrink: 0,
  },
  message: {
    flex: 1,
    fontSize: 13,
    color: colors.error,
    lineHeight: 18,
  },
})
