import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FileList } from '../FileList'
import type { UploadManagerSnapshot } from '@media-upload/core'

vi.mock('../FileUploadCard', () => ({
  FileUploadCard: ({
    session,
  }: {
    session: { fileDescriptor: { name: string } }
  }) => <div data-testid="file-card">{session.fileDescriptor.name}</div>,
}))

// ── Helpers ────────────────────────────────���──────────────────────────────────

type PartialSession = {
  status: string
  fileDescriptor: { id: string; name: string }
}

function makeSnapshot(
  sessions: Record<string, PartialSession>,
): UploadManagerSnapshot {
  return { sessions } as unknown as UploadManagerSnapshot
}

const noop = vi.fn()

function defaultProps(sessions: Record<string, PartialSession> = {}) {
  return {
    snapshot: makeSnapshot(sessions),
    speeds: {},
    onPause: noop,
    onResume: noop,
    onCancel: noop,
    onRetry: noop,
    onRetryAllFailed: noop,
    onDismiss: noop,
    onClearAll: noop,
  }
}

// ── Tests ───────────────────────────────────────────��────────────────────────��

describe('FileList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders null when sessions is empty', () => {
    const { container } = render(<FileList {...defaultProps()} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders a card for each session', () => {
    render(
      <FileList
        {...defaultProps({
          'uid-1': { status: 'uploading', fileDescriptor: { id: 'uid-1', name: 'a.jpg' } },
          'uid-2': { status: 'uploading', fileDescriptor: { id: 'uid-2', name: 'b.mp4' } },
        })}
      />,
    )
    expect(screen.getAllByTestId('file-card')).toHaveLength(2)
    expect(screen.getByText('a.jpg')).toBeInTheDocument()
    expect(screen.getByText('b.mp4')).toBeInTheDocument()
  })

  it('shows "Retry all" only when at least one session is failed', () => {
    const { rerender } = render(
      <FileList
        {...defaultProps({
          'f-1': { status: 'failed', fileDescriptor: { id: 'f-1', name: 'fail.jpg' } },
        })}
      />,
    )
    expect(screen.getByText('Retry all')).toBeInTheDocument()

    rerender(
      <FileList
        {...defaultProps({
          'u-1': { status: 'uploading', fileDescriptor: { id: 'u-1', name: 'up.jpg' } },
        })}
      />,
    )
    expect(screen.queryByText('Retry all')).not.toBeInTheDocument()
  })

  it('shows "Clear all" only when dismissible sessions exist', () => {
    const { rerender } = render(
      <FileList
        {...defaultProps({
          'c-1': { status: 'completed', fileDescriptor: { id: 'c-1', name: 'done.jpg' } },
        })}
      />,
    )
    expect(screen.getByText('Clear all')).toBeInTheDocument()

    rerender(
      <FileList
        {...defaultProps({
          'u-1': { status: 'uploading', fileDescriptor: { id: 'u-1', name: 'up.jpg' } },
        })}
      />,
    )
    expect(screen.queryByText('Clear all')).not.toBeInTheDocument()
  })

  it('shows both buttons when failed and completed sessions coexist', () => {
    render(
      <FileList
        {...defaultProps({
          'f-1': { status: 'failed', fileDescriptor: { id: 'f-1', name: 'a.jpg' } },
          'c-1': { status: 'completed', fileDescriptor: { id: 'c-1', name: 'b.jpg' } },
        })}
      />,
    )
    expect(screen.getByText('Retry all')).toBeInTheDocument()
    expect(screen.getByText('Clear all')).toBeInTheDocument()
  })

  it('displays plural file count in header', () => {
    render(
      <FileList
        {...defaultProps({
          'u-1': { status: 'uploading', fileDescriptor: { id: 'u-1', name: 'a.jpg' } },
          'u-2': { status: 'uploading', fileDescriptor: { id: 'u-2', name: 'b.mp4' } },
          'u-3': { status: 'uploading', fileDescriptor: { id: 'u-3', name: 'c.gif' } },
        })}
      />,
    )
    expect(screen.getByText('3 files')).toBeInTheDocument()
  })

  it('displays singular file count when exactly one session', () => {
    render(
      <FileList
        {...defaultProps({
          'u-1': { status: 'uploading', fileDescriptor: { id: 'u-1', name: 'a.jpg' } },
        })}
      />,
    )
    expect(screen.getByText('1 file')).toBeInTheDocument()
  })

  it('calls onRetryAllFailed when "Retry all" is clicked', async () => {
    const user = userEvent.setup()
    const onRetryAllFailed = vi.fn()

    render(
      <FileList
        {...defaultProps({
          'f-1': { status: 'failed', fileDescriptor: { id: 'f-1', name: 'fail.jpg' } },
        })}
        onRetryAllFailed={onRetryAllFailed}
      />,
    )
    await user.click(screen.getByText('Retry all'))
    expect(onRetryAllFailed).toHaveBeenCalledOnce()
  })

  it('calls onClearAll when "Clear all" is clicked', async () => {
    const user = userEvent.setup()
    const onClearAll = vi.fn()

    render(
      <FileList
        {...defaultProps({
          'c-1': { status: 'completed', fileDescriptor: { id: 'c-1', name: 'done.jpg' } },
        })}
        onClearAll={onClearAll}
      />,
    )
    await user.click(screen.getByText('Clear all'))
    expect(onClearAll).toHaveBeenCalledOnce()
  })
})