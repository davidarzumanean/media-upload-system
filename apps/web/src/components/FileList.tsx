import type { UploadManagerSnapshot } from '@media-upload/core'
import { FileUploadCard } from './FileUploadCard'

interface FileListProps {
  snapshot: UploadManagerSnapshot
  speeds: Record<string, number>
  onPause: (id: string) => void
  onResume: (id: string) => void
  onCancel: (id: string) => void
  onRetry: (id: string) => void
  onRetryAllFailed: () => void
  onDismiss: (id: string) => void
  onClearAll: () => void
}

export function FileList({
  snapshot,
  speeds,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onRetryAllFailed,
  onDismiss,
  onClearAll,
}: FileListProps) {
  const entries = Object.entries(snapshot.sessions)
  if (entries.length === 0) return null

  const sessions = Object.values(snapshot.sessions)

  const counts = sessions.reduce(
    (acc, s) => {
      acc[s.status] += 1
      return acc
    },
    {
      queued: 0,
      validating: 0,
      uploading: 0,
      paused: 0,
      completed: 0,
      failed: 0,
      canceled: 0,
    } as Record<string, number>,
  )

  const failedCount = counts.failed
  const dismissibleCount = counts.completed + counts.failed + counts.canceled

  return (
    <section aria-label="Upload queue" className="space-y-2.5">
      {/* Section header */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          {sessions.length} file{sessions.length !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-3">
          {failedCount > 0 && (
            <button
              onClick={onRetryAllFailed}
              className="cursor-pointer text-xs text-blue-600 hover:text-blue-700 transition-colors font-medium"
            >
              Retry all
            </button>
          )}
          {dismissibleCount > 0 && (
            <button
              onClick={onClearAll}
              className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Cards */}
      {entries.map(([id, session]) => (
        <FileUploadCard
          // Use the fileDescriptor.id as the React key — it is stable for the
          // entire session lifetime, unlike the snapshot key which changes from
          // file.id → uploadId when the server assigns a real upload ID.
          key={session.fileDescriptor.id}
          session={session}
          speed={speeds[id]}
          onPause={onPause}
          onResume={onResume}
          onCancel={onCancel}
          onRetry={onRetry}
          onDismiss={onDismiss}
        />
      ))}
    </section>
  )
}
