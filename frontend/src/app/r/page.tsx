import { Suspense } from 'react'
import AffRedirectClient from './client'

export const metadata = { robots: 'noindex, nofollow' }

export default function AffRedirectPage() {
  return (
    <Suspense>
      <AffRedirectClient />
    </Suspense>
  )
}
