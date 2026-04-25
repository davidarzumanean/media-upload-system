import type {
  ApiClient,
  FileDescriptor,
  UploadStatus,
} from '@media-upload/core'

export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:8000/api'

const appendReactNativeFile = (
  formData: FormData,
  fieldName: string,
  file: {
    uri: string
    type: string
    name: string
  },
) => {
  formData.append(fieldName, file as unknown as Blob)
}

export function createApiClient(): ApiClient {
  return {
    async initiate(
      file: FileDescriptor,
    ): Promise<{ uploadId: string; totalChunks: number }> {
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
      if (!res.ok)
        throw new Error(`Initiate failed: ${res.status} ${res.statusText}`)
      return res.json() as Promise<{ uploadId: string; totalChunks: number }>
    },

    async uploadChunk(
      uploadId: string,
      chunkIndex: number,
      data: Blob | ArrayBuffer,
      signal?: AbortSignal,
    ): Promise<void> {
      // React Native doesn't support Blob from ArrayBuffer.
      // Convert ArrayBuffer to base64 and send as a file-like object.
      let base64: string
      if (data instanceof ArrayBuffer) {
        const bytes = new Uint8Array(data)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i])
        }
        base64 = btoa(binary)
      } else {
        throw new Error('Expected ArrayBuffer from chunk reader')
      }

      const form = new FormData()
      appendReactNativeFile(form, 'chunk', {
        uri: `data:application/octet-stream;base64,${base64}`,
        type: 'application/octet-stream',
        name: 'chunk.bin',
      })

      const res = await fetch(
        `${BASE_URL}/uploads/${uploadId}/chunks/${chunkIndex}`,
        {
          method: 'POST',
          body: form,
          signal,
        },
      )
      if (!res.ok)
        throw new Error(`Chunk upload failed: ${res.status} ${res.statusText}`)
    },

    async finalize(uploadId: string): Promise<void> {
      const res = await fetch(`${BASE_URL}/uploads/${uploadId}/finalize`, {
        method: 'POST',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Finalize failed: ${res.status}`)
      }
    },

    async getStatus(uploadId: string): Promise<{ status: UploadStatus }> {
      const res = await fetch(`${BASE_URL}/uploads/${uploadId}/status`)
      if (!res.ok)
        throw new Error(`Get status failed: ${res.status} ${res.statusText}`)
      return res.json() as Promise<{ status: UploadStatus }>
    },

    async cancel(uploadId: string): Promise<void> {
      const res = await fetch(`${BASE_URL}/uploads/${uploadId}`, {
        method: 'DELETE',
      })
      if (!res.ok && res.status !== 404) {
        throw new Error(`Cancel failed: ${res.status} ${res.statusText}`)
      }
    },
  }
}
