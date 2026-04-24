import { useState, useEffect } from 'react'
import type { UploadSession, UploadStatus } from '@media-upload/core'
import { formatFileSize, formatSpeed } from '@media-upload/core'
import { ProgressBar } from './ProgressBar'

interface FilePreviewProps {
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
  { label: string; badgeClass: string; progressColor: 'blue' | 'green' | 'yellow' | 'red' }
> = {
  queued:     { label: 'Starting…',  badgeClass: 'bg-blue-50 text-blue-500',        progressColor: 'blue'   },
  validating: { label: 'Starting…',  badgeClass: 'bg-blue-50 text-blue-500',        progressColor: 'blue'   },
  uploading:  { label: 'Uploading',  badgeClass: 'bg-blue-50 text-blue-500',        progressColor: 'blue'   },
  paused:     { label: 'Paused',     badgeClass: 'bg-amber-50 text-amber-500',      progressColor: 'yellow' }, // amber-500 = warning #F59E0B
  completed:  { label: 'Completed',  badgeClass: 'bg-emerald-50 text-emerald-500',  progressColor: 'green'  }, // emerald-500 = success #10B981
  failed:     { label: 'Failed',     badgeClass: 'bg-red-50 text-red-500',          progressColor: 'red'    }, // red-500 = error #EF4444
  canceled:   { label: 'Canceled',   badgeClass: 'bg-gray-100 text-gray-400',       progressColor: 'red'    },
}

// ── Icon components ──────────────────────────────────────────────────────────

function ImageIcon() {
  return (
    <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  )
}

function FilmIcon() {
  return (
    <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75.125v-5.25m0 5.25A1.125 1.125 0 013.375 19.5M3.375 14.25v-2.625M21 19.5h-1.5A1.125 1.125 0 0118 18.375M21 19.5v-5.25m0 5.25a1.125 1.125 0 001.125-1.125M21 14.25v-2.625m0 0A1.125 1.125 0 0019.875 10.5h-15.75A1.125 1.125 0 003.375 11.625m16.5 0v2.625m0-2.625A1.125 1.125 0 0121 10.5M3.375 11.625v2.625M6 10.5V6.75m0 3.75h12m-12 0V6.75m12 3.75V6.75M6 6.75A1.125 1.125 0 017.125 5.625h9.75A1.125 1.125 0 0118 6.75" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0A.75.75 0 0 1 15 4.5h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z" clipRule="evenodd" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
    </svg>
  )
}

function RetryIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  )
}

function XMarkIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg className="w-3 h-3 text-red-400 shrink-0 mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  )
}

// ── Reusable icon button ─────────────────────────────────────────────────────

interface IconButtonProps {
  onClick: () => void
  label: string
  icon: React.ReactNode
  variant?: 'default' | 'primary' | 'danger'
}

function IconButton({ onClick, label, icon, variant = 'default' }: IconButtonProps) {
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

export function FilePreview({ session, speed = 0, onPause, onResume, onCancel, onRetry, onDismiss }: FilePreviewProps) {
  const { fileDescriptor: file, status, progress, error } = session
  const [imgError, setImgError] = useState(false)

  // ── Progress bar visibility ───────────────────────────────────────────────
  // `barFaded` drives the CSS opacity. Keeping the wrapper div mounted at all
  // times (instead of conditionally rendering it) prevents layout shift when
  // the bar disappears.
  const [barFaded, setBarFaded] = useState(false)

  useEffect(() => {
    if (status === 'completed') {
      // Hold at 100% for 1 s, then trigger the 500 ms CSS fade-out.
      const timer = setTimeout(() => setBarFaded(true), 1000)
      return () => clearTimeout(timer)
    }
    // failed / canceled: fade out immediately (no delay).
    // Any active state: ensure the bar is visible (handles retry resetting status).
    setBarFaded(status === 'failed' || status === 'canceled')
  }, [status])
  // ─────────────────────────────────────────────────────────────────────────

  const cfg = statusConfig[status]
  const isImage = file.mimeType.startsWith('image/')
  const id = session.uploadId || file.id

  const pct = Math.round(progress * 100)
  const uploadedBytes = Math.round(progress * file.size)

  // The bar row is absent only while a file is still queued — once it moves
  // to any other state the row (or its placeholder) stays to prevent shift.
  const hasBarRow = status !== 'queued'
  // Whether to actually render the ProgressBar inside the row.
  const renderBar =
    status === 'uploading' || status === 'paused' || status === 'validating' || status === 'completed'
  const showPct = status === 'uploading' || status === 'paused'
  const showTransferred = status === 'uploading' || status === 'paused'
  const isDone = status === 'completed' || status === 'canceled' || status === 'failed'

  return (
    <article
      className="animate-in flex items-start gap-3 px-4 py-3.5 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
      aria-label={`${file.name} — ${cfg.label}`}
    >
      {/* ── Thumbnail ── */}
      <div className="w-10 h-10 shrink-0 rounded-lg overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center mt-0.5">
        {isImage && file.previewUri && !imgError ? (
          <img
            src={file.previewUri}
            alt={`Preview of ${file.name}`}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : isImage ? (
          <ImageIcon />
        ) : (
          <FilmIcon />
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 min-w-0 space-y-1">

        {/* Row 1: filename + badge + dismiss */}
        <div className="flex items-center gap-2">
          <p className="flex-1 min-w-0 text-sm font-medium text-gray-800 truncate" title={file.name}>
            {file.name}
          </p>
          <span
            aria-live="polite"
            className={`shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full ${cfg.badgeClass}`}
          >
            {cfg.label}
          </span>
          {isDone && status !== 'failed' && (
            <IconButton
              onClick={() => onDismiss(id)}
              label={`Dismiss ${file.name}`}
              icon={<XMarkIcon />}
            />
          )}
          {status === 'failed' && (
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
                  <span className="ml-2 text-gray-500">{formatSpeed(speed)}</span>
                )}
                {showPct && (
                  <span className="ml-2 font-medium">{pct}%</span>
                )}
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

            {status === 'uploading' && (
              <>
                <IconButton
                  onClick={() => onPause(id)}
                  label={`Pause ${file.name}`}
                  icon={<PauseIcon />}
                  variant="primary"
                />
                <IconButton
                  onClick={() => onCancel(id)}
                  label={`Cancel ${file.name}`}
                  icon={<XMarkIcon />}
                  variant="danger"
                />
              </>
            )}
            {status === 'paused' && (
              <>
                <IconButton
                  onClick={() => onResume(id)}
                  label={`Resume ${file.name}`}
                  icon={<PlayIcon />}
                  variant="primary"
                />
                <IconButton
                  onClick={() => onCancel(id)}
                  label={`Cancel ${file.name}`}
                  icon={<XMarkIcon />}
                  variant="danger"
                />
              </>
            )}
            {status === 'failed' && (
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
