// Разбор board_manager.additional_urls из конфига Arduino IDE 2 (arduino-cli.yaml) — простой разбор секции, без yaml-библиотек.

const stripComment = (s: string): string => {
  let q: string | null = null
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (q) { if (c === q) q = null; continue }
    if (c === '"' || c === "'") { q = c; continue }
    // комментарий начинается с « #» (в адресах «#» бывает в якоре, но после пробела — уже комментарий)
    if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i)
  }
  return s
}

const unquote = (s: string): string => {
  const t = s.trim()
  return t.length >= 2 && (t[0] === '"' || t[0] === "'") && t[t.length - 1] === t[0] ? t.slice(1, -1) : t
}

const indentOf = (l: string): number => l.length - l.trimStart().length

/** Адреса из board_manager.additional_urls. Понимает блочный список («- url») и строчный («[a, b]»). */
export function parseAdditionalUrls(yaml: string): string[] {
  const lines = yaml.replace(/^﻿/, '').split(/\r\n|\n|\r/).map(stripComment)
  const out: string[] = []
  let i = 0
  while (i < lines.length && !/^board_manager\s*:\s*$/.test(lines[i].trimEnd())) i++
  if (i >= lines.length) return out
  const sectionIndent = indentOf(lines[i])
  for (i++; i < lines.length; i++) {
    const raw = lines[i]
    if (!raw.trim()) continue
    if (indentOf(raw) <= sectionIndent) break
    const m = /^\s*additional_urls\s*:\s*(.*)$/.exec(raw)
    if (!m) continue
    const keyIndent = indentOf(raw)
    const rest = m[1].trim()
    if (rest.startsWith('[')) {
      let flow = rest
      while (!flow.includes(']') && i + 1 < lines.length) flow += ' ' + lines[++i].trim()
      const inner = flow.slice(1, flow.indexOf(']') === -1 ? undefined : flow.indexOf(']'))
      for (const part of inner.split(',')) { const u = unquote(part); if (u) out.push(u) }
      break
    }
    if (rest) break // скаляр или «[]» без элементов
    for (i++; i < lines.length; i++) {
      const l = lines[i]
      if (!l.trim()) continue
      const it = /^(\s*)-\s*(.*)$/.exec(l)
      if (!it || (indentOf(l) < keyIndent)) { i--; break }
      const u = unquote(it[2])
      if (u) out.push(u)
    }
    break
  }
  return [...new Set(out)]
}
