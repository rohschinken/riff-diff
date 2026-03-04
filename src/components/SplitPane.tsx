import { ReactNode } from 'react'

interface SplitPaneProps {
  top: ReactNode
  bottom: ReactNode
}

export function SplitPane({ top, bottom }: SplitPaneProps) {
  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 border-b border-gray-300 overflow-hidden">
        {top}
      </div>
      <div className="flex-1 overflow-hidden">
        {bottom}
      </div>
    </div>
  )
}
