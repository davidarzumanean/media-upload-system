import { readAsStringAsync } from 'expo-file-system/legacy'
import { chunkReader, registerFile, unregisterFile } from '../chunk-reader'
import type { FileDescriptor } from '@media-upload/core'

const mockReadAsStringAsync = readAsStringAsync as jest.Mock

function makeDescriptor(overrides: Partial<FileDescriptor> = {}): FileDescriptor {
  return {
    id: 'file-1',
    name: 'test.jpg',
    size: 1024,
    mimeType: 'image/jpeg',
    ...overrides,
  }
}

beforeEach(() => {
  mockReadAsStringAsync.mockReset()
})

describe('chunkReader', () => {
  it('throws if the file is not registered', async () => {
    const descriptor = makeDescriptor({ id: 'unregistered' })
    await expect(chunkReader(descriptor, 0, 512)).rejects.toThrow(
      'File not registered: unregistered',
    )
  })

  it('calls readAsStringAsync with correct position and length for first chunk', async () => {
    const descriptor = makeDescriptor({ id: 'file-pos', size: 3000 })
    registerFile(descriptor, 'file:///test.jpg')

    // Return a minimal valid base64 string
    mockReadAsStringAsync.mockResolvedValueOnce(btoa('hello'))

    await chunkReader(descriptor, 0, 1024)

    expect(mockReadAsStringAsync).toHaveBeenCalledWith('file:///test.jpg', {
      encoding: 'base64',
      position: 0,
      length: 1024,
    })

    unregisterFile(descriptor.id)
  })

  it('calls readAsStringAsync with correct position for second chunk', async () => {
    const descriptor = makeDescriptor({ id: 'file-chunk2', size: 3000 })
    registerFile(descriptor, 'file:///test.jpg')

    mockReadAsStringAsync.mockResolvedValueOnce(btoa('world'))

    await chunkReader(descriptor, 1, 1024)

    expect(mockReadAsStringAsync).toHaveBeenCalledWith('file:///test.jpg', {
      encoding: 'base64',
      position: 1024,
      length: 1024,
    })

    unregisterFile(descriptor.id)
  })

  it('uses a smaller length for the last chunk when size is not evenly divisible', async () => {
    // 2500 bytes, chunk size 1024 → last chunk at index 2 is 2500 - 2048 = 452 bytes
    const descriptor = makeDescriptor({ id: 'file-partial', size: 2500 })
    registerFile(descriptor, 'file:///partial.bin')

    mockReadAsStringAsync.mockResolvedValueOnce(btoa('x'.repeat(5)))

    await chunkReader(descriptor, 2, 1024)

    expect(mockReadAsStringAsync).toHaveBeenCalledWith('file:///partial.bin', {
      encoding: 'base64',
      position: 2048,
      length: 452,
    })

    unregisterFile(descriptor.id)
  })

  it('converts base64 to ArrayBuffer correctly', async () => {
    const descriptor = makeDescriptor({ id: 'file-b64', size: 5 })
    registerFile(descriptor, 'file:///data.bin')

    // 5 bytes: [72, 101, 108, 108, 111] = "Hello"
    mockReadAsStringAsync.mockResolvedValueOnce(btoa('Hello'))

    const result = await chunkReader(descriptor, 0, 1024)

    expect(result).toBeInstanceOf(ArrayBuffer)
    const view = new Uint8Array(result as ArrayBuffer)
    expect(Array.from(view)).toEqual([72, 101, 108, 108, 111])

    unregisterFile(descriptor.id)
  })
})