import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FileUploadCard } from '../FileUploadCard'
import type { UploadSession } from '@media-upload/core'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<UploadSession> = {}): UploadSession {
  return {
    uploadId: 'uid-test',
    fileDescriptor: {
      id: 'file-id',
      name: 'photo.jpg',
      size: 2 * 1024 * 1024,
      mimeType: 'image/jpeg',
    },
    totalChunks: 3,
    uploadedChunks: [],
    status: 'uploading',
    progress: 0.5,
    retries: {},
    ...overrides,
  }
}

const noop = vi.fn()

function defaultProps() {
  return {
    onPause: noop,
    onResume: noop,
    onCancel: noop,
    onRetry: noop,
    onDismiss: noop,
  }
}

beforeEach(() => vi.clearAllMocks())

// ── Rendering ─────────────────────────────────────────────────────────────────

describe('FileUploadCard — rendering', () => {
  it('displays the filename', () => {
    render(<FileUploadCard session={makeSession()} {...defaultProps()} />)
    expect(screen.getByText('photo.jpg')).toBeInTheDocument()
  })

  it('displays the status badge label for each status', () => {
    const cases: Array<[UploadSession['status'], string | RegExp]> = [
      ['uploading', 'Uploading'],
      ['paused', 'Paused'],
      ['completed', 'Completed'],
      ['failed', 'Failed'],
      ['canceled', 'Canceled'],
    ]

    for (const [status, label] of cases) {
      const { unmount } = render(
        <FileUploadCard
          session={makeSession({
            status,
            progress: status === 'completed' ? 1 : 0.3,
            error: status === 'failed' ? 'err' : undefined,
          })}
          {...defaultProps()}
        />,
      )
      expect(screen.getByText(label)).toBeInTheDocument()
      unmount()
    }
  })

  it('shows the error message when the session has an error', () => {
    render(
      <FileUploadCard
        session={makeSession({
          status: 'failed',
          error: 'Connection timed out',
        })}
        {...defaultProps()}
      />,
    )
    expect(screen.getByText('Connection timed out')).toBeInTheDocument()
  })

  it('shows file size and mime type in the idle meta line', () => {
    render(
      <FileUploadCard
        session={makeSession({ status: 'completed', progress: 1 })}
        {...defaultProps()}
      />,
    )
    // The meta line renders "{size} · {mimeType}" split across text nodes;
    // use toHaveTextContent on the card element to concatenate them.
    expect(screen.getByRole('article')).toHaveTextContent('image/jpeg')
  })
})

// ── Progress bar ──────────────────────────────────────────────────────────────

