import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  UploadManager,
  validateFiles,
  type FileDescriptor,
  type UploadManagerSnapshot,
  type UploadSession,
} from '@media-upload/core'
import { createApiClient } from '@/lib/api-client'
import { chunkReader, registerFile, unregisterFile } from '@/lib/chunk-reader'
import { useToast } from '@/context/ToastContext'

const HISTORY_KEY = 'media-upload-history'

export interface HistoryEntry {
  id: string
  name: string
  size: number
  mimeType: string
  completedAt: string
  /** Local URI captured at upload completion — valid for the app session */
  previewUri?: string
}

export interface UseUploadManagerReturn {
  snapshot: UploadManagerSnapshot
  speeds: Record<string, number>
  addFiles: (
    files: Array<{ uri: string; name: string; size: number; mimeType: string }>,
  ) => void
  pause: (uploadId: string) => void
  resume: (uploadId: string) => void
  cancel: (uploadId: string) => void
  retry: (uploadId: string) => void
  dismiss: (uploadId: string) => void
  history: HistoryEntry[]
  clearHistory: () => void
}

export function useUploadManager(): UseUploadManagerReturn {
  const [rawSnapshot, setRawSnapshot] = useState<UploadManagerSnapshot>({
    sessions: {},
  })
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [hiddenUploadIds, setHiddenUploadIds] = useState<string[]>([])
  const [speeds, setSpeeds] = useState<Record<string, number>>({})
  const speedTrackRef = useRef<
    Record<string, { bytes: number; ts: number; speed: number }>
  >({})
  const { addToast } = useToast()

  // Load persisted history on mount
  useEffect(() => {
    AsyncStorage.getItem(HISTORY_KEY)
      .then((raw) => {
        if (raw) setHistory(JSON.parse(raw) as HistoryEntry[])
      })
      .catch(() => {})
  }, [])

  const manager = useMemo(
    () =>
      new UploadManager({
        apiClient: createApiClient(),
        chunkReader,
        maxConcurrent: 3,
        maxRetries: 3,
      }),
    [],
  )

  useEffect(() => {
    manager.setOnChange((snap) => {
      setRawSnapshot(snap)

      // ── Speed tracking ─────────────────────────────────────────────────────
      const now = Date.now()
      const nextSpeeds: Record<string, number> = {}
      for (const [id, session] of Object.entries(snap.sessions)) {
        if (session.status === 'uploading') {
          const uploadedBytes = Math.round(
            session.progress * session.fileDescriptor.size,
          )
          const prev = speedTrackRef.current[id]
          if (prev) {
            const dt = (now - prev.ts) / 1000
            const db = uploadedBytes - prev.bytes
            if (dt > 0.05 && db >= 0) {
              const instant = db / dt
              const smoothed = prev.speed * 0.6 + instant * 0.4
              nextSpeeds[id] = smoothed
              speedTrackRef.current[id] = {
                bytes: uploadedBytes,
                ts: now,
                speed: smoothed,
              }
            } else {
              nextSpeeds[id] = prev.speed
              speedTrackRef.current[id] = { ...prev, bytes: uploadedBytes }
            }
          } else {
            speedTrackRef.current[id] = {
              bytes: uploadedBytes,
              ts: now,
              speed: 0,
            }
            nextSpeeds[id] = 0
          }
        } else {
          delete speedTrackRef.current[id]
        }
      }
      setSpeeds(nextSpeeds)
      // ───────────────────────────────────────────────────────────────────────

      setHistory((prev) => {
        const existingIds = new Set(prev.map((e) => e.id))
        const newEntries: HistoryEntry[] = []

        for (const session of Object.values(snap.sessions)) {
          if (
            session.status === 'completed' &&
            !existingIds.has(session.uploadId)
          ) {
            newEntries.push({
              id: session.uploadId,
              name: session.fileDescriptor.name,
              size: session.fileDescriptor.size,
              mimeType: session.fileDescriptor.mimeType,
              completedAt: new Date().toISOString(),
              previewUri: session.fileDescriptor.previewUri,
            })
          }
          // Unregister the file from chunk-reader once we no longer need it
          if (
            session.status === 'completed' ||
            session.status === 'canceled' ||
            session.status === 'failed'
          ) {
            unregisterFile(session.fileDescriptor.id)
          }
        }

        if (newEntries.length === 0) return prev
        const updated = [...newEntries, ...prev]
        // Persist asynchronously — fire and forget
        AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated)).catch(
          () => {},
        )
        return updated
      })
    })
  }, [manager])

  // Prune hidden IDs that have been removed by the manager
  useEffect(() => {
    setHiddenUploadIds((prev) => {
      if (prev.length === 0) return prev
      const visible = new Set(Object.keys(rawSnapshot.sessions))
      const next = prev.filter((id) => visible.has(id))
      return next.length === prev.length ? prev : next
    })
  }, [rawSnapshot])

  const snapshot = useMemo<UploadManagerSnapshot>(() => {
    if (hiddenUploadIds.length === 0) return rawSnapshot
    const hidden = new Set(hiddenUploadIds)
    return {
      sessions: Object.fromEntries(
        Object.entries(rawSnapshot.sessions).filter(([id]) => !hidden.has(id)),
      ),
    }
  }, [hiddenUploadIds, rawSnapshot])

  const addFiles = useCallback(
    (
      files: Array<{
        uri: string
        name: string
        size: number
        mimeType: string
      }>,
    ) => {
      const descriptors: FileDescriptor[] = files.map((f) => {
        const id = `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2)}`
        const isImage = f.mimeType.startsWith('image/')
        const descriptor: FileDescriptor = {
          id,
          name: f.name,
          size: f.size,
          mimeType: f.mimeType,
          // On mobile we can use the local file URI as a stable preview URL
          previewUri: isImage ? f.uri : undefined,
        }
        registerFile(descriptor, f.uri)
        return descriptor
      })

      const { valid, errors } = validateFiles(descriptors)
      for (const err of errors) addToast(err.reason)

      if (valid.length > 0) {
        // Inject queued placeholders immediately so UI updates in same frame
        setRawSnapshot((prev) => {
          const next = { ...prev.sessions }
          for (const descriptor of valid) {
            const queued: UploadSession = {
              uploadId: '',
              fileDescriptor: descriptor,
              totalChunks: 0,
              uploadedChunks: [],
              status: 'queued',
              progress: 0,
              retries: {},
            }
            next[descriptor.id] = queued
          }
          return { sessions: next }
        })

        void manager.addFiles(valid).then(() => {
          setTimeout(() => {
            void manager.start()
          }, 0)
        })
      }
    },
    [manager],
  )

  const pause = useCallback((id: string) => manager.pause(id), [manager])
  const resume = useCallback((id: string) => manager.resume(id), [manager])
  const cancel = useCallback((id: string) => manager.cancel(id), [manager])
  const retry = useCallback((id: string) => manager.retry(id), [manager])

  const dismiss = useCallback(
    (id: string) => {
      setHiddenUploadIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
      manager.remove(id)
    },
    [manager],
  )

  const clearHistory = useCallback(() => {
    setHistory([])
    AsyncStorage.removeItem(HISTORY_KEY).catch(() => {})
  }, [])

  return {
    snapshot,
    speeds,
    addFiles,
    pause,
    resume,
    cancel,
    retry,
    dismiss,
    history,
    clearHistory,
  }
}
