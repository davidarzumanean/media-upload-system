import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UploadHistory } from '../UploadHistory'
import type { HistoryEntry } from '../../hooks/useUploadManager'

// ── Helpers ───────────────────────────────────────────────────────────────────

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

beforeEach(() => vi.clearAllMocks())

// ── Empty state ───────────────────────────────────────────────────────────────

describe('UploadHistory — empty state', () => {
  it('renders nothing when the history list is empty', () => {
    const { container } = render(<UploadHistory history={[]} onClear={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})

// ── Populated state ───────────────────────────────────────────────────────────

describe('UploadHistory — with entries', () => {
  it('renders each filename', () => {
    const history = [
      makeEntry({ id: '1', name: 'alpha.jpg' }),
      makeEntry({ id: '2', name: 'beta.mp4', mimeType: 'video/mp4' }),
    ]
    render(<UploadHistory history={history} onClear={vi.fn()} />)
    expect(screen.getByText('alpha.jpg')).toBeInTheDocument()
    expect(screen.getByText('beta.mp4')).toBeInTheDocument()
  })

  it('renders the mime type for each entry', () => {
    const history = [makeEntry({ mimeType: 'video/mp4' })]
    render(<UploadHistory history={history} onClear={vi.fn()} />)
    // The meta line renders "{size} · {mimeType}" split across text nodes;
    // scope to the list item and use toHaveTextContent to concatenate them.
    const [item] = screen.getAllByRole('listitem')
    expect(item).toHaveTextContent('video/mp4')
  })

  it('renders a formatted file size for each entry', () => {
    // formatFileSize(512 * 1024) → "512.0 KB", rendered alongside the mime
    // type in one <p>; scope to the listitem and check concatenated text.
    const history = [makeEntry({ size: 512 * 1024 })]
    render(<UploadHistory history={history} onClear={vi.fn()} />)
    const [item] = screen.getAllByRole('listitem')
    // formatFileSize(512 * 1024) → "512.0 KB"
    expect(item).toHaveTextContent('512.0 KB')
  })

  it('renders a <time> element with the ISO completedAt as dateTime', () => {
    const history = [makeEntry({ completedAt: '2024-06-15T14:30:00.000Z' })]
    render(<UploadHistory history={history} onClear={vi.fn()} />)
    const time = screen.getByRole('time' as never) as HTMLTimeElement
    expect(time.dateTime).toBe('2024-06-15T14:30:00.000Z')
  })

  it('shows a "History" section heading', () => {
    render(<UploadHistory history={[makeEntry()]} onClear={vi.fn()} />)
    expect(screen.getByText(/history/i)).toBeInTheDocument()
  })

  it('shows a file count in the heading', () => {
    const history = [makeEntry({ id: '1' }), makeEntry({ id: '2', name: 'b.jpg' })]
    render(<UploadHistory history={history} onClear={vi.fn()} />)
    expect(screen.getByText(/2 files/i)).toBeInTheDocument()
  })

  it('uses singular "1 file" when there is exactly one entry', () => {
    render(<UploadHistory history={[makeEntry()]} onClear={vi.fn()} />)
    // Should say "1 file", not "1 files"
    expect(screen.getByText('1 file')).toBeInTheDocument()
  })
})

// ── Clear all ─────────────────────────────────────────────────────────────────

describe('UploadHistory — clear all', () => {
  it('renders a "Clear all" button', () => {
    render(<UploadHistory history={[makeEntry()]} onClear={vi.fn()} />)
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
  })

  it('calls onClear when "Clear all" is clicked', async () => {
    const onClear = vi.fn()
    const user = userEvent.setup()
    render(<UploadHistory history={[makeEntry()]} onClear={onClear} />)
    await user.click(screen.getByRole('button', { name: /clear/i }))
    expect(onClear).toHaveBeenCalledOnce()
  })

  it('does not call onClear before the button is clicked', () => {
    const onClear = vi.fn()
    render(<UploadHistory history={[makeEntry()]} onClear={onClear} />)
    expect(onClear).not.toHaveBeenCalled()
  })
})
