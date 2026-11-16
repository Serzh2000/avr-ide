// Подсказки по символам библиотек: автодополнение, hover, signature help. Чистая логика.
import type { LibSymbol } from '../contracts'
import type { Candidate } from '../editor/completion'
import { classOfObject, isKnownClass, kindLabel, locationOf, membersOf, refName, shortSignature, type LibIndex, type LibRef } from './model'

const escapeSnippet = (s: string): string => s.replace(/[$}\\]/g, '\\$&')

function paramNames(sym: LibSymbol): string[] {
  const names = (sym.params ?? []).map((p, i) => (p.name && /^[A-Za-z_]\w*$/.test(p.name) ? p.name : `arg${i + 1}`))
  return names
}

/** Параметры, обязательные для вызова (без значений по умолчанию, без «...»). */
function requiredParams(sym: LibSymbol): string[] {
  const ps = sym.params ?? []
  const names = paramNames(sym)
  return names.filter((_, i) => ps[i].defaultValue === undefined && ps[i].type !== '...')
}

/** Markdown для документации (подпись, описание, источник). */
export function symbolDoc(r: LibRef, extraOverloads?: LibRef[]): string {
  const s = r.sym
  const parts: string[] = []
  const sigs = [r, ...(extraOverloads ?? [])].map((x) => shortSignature(x.sym))
  parts.push('```cpp\n' + sigs.slice(0, 8).join('\n') + (sigs.length > 8 ? `\n// … ещё ${sigs.length - 8}` : '') + '\n```')
  if (s.doc) parts.push(s.doc.replace(/\n/g, '  \n'))
  const lib = r.lib
  parts.push(`*${kindLabel(s.kind)} · библиотека ${lib.name}${lib.version ? ' ' + lib.version : ''} · ${locationOf(r)}* — F1 открывает справочник`)
  return parts.join('\n\n')
}

function detailOf(r: LibRef): string {
  return `${shortSignature(r.sym)}  [${r.lib.name}]`
}

function callInsert(r: LibRef): { text: string; snippet: boolean } {
  const s = r.sym
  const isFn = s.kind === 'function' || s.kind === 'method' || (s.kind === 'macro' && !!s.params && s.params.length > 0)
  if (!isFn) return { text: s.name, snippet: false }
  const req = requiredParams(s)
  if (req.length === 0) return { text: `${escapeSnippet(s.name)}($0)`, snippet: true }
  return { text: `${escapeSnippet(s.name)}(${req.map((n, i) => `\${${i + 1}:${escapeSnippet(n)}}`).join(', ')})`, snippet: true }
}

const KIND_MAP: Record<LibSymbol['kind'], Candidate['kind']> = {
  function: 'function',
  method: 'method',
  constructor: 'method',
  class: 'class',
  struct: 'class',
  enum: 'class',
  enumValue: 'constant',
  macro: 'macro',
  constant: 'constant',
  typedef: 'type',
  variable: 'variable'
}

/** Группирует перегрузки по имени и kind: один пункт списка на имя, в документации все подписи. */
function groupOverloads(refs: LibRef[]): LibRef[][] {
  const map = new Map<string, LibRef[]>()
  for (const r of refs) {
    const key = `${r.sym.kind === 'method' || r.sym.kind === 'function' ? 'f' : r.sym.kind}:${r.sym.name}`
    const a = map.get(key)
    if (a) a.push(r)
    else map.set(key, [r])
  }
  return [...map.values()]
}

function toCandidates(refs: LibRef[], rank: number): Candidate[] {
  const out: Candidate[] = []
  for (const group of groupOverloads(refs)) {
    // для вызова берём перегрузку с наименьшим числом обязательных параметров? — нет: самую «полную» первую по порядку объявления
    const first = group[0]
    const ins = callInsert(first)
    out.push({
      label: first.sym.name,
      kind: KIND_MAP[first.sym.kind],
      insertText: ins.text,
      isSnippet: ins.snippet,
      detail: detailOf(first) + (group.length > 1 ? `  (+${group.length - 1})` : ''),
      documentation: symbolDoc(first, group.slice(1)),
      rank
    })
  }
  return out
}

