import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QRCodeDisplay } from './QRCodeDisplay'

vi.mock('qrcode.react', () => ({
  QRCodeSVG: (props: Record<string, unknown>) => (
    <div
      data-testid="qr-code-svg"
      data-value={props.value}
      data-size={props.size}
      data-level={props.level}
    />
  ),
}))

describe('QRCodeDisplay', () => {
  it('renders with the qr-code data-testid', () => {
    render(<QRCodeDisplay eventId="evt-abc" />)

    expect(screen.getByTestId('qr-code')).toBeInTheDocument()
  })

  it('passes the correct URL to QRCodeSVG based on eventId', () => {
    render(<QRCodeDisplay eventId="evt-abc" />)

    const svg = screen.getByTestId('qr-code-svg')
    expect(svg).toHaveAttribute(
      'data-value',
      `${window.location.origin}/event/evt-abc`
    )
  })

  it('passes size=200 and level="M" to QRCodeSVG', () => {
    render(<QRCodeDisplay eventId="evt-abc" />)

    const svg = screen.getByTestId('qr-code-svg')
    expect(svg).toHaveAttribute('data-size', '200')
    expect(svg).toHaveAttribute('data-level', 'M')
  })

  it('constructs the URL using window.location.origin', () => {
    render(<QRCodeDisplay eventId="different-id" />)

    const svg = screen.getByTestId('qr-code-svg')
    const expectedUrl = `${window.location.origin}/event/different-id`
    expect(svg).toHaveAttribute('data-value', expectedUrl)
  })
})
