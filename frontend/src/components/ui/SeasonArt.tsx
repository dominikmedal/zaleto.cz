import type { SeasonKey } from '@/lib/season'

/**
 * Vlastní grafika roční doby pro položku menu (stejný styl jako sada ikon: tah, kulaté konce, barvy webu).
 * Podzim: padající listí, zima: sněhová čepice a vločky, jaro: květ a lístky, léto: slunce.
 * Čistě dekorativní (aria-hidden); animace jsou jemné a při `prefers-reduced-motion` se vypínají.
 */
export default function SeasonArt({ season }: { season: SeasonKey }) {
  return (
    <span className={`z-sart z-sart--${season}`} aria-hidden="true">
      {season === 'autumn' && (
        <>
          <svg className="z-sart__a" viewBox="0 0 24 24" style={{ ['--r' as string]: '-28deg', left: -10, top: -9, width: 20 }}>
            <path d="M5 19C5 10.5 10 5 19.5 4.5 19.5 14 14 19 5 19z" fill="var(--accent)" stroke="var(--accent-strong)" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="m5 19 7-7" stroke="var(--accent-strong)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </svg>
          <svg className="z-sart__b" viewBox="0 0 24 24" style={{ ['--r' as string]: '38deg', left: 8, top: -13, width: 14 }}>
            <path d="M5 19C5 10.5 10 5 19.5 4.5 19.5 14 14 19 5 19z" fill="var(--accent-strong)" stroke="var(--accent-strong)" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="m5 19 7-7" stroke="var(--accent-soft)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </svg>
          <svg className="z-sart__c" viewBox="0 0 24 24" style={{ ['--r' as string]: '8deg', left: -16, top: 6, width: 12 }}>
            <path d="M5 19C5 10.5 10 5 19.5 4.5 19.5 14 14 19 5 19z" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="m5 19 7-7" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          </svg>
        </>
      )}
      {season === 'winter' && (
        <>
          {/* sněhová čepice na horní hraně */}
          <svg className="z-sart__cap" viewBox="0 0 120 14" preserveAspectRatio="none">
            <path d="M2 11C4 4 12 2 18 6c3-5 12-6 17-1 4-4 13-4 17 1 4-5 14-5 18 0 4-4 13-3 16 2 2 1 7 1 12 3v1H2z" fill="#fff" stroke="var(--line)" strokeWidth="1" strokeLinejoin="round" />
          </svg>
          <svg className="z-sart__a" viewBox="0 0 24 24" style={{ left: -12, top: -3, width: 16 }}>
            <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5" fill="none" stroke="var(--brand-strong)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <svg className="z-sart__b" viewBox="0 0 24 24" style={{ right: 6, bottom: -9, width: 11 }}>
            <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <i className="z-sart__dot" style={{ left: 14, bottom: -6 }} /><i className="z-sart__dot z-sart__dot--s" style={{ right: -5, top: 6 }} />
        </>
      )}
      {season === 'spring' && (
        <>
          <svg className="z-sart__a" viewBox="0 0 24 24" style={{ left: -11, top: -8, width: 20 }}>
            <g fill="var(--sky)" stroke="var(--brand-strong)" strokeWidth="1.5">
              <circle cx="12" cy="6.5" r="2.7" /><circle cx="12" cy="17.5" r="2.7" /><circle cx="6.5" cy="12" r="2.7" /><circle cx="17.5" cy="12" r="2.7" />
            </g>
            <circle cx="12" cy="12" r="2.1" fill="var(--accent)" />
          </svg>
          <svg className="z-sart__b" viewBox="0 0 24 24" style={{ ['--r' as string]: '30deg', left: 8, top: -11, width: 13 }}>
            <path d="M5 19C5 10.5 10 5 19.5 4.5 19.5 14 14 19 5 19z" fill="var(--success)" stroke="var(--success)" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </>
      )}
      {season === 'summer' && (
        <svg className="z-sart__a" viewBox="0 0 24 24" style={{ left: -12, top: -9, width: 22 }}>
          <circle cx="12" cy="12" r="4.2" fill="var(--accent)" stroke="var(--accent-strong)" strokeWidth="1.5" />
          <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" stroke="var(--accent-strong)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </svg>
      )}
    </span>
  )
}
