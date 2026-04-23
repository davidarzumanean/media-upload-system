import { useUploadManager } from '../hooks/useUploadManager'
import { DropZone } from '../components/DropZone'
import { FileList } from '../components/FileList'
import { UploadControls } from '../components/UploadControls'
import { UploadHistory } from '../components/UploadHistory'

export function UploadPage() {
  const {
    snapshot,
    speeds,
    validationErrors,
    addFiles,
    clearErrors,
    pause,
    resume,
    cancel,
    retry,
    retryAllFailed,
    dismiss,
    clearAll,
    history,
    clearHistory,
  } = useUploadManager()

  const hasFiles = Object.keys(snapshot.sessions).length > 0

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-4">
      {/* Page header */}
      <div className="mb-2">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Upload Media</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {hasFiles
            ? 'Drop more files to add them to the queue.'
            : 'Drop images or videos — uploads start automatically.'}
        </p>
      </div>

      {/* Drop zone — compact when files are already queued */}
      <DropZone
        onFiles={addFiles}
        validationErrors={validationErrors}
        onClearErrors={clearErrors}
        compact={hasFiles}
      />

      {/* Overall progress — only visible while uploads are active */}
      <UploadControls snapshot={snapshot} />

      {/* Per-file queue */}
      {hasFiles && (
        <FileList
          snapshot={snapshot}
          speeds={speeds}
          onPause={pause}
          onResume={resume}
          onCancel={cancel}
          onRetry={retry}
          onRetryAllFailed={retryAllFailed}
          onDismiss={dismiss}
          onClearAll={clearAll}
        />
      )}

      {/* Completed uploads history */}
      <UploadHistory history={history} onClear={clearHistory} />
    </main>
  )
}
