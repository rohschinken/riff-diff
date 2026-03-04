import { useEffect } from 'react'

export function useSyncScroll(
  elA: HTMLElement | null,
  elB: HTMLElement | null,
  scrollbar: HTMLElement | null,
): void {
  useEffect(() => {
    if (!scrollbar) return
    const panes = [elA, elB].filter(Boolean) as HTMLElement[]
    if (panes.length === 0) return

    const onScroll = () => {
      for (const pane of panes) {
        pane.scrollLeft = scrollbar.scrollLeft
      }
    }

    const onWheel = (e: WheelEvent) => {
      if (e.deltaX !== 0) {
        scrollbar.scrollLeft += e.deltaX
        e.preventDefault()
      }
    }

    scrollbar.addEventListener('scroll', onScroll)
    for (const pane of panes) {
      pane.addEventListener('wheel', onWheel, { passive: false })
    }

    return () => {
      scrollbar.removeEventListener('scroll', onScroll)
      for (const pane of panes) {
        pane.removeEventListener('wheel', onWheel)
      }
    }
  }, [elA, elB, scrollbar])
}
