import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UploadManager } from '../upload-manager.js'
import type {
  ApiClient,
  ChunkReader,
  FileDescriptor,
  UploadManagerSnapshot,
} from '../types.js'
import { CHUNK_SIZE } from '../chunking.js'

// A file whose size is exactly 3 chunks
const THREE_CHUNK_SIZE = CHUNK_SIZE * 3

function makeFile(id: string, size = THREE_CHUNK_SIZE): FileDescriptor {
  return { id, name: `${id}.jpg`, size, mimeType: 'image/jpeg' }
}

function makeApiClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    initiate: vi
      .fn()
      .mockImplementation((file: FileDescriptor) =>
        Promise.resolve({ uploadId: `uid-${file.id}`, totalChunks: 3 }),
      ),
    uploadChunk: vi
      .fn()
      .mockImplementation(
        (
          _uploadId: string,
          _chunkIndex: number,
          _data: Blob | ArrayBuffer,
          _signal?: AbortSignal,
        ) => Promise.resolve(undefined),
      ),
    finalize: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function makeChunkReader(): ChunkReader {
  return vi
    .fn()
    .mockImplementation((_file, _index, size) =>
      Promise.resolve(new ArrayBuffer(size)),
    )
}

async function flushPromises(): Promise<void> {
  // Drain micro- and macro-task queues. 50 ticks covers deeply-nested
  // promise chains; real-time delays in mocks (≤50ms) settle naturally
  // within that window on any reasonable machine.
  for (let i = 0; i < 50; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

describe('UploadManager', () => {
  let api: ApiClient
  let reader: ChunkReader
  let manager: UploadManager
  let snapshots: UploadManagerSnapshot[]

  beforeEach(() => {
    api = makeApiClient()
    reader = makeChunkReader()
    manager = new UploadManager({
      apiClient: api,
      chunkReader: reader,
      maxConcurrent: 3,
      maxRetries: 3,
    })
    snapshots = []
    manager.setOnChange((snap) => snapshots.push(snap))
  })

  it('adds files with queued status', async () => {
    const file = makeFile('a')
    await manager.addFiles([file])
    const snap = manager.getSnapshot()
    // Keyed by file.id initially
    expect(snap.sessions['a']).toBeDefined()
    expect(snap.sessions['a'].status).toBe('queued')
  })

  it('transitions through validating → uploading on start', async () => {
    const file = makeFile('a')
    await manager.addFiles([file])
    await manager.start()
    await flushPromises()

    const statuses = snapshots.map((s) => Object.values(s.sessions)[0]?.status)
    expect(statuses).toContain('validating')
    expect(statuses).toContain('uploading')
  })

  it('uploads all chunks and finalizes', async () => {
    const file = makeFile('a')
    await manager.addFiles([file])
    await manager.start()
    await flushPromises()

    expect(api.uploadChunk).toHaveBeenCalledTimes(3)
    expect(api.finalize).toHaveBeenCalledWith('uid-a')

    const snap = manager.getSnapshot()
    const session = snap.sessions['uid-a']
    expect(session.status).toBe('completed')
    expect(session.progress).toBe(1)
  })

  it('respects maxConcurrent=3 across multiple files', async () => {
    // 3 files × 3 chunks = 9 chunks. maxConcurrent=3 means at most 3 in-flight at a time.
    let maxInFlightObserved = 0
    let currentInFlight = 0

    ;(api.uploadChunk as ReturnType<typeof vi.fn>).mockImplementation(() => {
      currentInFlight++
      maxInFlightObserved = Math.max(maxInFlightObserved, currentInFlight)
      return new Promise<void>((resolve) =>
        setTimeout(() => {
          currentInFlight--
          resolve()
        }, 10),
      )
    })

    const files = [makeFile('a'), makeFile('b'), makeFile('c')]
    await manager.addFiles(files)
    await manager.start()
    await flushPromises()

    expect(maxInFlightObserved).toBeLessThanOrEqual(3)
    expect(api.uploadChunk).toHaveBeenCalledTimes(9)
  })

  it('pauses a session and stops dispatching its chunks', async () => {
    // Slow uploads so we can pause mid-way
    let resolveFirst: (() => void) | undefined
    let callCount = 0

    ;(api.uploadChunk as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return new Promise<void>((resolve) => {
          resolveFirst = resolve
        })
      }
      return Promise.resolve()
    })

    const file = makeFile('a')
    await manager.addFiles([file])
    await manager.start()

    // Pause while first chunk is in flight
    manager.pause('uid-a')
    resolveFirst?.()
    await flushPromises()

    const snap = manager.getSnapshot()
    expect(snap.sessions['uid-a'].status).toBe('paused')
    // Only the in-flight chunk(s) at pause time can complete; remaining queued ones do not
    expect(api.uploadChunk).toHaveBeenCalledTimes(callCount)
    expect(api.finalize).not.toHaveBeenCalled()
  })

  it('resumes a paused session', async () => {
    // Pause immediately after start
    ;(api.uploadChunk as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise<void>((resolve) => setTimeout(resolve, 5)),
    )

    const file = makeFile('a')
    await manager.addFiles([file])
    await manager.start()
    manager.pause('uid-a')
    await flushPromises()

    expect(manager.getSnapshot().sessions['uid-a'].status).toBe('paused')

    // Swap to instant uploads and resume
    ;(api.uploadChunk as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    manager.resume('uid-a')
    await flushPromises()

    const snap = manager.getSnapshot()
    expect(snap.sessions['uid-a'].status).toBe('completed')
  })

  it('cancels an upload, stops chunks, and calls server cancel', async () => {
    ;(api.uploadChunk as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise<void>((resolve) => setTimeout(resolve, 50)),
    )

    const file = makeFile('a')
    await manager.addFiles([file])
    await manager.start()
    await manager.cancel('uid-a')
    await flushPromises()

    expect(manager.getSnapshot().sessions['uid-a'].status).toBe('canceled')
    expect(api.cancel).toHaveBeenCalledWith('uid-a')
    expect(api.finalize).not.toHaveBeenCalled()
  })

  it('retries a failed chunk and eventually succeeds', async () => {
    let attempts = 0

    const retryApi = makeApiClient({
      uploadChunk: vi
        .fn()
        .mockImplementation((_uploadId: string, chunkIndex: number) => {
          if (chunkIndex === 0 && attempts < 2) {
            attempts++
            return Promise.reject(new Error('network error'))
          }
          return Promise.resolve()
        }),
    })

    const retryManager = new UploadManager({
      apiClient: retryApi,
      chunkReader: reader,
      maxConcurrent: 3,
      maxRetries: 3,
      retryDelay: () => 0,
    })

    const file = makeFile('a')
    await retryManager.addFiles([file])
    await retryManager.start()
    await flushPromises()

    const snap = retryManager.getSnapshot()
    expect(snap.sessions['uid-a'].status).toBe('completed')
    expect(snap.sessions['uid-a'].retries[0]).toBeGreaterThanOrEqual(1)
  })

  it('marks a session as failed after exhausting all retries', async () => {
    const failApi = makeApiClient({
      uploadChunk: vi.fn().mockRejectedValue(new Error('persistent error')),
    })

    const failManager = new UploadManager({
      apiClient: failApi,
      chunkReader: reader,
      maxConcurrent: 3,
      maxRetries: 3,
      retryDelay: () => 0,
    })

    const file = makeFile('a')
    await failManager.addFiles([file])
    await failManager.start()
    await flushPromises()

    const snap = failManager.getSnapshot()
    expect(snap.sessions['uid-a'].status).toBe('failed')
    expect(snap.sessions['uid-a'].error).toBe('persistent error')
  })

  it('retries finalize directly when all chunks are already uploaded', async () => {
    // Simulate: all chunks upload fine, finalize fails once, then succeeds on retry.
    let finalizeAttempts = 0

    const api = makeApiClient({
      finalize: vi.fn().mockImplementation(() => {
        finalizeAttempts++
        if (finalizeAttempts === 1)
          return Promise.reject(new Error('server rejected'))
        return Promise.resolve()
      }),
    })

    const retryManager = new UploadManager({
      apiClient: api,
      chunkReader: reader,
      maxConcurrent: 3,
      maxRetries: 3,
      retryDelay: () => 0,
    })

    const snapshots: UploadManagerSnapshot[] = []
    retryManager.setOnChange((snap) => snapshots.push(snap))

    const file = makeFile('a')
    await retryManager.addFiles([file])
    await retryManager.start()
    await flushPromises()

    // After first finalize failure the session should be 'failed'
    const failedSnap = retryManager.getSnapshot()
    expect(failedSnap.sessions['uid-a'].status).toBe('failed')
    expect(failedSnap.sessions['uid-a'].error).toBe('server rejected')

    // All 3 chunks must already be recorded as uploaded
    expect(failedSnap.sessions['uid-a'].uploadedChunks).toHaveLength(3)

    // Retry: should NOT re-upload any chunks, only call finalize again
    retryManager.retry('uid-a')
    await flushPromises()

    expect(api.uploadChunk).toHaveBeenCalledTimes(3) // unchanged — no re-uploads
    expect(api.finalize).toHaveBeenCalledTimes(2) // called again on retry

    const finalSnap = retryManager.getSnapshot()
    expect(finalSnap.sessions['uid-a'].status).toBe('completed')
  })

  it('calls onChange on every state transition', async () => {
    const file = makeFile('a')
    await manager.addFiles([file])
    await manager.start()
    await flushPromises()

    // Should have received multiple snapshots throughout the lifecycle
    expect(snapshots.length).toBeGreaterThan(3)
  })

  it('should pass AbortSignal to uploadChunk', async () => {
    const file = makeFile('a')
    await manager.addFiles([file])
    await manager.start()
    await flushPromises()

    expect(api.uploadChunk).toHaveBeenCalled()
    const [, , , signal] = (api.uploadChunk as ReturnType<typeof vi.fn>).mock
      .calls[0]
    expect(signal).toBeInstanceOf(AbortSignal)
  })

  it('should abort in-flight chunks on pause', async () => {
    const signals: AbortSignal[] = []
    let resolveFirst: (() => void) | undefined

    ;(api.uploadChunk as ReturnType<typeof vi.fn>).mockImplementation(
      (
        _uploadId: string,
        _chunkIndex: number,
        _data: Blob | ArrayBuffer,
        signal?: AbortSignal,
      ) => {
        if (signal) signals.push(signal)
        return new Promise<void>((resolve) => {
          resolveFirst = resolve
        })
      },
    )

    const file = makeFile('a')
    await manager.addFiles([file])
    await manager.start()

    // Pause while first chunk is in flight
    manager.pause('uid-a')
    resolveFirst?.()
    await flushPromises()

    expect(signals.length).toBeGreaterThan(0)
    expect(signals[0].aborted).toBe(true)
  })

  it('should record chunk uploaded during pause if request completed before abort', async () => {
    // We need uploadChunk to be actually invoked before pause() is called.
    // Use a deferred that signals when the first chunk has reached uploadChunk.
    let resolveFirst: (() => void) | undefined
    let firstChunkStartedResolve!: () => void
    const firstChunkStarted = new Promise<void>((r) => {
      firstChunkStartedResolve = r
    })

    ;(api.uploadChunk as ReturnType<typeof vi.fn>).mockImplementation(
      (_u: string, chunkIndex: number) => {
        if (chunkIndex === 0) {
          firstChunkStartedResolve()
          return new Promise<void>((resolve) => {
            resolveFirst = resolve
          })
        }
        return Promise.resolve()
      },
    )

    const file = makeFile('a')
    await manager.addFiles([file])
    await manager.start()
    // Wait until chunk 0 is genuinely inside uploadChunk before pausing
    await firstChunkStarted

    manager.pause('uid-a')
    resolveFirst?.()
    await flushPromises()

    const snap = manager.getSnapshot()
    // Chunk 0 completed after the abort signal fired — should still be recorded
    expect(snap.sessions['uid-a'].uploadedChunks.length).toBeGreaterThan(0)
    expect(snap.sessions['uid-a'].status).toBe('paused')
  })

  it('should not re-upload already uploaded chunks on resume', async () => {
    // Wait until all 3 chunks are inside uploadChunk before pausing
    let resolveChunk0: (() => void) | undefined
    let allStartedResolve!: () => void
    const allStarted = new Promise<void>((r) => {
      allStartedResolve = r
    })
    let startedCount = 0

    ;(api.uploadChunk as ReturnType<typeof vi.fn>).mockImplementation(
      (_u: string, chunkIndex: number) => {
        startedCount++
        if (startedCount === 3) allStartedResolve()
        if (chunkIndex === 0) {
          return new Promise<void>((resolve) => {
            resolveChunk0 = resolve
          })
        }
        return Promise.resolve()
      },
    )

    const file = makeFile('a')
    await manager.addFiles([file])
    await manager.start()
    await allStarted // all 3 uploadChunk calls are in-flight

    manager.pause('uid-a')
    resolveChunk0?.()
    await flushPromises()

    const uploadedBeforeResume =
      manager.getSnapshot().sessions['uid-a'].uploadedChunks.length
    expect(uploadedBeforeResume).toBeGreaterThan(0)

    ;(api.uploadChunk as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    manager.resume('uid-a')
    await flushPromises()

    // Total calls should equal exactly 3 — no chunk is re-uploaded
    const totalCalls = (api.uploadChunk as ReturnType<typeof vi.fn>).mock.calls
      .length
    expect(totalCalls).toBe(3)
    expect(manager.getSnapshot().sessions['uid-a'].uploadedChunks.length).toBe(
      3,
    )
  })

  it('should finalize on resume if all chunks were uploaded while paused', async () => {
    // Wait until all 3 chunks are inside uploadChunk, then pause and resolve them all
    const resolvers: Array<() => void> = []
    let allStartedResolve!: () => void
    const allStarted = new Promise<void>((r) => {
      allStartedResolve = r
    })

    ;(api.uploadChunk as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvers.push(resolve)
          if (resolvers.length === 3) allStartedResolve()
        }),
    )

    const file = makeFile('a')
    await manager.addFiles([file])
    await manager.start()
    await allStarted // all 3 uploadChunk calls are in-flight

    manager.pause('uid-a')
    for (const resolve of resolvers) resolve()
    await flushPromises()

    const snapAfterPause = manager.getSnapshot()
    expect(snapAfterPause.sessions['uid-a'].status).toBe('paused')
    expect(snapAfterPause.sessions['uid-a'].uploadedChunks.length).toBe(3)
    expect(api.finalize).not.toHaveBeenCalled()

    // Resume should detect all chunks already uploaded and go straight to finalize
    manager.resume('uid-a')
    await flushPromises()

    expect(api.finalize).toHaveBeenCalledWith('uid-a')
    expect(manager.getSnapshot().sessions['uid-a'].status).toBe('completed')
  })
})
