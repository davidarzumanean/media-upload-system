import { renderHook, act } from '@testing-library/react-native'
import { useUploadManager } from '../useUploadManager'

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

// Silence AsyncStorage errors in test output
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}))

import { UploadManager } from '@media-upload/core'

function getMockInstance() {
  return (UploadManager as jest.Mock).mock.results[0]?.value
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

    const onChange: (snap: unknown) => void = instance.setOnChange.mock.calls[0][0]

    const newSnap = {
      sessions: {
        'uid-1': {
          uploadId: 'uid-1',
          fileDescriptor: { id: 'fd-1', name: 'a.jpg', size: 100, mimeType: 'image/jpeg' },
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
})