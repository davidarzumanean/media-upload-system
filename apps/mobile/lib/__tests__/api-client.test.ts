import { createApiClient, BASE_URL } from '../api-client'

function mockFetch(response: {
  ok: boolean
  status?: number
  statusText?: string
  body?: unknown
}) {
  globalThis.fetch = jest.fn().mockResolvedValueOnce({
    ok: response.ok,
    status: response.status ?? 200,
    statusText: response.statusText ?? 'OK',
    json: jest.fn().mockResolvedValue(response.body ?? {}),
  } as unknown as Response)
}

describe('api-client', () => {
  const client = createApiClient()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('initiate', () => {
    it('sends POST to /uploads/initiate with correct body fields', async () => {
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
    it('sends FormData to the correct URL with uploadId and chunkIndex', async () => {
      mockFetch({ ok: true })

      const data = new ArrayBuffer(8)
      await client.uploadChunk('upload-99', 2, data)

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/uploads/upload-99/chunks/2`,
        expect.objectContaining({ method: 'POST' }),
      )

      const call = (fetch as jest.Mock).mock.calls[0]
      expect(call[1].body).toBeInstanceOf(FormData)
    })

    it('converts ArrayBuffer to base64 before uploading', async () => {
      mockFetch({ ok: true })
      const btoaSpy = jest.spyOn(globalThis, 'btoa')

      const data = new ArrayBuffer(16)
      new Uint8Array(data).fill(0x41) // fill with 'A' bytes
      await client.uploadChunk('uid', 0, data)

      expect(btoaSpy).toHaveBeenCalled()
      btoaSpy.mockRestore()
    })

    it('throws when a Blob is passed instead of an ArrayBuffer', async () => {
      const blob = new Blob(['data'], { type: 'application/octet-stream' })
      await expect(
        client.uploadChunk('uid', 0, blob),
      ).rejects.toThrow('Expected ArrayBuffer')
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

    it('throws on non-ok response', async () => {
      mockFetch({
        ok: false,
        status: 409,
        body: { error: 'Already finalized' },
      })
      await expect(client.finalize('uid')).rejects.toThrow('Already finalized')
    })
  })

  describe('cancel', () => {
    it('sends DELETE request to /uploads/{uploadId}', async () => {
      mockFetch({ ok: true })

      await client.cancel!('upload-77')

      expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/uploads/upload-77`, {
        method: 'DELETE',
      })
    })

    it('does not throw on 404 (already gone)', async () => {
      mockFetch({ ok: false, status: 404, statusText: 'Not Found' })
      await expect(client.cancel!('uid')).resolves.toBeUndefined()
    })

    it('throws on other non-ok responses', async () => {
      mockFetch({ ok: false, status: 500, statusText: 'Server Error' })
      await expect(client.cancel!('uid')).rejects.toThrow('500')
    })
  })
})