/** Члены объекта известного класса: методы, поля, константы, вложенные типы. */
export function memberCandidates(index: LibIndex, className: string): Candidate[] {
  const members = membersOf(index, className).filter((r) => r.sym.access !== 'private' && r.sym.access !== 'protected' && !r.sym.name.startsWith('operator') && r.sym.kind !== 'constructor' && r.sym.kind !== 'enumValue' && r.sym.kind !== 'class' && r.sym.kind !== 'struct' && r.sym.kind !== 'enum' && r.sym.kind !== 'typedef')
  return toCandidates(members, 1)
}

/** `Class::` и `Enum::` и `ns::`: статические члены, значения перечислений, вложенные типы, функции пространства имён. */
export function scopeCandidates(index: LibIndex, qualifier: string): Candidate[] {
  const out: LibRef[] = []
  const q = qualifier.split('::').pop()!
  // значения enum class и enum внутри класса
  const enumVals = index.enumValuesByEnum.get(q)
  if (enumVals) out.push(...enumVals)
  if (isKnownClass(index, q)) {
    for (const r of membersOf(index, q)) {
      if (r.sym.access === 'private' || r.sym.access === 'protected' || r.sym.kind === 'constructor') continue
      if (r.sym.kind === 'method' && !r.sym.isStatic) continue
      if (r.sym.kind === 'variable' && !r.sym.isStatic) continue
      out.push(r)
    }
    // значения перечислений, объявленных внутри класса (Adafruit_BMP280::SAMPLING_X1)
    for (const r of membersOf(index, q, { kinds: ['enumValue'] })) if (!out.includes(r)) out.push(r)
  } else {
    // пространство имён
    for (const [owner, refs] of index.membersByOwner) if (owner === qualifier || owner.endsWith('::' + qualifier)) out.push(...refs.filter((r) => r.sym.kind !== 'method' && r.sym.kind !== 'constructor'))
  }
  return toCandidates(out, 1)
}

/** Символы, доступные без квалификатора: классы, функции, макросы, константы, значения enum, типы. */
export function globalCandidates(index: LibIndex): Candidate[] {
  const seen = new Set<LibRef>()
  const refs: LibRef[] = []
  for (const list of index.topByName.values()) {
    for (const r of list) {
      if (seen.has(r)) continue
      seen.add(r)
      if (r.sym.access === 'private' || r.sym.access === 'protected') continue
      // вложенные классы внутри классов доступны только как Outer::Inner
      if (r.sym.owner && (r.sym.kind === 'class' || r.sym.kind === 'struct')) continue
      refs.push(r)
    }
  }
  const out = toCandidates(refs, 1)
  // служебные макросы и значения перечислений — ниже, чем функции и классы
  for (const c of out) if (c.kind === 'macro' || c.kind === 'constant') c.rank = 2
  return out
}

// ---------- hover / signature help ----------

/** Определение слова под курсором: `obj.method`, `Class::member`, `func`, `CONSTANT`, `ClassName`. */
export function resolveWord(index: LibIndex, word: string, qualifier: string | null, fileTypes?: Record<string, string>, libTypes?: Record<string, string>, scope?: string | null): LibRef[] {
  if (scope) {
    const q = scope.split('::').pop()!
    const found = [...(index.enumValuesByEnum.get(q) ?? []), ...membersOf(index, q)].filter((r) => r.sym.name === word)
    if (found.length) return found
    const ns: LibRef[] = []
    for (const [owner, refs] of index.membersByOwner) if (owner === scope || owner.endsWith('::' + scope)) ns.push(...refs.filter((r) => r.sym.name === word))
    return ns
  }
  if (qualifier) {
    const cls = classOfObject(index, qualifier, fileTypes, libTypes) ?? (isKnownClass(index, qualifier) ? qualifier : undefined)
    if (!cls) return []
    return membersOf(index, cls).filter((r) => r.sym.name === word && r.sym.access !== 'private')
  }
  const top = index.topByName.get(word)
  if (top?.length) {
    const cls = top.filter((r) => r.sym.kind === 'class' || r.sym.kind === 'struct')
    if (cls.length) return [...cls, ...membersOf(index, word, { inherited: false, kinds: ['constructor'] })]
    return top
  }
  return []
}

