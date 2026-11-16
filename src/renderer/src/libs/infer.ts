// Вывод типов выражений по разобранным заголовкам: цепочки obj.a().b, auto x = ..., new Класс(...), obj[...].
// Правило: не уверены — возвращаем undefined (подсказок нет). Шаблонные подстановки не угадываем.
import type { LibSymbol } from '../contracts'
import { classOfObject, isKnownClass, membersOf, simpleTypeName, variableClasses, type LibIndex } from './model'

const IDENT = '[A-Za-z_]\\w*'
const CALL = '\\((?:[^()]|\\((?:[^()]|\\([^()]*\\))*\\))*\\)'
const INDEX = '\\[(?:[^\\[\\]]|\\[[^\\[\\]]*\\])*\\]'
const TEMPLATE_CALL = `(?:<[^<>;(){}]*(?:<[^<>;(){}]*>[^<>;(){}]*)*>)?`
const STEP = `${IDENT}${TEMPLATE_CALL}(?:${CALL}|${INDEX})*`
const CHAIN_AT_END = new RegExp(`(?:${STEP}(?:\\s*(?:\\.|->)\\s*${STEP})*)\\s*$`)
const CHAIN_FULL = new RegExp(`^(?:${STEP}(?:\\s*(?:\\.|->)\\s*${STEP})*)$`)

/** Выражение-получатель в конце текста (сам `.`/`->` в text уже отрезан): «obj.a().b», «doc["k"]», «new Foo(1)». */
export function receiverChain(text: string): string | null {
  const tail = text.length > 400 ? text.slice(-400) : text
  const m = CHAIN_AT_END.exec(tail)
  if (!m) return null
  const start = m.index
  let expr = m[0].replace(/\s+$/, '')
  // new Foo(...).
  if (/\bnew\s+$/.test(tail.slice(0, start))) expr = 'new ' + expr
  return expr
}

export function isComplexChain(expr: string): boolean {
  return /[(\[]/.test(expr)
}

type Step = { name: string; call: boolean; index: boolean }

function parseChain(expr: string): Step[] | null {
  if (!CHAIN_FULL.test(expr)) return null
  const steps: Step[] = []
  let i = 0
  const n = expr.length
  while (i < n) {
    const m = new RegExp(`^\\s*(${IDENT})`).exec(expr.slice(i))
    if (!m) return null
    i += m[0].length
    const name = m[1]
    // шаблонные аргументы <...> пропускаем
    if (expr[i] === '<') {
      let d = 0
      let j = i
      for (; j < n; j++) {
        if (expr[j] === '<') d++
        else if (expr[j] === '>') {
          d--
          if (d === 0) break
        }
      }
      if (j >= n) return null
      i = j + 1
    }
    let call = false
    let index = false
    while (i < n && (expr[i] === '(' || expr[i] === '[')) {
      const open = expr[i]
      const close = open === '(' ? ')' : ']'
      let d = 0
      let j = i
      for (; j < n; j++) {
        if (expr[j] === open) d++
        else if (expr[j] === close) {
          d--
          if (d === 0) break
        }
      }
      if (j >= n) return null
      if (open === '(') call = true
      else index = true
      i = j + 1
    }
    steps.push({ name, call, index })
    const sep = /^\s*(?:\.|->)/.exec(expr.slice(i))
    if (sep) i += sep[0].length
    else if (expr.slice(i).trim() === '') break
    else return null
  }
  return steps
}

/** Класс из возвращаемого типа: только известные классы библиотек и один и тот же тип у всех перегрузок. */
function classFromReturns(index: LibIndex, syms: LibSymbol[]): string | undefined {
  let found: string | undefined
  for (const s of syms) {
    if (!s.returns) return undefined
    // шаблонный параметр класса/метода (T, TString) — не угадываем
    const t = simpleTypeName(s.returns)
    if (!t || !isKnownClass(index, t)) return undefined
    if (found && found !== t) return undefined
    found = t
  }
  return found
}

function applyIndex(index: LibIndex, cls: string): string | undefined {
  const ops = membersOf(index, cls).filter((r) => r.sym.name === 'operator[]')
  return ops.length ? classFromReturns(index, ops.map((o) => o.sym)) : undefined
}

export type VarLookup = (name: string) => string | undefined

/** Класс значения выражения или undefined, если не уверены. */
export function inferExprClass(index: LibIndex, exprRaw: string, lookup: VarLookup): string | undefined {
  let expr = exprRaw.trim()
  if (!expr) return undefined
  // new Класс(...)
  const nw = /^new\s+(.+)$/.exec(expr)
  if (nw) {
    const m = new RegExp(`^(?:${IDENT}::)*(${IDENT})\\s*(?:<[^<>;]*>)?\\s*(?:\\(|\\{|$)`).exec(nw[1])
    return m && isKnownClass(index, m[1]) ? m[1] : undefined
  }
  // скобки вокруг и *obj / &obj
  while (/^\((.*)\)$/.test(expr) && CHAIN_FULL.test(expr.slice(1, -1))) expr = expr.slice(1, -1).trim()
  expr = expr.replace(/^[*&]\s*/, '')
  // Класс(...) / Класс{...} / ns::Класс(...)
  const ctor = new RegExp(`^(?:${IDENT}::)*(${IDENT})\\s*(?:<[^<>;]*>)?\\s*[({]`).exec(expr)
  const steps = parseChain(expr)
  if (!steps || steps.length === 0) return ctor && isKnownClass(index, ctor[1]) && /[)}]$/.test(expr) ? ctor[1] : undefined
  let cur: string | undefined
  const first = steps[0]
  if (first.call) {
    if (isKnownClass(index, first.name)) cur = first.name
    else {
      const fns = (index.topByName.get(first.name) ?? []).filter((r) => r.sym.kind === 'function').map((r) => r.sym)
      cur = fns.length ? classFromReturns(index, fns) : undefined
    }
  } else cur = lookup(first.name) ?? classOfObject(index, first.name, undefined, undefined)
  if (first.index && cur) cur = applyIndex(index, cur)
  for (let k = 1; k < steps.length && cur; k++) {
    const st = steps[k]
    const members = membersOf(index, cur).filter((r) => r.sym.name === st.name && r.sym.kind !== 'constructor' && r.sym.access !== 'private')
    if (members.length === 0) return undefined
    const isFn = members.every((r) => r.sym.kind === 'method' || r.sym.kind === 'function')
    if (st.call && !isFn) return undefined
    cur = classFromReturns(index, members.map((r) => r.sym))
    if (st.index && cur) cur = applyIndex(index, cur)
  }
  return cur
}

