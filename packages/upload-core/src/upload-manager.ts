import type {
  ApiClient,
  ChunkReader,
  ChunkTask,
  FileDescriptor,
  UploadManagerSnapshot,
  UploadSession,
} from './types.js'

// Internal session tracks uploadedChunks as a Set for O(1) lookups.
// getSnapshot() converts back to number[] for the public UploadSession type.
type InternalSession = Omit<UploadSession, 'uploadedChunks'> & {
  uploadedChunks: Set<number>
}
import { CHUNK_SIZE, calculateTotalChunks, getRetryDelay } from './chunking.js'

export interface UploadManagerOptions {
  apiClient: ApiClient
  chunkReader: ChunkReader
  maxConcurrent?: number
  maxRetries?: number
  /** Override retry delay for testing. Defaults to exponential backoff. */
  retryDelay?: (attempt: number) => number
}

interface InFlightChunk {
  uploadId: string
  chunkIndex: number
  abortController: AbortController
}

export class UploadManager {
  private readonly apiClient: ApiClient
  private readonly chunkReader: ChunkReader
  private readonly maxConcurrent: number
  private readonly maxRetries: number
  private readonly retryDelay: (attempt: number) => number

  private sessions: Map<string, InternalSession> = new Map()
  private queue: ChunkTask[] = []
  private inFlight: InFlightChunk[] = []
  private onChange?: (snapshot: UploadManagerSnapshot) => void

  constructor(options: UploadManagerOptions) {
    this.apiClient = options.apiClient
    this.chunkReader = options.chunkReader
    this.maxConcurrent = options.maxConcurrent ?? 3
    this.maxRetries = options.maxRetries ?? 3
    this.retryDelay = options.retryDelay ?? getRetryDelay
  }

  setOnChange(cb: (snapshot: UploadManagerSnapshot) => void): void {
    this.onChange = cb
  }

  async addFiles(files: FileDescriptor[]): Promise<void> {
    for (const file of files) {
      const session: InternalSession = {
        uploadId: '',
        fileDescriptor: file,
        totalChunks: 0,
        uploadedChunks: new Set(),
        status: 'queued',
        progress: 0,
        retries: {},
      }
      // Use file.id as a temporary key until we have a real uploadId
      this.sessions.set(file.id, session)
    }
    this.emit()
  }

  async start(): Promise<void> {
    const queued = [...this.sessions.values()].filter(
      (s) => s.status === 'queued',
    )
    if (queued.length === 0) {
      this.dispatch()
      return
    }

    // Transition ALL queued sessions to validating in one shot so every card
    // appears in the UI immediately, before any network request is made.
    for (const session of queued) {
      session.status = 'validating'
    }
    this.emit()

    // Initiate all files concurrently — each resolves independently.
    await Promise.allSettled(
      queued.map(async (session) => {
        try {
          const { uploadId, totalChunks } = await this.apiClient.initiate(
            session.fileDescriptor,
          )
          session.uploadId = uploadId
          session.totalChunks =
            totalChunks > 0
              ? totalChunks
              : calculateTotalChunks(session.fileDescriptor.size)
          session.status = 'uploading'

          // Re-key by real uploadId
          this.sessions.delete(session.fileDescriptor.id)
          this.sessions.set(uploadId, session)

          this.enqueueChunksForSession(session)
          this.emit()
        } catch (err) {
          session.status = 'failed'
          session.error = err instanceof Error ? err.message : String(err)
          this.emit()
        }
      }),
    )

    this.dispatch()
  }

  pause(uploadId: string): void {
    const session = this.sessions.get(uploadId)
    if (!session || session.status !== 'uploading') return

    session.status = 'paused'

    // Remove pending chunks for this upload from the queue
    this.queue = this.queue.filter((t) => t.uploadId !== uploadId)

    // Abort in-flight chunks for this upload
    for (const inflight of this.inFlight.filter(
      (i) => i.uploadId === uploadId,
    )) {
      inflight.abortController.abort()
    }

    this.emit()
  }

  resume(uploadId: string): void {
    const session = this.sessions.get(uploadId)
    if (!session || session.status !== 'paused') return

    session.status = 'uploading'

    // If all chunks uploaded while paused, go straight to finalize
    if (
      session.uploadedChunks.size === session.totalChunks &&
      session.totalChunks > 0
    ) {
      void this.finalizeSession(session)
      this.emit()
      return
    }

    this.enqueueChunksForSession(session)
    this.emit()
    this.dispatch()
  }

  remove(uploadId: string): void {
    const session = this.sessions.get(uploadId)
    if (!session) return
    const isDone =
      session.status === 'completed' ||
      session.status === 'canceled' ||
      session.status === 'failed'
    if (!isDone) return
    this.sessions.delete(uploadId)
    this.emit()
  }

