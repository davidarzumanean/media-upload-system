import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import type { ValidationError } from '@media-upload/core'
import clsx from 'clsx'

interface DropZoneProps {
  onFiles: (files: File[]) => void
  validationErrors: ValidationError[]
  onClearErrors: () => void
  disabled?: boolean
  /** Render as a compact "Add more" strip when the file list is already visible */
  compact?: boolean
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  )
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  )
}

export function DropZone({ onFiles, validationErrors, onClearErrors, disabled, compact }: DropZoneProps) {
  const [rejected, setRejected] = useState(false)

  const onDrop = useCallback(
    (accepted: File[]) => {
      setRejected(false)
      if (accepted.length > 0) {
        onClearErrors()
        onFiles(accepted)
      }
    },
    [onFiles, onClearErrors],
  )

  const onDropRejected = useCallback(() => {
    setRejected(true)
    setTimeout(() => setRejected(false), 1500)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: { 'image/*': [], 'video/*': [] },
    maxFiles: 10,
    disabled,
  })

  return (
    <div className="space-y-3">
      {compact ? (
        /* ── Compact strip shown after files are added ── */
        <div
          {...getRootProps()}
          role="button"
          aria-label="Add more files"
          className={clsx(
            'flex items-center justify-center gap-2 rounded-xl border border-dashed py-2.5 cursor-pointer transition-all duration-150',
            isDragActive && !rejected && 'border-blue-400 bg-blue-50',
            rejected && 'border-red-400 bg-red-50',
            !isDragActive && !rejected && 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          <input {...getInputProps()} />
          <div className={clsx(
            'w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors',
            isDragActive && !rejected ? 'bg-blue-200' : rejected ? 'bg-red-100' : 'bg-blue-100',
          )}>
            <svg
              className={clsx('w-3 h-3', isDragActive && !rejected ? 'text-blue-600' : rejected ? 'text-red-500' : 'text-blue-500')}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <span className={clsx(
            'text-sm transition-colors',
            isDragActive && !rejected ? 'text-blue-600 font-medium' : rejected ? 'text-red-600 font-medium' : 'text-gray-400',
          )}>
            {isDragActive && !rejected
              ? 'Drop to add more files'
              : rejected
              ? 'Only images & videos, max 10 files'
              : 'Add more files'}
          </span>
        </div>
      ) : (
        /* ── Full drop zone for empty state ── */
        <div
          {...getRootProps()}
          role="button"
          aria-label="Upload files — drop or click to browse"
          className={clsx(
            'relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 py-14 text-center cursor-pointer transition-all duration-200',
            isDragActive && !rejected && 'border-blue-400 bg-blue-50 scale-[1.01]',
            rejected && 'border-red-400 bg-red-50',
            !isDragActive && !rejected && 'border-gray-200 bg-gray-50/80 hover:border-blue-300 hover:bg-blue-50/40',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          <input {...getInputProps()} />

          <div
            className={clsx(
              'flex items-center justify-center w-16 h-16 rounded-2xl transition-colors',
              isDragActive && !rejected ? 'bg-blue-100' : rejected ? 'bg-red-100' : 'bg-white shadow-sm border border-gray-100',
            )}
          >
            <UploadIcon
              className={clsx(
                'w-8 h-8',
                isDragActive && !rejected ? 'text-blue-500' : rejected ? 'text-red-500' : 'text-gray-300',
              )}
            />
          </div>

          {isDragActive && !rejected ? (
            <p className="text-blue-600 font-semibold text-base">Drop files here</p>
          ) : rejected ? (
            <p className="text-red-600 font-medium">Only images & videos — max 10 files</p>
          ) : (
            <div className="space-y-1.5">
              <p className="text-gray-800 font-semibold">Drop files here or <span className="text-blue-600">browse</span></p>
              <p className="text-gray-400 text-sm">Images & videos · up to 10 files · 100 MB each</p>
            </div>
          )}
        </div>
      )}

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div role="alert" className="animate-in-down rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <AlertIcon className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-700 mb-1">
                {validationErrors.length} file{validationErrors.length > 1 ? 's' : ''} rejected
              </p>
              <ul className="space-y-0.5">
                {validationErrors.map((err) => (
                  <li key={err.fileId} className="text-xs text-red-600 truncate">
                    <span className="font-medium">{err.fileName}</span> — {err.reason}
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={onClearErrors}
              aria-label="Dismiss validation errors"
              className="cursor-pointer shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-red-300 hover:text-red-500 hover:bg-red-100 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
