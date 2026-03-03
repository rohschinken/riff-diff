import { useState, useCallback } from 'react'

const ALLOWED_EXTENSIONS = ['.gp', '.gp7', '.gp8']

export interface FileLoadResult {
  fileName: string
  buffer: ArrayBuffer
}

export interface UseFileLoaderReturn {
  openFilePicker: () => Promise<void>
  loadFromFile: (file: File) => Promise<void>
  fileData: FileLoadResult | null
  error: string | null
  isLoading: boolean
}

function isTauri(): boolean {
  return Boolean((window as any).__TAURI_INTERNALS__)
}

function getExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.')
  if (lastDot === -1) return ''
  return fileName.substring(lastDot).toLowerCase()
}

function isValidExtension(fileName: string): boolean {
  return ALLOWED_EXTENSIONS.includes(getExtension(fileName))
}

function getFileNameFromPath(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1]
}

export function useFileLoader(): UseFileLoaderReturn {
  const [fileData, setFileData] = useState<FileLoadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadFromFile = useCallback(async (file: File) => {
    setError(null)

    if (!isValidExtension(file.name)) {
      setError(`Invalid file type: "${getExtension(file.name)}". Only .gp, .gp7, .gp8 files are accepted.`)
      setFileData(null)
      return
    }

    setIsLoading(true)
    try {
      const buffer = await file.arrayBuffer()
      setFileData({ fileName: file.name, buffer })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to read file')
      setFileData(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const openFilePicker = useCallback(async () => {
    setError(null)
    setIsLoading(true)

    try {
      if (isTauri()) {
        const { open } = await import('@tauri-apps/plugin-dialog')
        const { readFile } = await import('@tauri-apps/plugin-fs')

        const selected = await open({
          multiple: false,
          directory: false,
          filters: [{
            name: 'Guitar Pro Files',
            extensions: ['gp', 'gp7', 'gp8'],
          }],
        })

        if (!selected) {
          setIsLoading(false)
          return
        }

        const filePath = typeof selected === 'string' ? selected : selected.path
        const fileName = getFileNameFromPath(filePath)

        if (!isValidExtension(fileName)) {
          setError(`Invalid file type: "${getExtension(fileName)}". Only .gp, .gp7, .gp8 files are accepted.`)
          setFileData(null)
          setIsLoading(false)
          return
        }

        const uint8Array = await readFile(filePath)
        const buffer = uint8Array.buffer.slice(
          uint8Array.byteOffset,
          uint8Array.byteOffset + uint8Array.byteLength
        )
        setFileData({ fileName, buffer })
      } else {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.gp,.gp7,.gp8'

        const file = await new Promise<File | null>((resolve) => {
          input.onchange = () => resolve(input.files?.[0] ?? null)
          input.click()
          window.addEventListener('focus', function onFocus() {
            window.removeEventListener('focus', onFocus)
            setTimeout(() => {
              if (!input.files?.length) resolve(null)
            }, 300)
          })
        })

        if (!file) {
          setIsLoading(false)
          return
        }

        if (!isValidExtension(file.name)) {
          setError(`Invalid file type: "${getExtension(file.name)}". Only .gp, .gp7, .gp8 files are accepted.`)
          setFileData(null)
          setIsLoading(false)
          return
        }

        const buffer = await file.arrayBuffer()
        setFileData({ fileName: file.name, buffer })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load file')
      setFileData(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { openFilePicker, loadFromFile, fileData, error, isLoading }
}
