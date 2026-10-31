import Link from 'next/link'

/** Drobečky jako trasa: tečkovaná čára, poslední položka končí modrou tečkou. */
export default function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Drobečková navigace">
      <ol className="z-crumbs">
        {items.map((it, i) => {
          const last = i === items.length - 1
          return (
            <li key={it.label} aria-current={last ? 'page' : undefined}>
              {it.href && !last ? <Link href={it.href}>{it.label}</Link> : it.label}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
