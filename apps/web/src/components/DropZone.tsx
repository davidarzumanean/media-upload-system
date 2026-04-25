import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import clsx from 'clsx'
import { DEFAULT_MAX_SIZE_BYTES, formatFileSize } from '@media-upload/core'

interface DropZoneProps {
  onFiles: (files: File[]) => void
  disabled?: boolean
  compact?: boolean
  maxFiles?: number
}

function UploadCloudIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 512 512"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={32}
      aria-hidden="true"
    >
      <path d="M320,367.79h76c55,0,100-29.21,100-83.6s-53-81.47-96-83.6c-8.89-85.06-71-136.8-144-136.8-69,0-113.44,45.79-128,91.2-60,5.7-112,43.88-112,106.4s54,106.4,120,106.4h56" />
      <polyline points="320 255.79 256 191.79 192 255.79" />
      <line x1="256" y1="448.21" x2="256" y2="207.79" />
    </svg>
  )
}

export function DropZone({
  onFiles,
  disabled,
  compact,
  maxFiles = 10,
}: DropZoneProps) {
  const [rejected, setRejected] = useState(false)

  const onDrop = useCallback(
    (accepted: File[]) => {
      setRejected(false)
      if (accepted.length > 0) onFiles(accepted)
    },
    [onFiles],
  )

  const onDropRejected = useCallback(() => {
    setRejected(true)
    setTimeout(() => setRejected(false), 1500)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: { 'image/*': [], 'video/*': [] },
    maxFiles,
    disabled,
  })

  return (
    <div className="space-y-3">
      {compact ? (
        <div
          {...getRootProps()}
          role="button"
          aria-label="Add more files"
          className={clsx(
            'flex items-center justify-center gap-2 rounded-xl border border-dashed py-2.5 cursor-pointer transition-all duration-150',
            isDragActive && !rejected && 'border-blue-400 bg-blue-50',
            rejected && 'border-red-400 bg-red-50',
            !isDragActive &&
              !rejected &&
              'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          <input {...getInputProps()} />
          <div
            className={clsx(
              'w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors',
              isDragActive && !rejected
                ? 'bg-blue-200'
                : rejected
                  ? 'bg-red-100'
                  : 'bg-blue-100',
            )}
          >
            <svg
              className={clsx(
                'w-3 h-3',
                isDragActive && !rejected
                  ? 'text-blue-600'
                  : rejected
                    ? 'text-red-500'
                    : 'text-blue-500',
              )}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
          </div>
          <span
            className={clsx(
              'text-sm transition-colors',
              isDragActive && !rejected
                ? 'text-blue-600 font-medium'
                : rejected
                  ? 'text-red-600 font-medium'
                  : 'text-gray-400',
            )}
          >
            {isDragActive && !rejected
              ? 'Drop to add more files'
              : rejected
                ? `Only images & videos, max ${maxFiles} files`
                : 'Add more files'}
          </span>
        </div>
      ) : (
        <div
          {...getRootProps()}
          role="button"
          aria-label="Upload files — drop or click to browse"
          className={clsx(
            'relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 py-14 text-center cursor-pointer transition-all duration-200',
            isDragActive &&
              !rejected &&
              'border-blue-400 bg-blue-50 scale-[1.01]',
            rejected && 'border-red-400 bg-red-50',
            !isDragActive &&
              !rejected &&
              'border-gray-200 bg-gray-50/80 hover:border-blue-300 hover:bg-blue-50/40',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          <input {...getInputProps()} />

          <div
            className={clsx(
              'w-22 h-22 rounded-[22px] flex items-center justify-center transition-colors',
              isDragActive && !rejected
                ? 'bg-blue-100'
                : rejected
                  ? 'bg-red-100'
                  : 'bg-blue-50',
            )}
          >
            <UploadCloudIcon
              className={clsx(
                'w-11 h-11',
                isDragActive && !rejected
                  ? 'text-blue-500'
                  : rejected
                    ? 'text-red-500'
                    : 'text-blue-400',
              )}
            />
          </div>

          {isDragActive && !rejected ? (
            <p className="text-blue-600 font-semibold text-base">
              Drop files here
            </p>
          ) : rejected ? (
            <p className="text-red-600 font-medium">
              Only images & videos — max {maxFiles} files
            </p>
          ) : (
            <div className="space-y-1.5">
              <p className="text-gray-800 font-semibold">
                Drop files here or <span className="text-blue-600">browse</span>
              </p>
              <p className="text-gray-400 text-sm">
                Images & videos · up to {maxFiles} files ·{' '}
                {formatFileSize(DEFAULT_MAX_SIZE_BYTES)} each
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
