import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { colors } from '@media-upload/core'
import { useUploadManagerContext } from '@/lib/upload-manager-context'
import { formatFileSize } from '@media-upload/core'
import type { HistoryEntry } from '@/hooks/useUploadManager'
import {BASE_URL} from "@/lib/api-client";

export default function HistoryScreen() {
  const { history, clearHistory } = useUploadManagerContext()

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        {history.length > 0 && (
          <TouchableOpacity onPress={clearHistory} accessibilityLabel="Clear all history">
            <Text style={styles.clearBtn}>Clear all</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── List ────────────────────────────────────────────────────────── */}
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState />}
        renderItem={({ item }) => <HistoryItem entry={item} />}
        ListFooterComponent={<View style={styles.listFooter} />}
      />
    </SafeAreaView>
  )
}

// ── History item ─────────────────────────────────────────────────────────────

function HistoryItem({ entry }: { entry: HistoryEntry }) {
  const [imgError, setImgError] = useState(false)
  const showThumb = entry.mimeType.startsWith('image/') && !imgError

  const date = new Date(entry.completedAt)
  const dateLabel = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const timeLabel = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <View style={styles.item}>
      {showThumb ? (
        <Image
          source={{ uri: `${BASE_URL}/uploads/${entry.id}/file` }}
          style={styles.thumb}
          resizeMode="cover"
          onError={() => setImgError(true)}
          accessibilityLabel={`Thumbnail for ${entry.name}`}
        />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Ionicons
            name={entry.mimeType.startsWith('video/') ? 'videocam' : 'document'}
            size={20}
            color="#94A3B8"
          />
        </View>
      )}

      <View style={styles.itemMeta}>
        <Text style={styles.itemName} numberOfLines={1} ellipsizeMode="middle">
          {entry.name}
        </Text>
        <Text style={styles.itemDetail}>
          {formatFileSize(entry.size)}  ·  {entry.mimeType}
        </Text>
        <View style={styles.itemDateRow}>
          <Ionicons name="checkmark-circle" size={12} color={colors.success} />
          <Text style={styles.itemDate}>{dateLabel} at {timeLabel}</Text>
        </View>
      </View>
    </View>
  )
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="time-outline" size={40} color="#94A3B8" />
      </View>
      <Text style={styles.emptyTitle}>No uploads yet</Text>
      <Text style={styles.emptySubtitle}>
        Completed uploads will appear here.
      </Text>
    </View>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8FAFC', // slate-50 — structural
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  clearBtn: {
    fontSize: 14,
    color: colors.gray500,
    fontWeight: '500',
  },

  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  listFooter: {
    height: 20,
  },

  // Item
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
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
  itemMeta: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B', // slate-800 — structural
  },
  itemDetail: {
    fontSize: 12,
    color: '#64748B', // slate-500 — structural
  },
  itemDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  itemDate: {
    fontSize: 11,
    color: '#94A3B8', // slate-400 — structural
  },

  // Empty
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#F1F5F9', // slate-100 — structural
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B', // slate-800 — structural
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B', // slate-500 — structural
    textAlign: 'center',
  },
})
