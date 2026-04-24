import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DropZone } from '../DropZone'
import type { ValidationError } from '@media-upload/core'

// ── Mock react-dropzone ───────────────────────────────────────────────────────
// Capture the callbacks the component passes to useDropzone so tests can
// invoke them directly, avoiding jsdom drag-and-drop limitations.

const mockUseDropzone = vi.hoisted(() => vi.fn())
vi.mock('react-dropzone', () => ({ useDropzone: mockUseDropzone }))

// ── Helpers ───────────────────────────────────────────────────────────────────

interface Captured {
  onDrop: (files: File[]) => void
  onDropRejected: () => void
}

/**
 * Configures the useDropzone mock. Returns a stable object whose properties
 * are mutated in-place each time the mock runs so callers always see the
 * latest callbacks — even after re-renders triggered by props changes.
 */
function setupMock(isDragActive = false): Captured {
  const captured: Captured = { onDrop: () => {}, onDropRejected: () => {} }

  mockUseDropzone.mockImplementation((opts: Captured) => {
    // Mutate in-place; do NOT reassign `captured` — callers hold a reference.
    captured.onDrop = opts.onDrop
    captured.onDropRejected = opts.onDropRejected
    return {
      getRootProps: () => ({ 'data-testid': 'dz-root' }),
      getInputProps: () => ({ 'data-testid': 'dz-input' }),
      isDragActive,
    }
  })

  return captured
}

function makeValidationErrors(count = 1): ValidationError[] {
  return Array.from({ length: count }, (_, i) => ({
    fileId: `id-${i}`,
    fileName: `bad-file-${i}.exe`,
    reason: 'Unsupported file type',
  }))
}

beforeEach(() => vi.clearAllMocks())

// ── Full drop zone ────────────────────────────────────────────────────────────

describe('DropZone (full / idle)', () => {
  it('renders the headline text', () => {
    setupMock()
    render(<DropZone onFiles={vi.fn()} validationErrors={[]} onClearErrors={vi.fn()} />)
    // The <h2> heading now reads "Upload media" (mobile-aligned empty state)
    expect(screen.getByText(/upload media/i)).toBeInTheDocument()
  })

  it('renders the helper text with file count', () => {
    setupMock()
    render(<DropZone onFiles={vi.fn()} validationErrors={[]} onClearErrors={vi.fn()} />)
    // The helper text has JSX interpolation that splits it into multiple text
    // nodes; toHaveTextContent concatenates them before matching.
    const dropzone = screen.getByRole('button', { name: /upload files/i })
    expect(dropzone).toHaveTextContent(/images & videos/i)
    expect(dropzone).toHaveTextContent(/up to 10 files/i)
  })

  it('reflects the maxFiles prop in the helper text', () => {
    setupMock()
    render(
      <DropZone onFiles={vi.fn()} validationErrors={[]} onClearErrors={vi.fn()} maxFiles={5} />,
    )
    const dropzone = screen.getByRole('button', { name: /upload files/i })
    expect(dropzone).toHaveTextContent(/up to 5 files/i)
  })

  it('defaults to 10 files when maxFiles is not specified', () => {
    setupMock()
    render(<DropZone onFiles={vi.fn()} validationErrors={[]} onClearErrors={vi.fn()} />)
    const dropzone = screen.getByRole('button', { name: /upload files/i })
    expect(dropzone).toHaveTextContent(/up to 10 files/i)
  })

  it('passes accept: image/* and video/* to useDropzone', () => {
    setupMock()
    render(<DropZone onFiles={vi.fn()} validationErrors={[]} onClearErrors={vi.fn()} />)
    expect(mockUseDropzone).toHaveBeenCalledWith(
      expect.objectContaining({ accept: { 'image/*': [], 'video/*': [] } }),
    )
  })

  it('passes maxFiles to useDropzone', () => {
    setupMock()
    render(
      <DropZone onFiles={vi.fn()} validationErrors={[]} onClearErrors={vi.fn()} maxFiles={3} />,
    )
    expect(mockUseDropzone).toHaveBeenCalledWith(
      expect.objectContaining({ maxFiles: 3 }),
    )
  })

  it('calls onFiles when accepted files are dropped', async () => {
    const captured = setupMock()
    const onFiles = vi.fn()
    render(<DropZone onFiles={onFiles} validationErrors={[]} onClearErrors={vi.fn()} />)

    const files = [
      new File(['img'], 'photo.jpg', { type: 'image/jpeg' }),
      new File(['vid'], 'clip.mp4', { type: 'video/mp4' }),
    ]
    await act(async () => captured.onDrop(files))

    expect(onFiles).toHaveBeenCalledWith(files)
  })

  it('calls onClearErrors when accepted files are dropped', async () => {
    const captured = setupMock()
    const onClearErrors = vi.fn()
    render(<DropZone onFiles={vi.fn()} validationErrors={[]} onClearErrors={onClearErrors} />)

    await act(async () =>
      captured.onDrop([new File(['a'], 'a.jpg', { type: 'image/jpeg' })]),
    )
    expect(onClearErrors).toHaveBeenCalledOnce()
  })

  it('does not call onFiles when the drop contains no accepted files', async () => {
    const captured = setupMock()
    const onFiles = vi.fn()
    render(<DropZone onFiles={onFiles} validationErrors={[]} onClearErrors={vi.fn()} />)

    await act(async () => captured.onDrop([]))
    expect(onFiles).not.toHaveBeenCalled()
  })

  it('shows the rejection message when onDropRejected fires', async () => {
    const captured = setupMock()
    render(<DropZone onFiles={vi.fn()} validationErrors={[]} onClearErrors={vi.fn()} />)

    await act(async () => captured.onDropRejected())

    // After rejection the dropzone re-renders with the error copy
    await waitFor(() => {
      const dropzone = screen.getByRole('button', { name: /upload files/i })
      expect(dropzone).toHaveTextContent(/max 10 files/i)
    })
  })

  it('reflects maxFiles in the rejection message', async () => {
    const captured = setupMock()
    render(
      <DropZone onFiles={vi.fn()} validationErrors={[]} onClearErrors={vi.fn()} maxFiles={3} />,
    )

    await act(async () => captured.onDropRejected())

    await waitFor(() => {
      const dropzone = screen.getByRole('button', { name: /upload files/i })
      expect(dropzone).toHaveTextContent(/max 3 files/i)
    })
  })
})

