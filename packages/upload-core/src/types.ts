export type UploadStatus =
  | 'queued'
  | 'validating'
  | 'uploading'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'canceled'

export interface FileDescriptor {
  id: string
  name: string
  size: number
  mimeType: string
  previewUri?: string
}

export interface UploadSession {
  uploadId: string
  fileDescriptor: FileDescriptor
  totalChunks: number
  uploadedChunks: number[]
  status: UploadStatus
  progress: number
  retries: Record<number, number>
  error?: string
}

export interface ChunkTask {
  uploadId: string
  chunkIndex: number
  data: Blob | ArrayBuffer
}

export type UploadManagerSnapshot = {
  sessions: Record<string, UploadSession>
}

export type ChunkReader = (
  file: FileDescriptor,
  chunkIndex: number,
  chunkSize: number,
) => Promise<Blob | ArrayBuffer>

export interface ApiClient {
  initiate(
    file: FileDescriptor,
  ): Promise<{ uploadId: string; totalChunks: number }>
  uploadChunk(
    uploadId: string,
    chunkIndex: number,
    data: Blob | ArrayBuffer,
    signal?: AbortSignal,
  ): Promise<void>
  finalize(uploadId: string): Promise<void>
  getStatus(uploadId: string): Promise<{ status: UploadStatus }>
  cancel?(uploadId: string): Promise<void>
}

export interface ValidationError {
  fileId: string
  fileName: string
  reason: string
}
