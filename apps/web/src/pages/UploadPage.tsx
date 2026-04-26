import { useEffect } from 'react'
import { useUploadManagerContext } from '../context/UploadManagerContext'
import { DropZone } from '../components/DropZone'
import { FileList } from '../components/FileList'
import { UploadControls } from '../components/UploadControls'
import { DEFAULT_MAX_FILES } from '@media-upload/core'

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
    clearAllUploads,
    clearTerminalSessions,
  } = useUploadManagerContext()

  // On unmount (navigating away), remove completed/failed/canceled sessions so
  // their revoked blob preview URLs don't cause ERR_FILE_NOT_FOUND on return.
  useEffect(() => {
    return () => clearTerminalSessions()
  }, [clearTerminalSessions])

  const hasFiles = Object.keys(snapshot.sessions).length > 0

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      {/* Drop zone — full empty-state hero when no files, compact strip otherwise */}
      <DropZone
        onFiles={addFiles}
        compact={hasFiles}
        maxFiles={DEFAULT_MAX_FILES}
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
          onClearAll={clearAllUploads}
        />
      )}
    </main>
  )
}
