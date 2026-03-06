import { useState, useCallback, useRef } from 'react'
import type { DragEvent } from 'react'

export function useDropZone(loadFromFile: (file: File) => Promise<void>) {
  const [isDragOver, setIsDragOver] = useState(false)
  const counterRef = useRef(0)

  const onDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    counterRef.current += 1
    setIsDragOver(true)
  }, [])

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
  }, [])

  const onDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    counterRef.current -= 1
    if (counterRef.current <= 0) {
      counterRef.current = 0
      setIsDragOver(false)
    }
  }, [])

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    counterRef.current = 0
    setIsDragOver(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) loadFromFile(file)
  }, [loadFromFile])

  return {
    isDragOver,
    dropHandlers: { onDragEnter, onDragOver, onDragLeave, onDrop },
  }
}
