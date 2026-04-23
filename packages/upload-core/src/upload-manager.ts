import type {
  ApiClient,
  ChunkReader,
  ChunkTask,
  FileDescriptor,
  UploadManagerSnapshot,
  UploadSession,
} from './types.js';
import { CHUNK_SIZE, calculateTotalChunks, getRetryDelay } from './chunking.js';

export interface UploadManagerOptions {
  apiClient: ApiClient;
  chunkReader: ChunkReader;
  maxConcurrent?: number;
  maxRetries?: number;
  /** Override retry delay for testing. Defaults to exponential backoff. */
  retryDelay?: (attempt: number) => number;
}

interface InFlightChunk {
  uploadId: string;
  chunkIndex: number;
  abortController: AbortController;
}

export class UploadManager {
  private readonly apiClient: ApiClient;
  private readonly chunkReader: ChunkReader;
  private readonly maxConcurrent: number;
  private readonly maxRetries: number;
  private readonly retryDelay: (attempt: number) => number;

  private sessions: Map<string, UploadSession> = new Map();
  private queue: ChunkTask[] = [];
  private inFlight: InFlightChunk[] = [];
  private onChange?: (snapshot: UploadManagerSnapshot) => void;

  constructor(options: UploadManagerOptions) {
    this.apiClient = options.apiClient;
    this.chunkReader = options.chunkReader;
    this.maxConcurrent = options.maxConcurrent ?? 3;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelay = options.retryDelay ?? getRetryDelay;
  }

  setOnChange(cb: (snapshot: UploadManagerSnapshot) => void): void {
    this.onChange = cb;
  }

  async addFiles(files: FileDescriptor[]): Promise<void> {
    for (const file of files) {
      const session: UploadSession = {
        uploadId: '',
        fileDescriptor: file,
        totalChunks: 0,
        uploadedChunks: [],
        status: 'queued',
        progress: 0,
        retries: {},
      };
      // Use file.id as a temporary key until we have a real uploadId
      this.sessions.set(file.id, session);
    }
    this.emit();
  }

  async start(): Promise<void> {
    const queued = [...this.sessions.values()].filter(s => s.status === 'queued');

    for (const session of queued) {
      session.status = 'validating';
      this.emit();

      try {
        const { uploadId, totalChunks } = await this.apiClient.initiate(session.fileDescriptor);
        session.uploadId = uploadId;
        session.totalChunks = totalChunks > 0 ? totalChunks : calculateTotalChunks(session.fileDescriptor.size);
        session.status = 'uploading';

        // Re-key by real uploadId
        this.sessions.delete(session.fileDescriptor.id);
        this.sessions.set(uploadId, session);

        this.enqueueChunksForSession(session);
        this.emit();
      } catch (err) {
        session.status = 'failed';
        session.error = err instanceof Error ? err.message : String(err);
        this.emit();
      }
    }

    this.dispatch();
  }

  pause(uploadId: string): void {
    const session = this.sessions.get(uploadId);
    if (!session || session.status !== 'uploading') return;

    session.status = 'paused';

    // Remove pending chunks for this upload from the queue
    this.queue = this.queue.filter(t => t.uploadId !== uploadId);

    // Abort in-flight chunks for this upload
    for (const inflight of this.inFlight.filter(i => i.uploadId === uploadId)) {
      inflight.abortController.abort();
    }

    this.emit();
  }

  resume(uploadId: string): void {
    const session = this.sessions.get(uploadId);
    if (!session || session.status !== 'paused') return;

    session.status = 'uploading';
    this.enqueueChunksForSession(session);
    this.emit();
    this.dispatch();
  }

  async cancel(uploadId: string): Promise<void> {
    const session = this.sessions.get(uploadId);
    if (!session) return;

    session.status = 'canceled';

    this.queue = this.queue.filter(t => t.uploadId !== uploadId);

    for (const inflight of this.inFlight.filter(i => i.uploadId === uploadId)) {
      inflight.abortController.abort();
    }

    this.emit();

    if (this.apiClient.cancel) {
      try {
        await this.apiClient.cancel(uploadId);
      } catch {
        // Best-effort server cancel — ignore errors
      }
    }
  }

