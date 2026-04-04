interface Stat {
  value: string
  label: string
  dark?: boolean
}

export default function StatsStrip({ stats }: { stats: Stat[] }) {
  return (
    <div className="mt-5 inline-flex rounded-2xl overflow-hidden shadow-sm border border-gray-100" style={{ isolation: 'isolate' }}>
      {stats.map((s, i) => (
        <div
          key={i}
          className={[
            'flex flex-col justify-center px-5 py-3.5 relative',
            s.dark
              ? 'bg-gray-950 text-white'
              : 'bg-white text-gray-900',
            i > 0 ? (s.dark ? 'border-l border-white/10' : 'border-l border-gray-100') : '',
          ].join(' ')}
        >
          {/* Thin top accent line */}
          {!s.dark && (
            <span
              className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background: i === 0 ? '#0093FF' : 'transparent' }}
            />
          )}

          <span className={[
            'text-xl sm:text-2xl font-black tabular-nums leading-none tracking-tight',
            s.dark ? 'text-white' : 'text-gray-900',
          ].join(' ')}>
            {s.value}
          </span>
          <span className={[
            'text-[9px] font-bold uppercase tracking-[0.14em] mt-1.5 leading-none',
            s.dark ? 'text-white/45' : 'text-gray-400',
          ].join(' ')}>
            {s.label}
          </span>
        </div>
      ))}
    </div>
  )
}
