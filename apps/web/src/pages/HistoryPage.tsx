import { useState } from 'react'
import { formatFileSize, formatDate } from '@media-upload/core'
import { useUploadManagerContext } from '../context/UploadManagerContext'
import type { HistoryEntry } from '../hooks/useUploadManager'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

// ── Icons ────────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function ImageIcon() {
  return (
    <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  )
}

function FilmIcon() {
  return (
    <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75.125v-5.25m0 5.25A1.125 1.125 0 013.375 19.5M3.375 14.25v-2.625M21 19.5h-1.5A1.125 1.125 0 0118 18.375M21 19.5v-5.25m0 5.25a1.125 1.125 0 001.125-1.125M21 14.25v-2.625m0 0A1.125 1.125 0 0019.875 10.5h-15.75A1.125 1.125 0 003.375 11.625m16.5 0v2.625m0-2.625A1.125 1.125 0 0121 10.5M3.375 11.625v2.625M6 10.5V6.75m0 3.75h12m-12 0V6.75m12 3.75V6.75M6 6.75A1.125 1.125 0 017.125 5.625h9.75A1.125 1.125 0 0118 6.75" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg className="w-10 h-10 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

// ── Thumbnail ─────────────────────────────────────────────────────────────────

function EntryThumbnail({ entry }: { entry: HistoryEntry }) {
  const [imgError, setImgError] = useState(false)
  const isImage = entry.mimeType.startsWith('image/')

  return (
    <div className="w-10 h-10 shrink-0 rounded-lg overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center">
      {isImage && !imgError ? (
        <img
          src={`${API_BASE_URL}/uploads/${entry.id}/file`}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : isImage ? (
        <ImageIcon />
      ) : (
        <FilmIcon />
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function HistoryPage() {
  const { history, clearHistory } = useUploadManagerContext()

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Upload History</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {history.length > 0
              ? `${history.length} file${history.length !== 1 ? 's' : ''} uploaded this session`
              : 'No uploads yet'}
          </p>
        </div>
        {history.length > 0 && (
          <button
            onClick={clearHistory}
            className="cursor-pointer text-sm text-gray-400 hover:text-red-500 transition-colors"
            aria-label="Clear upload history"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Empty state */}
      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <ClockIcon />
          <p className="text-sm text-gray-400">
            Completed uploads will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <ul className="divide-y divide-gray-50" role="list">
            {history.map((entry) => (
              <li
                key={`${entry.id}-${entry.completedAt}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60 transition-colors"
              >
                <EntryThumbnail entry={entry} />

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 font-medium truncate" title={entry.name}>
                    {entry.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 tabular-nums">
                    {formatFileSize(entry.size)}
                    <span className="mx-1.5 text-gray-200">·</span>
                    {entry.mimeType}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <CheckIcon />
                  <time
                    dateTime={entry.completedAt}
                    className="text-xs text-gray-400 tabular-nums"
                  >
                    {formatDate(entry.completedAt)}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  )
}
