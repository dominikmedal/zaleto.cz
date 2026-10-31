import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'
import Icon from './Icon'

type Variant = 'primary' | 'light' | 'offer' | 'line'

interface Props extends Omit<ComponentProps<typeof Link>, 'className'> {
  variant?: Variant
  small?: boolean
  block?: boolean
  /** Kulatý cíl se šipkou vpravo (výchozí zapnuto, u `line` vypnuto). */
  arrow?: boolean
  children: ReactNode
}

/** Tlačítko začíná slovesem: „Najít zájezd“, „Půjčit“, „Zobrazit nabídku“. */
export default function Button({ variant = 'primary', small, block, arrow, children, ...rest }: Props) {
  const withArrow = arrow ?? variant !== 'line'
  const cls = ['z-btn', `z-btn--${variant}`, small && 'z-btn--sm', block && 'z-btn--block'].filter(Boolean).join(' ')
  return (
    <Link className={cls} {...rest}>
      {children}
      {withArrow && (
        <span className="z-btn__go"><Icon name="sipka" /></span>
      )}
    </Link>
  )
}
