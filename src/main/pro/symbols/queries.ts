// Запросы редактора к индексу: дополнение, hover, подсказка параметров, переход, ссылки, переименование. Чистая логика поверх ProjectIndex.
import { ProjectIndex } from '../../../shared/pro/cindex/projectIndex'
import { callContext, completionContext, maskCode, wordContext } from '../../../shared/pro/cindex/context'
import type { Sym } from '../../../shared/pro/cindex/types'
import type { CompletionDto, CompletionItemDto, CursorReq, HoverDto, RefMatch, RenamePlan, SignatureDto, SymDto } from './types'

const C_KEYWORDS = new Set(['auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if', 'inline', 'int', 'long', 'register', 'restrict', 'return', 'short', 'signed', 'sizeof', 'static', 'struct', 'switch', 'typedef', 'union', 'unsigned', 'void', 'volatile', 'while', 'class', 'namespace', 'template', 'new', 'delete', 'this', 'public', 'private', 'protected', 'bool', 'true', 'false'])
const RESERVED_FIELD = /^RESERVED\d*$|^_?reserved\d*$/i

export const symLoc = (ix: ProjectIndex, s: Sym): SymDto => {
  const f = ix.fileOf(s)
  return { name: s.n, kind: s.k, path: f?.path ?? '', line: s.l, col: s.c, detail: s.s, doc: s.d, parent: s.p, own: !!f?.own }
}

/** Документация символа: у определения функции своей может не быть, тогда берётся из прототипа (заголовка). */
function docOf(ix: ProjectIndex, s: Sym): string | undefined {
  if (s.d) return s.d
  if (s.k === 'field' || s.k === 'enumerator') return undefined
  return ix.lookup(s.n).find((x) => x.k === s.k && x.d)?.d
}

const shortValue = (v: string | undefined): string => (v && v.length > 60 ? v.slice(0, 57) + '…' : v ?? '')

function detailOf(s: Sym): string {
  if (s.k === 'macro') return s.a ? `(${s.a.join(', ')}) ${shortValue(s.v)}`.trim() : shortValue(s.v)
  return s.s ?? s.n
}

export function completion(ix: ProjectIndex, req: { before: string }): CompletionDto {
  const ctx = completionContext(req.before)
  if (ctx.kind === 'none') return { items: [], incomplete: false, context: 'none' }
  if (ctx.kind === 'include') {
    const seen = new Set<string>()
    const items: CompletionItemDto[] = []
    for (const f of ix.files) {
      if (!/\.(h|hpp|hh|inc)$/i.test(f.path)) continue
      const name = f.path.slice(f.path.lastIndexOf('/') + 1)
      if (seen.has(name)) continue
      seen.add(name)
      if (!name.toLowerCase().startsWith(ctx.prefix.toLowerCase())) continue
      items.push({ label: name, kind: 'file', sort: f.own ? 0 : 10, own: f.own })
    }
    return { items, incomplete: false, context: 'include' }
  }
  if (ctx.kind === 'member') {
    const type = ix.chainType(ctx.chain, req.before)
    const items: CompletionItemDto[] = []
    if (type) {
      const mem = ix.membersOf(type)
      const lay = ix.layout(type)
      const inst = ctx.chain.length === 1 ? ix.instance(ctx.chain[0]) : undefined
      let order = 0
      for (const m of mem) {
        if (m.k === 'enumerator' || (m.k === 'field' && RESERVED_FIELD.test(m.n))) continue
        const off = m.k === 'field' ? lay?.offsets.get(m.n) : undefined
        const doc = [m.d, off !== undefined ? `Смещение: 0x${off.toString(16).toUpperCase().padStart(2, '0')}${inst ? ` (адрес 0x${((ix.instanceAddress(inst.name) ?? 0n) + BigInt(off)).toString(16).toUpperCase()})` : ''}` : undefined].filter(Boolean).join('\n\n')
        items.push({ label: m.n, kind: m.k, detail: m.s ?? m.n, doc: doc || undefined, sort: order++, own: false })
      }
    }
    return { items, incomplete: false, context: 'member' }
  }
  // обычный идентификатор
  const items: CompletionItemDto[] = []
  const seen = new Set<string>()
  if (ctx.reg) {
    const type = ix.chainType(ctx.reg.chain, req.before)
    if (type) {
      for (const [i, s] of ix.bitMacros(type, ctx.reg.reg, 400).entries()) {
        seen.add(s.n)
        items.push({ label: s.n, kind: 'macro', detail: detailOf(s), doc: s.d, sort: -1000 + i, own: false })
      }
    }
  }
  const LIMIT = 300
  let incomplete = false
  if (ctx.prefix.length === 0) {
    for (const s of ix.ownSymbols().slice(0, LIMIT)) {
      if (seen.has(s.n)) continue
      seen.add(s.n)
      items.push({ label: s.n, kind: s.k, detail: detailOf(s), doc: s.d, sort: 0, own: true })
    }
  } else {
    const res = ix.complete(ctx.prefix, LIMIT)
    incomplete = res.length >= LIMIT
    for (const [i, r] of res.entries()) {
      if (seen.has(r.sym.n)) continue
      seen.add(r.sym.n)
      items.push({ label: r.sym.n, kind: r.sym.k, detail: detailOf(r.sym), doc: r.sym.d, sort: i + 1, own: r.own })
    }
  }
  return { items, incomplete, context: 'plain' }
}

