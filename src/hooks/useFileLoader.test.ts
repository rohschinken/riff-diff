import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFileLoader } from './useFileLoader'

function createMockFile(name: string, content = new ArrayBuffer(8)): File {
  return new File([content], name, { type: 'application/octet-stream' })
}

describe('useFileLoader', () => {
  beforeEach(() => {
    delete (window as any).__TAURI_INTERNALS__
  })

  describe('web path', () => {
    it('returns { fileName, buffer } for a valid .gp file', async () => {
      const { result } = renderHook(() => useFileLoader())
      const mockFile = createMockFile('song.gp')

      await act(async () => {
        await result.current.loadFromFile(mockFile)
      })

      expect(result.current.fileData).not.toBeNull()
      expect(result.current.fileData!.fileName).toBe('song.gp')
      expect(result.current.fileData!.buffer).toBeInstanceOf(ArrayBuffer)
    })

    it('accepts .gp7 files', async () => {
      const { result } = renderHook(() => useFileLoader())

      await act(async () => {
        await result.current.loadFromFile(createMockFile('song.gp7'))
      })

      expect(result.current.fileData).not.toBeNull()
      expect(result.current.fileData!.fileName).toBe('song.gp7')
    })

    it('accepts .gp8 files', async () => {
      const { result } = renderHook(() => useFileLoader())

      await act(async () => {
        await result.current.loadFromFile(createMockFile('song.gp8'))
      })

      expect(result.current.fileData).not.toBeNull()
      expect(result.current.fileData!.fileName).toBe('song.gp8')
    })

    it('rejects invalid file types with error', async () => {
      const { result } = renderHook(() => useFileLoader())

      await act(async () => {
        await result.current.loadFromFile(createMockFile('song.pdf'))
      })

      expect(result.current.fileData).toBeNull()
      expect(result.current.error).toContain('Invalid file type')
    })

    it('rejects .gp5 files (out of scope)', async () => {
      const { result } = renderHook(() => useFileLoader())

      await act(async () => {
        await result.current.loadFromFile(createMockFile('song.gp5'))
      })

      expect(result.current.fileData).toBeNull()
      expect(result.current.error).toContain('Invalid file type')
    })

    it('rejects .gp6 files (out of scope)', async () => {
      const { result } = renderHook(() => useFileLoader())

      await act(async () => {
        await result.current.loadFromFile(createMockFile('song.gp6'))
      })

      expect(result.current.fileData).toBeNull()
      expect(result.current.error).toContain('Invalid file type')
    })
  })

  describe('Tauri path', () => {
    beforeEach(() => {
      (window as any).__TAURI_INTERNALS__ = {}
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('returns same shape { fileName, buffer } via openFilePicker', async () => {
      vi.mock('@tauri-apps/plugin-dialog', () => ({
        open: vi.fn().mockResolvedValue('/path/to/song.gp'),
      }))
      vi.mock('@tauri-apps/plugin-fs', () => ({
        readFile: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4])),
      }))

      const { result } = renderHook(() => useFileLoader())

      await act(async () => {
        await result.current.openFilePicker()
      })

      expect(result.current.fileData).not.toBeNull()
      expect(result.current.fileData!.fileName).toBe('song.gp')
      expect(result.current.fileData!.buffer).toBeInstanceOf(ArrayBuffer)
    })
  })

  describe('shared behavior', () => {
    it('starts with null fileData, null error, and isLoading false', () => {
      const { result } = renderHook(() => useFileLoader())

      expect(result.current.fileData).toBeNull()
      expect(result.current.error).toBeNull()
      expect(result.current.isLoading).toBe(false)
    })

    it('isLoading is false after load completes', async () => {
      const { result } = renderHook(() => useFileLoader())

      await act(async () => {
        await result.current.loadFromFile(createMockFile('song.gp'))
      })

      expect(result.current.isLoading).toBe(false)
    })

    it('clears previous error on new valid load', async () => {
      const { result } = renderHook(() => useFileLoader())

      await act(async () => {
        await result.current.loadFromFile(createMockFile('bad.pdf'))
      })
      expect(result.current.error).not.toBeNull()

      await act(async () => {
        await result.current.loadFromFile(createMockFile('good.gp'))
      })
      expect(result.current.error).toBeNull()
      expect(result.current.fileData).not.toBeNull()
    })

    it('buffer has correct byte length', async () => {
      const content = new ArrayBuffer(16)
      const { result } = renderHook(() => useFileLoader())

      await act(async () => {
        await result.current.loadFromFile(createMockFile('song.gp', content))
      })

      expect(result.current.fileData!.buffer.byteLength).toBe(16)
    })
  })
})
