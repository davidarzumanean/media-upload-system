import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { UploadSession, UploadStatus } from '@media-upload/core'
import { formatFileSize, formatSpeed } from '@media-upload/core'
import { ProgressBar } from './ProgressBar'
import { ErrorIcon } from './icons/ErrorIcon'
import { PauseIcon } from './icons/PauseIcon'
import { PlayIcon } from './icons/PlayIcon'
import { RetryIcon } from './icons/RetryIcon'
import { XMarkIcon } from './icons/XMarkIcon'
import { FileThumbnail } from './FileThumbnail'

interface FileUploadCardProps {
  session: UploadSession
  speed?: number
  onPause: (id: string) => void
  onResume: (id: string) => void
  onCancel: (id: string) => void
  onRetry: (id: string) => void
  onDismiss: (id: string) => void
}

const statusConfig: Record<
  UploadStatus,
  {
    label: string
    badgeClass: string
    progressColor: 'blue' | 'green' | 'yellow' | 'red'
  }
> = {
  queued: {
    label: 'Starting…',
    badgeClass: 'bg-blue-50 text-blue-500',
    progressColor: 'blue',
  },
  validating: {
    label: 'Starting…',
    badgeClass: 'bg-blue-50 text-blue-500',
    progressColor: 'blue',
  },
  uploading: {
    label: 'Uploading',
    badgeClass: 'bg-blue-50 text-blue-500',
    progressColor: 'blue',
  },
  paused: {
    label: 'Paused',
    badgeClass: 'bg-amber-50 text-amber-500',
    progressColor: 'yellow',
  }, // amber-500 = warning #F59E0B
  completed: {
    label: 'Completed',
    badgeClass: 'bg-emerald-50 text-emerald-500',
    progressColor: 'green',
  }, // emerald-500 = success #10B981
  failed: {
    label: 'Failed',
    badgeClass: 'bg-red-50 text-red-500',
    progressColor: 'red',
  }, // red-500 = error #EF4444
  canceled: {
    label: 'Canceled',
    badgeClass: 'bg-gray-100 text-gray-400',
    progressColor: 'red',
  },
}

// ── Reusable icon button ─────────────────────────────────────────────────────

interface IconButtonProps {
  onClick: () => void
  label: string
  icon: ReactNode
  variant?: 'default' | 'primary' | 'danger'
}

function IconButton({
  onClick,
  label,
  icon,
  variant = 'default',
}: IconButtonProps) {
  const variantClass =
    variant === 'primary'
      ? 'text-blue-500 hover:text-blue-600 hover:bg-blue-50'
      : variant === 'danger'
        ? 'text-gray-400 hover:text-red-500 hover:bg-red-50'
        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'

  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`cursor-pointer w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${variantClass}`}
    >
      {icon}
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function FileUploadCard({
  session,
  speed = 0,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onDismiss,
}: FileUploadCardProps) {
  const { fileDescriptor: file, status, progress, error } = session

  // ── Progress bar visibility ───────────────────────────────────────────────
  // `barFaded` drives the CSS opacity. Keeping the wrapper div mounted at all
  // times (instead of conditionally rendering it) prevents layout shift when
  // the bar disappears.
  const [completedDelay, setCompletedDelay] = useState(false)

  useEffect(() => {
    if (status !== 'completed') return
    const timer = setTimeout(() => setCompletedDelay(true), 1000)
    return () => {
      clearTimeout(timer)
      setCompletedDelay(false)
    }
  }, [status])

  const barFaded =
    status === 'failed' ||
    status === 'canceled' ||
    (status === 'completed' && completedDelay)
  // ─────────────────────────────────────────────────────────────────────────

  const cfg = statusConfig[status]
  const id = session.uploadId || file.id

  const pct = Math.round(progress * 100)
  const uploadedBytes = Math.round(progress * file.size)

  // The bar row is absent only while a file is still queued — once it moves
  // to any other state the row (or its placeholder) stays to prevent shift.
  const hasBarRow = status !== 'queued'
  // Whether to actually render the ProgressBar inside the row.
  const renderBar =
    status === 'uploading' ||
    status === 'paused' ||
    status === 'validating' ||
    status === 'completed'
  const showPct = status === 'uploading' || status === 'paused'
  const showTransferred = status === 'uploading' || status === 'paused'

  const canDismiss =
    status === 'completed' || status === 'canceled' || status === 'failed'
  const canPause = status === 'uploading'
  const canResume = status === 'paused'
  const canCancel = status === 'uploading' || status === 'paused'
  const canRetry = status === 'failed'

  return (
    <article
      className="animate-in flex items-start gap-3 px-4 py-3.5 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
      aria-label={`${file.name} — ${cfg.label}`}
    >
      {/* ── Thumbnail ── */}
      <FileThumbnail
        name={file.name}
        mimeType={file.mimeType}
        src={file.previewUri}
      />

      {/* ── Content ── */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Row 1: filename + badge + dismiss */}
        <div className="flex items-center gap-2">
          <p
            className="flex-1 min-w-0 text-sm font-medium text-gray-800 truncate"
            title={file.name}
          >
            {file.name}
          </p>
          <span
            aria-live="polite"
            className={`shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full ${cfg.badgeClass}`}
          >
            {cfg.label}
          </span>
          {canDismiss && (
            <IconButton
              onClick={() => onDismiss(id)}
              label={`Dismiss ${file.name}`}
              icon={<XMarkIcon />}
            />
          )}
        </div>

        {/* Row 2: meta or error */}
        {error ? (
          <div className="flex items-start gap-1.5">
            <ErrorIcon />
            <p className="text-xs text-red-500 leading-snug">{error}</p>
          </div>
        ) : (
          <p className="text-xs text-gray-600 tabular-nums">
            {showTransferred ? (
              <>
                {formatFileSize(uploadedBytes)}
                <span className="mx-1 text-gray-300">/</span>
                {formatFileSize(file.size)}
                {speed > 512 && (
                  <span className="ml-2 text-gray-500">
                    {formatSpeed(speed)}
                  </span>
                )}
                {showPct && <span className="ml-2 font-medium">{pct}%</span>}
              </>
            ) : (
              <>
                {formatFileSize(file.size)}
                <span className="mx-1.5 text-gray-300">·</span>
                {file.mimeType}
              </>
            )}
          </p>
        )}

        {/* Row 3: progress bar + action buttons inline */}
        {hasBarRow && (
          <div className="flex items-center gap-1.5">
            <div
              className="flex-1 h-1.5 transition-opacity duration-500 ease-out"
              style={{ opacity: barFaded ? 0 : 1 }}
            >
              {renderBar && (
                <ProgressBar
                  progress={status === 'completed' ? 1 : progress}
                  color={cfg.progressColor}
                />
              )}
            </div>

            {canPause && (
              <IconButton
                onClick={() => onPause(id)}
                label={`Pause ${file.name}`}
                icon={<PauseIcon />}
                variant="primary"
              />
            )}
            {canResume && (
              <IconButton
                onClick={() => onResume(id)}
                label={`Resume ${file.name}`}
                icon={<PlayIcon />}
                variant="primary"
              />
            )}
            {canCancel && (
              <IconButton
                onClick={() => onCancel(id)}
                label={`Cancel ${file.name}`}
                icon={<XMarkIcon />}
                variant="danger"
              />
            )}
            {canRetry && (
              <IconButton
                onClick={() => onRetry(id)}
                label={`Retry ${file.name}`}
                icon={<RetryIcon />}
                variant="primary"
              />
            )}
          </div>
        )}
      </div>
    </article>
  )
}
