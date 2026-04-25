import { useUploadManagerContext } from '../context/UploadManagerContext'
import { DropZone } from '../components/DropZone'
import { FileList } from '../components/FileList'
import { UploadControls } from '../components/UploadControls'

export function UploadPage() {
  const {
    snapshot,
    speeds,
    addFiles,
    pause,
    resume,
    cancel,
    retry,
    retryAllFailed,
    dismiss,
    clearAll,
  } = useUploadManagerContext()

  const hasFiles = Object.keys(snapshot.sessions).length > 0

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4">

      {/* Drop zone — full empty-state hero when no files, compact strip otherwise */}
      <DropZone
        onFiles={addFiles}
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
    </main>
  )
}