const hex = (v: bigint): string => '0x' + v.toString(16).toUpperCase()

function whereOf(ix: ProjectIndex, s: Sym): HoverDto['where'] {
  const f = ix.fileOf(s)
  return f ? { path: f.path, line: s.l, col: s.c, own: f.own } : undefined
}

export function hover(ix: ProjectIndex, req: CursorReq): HoverDto | null {
  const w = wordContext(req.lineText, req.col - 1)
  if (!w) return null
  if (C_KEYWORDS.has(w.word)) return null
  const facts: string[] = []
  let sym: Sym | undefined
  let typeOfMember: string | undefined
  if (w.chain) {
    typeOfMember = ix.chainType(w.chain, req.before)
    sym = ix.membersOf(typeOfMember).find((m) => m.n === w.word && m.k !== 'enumerator')
    if (!sym) return null
    const off = typeOfMember ? ix.fieldOffset(typeOfMember, sym.n) : undefined
    const inst = w.chain.length === 1 ? ix.instance(w.chain[0]) : undefined
    if (off !== undefined) {
      facts.push(`Смещение в ${typeOfMember}: 0x${off.toString(16).toUpperCase().padStart(2, '0')}`)
      if (inst) { const base = ix.instanceAddress(inst.name); if (base !== undefined) facts.push(`Адрес регистра: ${hex(base + BigInt(off))}`) }
    }
    if (sym.arr) facts.push(`Массив: [${sym.arr}]`)
    return { start: w.start, end: w.end, code: sym.s ?? sym.n, doc: sym.d, facts, where: whereOf(ix, sym) }
  }
  sym = ix.best(w.word, { file: undefined })
  if (!sym) {
    // поле без видимой цепочки (локальная структура): если имя одно — показываем его
    const fields = ix.lookup(w.word).filter((s) => s.k === 'field')
    if (fields.length === 0) return null
    sym = fields[0]
    if (fields.length > 1) facts.push(`Поле нескольких структур (${new Set(fields.map((f) => f.p)).size}): ${[...new Set(fields.map((f) => f.p))].slice(0, 4).join(', ')}`)
  }
  let code = sym.s ?? sym.n
  switch (sym.k) {
    case 'macro': {
      const inst = ix.instance(sym.n)
      if (inst) {
        const base = ix.instanceAddress(inst.name)
        facts.push(`Периферия типа ${inst.type}${base !== undefined ? `, базовый адрес ${hex(base)}` : ''}`)
        const lay = ix.layout(inst.type)
        const n = ix.membersOf(inst.type).filter((m) => m.k === 'field' && !RESERVED_FIELD.test(m.n)).length
        if (n) facts.push(`Регистров: ${n}${lay ? `, размер блока ${lay.size} байт` : ''}`)
      } else if (!sym.a) {
        const v = ix.describeMacro(sym.n)
        if (v !== undefined) facts.push(`Значение: ${v}`)
        if (/_Pos$/.test(sym.n)) facts.push('Номер младшего бита поля')
        else if (/_Msk$/.test(sym.n)) facts.push('Маска поля (сдвинута на позицию)')
        else if (/_BASE$/.test(sym.n)) facts.push('Базовый адрес')
      }
      break
    }
    case 'enumerator': {
      const v = ix.exprValue(sym.v ?? '')
      facts.push(`Значение: ${v !== undefined ? hex(v) : sym.v ?? 'по порядку'}${sym.p ? ` (${sym.p})` : ''}`)
      break
    }
    case 'struct': case 'union': case 'typedef': case 'class': case 'enum': {
      const t = ix.resolveType(sym.n) ?? sym.n
      const lay = ix.layout(t)
      if (lay) facts.push(`Размер: ${lay.size} байт`)
      const cnt = ix.membersOf(t).filter((m) => m.k === 'field').length
      if (cnt) facts.push(`Полей: ${cnt}`)
      if (sym.k === 'typedef' && sym.t) code = sym.s ?? code
      break
    }
    case 'variable': {
      const t = ix.resolveType(sym.t)
      if (t) facts.push(`Тип: ${t}`)
      break
    }
    case 'function':
      if (sym.b === undefined) facts.push('Только объявление (прототип)')
      break
  }
  return { start: w.start, end: w.end, code, doc: docOf(ix, sym), facts, where: whereOf(ix, sym) }
}

