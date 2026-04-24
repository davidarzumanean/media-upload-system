import React from 'react'
import { View } from 'react-native'
import { render } from '@testing-library/react-native'
import { StatusBadge } from '../StatusBadge'
import { colors } from '@media-upload/core'
import type { UploadStatus } from '@media-upload/core'

describe('StatusBadge', () => {
  const cases: Array<{ status: UploadStatus; label: string; bg: string; text: string }> = [
    { status: 'queued',     label: 'Queued',     bg: '#F1F5F9',             text: '#64748B'         },
    { status: 'validating', label: 'Validating', bg: '#F1F5F9',             text: '#64748B'         },
    { status: 'uploading',  label: 'Uploading',  bg: colors.primaryLight,   text: colors.primary    },
    { status: 'paused',     label: 'Paused',     bg: colors.warningLight,   text: colors.warning    },
    { status: 'completed',  label: 'Completed',  bg: colors.successLight,   text: colors.success    },
    { status: 'failed',     label: 'Failed',     bg: colors.errorLight,     text: colors.error      },
    { status: 'canceled',   label: 'Canceled',   bg: '#F8FAFC',             text: '#94A3B8'         },
  ]

  it.each(cases)('renders correct label for status "$status"', ({ status, label }) => {
    const { getByText } = render(<StatusBadge status={status} />)
    expect(getByText(label)).toBeTruthy()
  })

  it.each(cases)(
    'applies correct background color for status "$status"',
    ({ status, bg }) => {
      const { UNSAFE_getByType } = render(<StatusBadge status={status} />)
      // The badge View is the single root View in StatusBadge
      const badgeView = UNSAFE_getByType(View)
      expect(badgeView.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ backgroundColor: bg })]),
      )
    },
  )

  it.each(cases)(
    'applies correct text color for status "$status"',
    ({ status, text: textColor }) => {
      const { getByText } = render(<StatusBadge status={status} />)
      const label = cases.find((c) => c.status === status)!.label
      const textEl = getByText(label)
      expect(textEl.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ color: textColor })]),
      )
    },
  )
})