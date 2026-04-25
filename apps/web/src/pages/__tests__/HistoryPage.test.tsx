import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HistoryPage } from '../HistoryPage'
import type { HistoryEntry } from '../../hooks/useUploadManager'

// ── Mock context ──────────────────────────────────────────────────────────────

const mockHistory: HistoryEntry[] = []
const mockClearHistory = vi.fn()

vi.mock('../../context/UploadManagerContext', () => ({
  useUploadManagerContext: () => ({
    history: mockHistory,
    clearHistory: mockClearHistory,
    snapshot: { sessions: {} },
    speeds: {},
    validationErrors: [],
    addFiles: vi.fn(),
    clearErrors: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    cancel: vi.fn(),
    retry: vi.fn(),
    retryAllFailed: vi.fn(),
    dismiss: vi.fn(),
    clearAll: vi.fn(),
  }),
}))

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: 'uid-1',
    name: 'photo.jpg',
    size: 1024 * 512,
    mimeType: 'image/jpeg',
    completedAt: '2024-06-15T14:30:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockHistory.length = 0
})

// ── Thumbnail rendering ───────────────────────────────────────────────────────

describe('HistoryPage — thumbnail rendering', () => {
  it('renders an img with the API file URL for image entries', () => {
    mockHistory.push(makeEntry({ id: 'uid-image', mimeType: 'image/jpeg' }))
    const { container } = render(<HistoryPage />)

    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img).toHaveAttribute(
      'src',
      'http://localhost:8000/api/uploads/uid-image/file',
    )
  })

  it('does not render an img for video entries', () => {
    mockHistory.push(makeEntry({ id: 'uid-video', mimeType: 'video/mp4' }))
    const { container } = render(<HistoryPage />)

    // No thumbnail image — FilmIcon SVG is rendered instead
    expect(container.querySelector('img')).toBeNull()
    // Entry itself is still rendered
    expect(screen.getByText('photo.jpg')).toBeInTheDocument()
  })

  it('renders an img for each image entry', () => {
    mockHistory.push(
      makeEntry({ id: 'img-1', mimeType: 'image/jpeg' }),
      makeEntry({ id: 'img-2', mimeType: 'image/png', name: 'banner.png' }),
    )
    const { container } = render(<HistoryPage />)

    const images = container.querySelectorAll('img')
    expect(images).toHaveLength(2)
    expect(images[0]).toHaveAttribute(
      'src',
      'http://localhost:8000/api/uploads/img-1/file',
    )
    expect(images[1]).toHaveAttribute(
      'src',
      'http://localhost:8000/api/uploads/img-2/file',
    )
  })

  it('falls back to no image when onError fires', () => {
    mockHistory.push(makeEntry({ id: 'uid-broken', mimeType: 'image/jpeg' }))
    const { container } = render(<HistoryPage />)

    const img = container.querySelector('img')
    expect(img).not.toBeNull()

    // Simulate load error (e.g. file cleaned up on server)
    fireEvent.error(img!)

    // After error the img should be replaced by the fallback icon
    expect(container.querySelector('img')).toBeNull()
  })
})
