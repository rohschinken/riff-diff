import { useCallback } from 'react'
import { SplitPane } from './components/SplitPane'
import { AlphaTabPane } from './renderer/AlphaTabPane'
import { useFileLoader } from './hooks/useFileLoader'

function EmptyPane({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-full text-gray-400">
      <p className="text-lg">{label}</p>
    </div>
  )
}

function App() {
  const { openFilePicker, fileData, error, isLoading } = useFileLoader()

  const handleRenderFinished = useCallback(() => {
    // Phase 3 will use this to capture the api instance
  }, [])

  return (
    <div className="h-screen w-screen flex flex-col bg-white">
      <header className="h-12 flex items-center px-4 border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-800">Riff-Diff</h1>
      </header>
      <main className="flex-1 overflow-hidden">
        <SplitPane
          top={
            <div className="flex flex-col h-full">
              <div className="h-8 flex items-center px-3 border-b border-gray-200 gap-2">
                <button
                  onClick={openFilePicker}
                  className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  disabled={isLoading}
                >
                  {isLoading ? 'Loading…' : 'Open File A'}
                </button>
                {fileData && (
                  <span className="text-sm text-gray-600 truncate">{fileData.fileName}</span>
                )}
                {error && (
                  <span className="text-sm text-red-600 truncate">{error}</span>
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                {fileData ? (
                  <AlphaTabPane
                    buffer={fileData.buffer}
                    onRenderFinished={handleRenderFinished}
                  />
                ) : (
                  <EmptyPane label="File A — click 'Open File A' to load" />
                )}
              </div>
            </div>
          }
          bottom={<EmptyPane label="File B" />}
        />
      </main>
    </div>
  )
}

export default App
