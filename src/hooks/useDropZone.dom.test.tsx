import { render, screen, fireEvent } from '@testing-library/react'
import { useDropZone } from './useDropZone'

function DropPane({ onFile }: { onFile: (file: File) => Promise<void> }) {
  const { isDragOver, dropHandlers } = useDropZone(onFile)

  return (
    <div data-testid="pane" {...dropHandlers}>
      <span>pane</span>
      {isDragOver && <div data-testid="drop-overlay">Drop GP file here</div>}
    </div>
  )
}

describe('file drag and drop', () => {
  it('shows the drop overlay while a file is dragged over the pane', () => {
    render(<DropPane onFile={vi.fn().mockResolvedValue(undefined)} />)
    const file = new File(['abc'], 'song.gp8')

    fireEvent.dragEnter(screen.getByTestId('pane'), { dataTransfer: { files: [file] } })

    expect(screen.getByTestId('drop-overlay')).toBeInTheDocument()
  })

  it('loads the dropped file and removes the overlay', () => {
    const onFile = vi.fn().mockResolvedValue(undefined)
    render(<DropPane onFile={onFile} />)
    const pane = screen.getByTestId('pane')
    const file = new File(['abc'], 'song.gp8')

    fireEvent.dragEnter(pane, { dataTransfer: { files: [file] } })
    fireEvent.dragOver(pane, { dataTransfer: { files: [file] } })
    fireEvent.drop(pane, { dataTransfer: { files: [file] } })

    expect(onFile).toHaveBeenCalledWith(file)
    expect(screen.queryByTestId('drop-overlay')).not.toBeInTheDocument()
  })

  it('ignores a drop with no files', () => {
    const onFile = vi.fn().mockResolvedValue(undefined)
    render(<DropPane onFile={onFile} />)
    const pane = screen.getByTestId('pane')

    fireEvent.drop(pane, { dataTransfer: { files: [] } })

    expect(onFile).not.toHaveBeenCalled()
  })
})
