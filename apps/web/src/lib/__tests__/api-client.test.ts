import { describe, it, expect, vi, afterEach } from 'vitest'
import { createApiClient, BASE_URL } from '../api-client'

function mockFetch(response: {
  ok: boolean
  status?: number
  statusText?: string
  body?: unknown
}) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValueOnce({
      ok: response.ok,
      status: response.status ?? 200,
      statusText: response.statusText ?? 'OK',
      json: vi.fn().mockResolvedValue(response.body ?? {}),
    }),
  )
}

describe('api-client (web)', () => {
  const client = createApiClient()

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('initiate', () => {
    it('sends POST to /uploads/initiate with correct body', async () => {
      mockFetch({ ok: true, body: { uploadId: 'uid-1', totalChunks: 3 } })

      const result = await client.initiate({
        id: 'file-abc',
        name: 'photo.jpg',
        size: 3_000_000,
        mimeType: 'image/jpeg',
      })

      expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/uploads/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: 'file-abc',
          name: 'photo.jpg',
          size: 3_000_000,
          mimeType: 'image/jpeg',
        }),
      })
      expect(result).toEqual({ uploadId: 'uid-1', totalChunks: 3 })
    })

    it('throws on non-ok response', async () => {
      mockFetch({ ok: false, status: 422, statusText: 'Unprocessable Entity' })

      await expect(
        client.initiate({
          id: 'f',
          name: 'f.jpg',
          size: 1,
          mimeType: 'image/jpeg',
        }),
      ).rejects.toThrow('422')
    })
  })

  describe('uploadChunk', () => {
    it('sends FormData POST to correct URL', async () => {
      mockFetch({ ok: true })
      await client.uploadChunk('upload-99', 2, new ArrayBuffer(8))

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/uploads/upload-99/chunks/2`,
        expect.objectContaining({ method: 'POST' }),
      )
      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(init.body).toBeInstanceOf(FormData)
    })

    it('wraps ArrayBuffer in a Blob before appending', async () => {
      mockFetch({ ok: true })
      await client.uploadChunk('uid', 0, new ArrayBuffer(16))

      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(init.body).toBeInstanceOf(FormData)
    })

    it('passes Blob directly without double-wrapping', async () => {
      mockFetch({ ok: true })
      const blob = new Blob(['data'], { type: 'application/octet-stream' })
      await client.uploadChunk('uid', 0, blob)
      expect(fetch).toHaveBeenCalled()
    })

    it('forwards AbortSignal to fetch', async () => {
      mockFetch({ ok: true })
      const ctrl = new AbortController()
      await client.uploadChunk('uid', 0, new ArrayBuffer(4), ctrl.signal)

      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(init.signal).toBe(ctrl.signal)
    })

    it('throws on non-ok response', async () => {
      mockFetch({ ok: false, status: 500, statusText: 'Server Error' })
      await expect(
        client.uploadChunk('uid', 0, new ArrayBuffer(4)),
      ).rejects.toThrow('500')
    })
  })

  describe('finalize', () => {
    it('sends POST to the finalize endpoint', async () => {
      mockFetch({ ok: true })
      await client.finalize('upload-42')
      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/uploads/upload-42/finalize`,
        { method: 'POST' },
      )
    })

    it('extracts error message from response body on failure', async () => {
      mockFetch({
        ok: false,
        status: 409,
        body: { error: 'Already finalized' },
      })
      await expect(client.finalize('uid')).rejects.toThrow('Already finalized')
    })

    it('falls back to status code when body has no error field', async () => {
      mockFetch({ ok: false, status: 500, body: {} })
      await expect(client.finalize('uid')).rejects.toThrow('500')
    })
  })

  describe('getStatus', () => {
    it('sends GET to the status endpoint and returns parsed body', async () => {
      mockFetch({ ok: true, body: { status: 'uploading' } })
      const result = await client.getStatus('upload-55')
      expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/uploads/upload-55/status`)
      expect(result).toEqual({ status: 'uploading' })
    })

    it('throws on non-ok response', async () => {
      mockFetch({ ok: false, status: 404, statusText: 'Not Found' })
      await expect(client.getStatus('uid')).rejects.toThrow('404')
    })
  })

  describe('cancel', () => {
    it('sends DELETE to /uploads/{uploadId}', async () => {
      mockFetch({ ok: true })
      await client.cancel('upload-77')
      expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/uploads/upload-77`, {
        method: 'DELETE',
      })
    })

    it('does not throw on 404 — upload already gone', async () => {
      mockFetch({ ok: false, status: 404, statusText: 'Not Found' })
      await expect(client.cancel('uid')).resolves.toBeUndefined()
    })

    it('throws on other non-ok responses', async () => {
      mockFetch({ ok: false, status: 500, statusText: 'Server Error' })
      await expect(client.cancel('uid')).rejects.toThrow('500')
    })
  })
})
