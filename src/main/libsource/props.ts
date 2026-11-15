// Разбор library.properties и зависимостей (поле depends).
import type { DependInfo } from './types'

export function parseProperties(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
  }
  return out
}

/** «Adafruit BusIO (>=1.2.0), Foo, Bar (=2.0, <3)» → [{name, constraint}]. Запятые внутри скобок не разделяют. */
export function parseDepends(depends: string | undefined): { name: string; constraint?: string }[] {
  if (!depends) return []
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of depends) {
    if (ch === '(') depth++
    if (ch === ')') depth = Math.max(0, depth - 1)
    if (ch === ',' && depth === 0) { parts.push(cur); cur = '' } else cur += ch
  }
  parts.push(cur)
  const out: { name: string; constraint?: string }[] = []
  for (const p of parts) {
    const m = /^\s*([^()]+?)\s*(?:\(([^)]*)\))?\s*$/.exec(p)
    if (!m || !m[1]) continue
    out.push({ name: m[1], constraint: m[2]?.trim() || undefined })
  }
  return out
}

/** Имена библиотек сравниваются без учёта регистра; пробел и «_» считаются одним и тем же (папки). */
export const normLibName = (s: string): string => s.toLowerCase().replace(/[\s_]+/g, ' ').trim()

export function dependStatus(depends: string | undefined, installedNames: Iterable<string>): DependInfo[] {
  const have = new Set<string>()
  for (const n of installedNames) have.add(normLibName(n))
  return parseDepends(depends).map((d) => ({ ...d, installed: have.has(normLibName(d.name)) }))
}
