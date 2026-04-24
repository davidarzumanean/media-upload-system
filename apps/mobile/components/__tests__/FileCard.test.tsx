import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { FileCard } from '../FileCard'
import type { UploadSession } from '@media-upload/core'

function makeSession(overrides: Partial<UploadSession> = {}): UploadSession {
  return {
    uploadId: 'uid-1',
    fileDescriptor: {
      id: 'fd-1',
      name: 'photo.jpg',
      size: 1_500_000,
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

const defaultProps = {
  onPause: jest.fn(),
  onResume: jest.fn(),
  onCancel: jest.fn(),
  onRetry: jest.fn(),
  onDismiss: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('FileCard', () => {
  describe('status rendering', () => {
    it('renders Pause and Cancel buttons when uploading', () => {
      const { getByText } = render(
        <FileCard session={makeSession({ status: 'uploading' })} {...defaultProps} />,
      )
      expect(getByText('Pause')).toBeTruthy()
      expect(getByText('Cancel')).toBeTruthy()
    })

    it('renders Resume and Cancel buttons when paused', () => {
      const { getByText } = render(
        <FileCard session={makeSession({ status: 'paused' })} {...defaultProps} />,
      )
      expect(getByText('Resume')).toBeTruthy()
      expect(getByText('Cancel')).toBeTruthy()
    })

    it('renders only Retry button when failed', () => {
      const { getByText, queryByText } = render(
        <FileCard session={makeSession({ status: 'failed' })} {...defaultProps} />,
      )
      expect(getByText('Retry')).toBeTruthy()
      expect(queryByText('Pause')).toBeNull()
      expect(queryByText('Cancel')).toBeNull()
    })

    it('renders no action buttons when completed', () => {
      const { queryByText } = render(
        <FileCard session={makeSession({ status: 'completed' })} {...defaultProps} />,
      )
      expect(queryByText('Pause')).toBeNull()
      expect(queryByText('Cancel')).toBeNull()
      expect(queryByText('Retry')).toBeNull()
    })
  })

  describe('dismiss button', () => {
    it.each(['completed', 'failed', 'canceled'] as const)(
      'shows dismiss × on status "%s"',
      (status) => {
        const { getByLabelText } = render(
          <FileCard session={makeSession({ status })} {...defaultProps} />,
        )
        expect(getByLabelText('Dismiss')).toBeTruthy()
      },
    )

    it('does not show dismiss × when uploading', () => {
      const { queryByLabelText } = render(
        <FileCard session={makeSession({ status: 'uploading' })} {...defaultProps} />,
      )
      expect(queryByLabelText('Dismiss')).toBeNull()
    })
  })

  describe('action callbacks', () => {
    it('calls onPause with the upload id when Pause is pressed', () => {
      const { getByText } = render(
        <FileCard session={makeSession({ status: 'uploading', uploadId: 'uid-1' })} {...defaultProps} />,
      )
      fireEvent.press(getByText('Pause'))
      expect(defaultProps.onPause).toHaveBeenCalledWith('uid-1')
    })

    it('calls onResume with the upload id when Resume is pressed', () => {
      const { getByText } = render(
        <FileCard session={makeSession({ status: 'paused', uploadId: 'uid-2' })} {...defaultProps} />,
      )
      fireEvent.press(getByText('Resume'))
      expect(defaultProps.onResume).toHaveBeenCalledWith('uid-2')
    })

    it('calls onCancel with the upload id when Cancel is pressed', () => {
      const { getByText } = render(
        <FileCard session={makeSession({ status: 'uploading', uploadId: 'uid-3' })} {...defaultProps} />,
      )
      fireEvent.press(getByText('Cancel'))
      expect(defaultProps.onCancel).toHaveBeenCalledWith('uid-3')
    })

    it('calls onRetry with the upload id when Retry is pressed', () => {
      const { getByText } = render(
        <FileCard session={makeSession({ status: 'failed', uploadId: 'uid-4' })} {...defaultProps} />,
      )
      fireEvent.press(getByText('Retry'))
      expect(defaultProps.onRetry).toHaveBeenCalledWith('uid-4')
    })

    it('falls back to fileDescriptor.id when uploadId is empty', () => {
      const session = makeSession({ uploadId: '', status: 'uploading' })
      const { getByText } = render(<FileCard session={session} {...defaultProps} />)
      fireEvent.press(getByText('Pause'))
      expect(defaultProps.onPause).toHaveBeenCalledWith(session.fileDescriptor.id)
    })
  })

  describe('thumbnail', () => {
    it('renders an Image when previewUri is set', () => {
      const session = makeSession({
        fileDescriptor: {
          id: 'fd-img',
          name: 'photo.jpg',
          size: 1_000,
          mimeType: 'image/jpeg',
          previewUri: 'file:///preview.jpg',
        },
      })
      const { getByLabelText } = render(<FileCard session={session} {...defaultProps} />)
      expect(getByLabelText('Preview of photo.jpg')).toBeTruthy()
    })

    it('renders a placeholder icon when previewUri is absent', () => {
      const session = makeSession({
        fileDescriptor: {
          id: 'fd-doc',
          name: 'report.pdf',
          size: 2_000,
          mimeType: 'application/pdf',
        },
      })
      const { queryByLabelText } = render(<FileCard session={session} {...defaultProps} />)
      expect(queryByLabelText('Preview of report.pdf')).toBeNull()
    })
  })
})