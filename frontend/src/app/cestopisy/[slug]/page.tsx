import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/Header'
import JsonLd from '@/components/JsonLd'
import Icon from '@/components/ui/Icon'
import Crumbs from '@/components/ui/Crumbs'
import ArticleBody from '@/components/ui/ArticleBody'
import { formatLongDate } from '@/components/ui/format'
import { approvedTravelogue } from '@/server/travelogues'

export const revalidate = 300
export const dynamicParams = true
interface Props { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await approvedTravelogue(params.slug)
  if (!t) return { title: 'Cestopis nenalezen | Zaleto' }
  return {
    title: `${t.title} | Cestopisy | Zaleto`,
    description: t.body.replace(/[#*>\-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 155),
    alternates: { canonical: `https://zaleto.cz/cestopisy/${t.slug}` },
  }
}

export default async function CestopisPage({ params }: Props) {
  const t = await approvedTravelogue(params.slug)
  if (!t) notFound()
  return (
    <>
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'Article', headline: t.title,
        author: { '@type': 'Person', name: t.author_name }, datePublished: t.approved_at,
        mainEntityOfPage: `https://zaleto.cz/cestopisy/${t.slug}`,
      }} />
      <Header />
      <div className="z-page">
        <main>
          <Crumbs items={[{ label: 'Zaleto', href: '/' }, { label: 'Cestopisy', href: '/cestopisy' }, { label: t.title }]} />
          <div className="z-kicker" style={{ marginTop: 'var(--space-5)' }}>{t.destination}</div>
          <h1 className="h1" style={{ margin: 'var(--space-3) 0 var(--space-3)' }}>{t.title}</h1>
          <div className="z-data" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
            <Icon name="ucet" size="sm" />{t.author_name}{t.approved_at ? ` · ${formatLongDate(t.approved_at)}` : ''}
          </div>
          <div className="z-prose" style={{ marginTop: 'var(--space-6)', maxWidth: 'var(--article-max)' }}>
            <ArticleBody content={t.body} />
          </div>
          <p style={{ marginTop: 'var(--space-7)', display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
            <Link href={`/destinace/${t.dest_slug}`} className="z-more">Zájezdy a tipy: {t.destination}</Link>
            <Link href="/cestopisy/napsat" className="z-more">Napsat vlastní cestopis</Link>
          </p>
        </main>
      </div>
    </>
  )
}
