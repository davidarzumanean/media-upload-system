import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUploadManager } from '../useUploadManager'
import { UploadManager } from '@media-upload/core'

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

// Mock UploadManager so we can inspect calls (addFiles, remove, getSnapshot…)
// while keeping the real validateFiles, types, etc.
// Arrow functions cannot be constructors — the factory must use `function`.
vi.mock('@media-upload/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@media-upload/core')>()
  const mockInstance = {
    setOnChange: vi.fn(),
    addFiles: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    resume: vi.fn(),
    cancel: vi.fn().mockResolvedValue(undefined),
    retry: vi.fn(),
    remove: vi.fn(),
    getSnapshot: vi.fn().mockReturnValue({ sessions: {} }),
  }
  // eslint-disable-next-line prefer-arrow-callback
  return { ...actual, UploadManager: vi.fn(function () { return mockInstance }) }
})

vi.mock('../../lib/api-client', () => ({
  createApiClient: () => ({
    initiate: vi
      .fn()
      .mockResolvedValue({ uploadId: 'server-uid', totalChunks: 1 }),
    uploadChunk: vi.fn().mockResolvedValue(undefined),
    finalize: vi.fn().mockResolvedValue(undefined),
    getStatus: vi.fn().mockResolvedValue({ status: 'uploading' }),
    cancel: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('../../lib/chunk-reader', () => ({
  registerFile: vi.fn(),
  unregisterFile: vi.fn(),
  chunkReader: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
}))

import { unregisterFile } from '../../lib/chunk-reader'

function getMockInstance() {
  return vi.mocked(UploadManager).mock.results[0]?.value as {
    setOnChange: ReturnType<typeof vi.fn>
    remove: ReturnType<typeof vi.fn>
    getSnapshot: ReturnType<typeof vi.fn>
  }
}

// jsdom doesn't implement these; provide stubs
vi.stubGlobal('URL', {
  createObjectURL: vi.fn(() => 'blob:test-preview-url'),
  revokeObjectURL: vi.fn(),
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeImageFile(name = 'photo.jpg') {
  return new File(['img-content'], name, { type: 'image/jpeg' })
}

function makeVideoFile(name = 'clip.mp4') {
  return new File(['vid-content'], name, { type: 'video/mp4' })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useUploadManager', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('returns an initial empty snapshot', () => {
    const { result } = renderHook(() => useUploadManager())
    expect(result.current.snapshot.sessions).toEqual({})
    expect(result.current.speeds).toEqual({})
    expect(result.current.history).toEqual([])
  })

  it('addFiles synchronously injects a queued session for each file', () => {
    const { result } = renderHook(() => useUploadManager())

    act(() => {
      result.current.addFiles([makeImageFile('a.jpg'), makeVideoFile('b.mp4')])
    })

    const sessions = Object.values(result.current.snapshot.sessions)
    expect(sessions).toHaveLength(2)
    expect(sessions.map((s) => s.fileDescriptor.name).sort()).toEqual([
      'a.jpg',
      'b.mp4',
    ])
    // All injected as 'queued' before the async manager work runs
    expect(sessions.every((s) => s.status === 'queued')).toBe(true)
  })

  it('addFiles stores file descriptors with correct metadata', () => {
    const { result } = renderHook(() => useUploadManager())
    const file = makeImageFile('hero.jpg')

    act(() => {
      result.current.addFiles([file])
    })

    const session = Object.values(result.current.snapshot.sessions)[0]
    expect(session.fileDescriptor.name).toBe('hero.jpg')
    expect(session.fileDescriptor.size).toBe(file.size)
    expect(session.fileDescriptor.mimeType).toBe('image/jpeg')
    // A blob preview URL should have been created for the image
    expect(session.fileDescriptor.previewUri).toBe('blob:test-preview-url')
  })

  it('addFiles does not create a previewUri for non-image files', () => {
    const { result } = renderHook(() => useUploadManager())

    act(() => {
      result.current.addFiles([makeVideoFile()])
    })

    const session = Object.values(result.current.snapshot.sessions)[0]
    expect(session.fileDescriptor.previewUri).toBeUndefined()
  })

  it('dismiss hides a session from the snapshot', async () => {
    const { result } = renderHook(() => useUploadManager())

    act(() => {
      result.current.addFiles([makeImageFile()])
    })

    const id = Object.keys(result.current.snapshot.sessions)[0]

    act(() => {
      result.current.dismiss(id)
    })

    expect(result.current.snapshot.sessions[id]).toBeUndefined()
  })

  it('clearHistory empties the history list and localStorage', () => {
    localStorage.setItem(
      'media-upload-history',
      JSON.stringify([
        {
          id: '1',
          name: 'old.jpg',
          size: 100,
          mimeType: 'image/jpeg',
          completedAt: '2024-01-01T00:00:00Z',
        },
      ]),
    )

    const { result } = renderHook(() => useUploadManager())

    // history should be pre-populated from localStorage
    expect(result.current.history).toHaveLength(1)

    act(() => {
      result.current.clearHistory()
    })

    expect(result.current.history).toHaveLength(0)
    expect(localStorage.getItem('media-upload-history')).toBeNull()
  })

  it('loads persisted history from localStorage on mount', () => {
    const entry = {
      id: 'uid-1',
      name: 'restored.mp4',
      size: 4096,
      mimeType: 'video/mp4',
      completedAt: '2024-06-01T10:00:00Z',
    }
    localStorage.setItem('media-upload-history', JSON.stringify([entry]))

    const { result } = renderHook(() => useUploadManager())
    expect(result.current.history[0].name).toBe('restored.mp4')
  })

  it('clearTerminalSessions removes completed, failed, and canceled sessions but leaves active ones', () => {
    const { result } = renderHook(() => useUploadManager())
    const instance = getMockInstance()

    instance.getSnapshot.mockReturnValue({
      sessions: {
        'cmp-1': { status: 'completed', fileDescriptor: { id: 'cmp-1' } },
        'fld-1': { status: 'failed',    fileDescriptor: { id: 'fld-1' } },
        'cnc-1': { status: 'canceled',  fileDescriptor: { id: 'cnc-1' } },
        'upl-1': { status: 'uploading', fileDescriptor: { id: 'upl-1' } },
        'psd-1': { status: 'paused',    fileDescriptor: { id: 'psd-1' } },
      },
    })

    act(() => {
      result.current.clearTerminalSessions()
    })

    expect(instance.remove).toHaveBeenCalledTimes(3)
    expect(instance.remove).toHaveBeenCalledWith('cmp-1')
    expect(instance.remove).toHaveBeenCalledWith('fld-1')
    expect(instance.remove).toHaveBeenCalledWith('cnc-1')
    expect(instance.remove).not.toHaveBeenCalledWith('upl-1')
    expect(instance.remove).not.toHaveBeenCalledWith('psd-1')
  })

  it('does not throw when unmounted while idle', () => {
    const { unmount } = renderHook(() => useUploadManager())
    expect(() => unmount()).not.toThrow()
  })

  it('does not throw when unmounted after files are added', () => {
    const { result, unmount } = renderHook(() => useUploadManager())

    act(() => {
      result.current.addFiles([makeImageFile()])
    })

    expect(() => unmount()).not.toThrow()
  })

  // ── clearAll ──────────────────────────────────────────────────────────────

  it('clearAll hides all sessions including active ones', () => {
    const { result } = renderHook(() => useUploadManager())
    const instance = getMockInstance()

    instance.getSnapshot.mockReturnValue({
      sessions: {
        'upl-1': { status: 'uploading', fileDescriptor: { id: 'upl-1' } },
        'cmp-1': { status: 'completed', fileDescriptor: { id: 'cmp-1' } },
        'psd-1': { status: 'paused',    fileDescriptor: { id: 'psd-1' } },
      },
    })

    act(() => {
      result.current.clearAll()
    })

    // All three must be absent from the visible snapshot
    expect(result.current.snapshot.sessions['upl-1']).toBeUndefined()
    expect(result.current.snapshot.sessions['cmp-1']).toBeUndefined()
    expect(result.current.snapshot.sessions['psd-1']).toBeUndefined()
  })

  it('clearAll removes terminal sessions from manager but not active ones', () => {
    const { result } = renderHook(() => useUploadManager())
    const instance = getMockInstance()

    instance.getSnapshot.mockReturnValue({
      sessions: {
        'cmp-1': { status: 'completed', fileDescriptor: { id: 'cmp-1' } },
        'fld-1': { status: 'failed',    fileDescriptor: { id: 'fld-1' } },
        'cnc-1': { status: 'canceled',  fileDescriptor: { id: 'cnc-1' } },
        'upl-1': { status: 'uploading', fileDescriptor: { id: 'upl-1' } },
        'psd-1': { status: 'paused',    fileDescriptor: { id: 'psd-1' } },
      },
    })

    act(() => {
      result.current.clearAll()
    })

    expect(instance.remove).toHaveBeenCalledTimes(3)
    expect(instance.remove).toHaveBeenCalledWith('cmp-1')
    expect(instance.remove).toHaveBeenCalledWith('fld-1')
    expect(instance.remove).toHaveBeenCalledWith('cnc-1')
    expect(instance.remove).not.toHaveBeenCalledWith('upl-1')
    expect(instance.remove).not.toHaveBeenCalledWith('psd-1')
  })

  it('clearAll on empty snapshot does not throw', () => {
    const { result } = renderHook(() => useUploadManager())
    const instance = getMockInstance()
    instance.getSnapshot.mockReturnValue({ sessions: {} })

    expect(() => {
      act(() => { result.current.clearAll() })
    }).not.toThrow()
    expect(instance.remove).not.toHaveBeenCalled()
  })

  it('clearAll deduplicates hidden ids when called twice', () => {
    const { result } = renderHook(() => useUploadManager())
    const instance = getMockInstance()

    instance.getSnapshot.mockReturnValue({
      sessions: {
        'cmp-1': { status: 'completed', fileDescriptor: { id: 'cmp-1' } },
      },
    })

    act(() => { result.current.clearAll() })
    // After first call, session is removed from manager — second call sees empty snapshot
    instance.getSnapshot.mockReturnValue({ sessions: {} })
    act(() => { result.current.clearAll() })

    // remove called only once (only on first call when session existed)
    expect(instance.remove).toHaveBeenCalledTimes(1)
  })

  // ── retryAllFailed ────────────────────────────────────────────────────────

  it('retryAllFailed calls manager.retry for every failed session only', () => {
    const { result } = renderHook(() => useUploadManager())
    const instance = getMockInstance() as ReturnType<typeof getMockInstance> & {
      retry: ReturnType<typeof vi.fn>
    }

    instance.getSnapshot.mockReturnValue({
      sessions: {
        'failed-1': { status: 'failed', fileDescriptor: { id: 'failed-1' } },
        'failed-2': { status: 'failed', fileDescriptor: { id: 'failed-2' } },
        'uploading-1': { status: 'uploading', fileDescriptor: { id: 'uploading-1' } },
      },
    })

    act(() => {
      result.current.retryAllFailed()
    })

    expect(instance.retry).toHaveBeenCalledTimes(2)
    expect(instance.retry).toHaveBeenCalledWith('failed-1')
    expect(instance.retry).toHaveBeenCalledWith('failed-2')
    expect(instance.retry).not.toHaveBeenCalledWith('uploading-1')
  })

  // ── speed tracking ────────────────────────────────────────────────────────

  it('reports initial speed of 0 for a new uploading session', () => {
    const { result } = renderHook(() => useUploadManager())
    const instance = getMockInstance()
    const onChange: (snap: unknown) => void = instance.setOnChange.mock.calls[0][0]

    act(() => {
      onChange({
        sessions: {
          'uid-1': {
            uploadId: 'uid-1',
            fileDescriptor: { id: 'fd-1', name: 'a.jpg', size: 1_000_000, mimeType: 'image/jpeg' },
            totalChunks: 10,
            uploadedChunks: [],
            status: 'uploading',
            progress: 0,
            retries: {},
          },
        },
      })
    })

    expect(result.current.speeds['uid-1']).toBe(0)
  })

  it('applies exponential smoothing after subsequent upload events', () => {
    vi.useFakeTimers()
    const t0 = new Date('2024-01-01T00:00:00.000Z')
    vi.setSystemTime(t0)

    const { result } = renderHook(() => useUploadManager())
    const instance = getMockInstance()
    const onChange: (snap: unknown) => void = instance.setOnChange.mock.calls[0][0]

    const baseSession = {
      uploadId: 'uid-1',
      fileDescriptor: { id: 'fd-1', name: 'a.jpg', size: 1_000_000, mimeType: 'image/jpeg' },
      totalChunks: 10,
      uploadedChunks: [],
      status: 'uploading',
      retries: {},
    }

    // Baseline at 0%
    act(() => {
      onChange({ sessions: { 'uid-1': { ...baseSession, progress: 0 } } })
    })
    expect(result.current.speeds['uid-1']).toBe(0)

    // 1 second later, 50% progress = 500 KB uploaded
    vi.setSystemTime(new Date(t0.getTime() + 1000))
    act(() => {
      onChange({ sessions: { 'uid-1': { ...baseSession, progress: 0.5 } } })
    })

    // instant = 500_000 B/s; smoothed = 0 * 0.6 + 500_000 * 0.4 = 200_000
    expect(result.current.speeds['uid-1']).toBeCloseTo(200_000, -2)

    vi.useRealTimers()
  })

  // ── history persistence ───────────────────────────────────────────────────

  it('saves completed upload to localStorage history', () => {
    const { result } = renderHook(() => useUploadManager())
    const instance = getMockInstance()
    const onChange: (snap: unknown) => void = instance.setOnChange.mock.calls[0][0]

    act(() => {
      onChange({
        sessions: {
          'uid-done': {
            uploadId: 'uid-done',
            fileDescriptor: { id: 'fd-1', name: 'photo.jpg', size: 100, mimeType: 'image/jpeg' },
            totalChunks: 1,
            uploadedChunks: [0],
            status: 'completed',
            progress: 1,
            retries: {},
          },
        },
      })
    })

    expect(result.current.history).toHaveLength(1)
    expect(result.current.history[0].id).toBe('uid-done')
    expect(result.current.history[0].name).toBe('photo.jpg')

    const stored = JSON.parse(localStorage.getItem('media-upload-history')!)
    expect(stored[0].name).toBe('photo.jpg')
  })

  it('does not duplicate a session that is already in history', () => {
    const { result } = renderHook(() => useUploadManager())
    const instance = getMockInstance()
    const onChange: (snap: unknown) => void = instance.setOnChange.mock.calls[0][0]

    const completedSnap = {
      sessions: {
        'uid-done': {
          uploadId: 'uid-done',
          fileDescriptor: { id: 'fd-1', name: 'photo.jpg', size: 100, mimeType: 'image/jpeg' },
          totalChunks: 1,
          uploadedChunks: [0],
          status: 'completed',
          progress: 1,
          retries: {},
        },
      },
    }

    act(() => { onChange(completedSnap) })
    act(() => { onChange(completedSnap) })

    expect(result.current.history).toHaveLength(1)
  })

  // ── preview URL revocation ────────────────────────────────────────────────

  it('revokes the object URL when a session reaches a terminal status', () => {
    const { result } = renderHook(() => useUploadManager())
    const instance = getMockInstance()
    const onChange: (snap: unknown) => void = instance.setOnChange.mock.calls[0][0]

    act(() => {
      result.current.addFiles([makeImageFile('hero.jpg')])
    })

    const session = Object.values(result.current.snapshot.sessions)[0]
    const { id: fileId, previewUri } = session.fileDescriptor
    expect(previewUri).toBe('blob:test-preview-url')

    act(() => {
      onChange({
        sessions: {
          'server-uid': {
            uploadId: 'server-uid',
            fileDescriptor: {
              id: fileId,
              name: 'hero.jpg',
              size: 11,
              mimeType: 'image/jpeg',
              previewUri,
            },
            totalChunks: 1,
            uploadedChunks: [0],
            status: 'completed',
            progress: 1,
            retries: {},
          },
        },
      })
    })

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-preview-url')
  })

  it('should revoke blob URL and unregister file on completed status', () => {
    const { result } = renderHook(() => useUploadManager())
    const instance = getMockInstance()
    const onChange: (snap: unknown) => void = instance.setOnChange.mock.calls[0][0]

    act(() => { result.current.addFiles([makeImageFile('hero.jpg')]) })

    const session = Object.values(result.current.snapshot.sessions)[0]
    const { id: fileId, previewUri } = session.fileDescriptor

    act(() => {
      onChange({
        sessions: {
          'server-uid': {
            uploadId: 'server-uid',
            fileDescriptor: { id: fileId, name: 'hero.jpg', size: 11, mimeType: 'image/jpeg', previewUri },
            totalChunks: 1, uploadedChunks: [0], status: 'completed', progress: 1, retries: {},
          },
        },
      })
    })

    expect(URL.revokeObjectURL).toHaveBeenCalledWith(previewUri)
    expect(vi.mocked(unregisterFile)).toHaveBeenCalledWith(fileId)
  })

  it('should revoke blob URL and unregister file on canceled status', () => {
    const { result } = renderHook(() => useUploadManager())
    const instance = getMockInstance()
    const onChange: (snap: unknown) => void = instance.setOnChange.mock.calls[0][0]

    act(() => { result.current.addFiles([makeImageFile('hero.jpg')]) })

    const session = Object.values(result.current.snapshot.sessions)[0]
    const { id: fileId, previewUri } = session.fileDescriptor

    act(() => {
      onChange({
        sessions: {
          'server-uid': {
            uploadId: 'server-uid',
            fileDescriptor: { id: fileId, name: 'hero.jpg', size: 11, mimeType: 'image/jpeg', previewUri },
            totalChunks: 1, uploadedChunks: [], status: 'canceled', progress: 0, retries: {},
          },
        },
      })
    })

    expect(URL.revokeObjectURL).toHaveBeenCalledWith(previewUri)
    expect(vi.mocked(unregisterFile)).toHaveBeenCalledWith(fileId)
  })

  it('should not revoke blob URL or unregister file on failed status', () => {
    const { result } = renderHook(() => useUploadManager())
    const instance = getMockInstance()
    const onChange: (snap: unknown) => void = instance.setOnChange.mock.calls[0][0]

    act(() => { result.current.addFiles([makeImageFile('hero.jpg')]) })

    const session = Object.values(result.current.snapshot.sessions)[0]
    const { id: fileId, previewUri } = session.fileDescriptor

    act(() => {
      onChange({
        sessions: {
          'server-uid': {
            uploadId: 'server-uid',
            fileDescriptor: { id: fileId, name: 'hero.jpg', size: 11, mimeType: 'image/jpeg', previewUri },
            totalChunks: 1, uploadedChunks: [], status: 'failed', progress: 0, retries: {},
          },
        },
      })
    })

    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    expect(vi.mocked(unregisterFile)).not.toHaveBeenCalled()
  })
})
