// Автодополнение: чистая функция без Monaco. Возвращает кандидатов, адаптер в monacoSetup.ts превращает их в CompletionItem.
import type { FuncEntry } from '../reference/types'
import { PLATFORM_LABELS } from '../reference/types'
import type { EditorPlatform } from './types'
import { BUILTIN_OBJECTS, CONSTANTS, HEADERS, KEYWORDS, OBJECT_ALIASES, TYPES } from './constants'
import { SNIPPETS } from './snippets'
import { callSnippet, escapeSnippet, expandRegisterNames, isCodeName, platformMatches } from './resolve'
import { insideCommentOrString } from './scan'
import { extractSymbols, variableTypes, type FileSymbol } from './symbols'
import type { LibIndex } from '../libs/model'
import { classOfObject } from '../libs/model'
import { globalCandidates, memberCandidates, scopeCandidates } from '../libs/complete'
import { inferExprClass, isComplexChain, receiverChain } from '../libs/infer'

export type CandidateKind = 'function' | 'method' | 'constant' | 'class' | 'keyword' | 'type' | 'variable' | 'snippet' | 'macro' | 'file'

export interface Candidate {
  label: string
  kind: CandidateKind
  insertText: string
  isSnippet: boolean
  detail?: string
  /** Markdown. */
  documentation?: string
  /** Чем меньше, тем выше в списке при равной релевантности. */
  rank: number
  filterText?: string
}

export interface CompletionRequest {
  /** Весь текст до курсора. */
  textBefore: string
  /** Платформа (выбранная или определённая); null — неизвестна. */
  platform: EditorPlatform | null
  entries: FuncEntry[]
  /** Символы файла; если не переданы — вычисляются из полного текста (fullText). */
  symbols?: FileSymbol[]
  fullText?: string
  /** Индекс символов библиотек проекта (по #include); без него подсказки только из справочника. */
  libs?: LibIndex
  /** Переменные файла, чей тип — класс из библиотек (локальные тоже): имя → класс. */
  libTypes?: Record<string, string>
}

export interface CompletionResult {
  items: Candidate[]
  /** Если задано — заменять текст с этого индекса (в строке до курсора), а не слово под курсором. */
  replaceFromInLine?: number
}

export function entryDoc(e: FuncEntry): string {
  const parts: string[] = []
  parts.push('```cpp\n' + e.signature + '\n```')
  parts.push(e.description)
  if (e.params.length) parts.push(e.params.map((p) => `- \`${p.name}\` (${p.type}) — ${p.desc}`).join('\n'))
  if (e.returns && !/^(void|ничего|нет)\b/i.test(e.returns.trim())) parts.push(`**Возвращает:** ${e.returns}`)
  if (e.warnings?.length) parts.push(e.warnings.map((w) => `⚠ ${w}`).join('\n\n'))
  return parts.join('\n\n')
}

function platformNote(e: FuncEntry): string {
  if (e.platforms.length >= 5) return ''
  return e.platforms.map((p) => PLATFORM_LABELS[p] ?? p).join(', ')
}

function entryCandidate(e: FuncEntry, member: string, kind: CandidateKind): Candidate {
  const parsed = e.signature.includes('(')
  return {
    label: member,
    kind,
    insertText: parsed ? callSnippet(e, member) : escapeSnippet(member),
    isSnippet: parsed,
    detail: e.signature + (platformNote(e) ? `  [${platformNote(e)}]` : ''),
    documentation: entryDoc(e),
    rank: 1
  }
}

function mergeByLabel(list: Candidate[]): Candidate[] {
  const seen = new Set<string>()
  const out: Candidate[] = []
  for (const c of list) {
    const key = c.kind === 'snippet' ? 'S:' + c.label + c.detail : c.label
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
  }
  return out
}