export interface SigCandidate {
  label: string
  params: string[]
  doc?: string
  paramDocs: (string | undefined)[]
  ref: LibRef
}

function splitParamsText(sig: string): string[] {
  const open = sig.indexOf('(')
  if (open < 0) return []
  let d = 0
  let end = sig.length
  for (let i = open; i < sig.length; i++) {
    const c = sig[i]
    if (c === '(' || c === '[' || c === '<') d++
    else if (c === ')' || c === ']' || c === '>') {
      d--
      if (d === 0 && c === ')') {
        end = i
        break
      }
    }
  }
  const inner = sig.slice(open + 1, end)
  const out: string[] = []
  let cur = ''
  d = 0
  for (const c of inner) {
    if (c === '(' || c === '[' || c === '<') d++
    else if (c === ')' || c === ']' || c === '>') d--
    if (c === ',' && d === 0) {
      out.push(cur.trim())
      cur = ''
    } else cur += c
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

/** Перегрузки для signature help: метод/функция/конструктор, у которых есть скобки. */
export function signatureCandidates(index: LibIndex, name: string, qualifier: string | null, fileTypes?: Record<string, string>, libTypes?: Record<string, string>, scope?: string | null): SigCandidate[] {
  let refs = resolveWord(index, name, qualifier, fileTypes, libTypes, scope)
  if (refs.length === 0 && !qualifier && !scope) {
    // `DHT dht(` — имя переменной с классом из библиотеки: подсказываем конструкторы класса
    const cls = classOfObject(index, name, fileTypes, libTypes)
    if (cls && libTypes?.[name]) refs = membersOf(index, cls, { inherited: false, kinds: ['constructor'] })
  }
  if (!qualifier && !scope) {
    // функтор: obj(...) → operator()
    const cls = classOfObject(index, name, fileTypes, libTypes)
    if (cls && libTypes?.[name]) refs = [...refs, ...membersOf(index, cls).filter((r) => r.sym.name === 'operator()')]
  }
  return toSigCandidates(refs)
}

function toSigCandidates(refs: LibRef[]): SigCandidate[] {
  const out: SigCandidate[] = []
  for (const r of refs) {
    const s = r.sym
    const isCall = s.kind === 'function' || s.kind === 'method' || s.kind === 'constructor' || (s.kind === 'macro' && !!s.params)
    if (!isCall) continue
    const params = s.kind === 'macro' ? (s.params ?? []).map((p) => p.name) : splitParamsText(shortSignature(s))
    // из документации достаём пояснения параметров «имя — описание»
    const pdocs = (s.params ?? []).map((p) => {
      if (!s.doc || !p.name) return undefined
      const m = new RegExp(`^${p.name}\\s+—\\s+(.+)$`, 'm').exec(s.doc)
      return m ? m[1] : undefined
    })
    const label = s.kind === 'macro' ? `${s.name}(${params.join(', ')})` : shortSignature(s)
    const parts = [s.doc?.split('\n')[0], s.returns && s.kind !== 'constructor' && s.kind !== 'macro' ? `Результат: ${s.returns}` : undefined].filter(Boolean)
    out.push({ label, params, doc: parts.length ? parts.join('\n\n') : undefined, paramDocs: pdocs, ref: r })
  }
  return out
}

/** Перегрузки operator[] / operator() класса — для подсказки при вводе `obj[` и `obj(`. */
export function operatorSignatures(index: LibIndex, cls: string, op: 'operator[]' | 'operator()'): SigCandidate[] {
  return toSigCandidates(membersOf(index, cls).filter((r) => r.sym.name === op && r.sym.access !== 'private'))
}

/** Какая перегрузка подходит под текущий индекс аргумента. */
export function pickOverload(cands: SigCandidate[], argIndex: number): number {
  for (let i = 0; i < cands.length; i++) {
    const n = cands[i].params.length
    const variadic = cands[i].params.some((p) => p === '...')
    if (argIndex < n || variadic) return i
  }
  return 0
}

export { refName }
