import { View, Text, FlatList, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import type { UploadSession } from '@media-upload/core'
import { useUploadManagerContext } from '@/lib/upload-manager-context'
import { useToast } from '@/context/ToastContext'
import { FileCard } from '@/components/FileCard'
import { EmptyState } from '@/components/EmptyState'
import { PickerButton } from '@/components/PickerButton'

export default function UploadScreen() {
  const { snapshot, speeds, addFiles, pause, resume, cancel, retry, dismiss } =
    useUploadManagerContext()
  const { addToast } = useToast()

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

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      addToast('Camera permission is required to take photos')
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
    })
    if (result.canceled) return

    const asset = result.assets[0]
    const mimeType = asset.mimeType ?? 'image/jpeg'
    const ext = mimeType.startsWith('video/') ? mimeType.split('/')[1] : 'jpg'
    addFiles([{
      uri: asset.uri,
      name: asset.fileName ?? `${mimeType.startsWith('video/') ? 'video' : 'photo'}-${Date.now()}.${ext}`,
      size: asset.fileSize ?? 0,
      mimeType,
    }])
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
        ListEmptyComponent={
          <EmptyState
            onGallery={pickFromGallery}
            onCamera={takePhoto}
            onDocument={pickDocument}
          />
        }
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

      {sessions.length > 0 && (
        <View style={styles.fabRow}>
          <PickerButton icon="images" label="Gallery" onPress={pickFromGallery} />
          <PickerButton icon="camera-outline" label="Camera" onPress={takePhoto} />
          <PickerButton icon="folder-open" label="Files" onPress={pickDocument} />
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8FAFC', // slate-50 — structural
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
  fabRow: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    gap: 8,
    alignItems: 'flex-end',
  },
})