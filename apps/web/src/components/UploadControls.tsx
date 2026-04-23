import type { UploadManagerSnapshot } from '@media-upload/core'
import { ProgressBar } from './ProgressBar'

interface UploadControlsProps {
  snapshot: UploadManagerSnapshot
}

export function UploadControls({ snapshot }: UploadControlsProps) {
  const sessions = Object.values(snapshot.sessions)

  // Show the bar as long as at least one session is still in-progress
  const inProgressSessions = sessions.filter(
    (s) => s.status === 'uploading' || s.status === 'validating' || s.status === 'queued',
  )
  if (inProgressSessions.length === 0) return null

  const uploadingCount = sessions.filter(
    (s) => s.status === 'uploading' || s.status === 'validating',
  ).length

  // Overall progress = average across ALL sessions so completed files
  // count as 1.0 and queued files count as 0.0
  const totalProgress = sessions.reduce((sum, s) => sum + s.progress, 0)
  const progress = sessions.length > 0 ? totalProgress / sessions.length : 0
  const pct = Math.round(progress * 100)

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Uploading ${uploadingCount} of ${sessions.length} files, ${pct}% complete`}
      className="animate-in-down bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3.5 space-y-2.5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-700 leading-tight">Active Uploads</p>
          <p className="text-xs text-gray-400 mt-0.5 leading-tight">
            {uploadingCount} of {sessions.length} file{sessions.length !== 1 ? 's' : ''} uploading…
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