  getSnapshot(): UploadManagerSnapshot {
    const sessions: Record<string, UploadSession> = {};
    for (const [id, session] of this.sessions) {
      sessions[id] = { ...session, uploadedChunks: [...session.uploadedChunks] };
    }
    return { sessions };
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private enqueueChunksForSession(session: UploadSession): void {
    const uploadedSet = new Set(session.uploadedChunks);
    for (let i = 0; i < session.totalChunks; i++) {
      if (!uploadedSet.has(i)) {
        // Avoid re-queuing chunks already in queue
        const alreadyQueued = this.queue.some(
          t => t.uploadId === session.uploadId && t.chunkIndex === i,
        );
        if (!alreadyQueued) {
          this.queue.push({ uploadId: session.uploadId, chunkIndex: i, data: new ArrayBuffer(0) });
        }
      }
    }
  }

  private dispatch(): void {
    while (this.inFlight.length < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift()!;
      const session = this.sessions.get(task.uploadId);

      if (!session || session.status !== 'uploading') continue;

      const abortController = new AbortController();
      this.inFlight.push({ uploadId: task.uploadId, chunkIndex: task.chunkIndex, abortController });

      this.executeChunk(task, session, abortController).catch(() => {
        // errors handled inside executeChunk
      });
    }
  }

  private async executeChunk(
    task: ChunkTask,
    session: UploadSession,
    abortController: AbortController,
  ): Promise<void> {
    try {
      const data = await this.chunkReader(session.fileDescriptor, task.chunkIndex, CHUNK_SIZE);

      if (abortController.signal.aborted) return;

      await this.apiClient.uploadChunk(session.uploadId, task.chunkIndex, data);

      if (abortController.signal.aborted) return;

      this.onChunkSuccess(session, task.chunkIndex);
    } catch (err) {
      if (abortController.signal.aborted) return;
      this.onChunkError(session, task.chunkIndex, err);
    } finally {
      this.inFlight = this.inFlight.filter(
        i => !(i.uploadId === task.uploadId && i.chunkIndex === task.chunkIndex),
      );
      this.dispatch();
    }
  }

  private onChunkSuccess(session: UploadSession, chunkIndex: number): void {
    if (!session.uploadedChunks.includes(chunkIndex)) {
      session.uploadedChunks.push(chunkIndex);
    }
    session.progress = session.uploadedChunks.length / session.totalChunks;
    this.emit();

    if (session.uploadedChunks.length === session.totalChunks) {
      this.finalizeSession(session);
    }
  }

  private onChunkError(session: UploadSession, chunkIndex: number, err: unknown): void {
    const retries = session.retries[chunkIndex] ?? 0;

    if (retries >= this.maxRetries) {
      session.status = 'failed';
      session.error = err instanceof Error ? err.message : String(err);
      // Remove all remaining queued chunks for this upload
      this.queue = this.queue.filter(t => t.uploadId !== session.uploadId);
      this.emit();
      return;
    }

    session.retries[chunkIndex] = retries + 1;
    const delay = this.retryDelay(retries + 1);

    setTimeout(() => {
      if (session.status !== 'uploading') return;
      this.queue.unshift({ uploadId: session.uploadId, chunkIndex, data: new ArrayBuffer(0) });
      this.dispatch();
    }, delay);

    this.emit();
  }

  private finalizeSession(session: UploadSession): void {
    this.apiClient
      .finalize(session.uploadId)
      .then(() => {
        session.status = 'completed';
        session.progress = 1;
        this.emit();
      })
      .catch(err => {
        session.status = 'failed';
        session.error = err instanceof Error ? err.message : String(err);
        this.emit();
      });
  }

  private emit(): void {
    this.onChange?.(this.getSnapshot());
  }
}