export function computeCompletions(req: CompletionRequest): CompletionResult {
  const { textBefore, platform, entries } = req
  const lineStart = textBefore.lastIndexOf('\n') + 1
  const linePrefix = textBefore.slice(lineStart)

  // 1) #include <...> / "..."
  const inc = /^\s*#\s*include\s*([<"])([\w./+-]*)$/.exec(linePrefix)
  if (inc) {
    const items: Candidate[] = HEADERS.filter((h) => !h.platforms || !platform || h.platforms.includes(platform) || (platform.startsWith('esp32') && h.platforms.includes('esp32'))).map((h) => ({
      label: h.name,
      kind: 'file' as const,
      insertText: h.name + (inc[1] === '<' ? '>' : '"'),
      isSnippet: false,
      detail: h.detail,
      rank: 1
    }))
    return { items, replaceFromInLine: linePrefix.length - inc[2].length }
  }

  if (insideCommentOrString(textBefore)) return { items: [] }
  if (/^\s*#\s*\w*$/.test(linePrefix)) {
    return {
      items: ['include', 'define', 'ifdef', 'ifndef', 'if', 'else', 'elif', 'endif', 'pragma', 'undef'].map((d) => ({
        label: d,
        kind: 'keyword' as const,
        insertText: d + (d === 'include' ? ' <$0>' : d === 'define' || d === 'ifdef' || d === 'ifndef' || d === 'if' || d === 'elif' ? ' ' : ''),
        isSnippet: d === 'include',
        detail: 'директива препроцессора',
        rank: 1
      }))
    }
  }

  const symbols = req.symbols ?? (req.fullText ? extractSymbols(req.fullText) : [])
  const types = variableTypes(symbols)

  // 2a) Класс::член, перечисление::значение, пространство::функция
  const scopeM = /([A-Za-z_][\w]*(?:\s*::\s*[A-Za-z_]\w*)*)\s*::\s*\w*$/.exec(linePrefix)
  if (scopeM) {
    const items = req.libs ? scopeCandidates(req.libs, scopeM[1].replace(/\s+/g, '')) : []
    return { items: mergeByLabel(items) }
  }

  // 2b') составной получатель: obj.method().<…>, doc["k"].<…>, new Класс(..).<…>
  const chainM = req.libs ? /(\.|->)\s*\w*$/.exec(linePrefix) : null
  if (chainM && req.libs) {
    const libs = req.libs
    const recv = receiverChain(linePrefix.slice(0, chainM.index))
    if (recv && isComplexChain(recv)) {
      const cls = inferExprClass(libs, recv, (n) => classOfObject(libs, n, types, req.libTypes))
      if (cls) return { items: mergeByLabel(memberCandidates(libs, cls)) }
    }
  }

  // 2b) члены объекта: Serial.<...>, bmp.<...>, request-><...>
  const mem = /([A-Za-z_]\w*)\s*(?:\.|->)\s*\w*$/.exec(linePrefix)
  if (mem) {
    const obj = mem[1]
    const out: Candidate[] = []
    // библиотеки проекта: тип известен по объявлению (Adafruit_BMP280 bmp;) или это глобальный объект (WiFi, ESPUI)
    if (req.libs) {
      const cls = classOfObject(req.libs, obj, types, req.libTypes)
      if (cls) out.push(...memberCandidates(req.libs, cls))
    }
    const candidates = [obj, OBJECT_ALIASES[obj], types[obj]].filter((x): x is string => !!x)
    for (const c of candidates) {
      const prefix = c + '.'
      const before = out.length
      for (const e of entries) {
        if (!e.name.startsWith(prefix) || !platformMatches(e, platform)) continue
        const member = e.name.slice(prefix.length)
        if (!/^[A-Za-z_]\w*$/.test(member)) continue
        out.push(entryCandidate(e, member, 'method'))
      }
      if (out.length > before) break
    }
    return { items: mergeByLabel(out) }
  }
  // число с точкой (3.14) и обращение после «)» — не предлагаем
  if (/(\d|\))\s*\.\s*\w*$/.test(linePrefix)) return { items: [] }

  // 3) обычные идентификаторы
  const out: Candidate[] = []

  // символы файла — выше всего
  for (const s of symbols) {
    const isFn = s.kind === 'function'
    out.push({
      label: s.name,
      kind: s.kind === 'function' ? 'function' : s.kind === 'macro' ? 'macro' : s.kind === 'type' ? 'class' : 'variable',
      insertText: isFn || (s.kind === 'macro' && s.params) ? `${s.name}(${(s.params ?? []).map((p, i) => `\${${i + 1}:${p}}`).join(', ')}${(s.params ?? []).length ? '' : '$0'})` : s.name,
      isSnippet: isFn || (s.kind === 'macro' && !!s.params),
      detail: s.detail,
      documentation: `Объявлено в этом файле, строка ${s.line}`,
      rank: 0
    })
  }

  if (req.libs) out.push(...globalCandidates(req.libs))

  const objects = new Set<string>()
  for (const e of entries) {
    if (!platformMatches(e, platform)) continue
    const regs = expandRegisterNames(e)
    if (regs.length) {
      for (const r of regs) out.push({ label: r, kind: 'variable', insertText: r, isSnippet: false, detail: `${e.name}: ${e.category}`, documentation: entryDoc(e), rank: 1 })
      continue
    }
    if (!isCodeName(e.name)) continue
    const dot = e.name.indexOf('.')
    if (dot > 0) {
      objects.add(e.name.slice(0, dot))
      continue
    }
    const isCall = e.signature.includes('(')
    const kind: CandidateKind = isCall ? 'function' : /^[A-Z]/.test(e.name) ? 'class' : 'constant'
    out.push(entryCandidate(e, e.name, kind))
  }
  for (const o of objects) {
    const first = entries.find((e) => e.name.startsWith(o + '.') && platformMatches(e, platform))
    out.push({ label: o, kind: 'class', insertText: o, isSnippet: false, detail: first ? `объект ${o} (${first.category})` : `объект ${o}`, rank: 1 })
  }
  for (const o of BUILTIN_OBJECTS) {
    const base = OBJECT_ALIASES[o]
    // Serial1/Serial2: добавляем, только если знаем объект-основу
    if (base && objects.has(base) && !objects.has(o)) {
      out.push({ label: o, kind: 'class', insertText: o, isSnippet: false, detail: `объект ${base}`, rank: 2 })
    }
  }

  for (const c of CONSTANTS) {
    if (c.platforms && platform && !c.platforms.includes(platform)) continue
    out.push({ label: c.name, kind: 'constant', insertText: c.name, isSnippet: false, detail: c.detail, documentation: c.doc, rank: 1 })
  }
  for (const t of TYPES) out.push({ label: t, kind: 'type', insertText: t, isSnippet: false, detail: 'тип', rank: 3 })
  for (const k of KEYWORDS) out.push({ label: k, kind: 'keyword', insertText: k, isSnippet: false, detail: 'ключевое слово', rank: 4 })

  for (const s of SNIPPETS) {
    if (s.platforms && platform && !s.platforms.some((p) => p === platform || (platform.startsWith('esp32') && p === 'esp32'))) continue
    out.push({
      label: s.prefix,
      kind: 'snippet',
      insertText: s.body,
      isSnippet: true,
      detail: `Сниппет: ${s.title}`,
      documentation: '```cpp\n' + s.body.replace(/\$\{\d+:([^}]*)\}/g, '$1').replace(/\$\d/g, '').replace(/\t/g, '  ') + '\n```\n' + s.description,
      rank: 5
    })
  }
  return { items: mergeByLabel(out) }
}