  retry(uploadId: string): void {
    const session = this.sessions.get(uploadId)
    if (!session || session.status !== 'failed') return

    session.status = 'uploading'
    session.error = undefined
    session.retries = {}

    // All chunks already uploaded but finalize failed — go straight to
    // finalize instead of re-uploading chunks that are already on the server.
    if (
      session.totalChunks > 0 &&
      session.uploadedChunks.size === session.totalChunks
    ) {
      this.emit()
      void this.finalizeSession(session)
      return
    }

    this.enqueueChunksForSession(session)
    this.emit()
    this.dispatch()
  }

  async cancel(uploadId: string): Promise<void> {
    const session = this.sessions.get(uploadId)
    if (!session) return

    session.status = 'canceled'

    this.queue = this.queue.filter((t) => t.uploadId !== uploadId)

    for (const inflight of this.inFlight.filter(
      (i) => i.uploadId === uploadId,
    )) {
      inflight.abortController.abort()
    }

    this.emit()

    try {
      await this.apiClient.cancel(uploadId)
    } catch {
      // Best-effort server cancel — ignore errors
    }
  }

  getSnapshot(): UploadManagerSnapshot {
    const sessions: Record<string, UploadSession> = {}
    for (const [id, session] of this.sessions) {
      sessions[id] = {
        ...session,
        uploadedChunks: [...session.uploadedChunks],
      } as UploadSession
    }
    return { sessions }
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private enqueueChunksForSession(session: InternalSession): void {
    const queuedSet = new Set(
      this.queue
        .filter((t) => t.uploadId === session.uploadId)
        .map((t) => t.chunkIndex),
    )
    for (let i = 0; i < session.totalChunks; i++) {
      if (!session.uploadedChunks.has(i) && !queuedSet.has(i)) {
        this.queue.push({ uploadId: session.uploadId, chunkIndex: i })
        queuedSet.add(i)
      }
    }
  }

  private dispatch(): void {
    while (this.inFlight.length < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift()!
      const session = this.sessions.get(task.uploadId)

      if (!session || session.status !== 'uploading') continue

      const abortController = new AbortController()
      this.inFlight.push({
        uploadId: task.uploadId,
        chunkIndex: task.chunkIndex,
        abortController,
      })

      this.executeChunk(task, session, abortController).catch(() => {
        // errors handled inside executeChunk
      })
    }
  }

  private async executeChunk(
    task: ChunkTask,
    session: InternalSession,
    abortController: AbortController,
  ): Promise<void> {
    try {
      const data = await this.chunkReader(
        session.fileDescriptor,
        task.chunkIndex,
        CHUNK_SIZE,
      )

      if (abortController.signal.aborted) return

      await this.apiClient.uploadChunk(
        session.uploadId,
        task.chunkIndex,
        data,
        abortController.signal,
      )

      // If uploadChunk resolved (didn't throw), the data was sent — record it.
      // onChunkSuccess handles paused/canceled states gracefully.
      this.onChunkSuccess(session, task.chunkIndex)
    } catch (err) {
      if (abortController.signal.aborted) return
      this.onChunkError(session, task.chunkIndex, err)
    } finally {
      this.inFlight = this.inFlight.filter(
        (i) =>
          !(i.uploadId === task.uploadId && i.chunkIndex === task.chunkIndex),
      )
      this.dispatch()
    }
  }

  private onChunkSuccess(session: InternalSession, chunkIndex: number): void {
    // Always record the chunk — even if paused, don't waste a successful upload
    session.uploadedChunks.add(chunkIndex)
    session.progress = session.uploadedChunks.size / session.totalChunks

    // If canceled, silently ignore
    if (session.status === 'canceled') return

    // If paused, record but don't continue
    if (session.status === 'paused') {
      this.emit()
      return
    }

    this.emit()

    if (session.uploadedChunks.size === session.totalChunks) {
      void this.finalizeSession(session)
    }
  }

  private onChunkError(
    session: InternalSession,
    chunkIndex: number,
    err: unknown,
  ): void {
    const retries = session.retries[chunkIndex] ?? 0

    if (retries >= this.maxRetries) {
      session.status = 'failed'
      session.error = err instanceof Error ? err.message : String(err)
      // Remove all remaining queued chunks for this upload
      this.queue = this.queue.filter((t) => t.uploadId !== session.uploadId)
      this.emit()
      return
    }

    session.retries[chunkIndex] = retries + 1
    const delay = this.retryDelay(retries + 1)

    setTimeout(() => {
      if (session.status !== 'uploading') return
      this.queue.unshift({
        uploadId: session.uploadId,
        chunkIndex,
      })
      this.dispatch()
    }, delay)

    this.emit()
  }

  private async finalizeSession(session: InternalSession): Promise<void> {
    try {
      await this.apiClient.finalize(session.uploadId)
      session.status = 'completed'
      session.progress = 1
      this.emit()
    } catch (err) {
      session.status = 'failed'
      session.error = err instanceof Error ? err.message : String(err)
      this.emit()
    }
  }

  private emit(): void {
    this.onChange?.(this.getSnapshot())
  }
}