export function signature(ix: ProjectIndex, before: string): SignatureDto | null {
  const cc = callContext(before)
  if (!cc) return null
  const cands = ix.lookup(cc.name).filter((s) => s.k === 'function' || (s.k === 'macro' && s.a))
  if (cands.length === 0) return null
  const seen = new Set<string>()
  const sigs: SignatureDto['signatures'] = []
  for (const s of cands.sort((a, b) => Number(!!a.b) - Number(!!b.b))) {
    const label = s.k === 'macro' ? `${s.n}(${(s.a ?? []).join(', ')})` : s.s ?? `${s.n}(${(s.a ?? []).join(', ')})`
    if (seen.has(label)) continue
    seen.add(label)
    sigs.push({ label, doc: docOf(ix, s), params: s.a ?? [] })
  }
  const active = Math.max(0, sigs.findIndex((s) => s.params.length > cc.arg))
  return { signatures: sigs, active, activeParam: Math.min(cc.arg, Math.max(0, (sigs[active]?.params.length ?? 1) - 1)) }
}

/** Куда ведёт слово под курсором: объявления в порядке предпочтения. */
export function definitions(ix: ProjectIndex, req: CursorReq): SymDto[] {
  const inc = /^\s*#\s*include\s*["<]([^">]+)[">]/.exec(req.lineText)
  if (inc) {
    const name = inc[1].trim()
    const f = ix.files.find((x) => x.path.endsWith('/' + name) || x.path === name)
    return f ? [{ name, kind: 'file' as never, path: f.path, line: 1, col: 1, own: f.own }] : []
  }
  const w = wordContext(req.lineText, req.col - 1)
  if (!w) return []
  let list: Sym[]
  if (w.chain) {
    const t = ix.chainType(w.chain, req.before)
    list = ix.membersOf(t).filter((m) => m.n === w.word && m.k !== 'enumerator')
    if (list.length === 0) list = ix.lookup(w.word).filter((s) => s.k === 'field')
  } else {
    list = ix.definitions(w.word).filter((s) => s.k !== 'field')
    if (list.length === 0) list = ix.lookup(w.word)
  }
  return list.slice(0, 20).map((s) => symLoc(ix, s))
}

// ----- ссылки и переименование -----

function lineStarts(text: string): number[] {
  const out = [0]
  for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) out.push(i + 1)
  return out
}

const escapeRe = (s: string): string => s.replace(/[$.*+?^${}()|[\]\\]/g, '\\$&')

/** Вхождения слова по границам идентификатора, кроме комментариев и строк. mode 'field' — только после «->» или «.» либо в точке объявления. */
export function findWord(text: string, name: string, opts: { field?: { line: number } } = {}): RefMatch[] {
  const masked = maskCode(text)
  const re = new RegExp(`(?<![\\w$])${escapeRe(name)}(?![\\w$])`, 'g')
  const starts = lineStarts(text)
  const out: RefMatch[] = []
  for (let m = re.exec(masked); m; m = re.exec(masked)) {
    let lo = 0
    let hi = starts.length - 1
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= m.index) lo = mid; else hi = mid - 1 }
    const line = lo + 1
    const col = m.index - starts[lo] + 1
    if (opts.field) {
      const before = masked.slice(Math.max(0, m.index - 4), m.index).trimEnd()
      if (!(before.endsWith('->') || before.endsWith('.') || line === opts.field.line)) continue
    }
    const end = text.indexOf('\n', m.index)
    const lt = text.slice(starts[lo], end < 0 ? text.length : end).replace(/\r$/, '')
    out.push({ path: '', line, col, text: lt.trim().slice(0, 200), len: name.length })
    if (out.length > 3000) break
  }
  return out
}

export interface TextSource { all(): { path: string; own: boolean }[]; read(path: string): Promise<string | undefined> }

