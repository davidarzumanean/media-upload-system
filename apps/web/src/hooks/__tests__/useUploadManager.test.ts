import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUploadManager } from '../useUploadManager'

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../lib/api-client', () => ({
  createApiClient: () => ({
    initiate: vi.fn().mockResolvedValue({ uploadId: 'server-uid', totalChunks: 1 }),
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
    expect(result.current.validationErrors).toEqual([])
    expect(result.current.history).toEqual([])
  })

  it('addFiles synchronously injects a queued session for each file', () => {
    const { result } = renderHook(() => useUploadManager())

    act(() => {
      result.current.addFiles([makeImageFile('a.jpg'), makeVideoFile('b.mp4')])
    })

    const sessions = Object.values(result.current.snapshot.sessions)
    expect(sessions).toHaveLength(2)
    expect(sessions.map((s) => s.fileDescriptor.name).sort()).toEqual(['a.jpg', 'b.mp4'])
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

  it('clearErrors resets validationErrors', () => {
    // Feed an oversized file so validateFiles produces an error
    const huge = new File([new ArrayBuffer(200 * 1024 * 1024)], 'huge.jpg', {
      type: 'image/jpeg',
    })
    const { result } = renderHook(() => useUploadManager())

    act(() => {
      result.current.addFiles([huge])
    })

    expect(result.current.validationErrors.length).toBeGreaterThan(0)

    act(() => {
      result.current.clearErrors()
    })

    expect(result.current.validationErrors).toEqual([])
  })

  it('clearHistory empties the history list and localStorage', () => {
    localStorage.setItem(
      'media-upload-history',
      JSON.stringify([
        { id: '1', name: 'old.jpg', size: 100, mimeType: 'image/jpeg', completedAt: '2024-01-01T00:00:00Z' },
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
})
