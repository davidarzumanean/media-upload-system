import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  UploadManager,
  validateFiles,
  type FileDescriptor,
  type UploadManagerSnapshot,
  type UploadSession,
  type ValidationError,
} from '@media-upload/core'
import { createApiClient } from '../lib/api-client'
import { chunkReader, registerFile, unregisterFile } from '../lib/chunk-reader'

const HISTORY_KEY = 'media-upload-history'

export interface HistoryEntry {
  id: string
  name: string
  size: number
  mimeType: string
  completedAt: string
  previewUri?: string
}

export interface UseUploadManagerReturn {
  snapshot: UploadManagerSnapshot
  speeds: Record<string, number>
  validationErrors: ValidationError[]
  addFiles: (files: File[]) => void
  clearErrors: () => void
  pause: (uploadId: string) => void
  resume: (uploadId: string) => void
  cancel: (uploadId: string) => void
  retry: (uploadId: string) => void
  retryAllFailed: () => void
  dismiss: (uploadId: string) => void
  clearAll: () => void
  history: HistoryEntry[]
  clearHistory: () => void
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : []
  } catch {
    return []
  }
}

function saveHistory(entries: HistoryEntry[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries))
}

const previewUrls = new Map<string, string>()

export function useUploadManager(): UseUploadManagerReturn {
  const managerRef = useRef<UploadManager | null>(null)
  const [rawSnapshot, setRawSnapshot] = useState<UploadManagerSnapshot>({ sessions: {} })
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory)
  const [hiddenUploadIds, setHiddenUploadIds] = useState<string[]>([])
  const [speeds, setSpeeds] = useState<Record<string, number>>({})
  const speedTrackRef = useRef<Record<string, { bytes: number; ts: number; speed: number }>>({})

  const manager = useMemo(() => {
    const m = new UploadManager({
      apiClient: createApiClient(),
      chunkReader,
      maxConcurrent: 3,
      maxRetries: 3,
    })
    managerRef.current = m
    return m
  }, [])

  useEffect(() => {
    manager.setOnChange((snap) => {
      setRawSnapshot(snap)

      // ── Speed tracking ───────────────────────────────────────────────────
      const now = Date.now()
      const nextSpeeds: Record<string, number> = {}
      for (const [id, session] of Object.entries(snap.sessions)) {
        if (session.status === 'uploading') {
          const uploadedBytes = Math.round(session.progress * session.fileDescriptor.size)
          const prev = speedTrackRef.current[id]
          if (prev) {
            const dt = (now - prev.ts) / 1000 // seconds
            const db = uploadedBytes - prev.bytes
            if (dt > 0.05 && db >= 0) {
              const instant = db / dt
              const smoothed = prev.speed * 0.6 + instant * 0.4
              nextSpeeds[id] = smoothed
              speedTrackRef.current[id] = { bytes: uploadedBytes, ts: now, speed: smoothed }
            } else {
              nextSpeeds[id] = prev.speed
              speedTrackRef.current[id] = { ...prev, bytes: uploadedBytes }
            }
          } else {
            speedTrackRef.current[id] = { bytes: uploadedBytes, ts: now, speed: 0 }
            nextSpeeds[id] = 0
          }
        } else {
          delete speedTrackRef.current[id]
        }
      }
      setSpeeds(nextSpeeds)
      // ─────────────────────────────────────────────────────────────────────

      setHistory((prev) => {
        const existingIds = new Set(prev.map((e) => e.id))
        const newEntries: HistoryEntry[] = []

        for (const session of Object.values(snap.sessions)) {
          if (session.status === 'completed' && !existingIds.has(session.uploadId)) {
            // Capture the preview URL into history BEFORE we revoke it below
            const previewUri = session.fileDescriptor.previewUri
            newEntries.push({
              id: session.uploadId,
              name: session.fileDescriptor.name,
              size: session.fileDescriptor.size,
              mimeType: session.fileDescriptor.mimeType,
              completedAt: new Date().toISOString(),
              previewUri,
            })
          }
          if (
            (session.status === 'completed' ||
              session.status === 'canceled' ||
              session.status === 'failed') &&
            session.fileDescriptor.previewUri
          ) {
            const url = previewUrls.get(session.fileDescriptor.id)
            if (url) {
              URL.revokeObjectURL(url)
              previewUrls.delete(session.fileDescriptor.id)
            }
            unregisterFile(session.fileDescriptor.id)
          }
        }

        if (newEntries.length === 0) return prev
        const updated = [...newEntries, ...prev]
        saveHistory(updated)
        return updated
      })
    })
  }, [manager])

  useEffect(() => {
    setHiddenUploadIds((prev) => {
      if (prev.length === 0) return prev
      const visibleIds = new Set(Object.keys(rawSnapshot.sessions))
      const next = prev.filter((id) => visibleIds.has(id))
      return next.length === prev.length ? prev : next
    })
  }, [rawSnapshot])

  const snapshot = useMemo<UploadManagerSnapshot>(() => {
    if (hiddenUploadIds.length === 0) return rawSnapshot

    const hiddenIds = new Set(hiddenUploadIds)
    const sessions = Object.fromEntries(
      Object.entries(rawSnapshot.sessions).filter(([id]) => !hiddenIds.has(id)),
    )

    return { sessions }
  }, [hiddenUploadIds, rawSnapshot])

  const addFiles = useCallback(
    (files: File[]) => {
      const descriptors: FileDescriptor[] = files.map((f) => {
        const id = `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2)}`
        const isImage = f.type.startsWith('image/')
        const previewUri = isImage ? URL.createObjectURL(f) : undefined
        if (previewUri) previewUrls.set(id, previewUri)

        const descriptor: FileDescriptor = { id, name: f.name, size: f.size, mimeType: f.type, previewUri }
        registerFile(descriptor, f)
        return descriptor
      })

      const { valid, errors } = validateFiles(descriptors)
      setValidationErrors(errors)

      if (valid.length > 0) {
        // Immediately inject queued-state sessions directly into React state
        // so file cards appear in the same render frame as the drop event,
        // without waiting for any async manager work.
        setRawSnapshot(prev => {
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

        // Hand off to the manager (its emit will naturally overwrite the
        // queued placeholders once sessions transition to validating/uploading).
        void manager.addFiles(valid).then(() => {
          setTimeout(() => { void manager.start() }, 0)
        })
      }
    },
    [manager],
  )

  const clearErrors = useCallback(() => setValidationErrors([]), [])
  const pause = useCallback((id: string) => manager.pause(id), [manager])
  const resume = useCallback((id: string) => manager.resume(id), [manager])
  const cancel = useCallback((id: string) => manager.cancel(id), [manager])
  const retry = useCallback((id: string) => manager.retry(id), [manager])
  const retryAllFailed = useCallback(() => {
    const snap = manager.getSnapshot()
    for (const [id, session] of Object.entries(snap.sessions)) {
      if (session.status === 'failed') {
        manager.retry(id)
      }
    }
  }, [manager])
  const dismiss = useCallback((id: string) => {
    setHiddenUploadIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    manager.remove(id)
  }, [manager])

  const clearAll = useCallback(() => {
    const snap = manager.getSnapshot()
    const sessionIds = Object.keys(snap.sessions)

    setHiddenUploadIds((prev) => {
      const next = new Set(prev)
      for (const id of sessionIds) next.add(id)
      return [...next]
    })

    for (const [id, s] of Object.entries(snap.sessions)) {
      if (s.status === 'completed' || s.status === 'canceled' || s.status === 'failed') {
        manager.remove(id)
      }
    }
  }, [manager])

  const clearHistory = useCallback(() => {
    setHistory([])
    localStorage.removeItem(HISTORY_KEY)
  }, [])

  return {
    snapshot,
    speeds,
    validationErrors,
    addFiles,
    clearErrors,
    pause,
    resume,
    cancel,
    retry,
    retryAllFailed,
    dismiss,
    clearAll,
    history,
    clearHistory,
  }
}