describe('FileUploadCard — progress bar', () => {
  it('renders a progressbar during uploading with the correct value', () => {
    render(
      <FileUploadCard
        session={makeSession({ status: 'uploading', progress: 0.6 })}
        {...defaultProps()}
      />,
    )
    const bar = screen.getByRole('progressbar')
    expect(bar).toBeInTheDocument()
    expect(bar).toHaveAttribute('aria-valuenow', '60')
  })

  it('renders a progressbar during paused', () => {
    render(
      <FileUploadCard
        session={makeSession({ status: 'paused', progress: 0.3 })}
        {...defaultProps()}
      />,
    )
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders a progressbar at 100% when completed', () => {
    render(
      <FileUploadCard
        session={makeSession({
          status: 'completed',
          progress: 1,
          uploadedChunks: [0, 1, 2],
        })}
        {...defaultProps()}
      />,
    )
    const bar = screen.getByRole('progressbar')
    expect(bar).toBeInTheDocument()
    expect(bar).toHaveAttribute('aria-valuenow', '100')
  })

  it('does not render a progressbar when the status is failed', () => {
    render(
      <FileUploadCard
        session={makeSession({ status: 'failed', error: 'network error' })}
        {...defaultProps()}
      />,
    )
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('does not render a progressbar when the status is canceled', () => {
    render(
      <FileUploadCard
        session={makeSession({ status: 'canceled' })}
        {...defaultProps()}
      />,
    )
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})

// ── Action buttons ────────────────────────────────────────────────────────────

describe('FileUploadCard — buttons while uploading', () => {
  it('shows pause and cancel buttons', () => {
    render(
      <FileUploadCard
        session={makeSession({ status: 'uploading' })}
        {...defaultProps()}
      />,
    )
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('does not show resume or retry or dismiss buttons', () => {
    render(
      <FileUploadCard
        session={makeSession({ status: 'uploading' })}
        {...defaultProps()}
      />,
    )
    expect(
      screen.queryByRole('button', { name: /resume/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /retry/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /dismiss/i }),
    ).not.toBeInTheDocument()
  })
})

describe('FileUploadCard — buttons while paused', () => {
  it('shows resume and cancel buttons', () => {
    render(
      <FileUploadCard
        session={makeSession({ status: 'paused', progress: 0.3 })}
        {...defaultProps()}
      />,
    )
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('does not show the pause button', () => {
    render(
      <FileUploadCard
        session={makeSession({ status: 'paused', progress: 0.3 })}
        {...defaultProps()}
      />,
    )
    expect(
      screen.queryByRole('button', { name: /pause/i }),
    ).not.toBeInTheDocument()
  })
})

describe('FileUploadCard — buttons when completed', () => {
  it('shows only the dismiss button', () => {
    render(
      <FileUploadCard
        session={makeSession({ status: 'completed', progress: 1 })}
        {...defaultProps()}
      />,
    )
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /pause/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /resume/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /retry/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /cancel/i }),
    ).not.toBeInTheDocument()
  })
})

describe('FileUploadCard — buttons when failed', () => {
  it('shows retry and dismiss buttons', () => {
    render(
      <FileUploadCard
        session={makeSession({ status: 'failed', error: 'err' })}
        {...defaultProps()}
      />,
    )
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument()
  })

  it('does not show pause, resume, or cancel buttons', () => {
    render(
      <FileUploadCard
        session={makeSession({ status: 'failed', error: 'err' })}
        {...defaultProps()}
      />,
    )
    expect(
      screen.queryByRole('button', { name: /pause/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /resume/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /cancel/i }),
    ).not.toBeInTheDocument()
  })
})

// ── Callbacks ─────────────────────────────────────────────────────────────────

describe('FileUploadCard — callbacks', () => {
  it('calls onPause with the uploadId when pause is clicked', async () => {
    const onPause = vi.fn()
    const user = userEvent.setup()
    render(
      <FileUploadCard
        session={makeSession({ status: 'uploading' })}
        {...defaultProps()}
        onPause={onPause}
      />,
    )
    await user.click(screen.getByRole('button', { name: /pause/i }))
    expect(onPause).toHaveBeenCalledWith('uid-test')
  })

  it('calls onResume with the uploadId when resume is clicked', async () => {
    const onResume = vi.fn()
    const user = userEvent.setup()
    render(
      <FileUploadCard
        session={makeSession({ status: 'paused', progress: 0.3 })}
        {...defaultProps()}
        onResume={onResume}
      />,
    )
    await user.click(screen.getByRole('button', { name: /resume/i }))
    expect(onResume).toHaveBeenCalledWith('uid-test')
  })

  it('calls onCancel with the uploadId when cancel is clicked', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(
      <FileUploadCard
        session={makeSession({ status: 'uploading' })}
        {...defaultProps()}
        onCancel={onCancel}
      />,
    )
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledWith('uid-test')
  })

  it('calls onRetry with the uploadId when retry is clicked', async () => {
    const onRetry = vi.fn()
    const user = userEvent.setup()
    render(
      <FileUploadCard
        session={makeSession({ status: 'failed', error: 'err' })}
        {...defaultProps()}
        onRetry={onRetry}
      />,
    )
    await user.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledWith('uid-test')
  })

  it('calls onDismiss with the uploadId when dismiss is clicked on a completed session', async () => {
    const onDismiss = vi.fn()
    const user = userEvent.setup()
    render(
      <FileUploadCard
        session={makeSession({ status: 'completed', progress: 1 })}
        {...defaultProps()}
        onDismiss={onDismiss}
      />,
    )
    await user.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(onDismiss).toHaveBeenCalledWith('uid-test')
  })

  it('falls back to fileDescriptor.id when uploadId is empty', async () => {
    const onDismiss = vi.fn()
    const user = userEvent.setup()
    render(
      <FileUploadCard
        session={makeSession({
          uploadId: '',
          status: 'completed',
          progress: 1,
        })}
        {...defaultProps()}
        onDismiss={onDismiss}
      />,
    )
    await user.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(onDismiss).toHaveBeenCalledWith('file-id')
  })
})

// ── Thumbnail ─────────────────────────────────────────────────────────────────

describe('FileUploadCard — thumbnail', () => {
  it('renders an img element when a previewUri is provided for an image', () => {
    render(
      <FileUploadCard
        session={makeSession({
          fileDescriptor: {
            id: 'file-id',
            name: 'photo.jpg',
            size: 500,
            mimeType: 'image/jpeg',
            previewUri: 'blob:preview-url',
          },
        })}
        {...defaultProps()}
      />,
    )
    const img = screen.getByRole('img', { name: /preview of photo\.jpg/i })
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'blob:preview-url')
  })

  it('does not render an img when there is no previewUri', () => {
    render(<FileUploadCard session={makeSession()} {...defaultProps()} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
