'use client'

interface Props {
  targetId: string
  className?: string
  children: React.ReactNode
}

export default function ScrollToButton({ targetId, className, children }: Props) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
    >
      {children}
    </button>
  )
}
