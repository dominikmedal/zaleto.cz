'use client'

interface Props {
  targetId: string
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}

export default function ScrollToButton({ targetId, className, style, children }: Props) {
  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={() => document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
    >
      {children}
    </button>
  )
}
