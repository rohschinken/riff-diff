interface LoadingOverlayProps {
  visible: boolean
  testId?: string
}

export function LoadingOverlay({ visible, testId }: LoadingOverlayProps) {
  if (!visible) return null

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-white/60 dark:bg-black/40 pointer-events-none"
      data-testid={testId}
    >
      <div className="animate-spin w-8 h-8 border-3 border-chrome-accent border-t-transparent rounded-full" />
    </div>
  )
}
