import Link from 'next/link'
import type { ReactNode } from 'react'

/** Odkaz, který se v textu doplní automaticky (první výskyt názvu → stránka, která ho vysvětluje). */
export interface AutoLink { name: string; href: string; /** hledat bez ohledu na velikost písmen (u běžných slov, ne u názvů míst) */ ci?: boolean }

/** Slova z textů o dovolené, která se prolinkují na stránku počasí daného místa (první výskyt v textu). */
export function weatherAutoLinks(href: string | null | undefined): AutoLink[] {
  if (!href) return []
  return ['počasí', 'klima', 'klimatu', 'teplota moře', 'teploty moře', 'teplotu moře', 'teplotě moře', 'teplota vzduchu', 'teploty vzduchu']
    .map(name => ({ name, href, ci: true }))
}

export interface AutoLinkCtx { links: { href: string; re: RegExp }[]; used: Set<string>; max: number }

/** Obecná slova, která jsou i názvy oblastí (Ostrov, Pobřeží …): shoda v textu by byla náhodná. */
export const GENERIC_PLACE = /^(ostrov|ostrovy|pobřeží|město|hory|riviéra|centrum|okolí|sever|jih|východ|západ|pláž|moře|ostatní)$/i

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Čerstvý kontext pro jeden text. Delší názvy mají přednost (Costa Adeje před Adeje); `exclude` jsou adresy, na které se neodkazuje (aktuální stránka). */
export function makeAutoLinkCtx(links: AutoLink[] = [], max = 6, exclude: string[] = []): AutoLinkCtx {
  return {
    links: links
      .filter(l => l.name.length >= 4 && !exclude.includes(l.href))
      .sort((a, b) => b.name.length - a.name.length)
      .map(l => ({ href: l.href, re: new RegExp(String.raw`(?<![\p{L}\d])` + esc(l.name) + String.raw`(?![\p{L}\d])`, l.ci ? 'iu' : 'u') })),
    used: new Set(), max,
  }
}

/** První výskyt každého názvu v prostém textu nahradí odkazem (nejvýš `max` odkazů v kontextu). Názvy se hledají v 1. pádu. */
export function autolinkText(text: string, ctx: AutoLinkCtx, key: string): ReactNode[] {
  let parts: ReactNode[] = [text]
  for (const l of ctx.links) {
    if (ctx.used.has(l.href) || ctx.used.size >= ctx.max) continue
    let hit = false
    const out: ReactNode[] = []
    for (const part of parts) {
      const m = !hit && typeof part === 'string' ? l.re.exec(part) : null
      if (!m || typeof part !== 'string') { out.push(part); continue }
      hit = true
      out.push(part.slice(0, m.index), <Link key={`${key}-${l.href}`} href={l.href}>{m[0]}</Link>, part.slice(m.index + m[0].length))
    }
    parts = out
    if (hit) ctx.used.add(l.href)
  }
  return parts
}

/** Text s automatickými odkazy (nová kontext pro každé použití, tedy první výskyt každého názvu v tomto textu). */
export function Linked({ text, links, exclude, max = 8 }: { text: string; links?: AutoLink[]; exclude?: string[]; max?: number }) {
  if (!links?.length) return <>{text}</>
  const ctx = makeAutoLinkCtx(links, max, exclude)
  return <>{autolinkText(text, ctx, 'l').map((p, i) => (typeof p === 'string' ? <span key={i} style={{ display: 'contents' }}>{p}</span> : p))}</>
}
