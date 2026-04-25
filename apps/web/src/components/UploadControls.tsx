import type { UploadManagerSnapshot } from '@media-upload/core'
import { ProgressBar } from './ProgressBar'

interface UploadControlsProps {
  snapshot: UploadManagerSnapshot
}

const VISIBLE_PROGRESS_STATUSES = new Set([
  'uploading',
  'validating',
  'queued',
  'paused',
])

export function UploadControls({ snapshot }: UploadControlsProps) {
  const sessions = Object.values(snapshot.sessions)

  // Show the bar while uploads are still active or paused.
  const hasVisibleProgress = sessions.some((s) =>
    VISIBLE_PROGRESS_STATUSES.has(s.status),
  )
  if (!hasVisibleProgress) return null

  const counts = sessions.reduce(
    (acc, session) => {
      acc[session.status] += 1
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

  const statusParts: string[] = []

  if (counts.completed > 0) {
    statusParts.push(
      `${counts.completed} of ${sessions.length} file${sessions.length !== 1 ? 's' : ''} completed`,
    )
  }

  if (counts.uploading > 0) {
    statusParts.push(`${counts.uploading} uploading`)
  }

  if (counts.validating > 0) {
    statusParts.push(`${counts.validating} preparing`)
  }

  if (counts.paused > 0) {
    statusParts.push(`${counts.paused} paused`)
  }

  if (counts.failed > 0) {
    statusParts.push(`${counts.failed} failed`)
  }

  if (counts.canceled > 0) {
    statusParts.push(`${counts.canceled} canceled`)
  }

  const statusText =
    statusParts.length > 0 ? statusParts.join(' · ') : 'Preparing uploads'

  // Overall progress = average progress across all sessions.
  // Each session contributes its current progress (0 → 1),
  // so completed files count as 1 and in-progress/paused files
  // contribute their partial progress.
  const totalProgress = sessions.reduce((sum, s) => sum + s.progress, 0)
  const progress = sessions.length > 0 ? totalProgress / sessions.length : 0
  const pct = Math.round(progress * 100)

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${statusText}, ${pct}% complete`}
      className="animate-in-down bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3.5 space-y-2.5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-700 leading-tight">
            Upload progress
          </p>
          <p className="text-xs text-gray-400 mt-0.5 leading-tight">
            {statusText}
          </p>
        </div>
        <span className="text-2xl font-bold text-blue-600 tabular-nums leading-none shrink-0">
          {pct}%
        </span>
      </div>
      <ProgressBar progress={progress} color="blue" />
    </div>
  )
}
