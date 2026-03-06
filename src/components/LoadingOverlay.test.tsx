import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoadingOverlay } from './LoadingOverlay'

describe('LoadingOverlay', () => {
  it('renders nothing when visible is false', () => {
    const { container } = render(<LoadingOverlay visible={false} testId="spinner" />)
    expect(container.innerHTML).toBe('')
  })

  it('renders spinner when visible is true', () => {
    render(<LoadingOverlay visible={true} testId="spinner" />)
    expect(screen.getByTestId('spinner')).toBeDefined()
  })

  it('has correct data-testid', () => {
    render(<LoadingOverlay visible={true} testId="loading-A" />)
    expect(screen.getByTestId('loading-A')).toBeDefined()
  })

  it('contains a spinning element', () => {
    render(<LoadingOverlay visible={true} testId="spinner" />)
    const overlay = screen.getByTestId('spinner')
    const spinner = overlay.querySelector('.animate-spin')
    expect(spinner).not.toBeNull()
  })
})
