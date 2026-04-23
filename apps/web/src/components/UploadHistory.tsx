import type { HistoryEntry } from '../hooks/useUploadManager'
import { formatFileSize, formatDate } from '@media-upload/core'

interface UploadHistoryProps {
  history: HistoryEntry[]
  onClear: () => void
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

export function UploadHistory({ history, onClear }: UploadHistoryProps) {
  if (history.length === 0) return null

  return (
    <section aria-label="Upload history" className="animate-in bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          History
          <span className="ml-2 font-normal text-gray-400 normal-case tracking-normal">
            {history.length} file{history.length !== 1 ? 's' : ''}
          </span>
        </h2>
        <button
          onClick={onClear}
          className="cursor-pointer text-xs text-gray-400 hover:text-red-500 transition-colors"
          aria-label="Clear upload history"
        >
          Clear all
        </button>
      </div>

      <ul className="divide-y divide-gray-50" role="list">
        {history.map((entry) => (
          <li
            key={`${entry.id}-${entry.completedAt}`}
            className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/60 transition-colors"
          >
            <CheckIcon />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 truncate font-medium" title={entry.name}>
                {entry.name}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {formatFileSize(entry.size)} · {entry.mimeType}
              </p>
            </div>
            <time
              dateTime={entry.completedAt}
              className="text-xs text-gray-400 shrink-0 tabular-nums"
            >
              {formatDate(entry.completedAt)}
            </time>
          </li>
        ))}
      </ul>
    </section>
  )
}
