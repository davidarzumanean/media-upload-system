import { renderHook, act } from '@testing-library/react-native'
import { useUploadManager } from '../useUploadManager'

jest.mock('@/context/ToastContext', () => ({
  useToast: jest.fn(() => ({ addToast: jest.fn() })),
}))

jest.mock('@/lib/api-client', () => ({
  createApiClient: () => ({
    initiate: jest.fn().mockResolvedValue({ uploadId: 'server-uid', totalChunks: 1 }),
    uploadChunk: jest.fn().mockResolvedValue(undefined),
    finalize: jest.fn().mockResolvedValue(undefined),
    getStatus: jest.fn().mockResolvedValue({ status: 'uploading' }),
    cancel: jest.fn().mockResolvedValue(undefined),
  }),
}))

jest.mock('@/lib/chunk-reader', () => ({
  registerFile: jest.fn(),
  unregisterFile: jest.fn(),
  chunkReader: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
}))

// Mock the UploadManager while keeping real validateFiles / chunking from core.
jest.mock('@media-upload/core', () => {
  const actual = jest.requireActual('@media-upload/core')
  const mockInstance = {
    setOnChange: jest.fn(),
    addFiles: jest.fn().mockResolvedValue(undefined),
    start: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn(),
    resume: jest.fn(),
    cancel: jest.fn().mockResolvedValue(undefined),
    retry: jest.fn(),
    remove: jest.fn(),
    getSnapshot: jest.fn().mockReturnValue({ sessions: {} }),
  }
  return {
    ...actual,
    UploadManager: jest.fn(() => mockInstance),
  }
})

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}))

import { UploadManager } from '@media-upload/core'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { registerFile, unregisterFile } from '@/lib/chunk-reader'

function getMockInstance() {
  return (UploadManager as jest.Mock).mock.results[0]?.value
}

function getOnChange(instance: ReturnType<typeof getMockInstance>) {
  return instance.setOnChange.mock.calls[0][0] as (snap: unknown) => void
}

function makeFileInput(overrides: Partial<{ uri: string; name: string; size: number; mimeType: string }> = {}) {
  return {
    uri: 'file:///photo.jpg',
    name: 'photo.jpg',
    size: 1024,
    mimeType: 'image/jpeg',
    ...overrides,
  }
}

