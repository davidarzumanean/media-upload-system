import { describe, it, expect, afterEach } from 'vitest'
import { registerFile, unregisterFile, chunkReader } from '../chunk-reader'
import type { FileDescriptor } from '@media-upload/core'

// A small text file whose byte offsets are easy to reason about
const CONTENT = 'abcdefghij' // exactly 10 bytes as ASCII
const CHUNK_SIZE = 4

function makeDescriptor(overrides?: Partial<FileDescriptor>): FileDescriptor {
  return {
    id: 'test-file',
    name: 'test.txt',
    size: CONTENT.length,
    mimeType: 'text/plain',
    ...overrides,
  }
}

afterEach(() => {
  unregisterFile('test-file')
})

describe('chunkReader', () => {
  it('throws when the file has not been registered', async () => {
    const descriptor = makeDescriptor()
    await expect(chunkReader(descriptor, 0, CHUNK_SIZE)).rejects.toThrow(
      'File not registered: test-file',
    )
  })

  it('reads the first chunk at the correct byte offset', async () => {
    const file = new File([CONTENT], 'test.txt', { type: 'text/plain' })
    const descriptor = makeDescriptor()
    registerFile(descriptor, file)

    const chunk = (await chunkReader(descriptor, 0, CHUNK_SIZE)) as Blob
    expect(chunk.size).toBe(CHUNK_SIZE)
    expect(await chunk.text()).toBe('abcd')
  })

  it('reads a middle chunk at the correct byte offset', async () => {
    const file = new File([CONTENT], 'test.txt', { type: 'text/plain' })
    const descriptor = makeDescriptor()
    registerFile(descriptor, file)

    const chunk = (await chunkReader(descriptor, 1, CHUNK_SIZE)) as Blob
    expect(chunk.size).toBe(CHUNK_SIZE)
    expect(await chunk.text()).toBe('efgh')
  })

  it('reads the last chunk which is smaller than CHUNK_SIZE', async () => {
    // 10 bytes / 4 per chunk → chunk 2 covers bytes 8–9 (2 bytes)
    const file = new File([CONTENT], 'test.txt', { type: 'text/plain' })
    const descriptor = makeDescriptor()
    registerFile(descriptor, file)

    const chunk = (await chunkReader(descriptor, 2, CHUNK_SIZE)) as Blob
    expect(chunk.size).toBe(2)
    expect(await chunk.text()).toBe('ij')
  })

  it('reads a single-chunk file whose size equals CHUNK_SIZE exactly', async () => {
    const content = 'abcd'
    const file = new File([content], 'exact.txt', { type: 'text/plain' })
    const descriptor = makeDescriptor({ id: 'test-file', size: 4 })
    registerFile(descriptor, file)

    const chunk = (await chunkReader(descriptor, 0, CHUNK_SIZE)) as Blob
    expect(chunk.size).toBe(CHUNK_SIZE)
    expect(await chunk.text()).toBe('abcd')
  })

  it('unregisterFile removes the file so subsequent reads throw', async () => {
    const file = new File([CONTENT], 'test.txt', { type: 'text/plain' })
    const descriptor = makeDescriptor()
    registerFile(descriptor, file)
    unregisterFile(descriptor.id)

    await expect(chunkReader(descriptor, 0, CHUNK_SIZE)).rejects.toThrow(
      'File not registered: test-file',
    )
  })
})
