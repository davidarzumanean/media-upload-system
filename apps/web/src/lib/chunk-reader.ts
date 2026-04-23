import type { ChunkReader, FileDescriptor } from '@media-upload/core'

// Maps file.id → the original File object. Populated by useUploadManager before starting.
const fileRegistry = new Map<string, File>()

export function registerFile(fileDescriptor: FileDescriptor, file: File): void {
  fileRegistry.set(fileDescriptor.id, file)
}

export function unregisterFile(fileId: string): void {
  fileRegistry.delete(fileId)
}

export const chunkReader: ChunkReader = async (
  fileDescriptor: FileDescriptor,
  chunkIndex: number,
  chunkSize: number,
): Promise<Blob> => {
  const file = fileRegistry.get(fileDescriptor.id)
  if (!file) throw new Error(`File not registered: ${fileDescriptor.id}`)

  const start = chunkIndex * chunkSize
  const end = Math.min(start + chunkSize, file.size)
  return file.slice(start, end)
}
