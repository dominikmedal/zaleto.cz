'use client'
import { useEffect } from 'react'
import { rememberFilters } from '@/lib/filterMemory'

/** Uloží parametry aktuálního vyhledávání, aby si je převzal detail hotelu (termín, odkud). */
export default function RememberFilters({ params }: { params: Record<string, string | undefined> }) {
  const key = JSON.stringify(params)
  useEffect(() => { rememberFilters(JSON.parse(key)) }, [key])
  return null
}
