import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'riff-diff-show-notation'

export function useNotationToggle() {
  const [showNotation, setShowNotation] = useState<boolean>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'false' ? false : true
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(showNotation))
  }, [showNotation])

  const toggleNotation = useCallback(() => {
    setShowNotation((prev) => !prev)
  }, [])

  return { showNotation, toggleNotation }
}
