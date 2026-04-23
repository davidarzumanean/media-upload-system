import type { ApiClient, FileDescriptor, UploadStatus } from '@media-upload/core'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

export function createApiClient(): ApiClient {
  return {
    async initiate(file: FileDescriptor): Promise<{ uploadId: string; totalChunks: number }> {
      const res = await fetch(`${BASE_URL}/uploads/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: file.id,
          name: file.name,
          size: file.size,
          mimeType: file.mimeType,
        }),
      })
      if (!res.ok) throw new Error(`Initiate failed: ${res.status} ${res.statusText}`)
      return res.json() as Promise<{ uploadId: string; totalChunks: number }>
    },

    async uploadChunk(
      uploadId: string,
      chunkIndex: number,
      data: Blob | ArrayBuffer,
    ): Promise<void> {
      const form = new FormData()
      const blob = data instanceof Blob ? data : new Blob([data])
      form.append('chunk', blob)
      form.append('chunkIndex', String(chunkIndex))

      const res = await fetch(`${BASE_URL}/uploads/${uploadId}/chunks/${chunkIndex}`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) throw new Error(`Chunk upload failed: ${res.status} ${res.statusText}`)
    },

    async finalize(uploadId: string): Promise<void> {
      const res = await fetch(`${BASE_URL}/uploads/${uploadId}/finalize`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Finalize failed: ${res.status}`)
      }
    },

    async getStatus(uploadId: string): Promise<{ status: UploadStatus }> {
      const res = await fetch(`${BASE_URL}/uploads/${uploadId}/status`)
      if (!res.ok) throw new Error(`Get status failed: ${res.status} ${res.statusText}`)
      return res.json() as Promise<{ status: UploadStatus }>
    },

    async cancel(uploadId: string): Promise<void> {
      const res = await fetch(`${BASE_URL}/uploads/${uploadId}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 404) {
        throw new Error(`Cancel failed: ${res.status} ${res.statusText}`)
      }
    },
  }
}
