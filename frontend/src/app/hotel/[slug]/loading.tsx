import Header from '@/components/Header'

/** Načítání detailu hotelu: kostra stejné stavby jako stránka (lístky, rezervační box) + trasa s modrou tečkou. */
export default function HotelDetailLoading() {
  return (
    <>
      <Header />
      <div className="z-container z-loading" role="status" aria-live="polite" aria-label="Načítám hotel" style={{ paddingTop: 'var(--space-6)' }}>
        <div className="z-skel" style={{ height: 14, width: 280 }} />
        <div className="z-skel" style={{ height: 56, width: 'min(640px, 80%)', margin: 'var(--space-5) 0 var(--space-3)', borderRadius: 'var(--radius-lg)' }} />
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
          {[120, 96, 150, 110].map(w => <div key={w} className="z-skel" style={{ height: 22, width: w, borderRadius: 'var(--radius-pill)' }} />)}
        </div>

        <div className="z-loadroute" aria-hidden="true"><span /></div>

        <div className="z-loading__gallery" aria-hidden="true">
          <div className="z-skel" />
          <div className="z-skel" /><div className="z-skel" /><div className="z-skel" /><div className="z-skel" />
        </div>

        <div className="z-hotel" aria-hidden="true">
          <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
            {[0, 1, 2].map(i => (
              <div key={i} className="z-tk"><div className="z-tk__in" style={{ padding: 'var(--space-5)', display: 'grid', gap: 'var(--space-3)' }}>
                <div className="z-skel" style={{ height: 28, width: 220 }} />
                <div className="z-skel" style={{ height: 14 }} />
                <div className="z-skel" style={{ height: 14, width: '88%' }} />
                <div className="z-skel" style={{ height: 14, width: '64%' }} />
              </div></div>
            ))}
          </div>
          <aside>
            <div className="z-bookbox" style={{ display: 'grid', gap: 'var(--space-4)' }}>
              <div className="z-skel" style={{ height: 14, width: 90 }} />
              <div className="z-skel" style={{ height: 52, width: 200, borderRadius: 'var(--radius-lg)' }} />
              <div className="z-skel" style={{ height: 70 }} />
              <div className="z-skel" style={{ height: 56, borderRadius: 'var(--radius-pill)' }} />
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}
