/**
 * Mobile chunk reader — uses expo-file-system (legacy API) to read byte
 * ranges from a file URI, then converts the base-64 payload back to an
 * ArrayBuffer.
 *
 * Registered files are keyed by FileDescriptor.id so the UploadManager can
 * call chunkReader() without holding onto the raw file URI itself.
 */
import {
  readAsStringAsync,
  EncodingType,
} from 'expo-file-system/legacy'
import type { ChunkReader, FileDescriptor } from '@media-upload/core'

// Maps fileDescriptor.id → local file URI (e.g. "file:///...").
const registry = new Map<string, string>()

export function registerFile(descriptor: FileDescriptor, uri: string): void {
  registry.set(descriptor.id, uri)
}

export function unregisterFile(fileId: string): void {
  registry.delete(fileId)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // atob is available in React Native's Hermes engine since RN 0.70
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export const chunkReader: ChunkReader = async (
  descriptor: FileDescriptor,
  chunkIndex: number,
  chunkSize: number,
): Promise<ArrayBuffer> => {
  const uri = registry.get(descriptor.id)
  if (!uri) throw new Error(`File not registered: ${descriptor.id}`)

  const position = chunkIndex * chunkSize
  const length = Math.min(chunkSize, descriptor.size - position)

  const base64 = await readAsStringAsync(uri, {
    encoding: EncodingType.Base64,
    position,
    length,
  })

  return base64ToArrayBuffer(base64)
}
