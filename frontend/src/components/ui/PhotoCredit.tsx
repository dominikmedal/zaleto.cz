import type { GuidePhoto } from '@/lib/guide'

const UNSPLASH = 'https://unsplash.com/?utm_source=zaleto&utm_medium=referral'

/** Zdroj fotky: autor + Wikimedia Commons (s licencí) nebo Unsplash. */
export function PhotoCredit({ photo, className }: { photo: GuidePhoto; className?: string }) {
  const wiki = photo.source === 'wikimedia'
  return (
    <span className={className}>
      <a href={photo.creditUrl} target="_blank" rel="noopener noreferrer">{photo.credit.replace(/\s+\d{1,2}:\d\d.*$/, '').slice(0, 48)}</a>{' / '}
      {wiki
        ? <a href="https://commons.wikimedia.org" target="_blank" rel="noopener noreferrer">Wikimedia Commons{photo.license ? `, ${photo.license}` : ''}</a>
        : <a href={UNSPLASH} target="_blank" rel="noopener noreferrer">Unsplash</a>}
    </span>
  )
}
