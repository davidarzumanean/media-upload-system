import { describe, it, expect } from 'vitest'
import { validateFiles } from '../validation.js'
import type { FileDescriptor } from '../types.js'

function makeFile(
  overrides: Partial<FileDescriptor> & { id: string },
): FileDescriptor {
  return {
    name: 'file.jpg',
    size: 1024,
    mimeType: 'image/jpeg',
    ...overrides,
  }
}

describe('validateFiles', () => {
  it('accepts valid image and video files', () => {
    const files = [
      makeFile({ id: '1', mimeType: 'image/jpeg' }),
      makeFile({ id: '2', mimeType: 'video/mp4', name: 'clip.mp4' }),
      makeFile({ id: '3', mimeType: 'image/png', name: 'photo.png' }),
    ]
    const { valid, errors } = validateFiles(files)
    expect(valid).toHaveLength(3)
    expect(errors).toHaveLength(0)
  })

  it('rejects files with unsupported MIME types', () => {
    const files = [
      makeFile({ id: '1', mimeType: 'application/pdf', name: 'doc.pdf' }),
      makeFile({ id: '2', mimeType: 'text/plain', name: 'notes.txt' }),
      makeFile({ id: '3', mimeType: 'image/jpeg' }),
    ]
    const { valid, errors } = validateFiles(files)
    expect(valid).toHaveLength(1)
    expect(errors).toHaveLength(2)
    expect(errors[0].fileId).toBe('1')
    expect(errors[1].fileId).toBe('2')
  })

  it('rejects files exceeding the default 100 MB size limit', () => {
    const over100MB = 101 * 1024 * 1024
    const files = [
      makeFile({ id: '1', size: over100MB }),
      makeFile({ id: '2', size: 1024 }),
    ]
    const { valid, errors } = validateFiles(files)
    expect(valid).toHaveLength(1)
    expect(valid[0].id).toBe('2')
    expect(errors).toHaveLength(1)
    expect(errors[0].fileId).toBe('1')
  })

  it('size error message includes the file name, formatted size, and formatted limit', () => {
    const size = Math.round(250.3 * 1024 * 1024)
    const files = [makeFile({ id: '1', name: 'bigvideo.mp4', size })]
    const { errors } = validateFiles(files)
    expect(errors).toHaveLength(1)
    expect(errors[0].reason).toContain('bigvideo.mp4')
    expect(errors[0].reason).toMatch(/250\.\d MB/) // e.g. "250.3 MB"
    expect(errors[0].reason).toContain('100.0 MB') // the default limit
  })

  it('respects a custom maxSizeBytes option', () => {
    const files = [
      makeFile({ id: '1', size: 500 }),
      makeFile({ id: '2', size: 1500 }),
    ]
    const { valid, errors } = validateFiles(files, { maxSizeBytes: 1000 })
    expect(valid).toHaveLength(1)
    expect(valid[0].id).toBe('1')
    expect(errors[0].fileId).toBe('2')
  })

  it('enforces a maximum of 10 files by default', () => {
    const files = Array.from({ length: 12 }, (_, i) =>
      makeFile({ id: String(i), name: `file${i}.jpg` }),
    )
    const { valid, errors } = validateFiles(files)
    expect(valid).toHaveLength(10)
    expect(errors).toHaveLength(2)
    expect(errors[0].reason).toMatch(/maximum file count/)
  })

  it('respects a custom maxFiles option', () => {
    const files = Array.from({ length: 5 }, (_, i) =>
      makeFile({ id: String(i) }),
    )
    const { valid, errors } = validateFiles(files, { maxFiles: 3 })
    expect(valid).toHaveLength(3)
    expect(errors).toHaveLength(2)
  })

  it('returns empty arrays for an empty input', () => {
    const { valid, errors } = validateFiles([])
    expect(valid).toHaveLength(0)
    expect(errors).toHaveLength(0)
  })
})