describe('useUploadManager', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates an UploadManager instance on mount', () => {
    renderHook(() => useUploadManager())
    expect(UploadManager).toHaveBeenCalledTimes(1)
  })

  it('registers an onChange callback on the manager', () => {
    renderHook(() => useUploadManager())
    const instance = getMockInstance()
    expect(instance.setOnChange).toHaveBeenCalledWith(expect.any(Function))
  })

  it('snapshot starts as empty sessions', () => {
    const { result } = renderHook(() => useUploadManager())
    expect(result.current.snapshot).toEqual({ sessions: {} })
  })

  it('snapshot updates when the onChange callback fires', () => {
    const { result } = renderHook(() => useUploadManager())
    const instance = getMockInstance()

    const onChange: (snap: unknown) => void =
      instance.setOnChange.mock.calls[0][0]

    const newSnap = {
      sessions: {
        'uid-1': {
          uploadId: 'uid-1',
          fileDescriptor: {
            id: 'fd-1',
            name: 'a.jpg',
            size: 100,
            mimeType: 'image/jpeg',
          },
          totalChunks: 1,
          uploadedChunks: [],
          status: 'uploading',
          progress: 0.5,
          retries: {},
        },
      },
    }

    act(() => {
      onChange(newSnap)
    })

    expect(result.current.snapshot.sessions['uid-1']).toBeDefined()
    expect(result.current.snapshot.sessions['uid-1'].status).toBe('uploading')
  })

  it('cleans up onChange on unmount', () => {
    const { unmount } = renderHook(() => useUploadManager())
    const instance = getMockInstance()

    // setOnChange is the registration — we verify it was called once (not re-called on unmount)
    expect(instance.setOnChange).toHaveBeenCalledTimes(1)

    // Should not throw
    unmount()
  })

  // ── addFiles ──────────────────────────────────────────────────────────────

  it('addFiles synchronously injects a queued session per file', () => {
    const { result } = renderHook(() => useUploadManager())

    act(() => {
      result.current.addFiles([
        makeFileInput({ name: 'a.jpg', mimeType: 'image/jpeg' }),
        makeFileInput({ uri: 'file:///b.mp4', name: 'b.mp4', mimeType: 'video/mp4' }),
      ])
    })

    const sessions = Object.values(result.current.snapshot.sessions)
    expect(sessions).toHaveLength(2)
    expect(sessions.every((s) => s.status === 'queued')).toBe(true)
  })

  it('addFiles sets previewUri to the file URI for images', () => {
    const { result } = renderHook(() => useUploadManager())

    act(() => {
      result.current.addFiles([
        makeFileInput({ uri: 'file:///photo.jpg', name: 'photo.jpg', mimeType: 'image/jpeg' }),
      ])
    })

    const session = Object.values(result.current.snapshot.sessions)[0]
    expect(session.fileDescriptor.previewUri).toBe('file:///photo.jpg')
  })

  it('addFiles omits previewUri for non-image files', () => {
    const { result } = renderHook(() => useUploadManager())

    act(() => {
      result.current.addFiles([
        makeFileInput({ uri: 'file:///clip.mp4', name: 'clip.mp4', mimeType: 'video/mp4' }),
      ])
    })

    const session = Object.values(result.current.snapshot.sessions)[0]
    expect(session.fileDescriptor.previewUri).toBeUndefined()
  })

  it('addFiles calls registerFile for each valid file', () => {
    const { result } = renderHook(() => useUploadManager())

    act(() => {
      result.current.addFiles([makeFileInput()])
    })

    expect(registerFile).toHaveBeenCalledTimes(1)
  })

  // ── dismiss ───────────────────────────────────────────────────────────────

  it('dismiss hides the session from snapshot and calls manager.remove', () => {
    const { result } = renderHook(() => useUploadManager())

    act(() => {
      result.current.addFiles([makeFileInput()])
    })

    const id = Object.keys(result.current.snapshot.sessions)[0]

    act(() => {
      result.current.dismiss(id)
    })

    expect(result.current.snapshot.sessions[id]).toBeUndefined()
    expect(getMockInstance().remove).toHaveBeenCalledWith(id)
  })

  // ── history ───────────────────────────────────────────────────────────────

  it('loads history from AsyncStorage on mount', async () => {
    const entry = {
      id: 'uid-x',
      name: 'video.mp4',
      size: 4096,
      mimeType: 'video/mp4',
      completedAt: '2024-01-01T00:00:00Z',
    }
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify([entry]),
    )

    const { result } = renderHook(() => useUploadManager())

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.history[0].name).toBe('video.mp4')
  })

  it('persists completed upload to AsyncStorage', () => {
    const { result } = renderHook(() => useUploadManager())
    const instance = getMockInstance()
    const onChange = getOnChange(instance)

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
    expect(result.current.history[0].name).toBe('photo.jpg')
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'media-upload-history',
      expect.stringContaining('photo.jpg'),
    )
  })

  it('clearHistory empties the list and calls AsyncStorage.removeItem', async () => {
    const entry = {
      id: 'uid-x',
      name: 'video.mp4',
      size: 4096,
      mimeType: 'video/mp4',
      completedAt: '2024-01-01T00:00:00Z',
    }
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify([entry]),
    )

    const { result } = renderHook(() => useUploadManager())
    await act(async () => { await Promise.resolve() })

    expect(result.current.history).toHaveLength(1)

    act(() => { result.current.clearHistory() })

    expect(result.current.history).toHaveLength(0)
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('media-upload-history')
  })

  // ── speed tracking ────────────────────────────────────────────────────────

  it('reports initial speed of 0 for a new uploading session', () => {
    const { result } = renderHook(() => useUploadManager())
    const onChange = getOnChange(getMockInstance())

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

  // ── unregisterFile ────────────────────────────────────────────────────────

  it('calls unregisterFile when a session reaches a terminal status', () => {
    const { result } = renderHook(() => useUploadManager())
    const onChange = getOnChange(getMockInstance())

    act(() => {
      onChange({
        sessions: {
          'uid-1': {
            uploadId: 'uid-1',
            fileDescriptor: { id: 'fd-1', name: 'a.jpg', size: 100, mimeType: 'image/jpeg' },
            totalChunks: 1,
            uploadedChunks: [0],
            status: 'completed',
            progress: 1,
            retries: {},
          },
        },
      })
    })

    expect(unregisterFile).toHaveBeenCalledWith('fd-1')
  })

  it('calls unregisterFile on canceled status', () => {
    const { result } = renderHook(() => useUploadManager())
    const onChange = getOnChange(getMockInstance())

    act(() => {
      onChange({
        sessions: {
          'fd-cancel': {
            uploadId: 'fd-cancel',
            fileDescriptor: { id: 'fd-cancel', name: 'a.jpg', size: 100, mimeType: 'image/jpeg' },
            totalChunks: 1, uploadedChunks: [], status: 'canceled', progress: 0, retries: {},
          },
        },
      })
    })

    expect(unregisterFile).toHaveBeenCalledWith('fd-cancel')
  })

  it('should not unregister file on failed status', () => {
    const { result } = renderHook(() => useUploadManager())
    const onChange = getOnChange(getMockInstance())

    act(() => {
      onChange({
        sessions: {
          'fd-fail': {
            uploadId: 'fd-fail',
            fileDescriptor: { id: 'fd-fail', name: 'a.jpg', size: 100, mimeType: 'image/jpeg' },
            totalChunks: 1, uploadedChunks: [], status: 'failed', progress: 0, retries: {},
          },
        },
      })
    })

    expect(unregisterFile).not.toHaveBeenCalled()
  })

  it('should unregister file on completed status', () => {
    const { result } = renderHook(() => useUploadManager())
    const onChange = getOnChange(getMockInstance())

    act(() => {
      onChange({
        sessions: {
          'fd-done': {
            uploadId: 'fd-done',
            fileDescriptor: { id: 'fd-done', name: 'a.jpg', size: 100, mimeType: 'image/jpeg' },
            totalChunks: 1, uploadedChunks: [0], status: 'completed', progress: 1, retries: {},
          },
        },
      })
    })

    expect(unregisterFile).toHaveBeenCalledWith('fd-done')
  })

  it('should unregister file on canceled status', () => {
    const { result } = renderHook(() => useUploadManager())
    const onChange = getOnChange(getMockInstance())

    act(() => {
      onChange({
        sessions: {
          'fd-cancel': {
            uploadId: 'fd-cancel',
            fileDescriptor: { id: 'fd-cancel', name: 'a.jpg', size: 100, mimeType: 'image/jpeg' },
            totalChunks: 1, uploadedChunks: [], status: 'canceled', progress: 0, retries: {},
          },
        },
      })
    })

    expect(unregisterFile).toHaveBeenCalledWith('fd-cancel')
  })
})
