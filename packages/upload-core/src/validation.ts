import type { FileDescriptor, ValidationError } from './types.js'
import { formatFileSize } from './format.js'

export const DEFAULT_MAX_SIZE_BYTES = 100 * 1024 * 1024 // 100 MB
export const DEFAULT_MAX_FILES = 10

export interface ValidationOptions {
  maxFiles?: number
  maxSizeBytes?: number
}

export interface ValidationResult {
  valid: FileDescriptor[]
  errors: ValidationError[]
}

export function validateFiles(
  files: FileDescriptor[],
  options: ValidationOptions = {},
): ValidationResult {
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES
  const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES

  const valid: FileDescriptor[] = []
  const errors: ValidationError[] = []

  if (files.length > maxFiles) {
    // Reject all files beyond the limit
    for (const file of files.slice(maxFiles)) {
      errors.push({
        fileId: file.id,
        fileName: file.name,
        reason: `Exceeds maximum file count of ${maxFiles}`,
      })
    }
  }

  const candidates = files.slice(0, maxFiles)

  for (const file of candidates) {
    if (
      !file.mimeType.startsWith('image/') &&
      !file.mimeType.startsWith('video/')
    ) {
      errors.push({
        fileId: file.id,
        fileName: file.name,
        reason: `Unsupported file type "${file.mimeType}". Only image/* and video/* are allowed`,
      })
      continue
    }

    if (file.size <= 0) {
      errors.push({
        fileId: file.id,
        fileName: file.name,
        reason: `${file.name} has no size — the file may be empty or unreadable`,
      })
      continue
    }

    if (file.size > maxSizeBytes) {
      errors.push({
        fileId: file.id,
        fileName: file.name,
        reason: `${file.name} (${formatFileSize(file.size)}) exceeds the ${formatFileSize(maxSizeBytes)} limit`,
      })
      continue
    }

    valid.push(file)
  }

  return { valid, errors }
}
