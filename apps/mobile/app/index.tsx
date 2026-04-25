import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@media-upload/core'
import type { UploadSession } from '@media-upload/core'
import { useUploadManagerContext } from '@/lib/upload-manager-context'
import { FileCard } from '@/components/FileCard'

// ── Screen ───────────────────────────────────────────────────────────────────

export default function UploadScreen() {
  const { snapshot, speeds, addFiles, pause, resume, cancel, retry, dismiss } =
    useUploadManagerContext()

  const sessions = Object.values(snapshot.sessions) as UploadSession[]

  // ── File pickers ────────────────────────────────────────────────────────

  async function pickFromGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 1,
    })
    if (result.canceled) return

    addFiles(
      result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.fileName ?? `media-${Date.now()}`,
        size: asset.fileSize ?? 0,
        mimeType: asset.mimeType ?? 'application/octet-stream',
      })),
    )
  }

  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'video/*'],
      multiple: true,
      copyToCacheDirectory: true,
    })
    if (result.canceled) return

    addFiles(
      result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name,
        size: asset.size ?? 0,
        mimeType: asset.mimeType ?? 'application/octet-stream',
      })),
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Ionicons name="cloud-upload" size={22} color={colors.primary} />
          <Text style={styles.logoText}>FileStream</Text>
        </View>
      </View>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <FlatList
        data={sessions}
        keyExtractor={(s) => s.uploadId || s.fileDescriptor.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          sessions.length > 0 ? (
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderText}>
                {sessions.length} {sessions.length === 1 ? 'file' : 'files'}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={<EmptyState onGallery={pickFromGallery} onDocument={pickDocument} />}
        renderItem={({ item }) => (
          <FileCard
            session={item}
            speed={speeds[item.uploadId || item.fileDescriptor.id]}
            onPause={pause}
            onResume={resume}
            onCancel={cancel}
            onRetry={retry}
            onDismiss={dismiss}
          />
        )}
        ListFooterComponent={<View style={styles.listFooter} />}
      />

      {/* ── FAB picker buttons (shown when files are present) ───────────── */}
      {sessions.length > 0 && (
        <View style={styles.fabRow}>
          <PickerButton icon="images" label="Gallery" onPress={pickFromGallery} />
          <PickerButton icon="folder-open" label="Files" onPress={pickDocument} />
        </View>
      )}
    </SafeAreaView>
  )
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  onGallery,
  onDocument,
}: {
  onGallery: () => void
  onDocument: () => void
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="cloud-upload-outline" size={48} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>Upload media</Text>
      <Text style={styles.emptySubtitle}>
        Images and videos are uploaded in chunks with pause, resume, and retry.
      </Text>

      <View style={styles.emptyButtons}>
        <TouchableOpacity style={styles.primaryBtn} onPress={onGallery}>
          <Ionicons name="images-outline" size={18} color={colors.white} />
          <Text style={styles.primaryBtnLabel}>Choose from Gallery</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onDocument}>
          <Ionicons name="folder-open-outline" size={18} color={colors.primary} />
          <Text style={styles.secondaryBtnLabel}>Browse Files</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.emptyHint}>Supports images and videos · up to 100 MB each</Text>
    </View>
  )
}

// ── Picker FAB ───────────────────────────────────────────────────────────────

function PickerButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
}) {
  return (
    <TouchableOpacity style={styles.pickerBtn} onPress={onPress} accessibilityLabel={label}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.pickerBtnLabel}>{label}</Text>
    </TouchableOpacity>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8FAFC', // slate-50 — structural
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 12 : 6,
    paddingBottom: 12,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0', // slate-200 — structural
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B', // slate-800 — structural
    letterSpacing: -0.3,
  },
  list: {
    padding: 16,
    paddingBottom: 120,
  },
  listHeader: {
    marginBottom: 12,
  },
  listHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B', // slate-500 — structural
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listFooter: {
    height: 20,
  },

  // Empty state
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B', // slate-800 — structural
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B', // slate-500 — structural
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  emptyButtons: {
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
  emptyHint: {
    fontSize: 12,
    color: '#94A3B8', // slate-400 — structural
  },

  // FAB row
  fabRow: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    gap: 8,
    alignItems: 'flex-end',
  },
  pickerBtn: {
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
  pickerBtnLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
})
