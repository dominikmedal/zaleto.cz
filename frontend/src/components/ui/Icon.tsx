import type { SVGProps } from 'react'

type Def = { body: JSX.Element; dot?: [number, number, number] }

/** Sada ikon „Palubní deník“: tah 1,5 px na 24 px, tečka z loga jen tam, kde něco znamená. */
const ICONS = {
  letadlo: (
    <>
      <g transform="rotate(-22 12 12)"><path d="M3.5 8.5 5.5 11.5H18a1.75 1.75 0 0 1 0 3.5h-5.5l-3 5H8l1.2-5H6l-1.6-1.6" /></g>
      <circle className="zi-dot" cx="21.2" cy="6.3" r="1.4" />
    </>
  ),
  auto: (
    <>
      <path d="M5 16.5H3v-3l1.8-4.2A2 2 0 0 1 6.6 8h9.6a2 2 0 0 1 1.7.9l2.6 4.1v3.5h-1.5M14.5 16.5h-5" />
      <circle cx="7.25" cy="16.5" r="2" /><circle cx="16.75" cy="16.5" r="2" />
    </>
  ),
  kufr: (
    <>
      <path d="M9.5 7V5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7H18a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1" />
      <circle className="zi-dot" cx="12" cy="13.2" r="1.4" />
    </>
  ),
  hotel: (
    <>
      <path d="M3.5 5.5v13" /><path d="M20.5 18.5V13a3 3 0 0 0-3-3H11v5.5H3.5" />
      <circle className="zi-dot" cx="7.2" cy="12.3" r="1.75" />
    </>
  ),
  plaz: (
    <>
      <path d="M17 20h-5v-8.5H4.5a7.5 7.5 0 0 1 15 0h-4" />
      <circle className="zi-dot" cx="20.2" cy="4.6" r="1.4" />
    </>
  ),
  hory: (
    <>
      <path d="M2.5 19 9 8.5l4 6.5 2.5-3.5 6 7.5" />
      <circle className="zi-dot" cx="17" cy="5.5" r="1.4" />
    </>
  ),
  mesto: (
    <>
      <path d="M21 20H3v-7.5h4.5V7l3-3 3 3v13M13.5 11H18a1 1 0 0 1 1 1v8" />
      <circle className="zi-dot" cx="10.5" cy="9.5" r="1.2" />
    </>
  ),
  more: (
    <>
      <path d="M2.5 15.5c2 0 2.5-2 4.75-2s2.75 2 4.75 2 2.5-2 4.75-2 2.75 2 4.75 2" />
      <path d="M6.5 19.5c1.4 0 1.8-1.3 3.2-1.3s1.9 1.3 3.3 1.3" />
      <circle className="zi-dot" cx="12" cy="7.5" r="2" />
    </>
  ),
  jidlo: (
    <>
      <path d="M12 20.5v-9A3.5 3.5 0 0 1 8.5 8L8 3.5h8L15.5 8a3.5 3.5 0 0 1-3.5 3.5" />
      <path d="M8.5 20.5h7" />
      <circle className="zi-dot" cx="12" cy="7.2" r="1.1" />
    </>
  ),
  foto: (
    <>
      <path d="M11 7H8l1.5-2h5L16 7h2.5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2H7" />
      <circle cx="12" cy="13.5" r="3.5" /><circle className="zi-dot" cx="17.4" cy="10" r="1" />
    </>
  ),
  clanek: (
    <>
      <path d="M12 19.5V6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5c-3.5-.5-6.5 0-8.5 1.5" />
      <circle className="zi-dot" cx="16.3" cy="12" r="1.1" />
    </>
  ),
  kompas: (
    <>
      <path d="M12 3l1.8 7.2L21 12l-7.2 1.8L12 21l-1.8-7.2L3 12l7.2-1.8z" />
      <circle className="zi-dot" cx="12" cy="12" r="1.25" />
    </>
  ),
  poloha: (
    <>
      <path d="M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11-6.5 11z" />
      <circle className="zi-dot" cx="12" cy="10" r="2.2" />
    </>
  ),
  trasa: (
    <>
      <circle cx="5.5" cy="18.5" r="2" />
      <path d="M7.3 17C10.5 14 13.5 16.5 16.8 8.4" strokeDasharray="0.1 3" />
      <circle className="zi-dot" cx="18" cy="5.8" r="2" />
    </>
  ),
  kalendar: (
    <>
      <path d="M8 3.5v4M16 3.5v4" />
      <path d="M10.5 5.5h3M18.5 5.5a1.5 1.5 0 0 1 1.5 1.5v11.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5V7a1.5 1.5 0 0 1 1.5-1.5" />
      <circle className="zi-dot" cx="15" cy="15" r="1.5" />
    </>
  ),
  cas: (
    <>
      <circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" />
    </>
  ),
  osoby: (
    <>
      <circle cx="9.5" cy="8.5" r="3" /><path d="M4 19.5c0-3.5 2.5-6 5.5-6s5.5 2.5 5.5 6" />
      <path d="M17.5 14c1.8.7 3 2.6 3 5.5" /><circle className="zi-dot" cx="17.5" cy="9" r="1.75" />
    </>
  ),
  mena: (
    <>
      <circle cx="12" cy="12" r="8.5" /><path d="M14.6 9a3.5 3.5 0 1 0 0 6M8 11h5M8 13h5" />
    </>
  ),
  slunce: (
    <>
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
      <circle className="zi-dot" cx="12" cy="12" r="3.25" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" /><path d="M12 11v5" /><circle className="zi-dot" cx="12" cy="8" r="1.2" />
    </>
  ),
  // rozhraní – bez tečky
  hledat: (<><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>),
  menu: (<path d="M4 7h16M4 12h16M4 17h10" />),
  zavrit: (<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />),
  sipka: (<path d="M4 12h15M13.5 6.5 19 12l-5.5 5.5" />),
  chevron: (<path d="m6.5 9.5 5.5 5.5 5.5-5.5" />),
  filtr: (
    <>
      <path d="M4 7.5h8.5M16.5 7.5H20M4 16.5h3.5M11.5 16.5H20" /><circle cx="14.5" cy="7.5" r="2" /><circle cx="9.5" cy="16.5" r="2" />
    </>
  ),
  plus: (<path d="M12 5v14M5 12h14" />),
  minus: (<path d="M5 12h14" />),
  ucet: (<><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>),
  srdce: (<path d="M12 19.5s-7.5-4.4-7.5-10A4 4 0 0 1 12 7.2a4 4 0 0 1 7.5 2.3c0 5.6-7.5 10-7.5 10z" />),
  sdilet: (<><path d="M12 4v11M8 8l4-4 4 4" /><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></>),
  mapa: (<><path d="M3.5 6.5 9 4.5l6 2 5.5-2v13l-5.5 2-6-2-5.5 2z" /><path d="M9 4.5v13M15 6.5v13" /></>),
  ok: (<path d="m5 12.5 4.5 4.5L19 7.5" />),
  hvezda: (<path d="m12 4 2.4 5 5.4.7-4 3.7 1 5.4L12 16.2l-4.8 2.6 1-5.4-4-3.7 5.4-.7z" />),
} satisfies Record<string, JSX.Element>

export type IconName = keyof typeof ICONS

interface Props extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  size?: 'sm' | 'md' | 'lg'
  /** Přístupný popisek; bez něj je ikona dekorativní (aria-hidden). */
  label?: string
}

export default function Icon({ name, size = 'md', label, className, ...rest }: Props) {
  const cls = ['zi', size === 'sm' && 'zi--sm', size === 'lg' && 'zi--lg', className].filter(Boolean).join(' ')
  return (
    <svg
      className={cls}
      viewBox="0 0 24 24"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...rest}
    >
      {ICONS[name]}
    </svg>
  )
}