// ── Compact strip ─────────────────────────────────────────────────────────────

describe('DropZone (compact strip)', () => {
  it('renders the "Add more files" label in compact mode', () => {
    setupMock()
    render(
      <DropZone onFiles={vi.fn()} validationErrors={[]} onClearErrors={vi.fn()} compact />,
    )
    expect(screen.getByText(/add more files/i)).toBeInTheDocument()
  })

  it('calls onFiles from the compact strip', async () => {
    const captured = setupMock()
    const onFiles = vi.fn()
    render(<DropZone onFiles={onFiles} validationErrors={[]} onClearErrors={vi.fn()} compact />)

    const file = new File(['x'], 'extra.jpg', { type: 'image/jpeg' })
    await act(async () => captured.onDrop([file]))
    expect(onFiles).toHaveBeenCalledWith([file])
  })
})

// ── Validation error banner ───────────────────────────────────────────────────

describe('DropZone — validation error banner', () => {
  it('renders each rejected filename and reason', () => {
    setupMock()
    const errors = makeValidationErrors(2)
    render(<DropZone onFiles={vi.fn()} validationErrors={errors} onClearErrors={vi.fn()} />)

    expect(screen.getByText(/2 files? rejected/i)).toBeInTheDocument()
    expect(screen.getByText('bad-file-0.exe')).toBeInTheDocument()
    expect(screen.getByText('bad-file-1.exe')).toBeInTheDocument()
    expect(screen.getAllByText(/unsupported file type/i)).toHaveLength(2)
  })

  it('shows singular "1 file rejected" for a single error', () => {
    setupMock()
    render(
      <DropZone
        onFiles={vi.fn()}
        validationErrors={makeValidationErrors(1)}
        onClearErrors={vi.fn()}
      />,
    )
    expect(screen.getByText(/1 file rejected/i)).toBeInTheDocument()
  })

  it('calls onClearErrors when the dismiss button is clicked', async () => {
    setupMock()
    const onClearErrors = vi.fn()
    const user = userEvent.setup()
    render(
      <DropZone
        onFiles={vi.fn()}
        validationErrors={makeValidationErrors(1)}
        onClearErrors={onClearErrors}
      />,
    )

    await user.click(screen.getByRole('button', { name: /dismiss validation errors/i }))
    expect(onClearErrors).toHaveBeenCalledOnce()
  })

  it('does not render the error banner when validationErrors is empty', () => {
    setupMock()
    render(<DropZone onFiles={vi.fn()} validationErrors={[]} onClearErrors={vi.fn()} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
