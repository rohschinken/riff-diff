import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSyncScroll } from './useSyncScroll'

function createDiv(): HTMLDivElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

describe('useSyncScroll', () => {
  let elA: HTMLDivElement
  let elB: HTMLDivElement
  let scrollbar: HTMLDivElement

  beforeEach(() => {
    elA = createDiv()
    elB = createDiv()
    scrollbar = createDiv()
  })

  afterEach(() => {
    elA.remove()
    elB.remove()
    scrollbar.remove()
  })

  it('scrollbar scroll syncs scrollLeft to both panes', () => {
    renderHook(() => useSyncScroll(elA, elB, scrollbar))

    scrollbar.scrollLeft = 150
    scrollbar.dispatchEvent(new Event('scroll'))

    expect(elA.scrollLeft).toBe(150)
    expect(elB.scrollLeft).toBe(150)
  })

  it('scrollbar scroll syncs to pane A only when pane B is null', () => {
    renderHook(() => useSyncScroll(elA, null, scrollbar))

    scrollbar.scrollLeft = 200
    scrollbar.dispatchEvent(new Event('scroll'))

    expect(elA.scrollLeft).toBe(200)
  })

  it('wheel deltaX on pane A updates scrollbar scrollLeft', () => {
    renderHook(() => useSyncScroll(elA, elB, scrollbar))

    const wheelEvent = new WheelEvent('wheel', { deltaX: 50, deltaY: 0 })
    elA.dispatchEvent(wheelEvent)

    expect(scrollbar.scrollLeft).toBe(50)
  })

  it('wheel deltaX on pane B updates scrollbar scrollLeft', () => {
    renderHook(() => useSyncScroll(elA, elB, scrollbar))

    const wheelEvent = new WheelEvent('wheel', { deltaX: 75, deltaY: 0 })
    elB.dispatchEvent(wheelEvent)

    expect(scrollbar.scrollLeft).toBe(75)
  })

  it('wheel deltaY only does NOT update scrollbar', () => {
    renderHook(() => useSyncScroll(elA, elB, scrollbar))

    const wheelEvent = new WheelEvent('wheel', { deltaX: 0, deltaY: 50 })
    elA.dispatchEvent(wheelEvent)

    expect(scrollbar.scrollLeft).toBe(0)
  })

  it('removes event listeners on unmount', () => {
    const spyScrollbar = vi.spyOn(scrollbar, 'removeEventListener')
    const spyA = vi.spyOn(elA, 'removeEventListener')
    const spyB = vi.spyOn(elB, 'removeEventListener')

    const { unmount } = renderHook(() => useSyncScroll(elA, elB, scrollbar))
    unmount()

    expect(spyScrollbar).toHaveBeenCalledWith('scroll', expect.any(Function))
    expect(spyA).toHaveBeenCalledWith('wheel', expect.any(Function))
    expect(spyB).toHaveBeenCalledWith('wheel', expect.any(Function))
  })

  it('does nothing when scrollbar is null', () => {
    // Should not throw
    const { unmount } = renderHook(() => useSyncScroll(elA, elB, null))
    unmount()

    // No listeners to clean up, no errors
    expect(true).toBe(true)
  })
})
