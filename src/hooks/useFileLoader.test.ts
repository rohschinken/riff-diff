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
    let mockOpen: ReturnType<typeof vi.fn>
    let mockReadFile: ReturnType<typeof vi.fn>

    beforeEach(() => {
      (window as any).__TAURI_INTERNALS__ = {}
      mockOpen = vi.fn().mockResolvedValue('/path/to/song.gp')
      mockReadFile = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]))
      vi.doMock('@tauri-apps/plugin-dialog', () => ({ open: mockOpen }))
      vi.doMock('@tauri-apps/plugin-fs', () => ({ readFile: mockReadFile }))
    })

    afterEach(() => {
      vi.restoreAllMocks()
      vi.doUnmock('@tauri-apps/plugin-dialog')
      vi.doUnmock('@tauri-apps/plugin-fs')
    })

    it('returns same shape { fileName, buffer } via openFilePicker', async () => {
      const { result } = renderHook(() => useFileLoader())

      await act(async () => {
        await result.current.openFilePicker()
      })

      expect(result.current.fileData).not.toBeNull()
      expect(result.current.fileData!.fileName).toBe('song.gp')
      expect(result.current.fileData!.buffer).toBeInstanceOf(ArrayBuffer)
    })

    it('handles user cancelling the file dialog', async () => {
      mockOpen.mockResolvedValue(null)

      const { result } = renderHook(() => useFileLoader())

      await act(async () => {
        await result.current.openFilePicker()
      })

      expect(result.current.fileData).toBeNull()
      expect(result.current.error).toBeNull()
      expect(result.current.isLoading).toBe(false)
    })

    it('extracts filename from Windows backslash paths', async () => {
      mockOpen.mockResolvedValue('C:\\Users\\me\\Documents\\song.gp8')
      mockReadFile.mockResolvedValue(new Uint8Array([1, 2, 3]))

      const { result } = renderHook(() => useFileLoader())

      await act(async () => {
        await result.current.openFilePicker()
      })

      expect(result.current.fileData!.fileName).toBe('song.gp8')
    })

    it('handles readFile errors gracefully', async () => {
      mockReadFile.mockRejectedValue(new Error('Permission denied'))

      const { result } = renderHook(() => useFileLoader())

      await act(async () => {
        await result.current.openFilePicker()
      })

      expect(result.current.fileData).toBeNull()
      expect(result.current.error).toBe('Permission denied')
      expect(result.current.isLoading).toBe(false)
    })

    it('loads a dropped file path via loadFromPath', async () => {
      mockReadFile.mockResolvedValue(new Uint8Array([9, 8, 7]))

      const { result } = renderHook(() => useFileLoader())

      await act(async () => {
        await result.current.loadFromPath('/home/me/song.gp8')
      })

      expect(mockReadFile).toHaveBeenCalledWith('/home/me/song.gp8')
      expect(result.current.fileData).not.toBeNull()
      expect(result.current.fileData!.fileName).toBe('song.gp8')
      expect(result.current.fileData!.buffer.byteLength).toBe(3)
      expect(result.current.error).toBeNull()
      expect(result.current.isLoading).toBe(false)
    })

    it('extracts filename from Windows paths in loadFromPath', async () => {
      mockReadFile.mockResolvedValue(new Uint8Array([1]))

      const { result } = renderHook(() => useFileLoader())

      await act(async () => {
        await result.current.loadFromPath('C:\\Users\\me\\Documents\\song.gp7')
      })

      expect(result.current.fileData!.fileName).toBe('song.gp7')
    })

    it('rejects an invalid dropped path without reading it', async () => {
      const { result } = renderHook(() => useFileLoader())

      await act(async () => {
        await result.current.loadFromPath('/home/me/song.gp5')
      })

      expect(mockReadFile).not.toHaveBeenCalled()
      expect(result.current.fileData).toBeNull()
      expect(result.current.error).toContain('Invalid file type')
      expect(result.current.isLoading).toBe(false)
    })

    it('handles loadFromPath read errors gracefully', async () => {
      mockReadFile.mockRejectedValue(new Error('Permission denied'))

      const { result } = renderHook(() => useFileLoader())

      await act(async () => {
        await result.current.loadFromPath('/home/me/song.gp')
      })

      expect(result.current.fileData).toBeNull()
      expect(result.current.error).toBe('Permission denied')
      expect(result.current.isLoading).toBe(false)
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
