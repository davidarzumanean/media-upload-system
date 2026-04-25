import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@media-upload/core'

interface EmptyStateProps {
  onGallery: () => void
  onCamera: () => void
  onDocument: () => void
}

export function EmptyState({
  onGallery,
  onCamera,
  onDocument,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        <Ionicons
          name="cloud-upload-outline"
          size={48}
          color={colors.primary}
        />
      </View>
      <Text style={styles.title}>Upload media</Text>
      <Text style={styles.subtitle}>
        Images and videos are uploaded in chunks with pause, resume, and retry.
      </Text>

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.primaryBtn} onPress={onGallery}>
          <Ionicons name="images-outline" size={18} color={colors.white} />
          <Text style={styles.primaryBtnLabel}>Choose from Gallery</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onCamera}>
          <Ionicons name="camera-outline" size={18} color={colors.primary} />
          <Text style={styles.secondaryBtnLabel}>Use Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onDocument}>
          <Ionicons
            name="folder-open-outline"
            size={18}
            color={colors.primary}
          />
          <Text style={styles.secondaryBtnLabel}>Browse Files</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>
        Supports images and videos · up to 100 MB each
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  icon: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B', // slate-800 — structural
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B', // slate-500 — structural
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  buttons: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  primaryBtnLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderWidth: 1.5,
    borderColor: '#DBEAFE', // blue-100 — structural border
  },
  secondaryBtnLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  hint: {
    fontSize: 12,
    color: '#94A3B8', // slate-400 — structural
  },
})