/** Какой символ имеется в виду и в каких файлах его искать. */
function targetOf(ix: ProjectIndex, req: CursorReq): { sym: Sym; name: string; fileScope: string | null } | { error: string } {
  const w = wordContext(req.lineText, req.col - 1)
  if (!w) return { error: 'Поставьте курсор на имя символа.' }
  const defs = w.chain
    ? ix.membersOf(ix.chainType(w.chain, req.before)).filter((m) => m.n === w.word && m.k !== 'enumerator')
    : ix.definitions(w.word)
  const sym = defs[0] ?? ix.lookup(w.word)[0]
  if (!sym) return { error: `«${w.word}» не найден среди символов проекта. Переименование доступно для функций, макросов, переменных, типов и полей; локальные переменные — через поиск и замену (Ctrl+H).` }
  let fileScope: string | null = null
  const f = ix.fileOf(sym)
  if (sym.st && f && /\.(c|cpp|cc|cxx|s)$/i.test(f.path)) fileScope = f.path
  return { sym, name: w.word, fileScope }
}

export async function references(ix: ProjectIndex, req: CursorReq, src: TextSource): Promise<{ name: string; refs: RefMatch[]; truncated: boolean } | { error: string }> {
  const t = targetOf(ix, req)
  if ('error' in t) return t
  const fieldOpt = t.sym.k === 'field' ? { field: { line: -1 } } : {}
  const refs: RefMatch[] = []
  for (const f of src.all()) {
    if (!f.own) continue
    if (t.fileScope && f.path !== t.fileScope) continue
    const text = await src.read(f.path)
    if (text === undefined) continue
    const declFile = ix.fileOf(t.sym)?.path
    const opt = t.sym.k === 'field' ? { field: { line: f.path === declFile ? t.sym.l : -1 } } : fieldOpt
    for (const m of findWord(text, t.name, opt)) { m.path = f.path; refs.push(m) }
    if (refs.length > 2000) break
  }
  // объявление в чужом заголовке тоже показываем первой строкой, если оно не попало в список
  return { name: t.name, refs, truncated: refs.length > 2000 }
}

export async function renamePlan(ix: ProjectIndex, req: CursorReq, newName: string, src: TextSource): Promise<RenamePlan> {
  const t = targetOf(ix, req)
  if ('error' in t) return { ok: false, error: t.error }
  if (!/^[A-Za-z_]\w*$/.test(newName)) return { ok: false, error: 'Имя должно состоять из латинских букв, цифр и «_» и не начинаться с цифры.' }
  if (C_KEYWORDS.has(newName)) return { ok: false, error: `«${newName}» — ключевое слово C/C++.` }
  if (newName === t.name) return { ok: false, error: 'Новое имя совпадает со старым.' }
  const f = ix.fileOf(t.sym)
  if (!f?.own) return { ok: false, error: `«${t.name}» объявлен в стороннем файле (${f?.path.split('/').pop() ?? '?'}): CMSIS, HAL и библиотеки переименовывать нельзя.` }
  if (t.sym.k === 'field') {
    const same = ix.lookup(t.name).filter((s) => s.k === 'field')
    if (new Set(same.map((s) => s.p)).size > 1) return { ok: false, error: `Поле «${t.name}» есть у нескольких структур — без полноценного анализа типов переименовать безопасно нельзя.` }
  }
  const clash = ix.lookup(newName).filter((s) => s.k !== 'field' && (t.sym.k !== 'field'))
  const macroClash = clash.find((s) => s.k === 'macro')
  if (macroClash) return { ok: false, error: `Имя «${newName}» уже занято макросом (${ix.fileOf(macroClash)?.path.split('/').pop()}:${macroClash.l}).` }
  const warning = clash.length ? `Имя «${newName}» уже есть в проекте (${ix.fileOf(clash[0])?.path.split('/').pop()}:${clash[0].l}) — возможен конфликт.` : undefined
  const r = await references(ix, req, src)
  if ('error' in r) return { ok: false, error: r.error }
  const byFile = new Map<string, RefMatch[]>()
  for (const m of r.refs) { const a = byFile.get(m.path); if (a) a.push(m); else byFile.set(m.path, [m]) }
  const files = []
  for (const [path, matches] of byFile) {
    const text = (await src.read(path)) ?? ''
    // замена от конца к началу: позиции не сдвигаются
    const starts = lineStarts(text)
    let out = text
    for (const m of [...matches].sort((a, b) => b.line - a.line || b.col - a.col)) {
      const at = starts[m.line - 1] + m.col - 1
      out = out.slice(0, at) + newName + out.slice(at + m.len)
    }
    files.push({ path, count: matches.length, matches, newText: out })
  }
  if (files.length === 0) return { ok: false, error: 'Вхождений для замены не найдено.' }
  return { ok: true, name: t.name, newName, kind: t.sym.k, files, warning }
}
