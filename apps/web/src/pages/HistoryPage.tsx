import { formatFileSize, formatDate } from '@media-upload/core'
import { useUploadManagerContext } from '../context/UploadManagerContext'
import { BASE_URL } from '../lib/api-client.ts'
import { ClockIcon } from '../components/icons/ClockIcon.tsx'
import { CheckIcon } from '../components/icons/CheckIcon.tsx'
import { FileThumbnail } from '../components/FileThumbnail.tsx'

// ── Page ─────────────────────────────────────────────────────────────────────

export function HistoryPage() {
  const { history, clearHistory } = useUploadManagerContext()

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">
            Upload History
          </h1>
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
                <FileThumbnail
                  name={entry.name}
                  mimeType={entry.mimeType}
                  src={`${BASE_URL}/uploads/${entry.id}/file`}
                />

                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm text-gray-800 font-medium truncate"
                    title={entry.name}
                  >
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