/** auto x = ...; auto& x = ...; auto* p = ...; const auto x = ...; — по выражению справа. */
export function autoVariableClasses(masked: string, index: LibIndex, base: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  if (index.classesBySimple.size === 0 || !/\bauto\b/.test(masked)) return out
  const re = /(?:^|[;{}(,\s])(?:(?:const|static|volatile)\s+)*auto\s*(?:const\s*)?[*&]*\s*(?:const\s*)?([A-Za-z_]\w*)\s*=\s*([^;]+);/g
  let m: RegExpExecArray | null
  let guard = 0
  const lookup: VarLookup = (n) => out[n] ?? base[n]
  while ((m = re.exec(masked)) && guard++ < 2000) {
    const rhs = m[2].replace(/\s+/g, ' ').trim()
    // оператор ?: , лямбды и арифметика — не угадываем
    if (/[?]|=>|\[\s*[&=]|[+\-/%|]|&&|\|\|/.test(rhs.replace(/->/g, '.'))) continue
    const t = inferExprClass(index, rhs, lookup)
    if (t) out[m[1]] = t
  }
  return out
}

/** Все переменные файла с классами библиотек: явные объявления и auto. */
export function allVariableClasses(masked: string, index: LibIndex): Record<string, string> {
  const explicit = variableClasses(masked, index)
  return { ...explicit, ...autoVariableClasses(masked, index, explicit) }
}

// ---------- signature help для [ ] ----------

/** Незакрытая «[» перед курсором: выражение слева от неё (null — курсор не внутри индексации). */
export function findIndexContext(textBefore: string): { receiver: string; argIndex: number } | null {
  const tail = textBefore.length > 1500 ? textBefore.slice(-1500) : textBefore
  let depth = 0
  for (let i = tail.length - 1; i >= 0; i--) {
    const c = tail[i]
    if (c === ']' || c === ')') depth++
    else if (c === '(') {
      if (depth === 0) return null
      depth--
    } else if (c === '[') {
      if (depth > 0) {
        depth--
        continue
      }
      const before = tail.slice(0, i)
      const recv = receiverChain(before)
      if (!recv || /^new\s/.test(recv)) return null
      return { receiver: recv, argIndex: 0 }
    } else if ((c === ';' || c === '{' || c === '}') && depth === 0) return null
  }
  return null
}
