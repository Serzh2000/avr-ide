// avride.project.json в редакторе: подсказки по ключам и значениям, описания при наведении и диагностика (синтаксис JSON + validateProject).
// Чистые функции без Monaco: позиции — смещения в тексте, преобразование в строки/столбцы делает вызывающий код.
import { CORE_KINDS, DEBUG_LEVELS, FLOAT_ABIS, FPU_KINDS, OPTIMIZATIONS, PROGRAMMER_KINDS, PROJECT_FILE } from '../../../../main/pro/project/types'
import { validateProject } from '../../../../main/pro/project/validate'

export const isProjectFile = (path: string | null | undefined): boolean => !!path && /(^|[\\/])avride\.project\.json$/i.test(path)
export { PROJECT_FILE }

export interface FieldDoc { desc: string; values?: readonly string[]; kind: 'object' | 'array' | 'string' | 'number' | 'any'; example?: string }

const f = (kind: FieldDoc['kind'], desc: string, values?: readonly string[], example?: string): FieldDoc => ({ kind, desc, values, example })

/** Описание полей по пути (`configurations.*` — любая конфигурация). Источник: docs/pro-mode.md и validate.ts. */
export const FIELDS: Record<string, FieldDoc> = {
  schemaVersion: f('number', 'Версия схемы файла проекта. Сейчас всегда 1.', undefined, '1'),
  name: f('string', 'Имя проекта: латиница, цифры, «_» и «-». Используется в имени результата сборки (build/<Конфигурация>/<имя>.elf).'),
  target: f('object', 'Целевой кристалл: семейство, ядро, память, тактирование.'),
  'target.vendor': f('string', 'Производитель кристалла. Поддерживается только «st».', ['st']),
  'target.family': f('string', 'Семейство, например STM32F1.'),
  'target.chip': f('string', 'Полное обозначение кристалла, например STM32F103C8T6.'),
  'target.board': f('string', 'Плата (необязательно), например «Blue Pill».'),
  'target.core': f('string', 'Ядро процессора: определяет ключи -mcpu и -mthumb.', CORE_KINDS),
  'target.fpu': f('string', 'Сопроцессор с плавающей запятой (только для ядер с FPU).', FPU_KINDS),
  'target.floatAbi': f('string', 'Соглашение о вызовах для чисел с плавающей запятой: soft, softfp или hard.', FLOAT_ABIS),
  'target.clock': f('object', 'Тактирование: частота кварца и целевая частота ядра.'),
  'target.clock.hseHz': f('number', 'Частота внешнего кварца HSE, Гц.', undefined, '8000000'),
  'target.clock.sysclkHz': f('number', 'Целевая частота ядра, Гц.', undefined, '72000000'),
  'target.memory': f('object', 'Карта памяти: из неё строится скрипт компоновки.'),
  'target.memory.flash': f('object', 'Flash: адрес начала и размер в байтах.'),
  'target.memory.flash.origin': f('string', 'Адрес начала Flash в виде «0x08000000».', undefined, '"0x08000000"'),
  'target.memory.flash.size': f('number', 'Размер Flash, байт.', undefined, '65536'),
  'target.memory.ram': f('object', 'ОЗУ: адрес начала и размер в байтах.'),
  'target.memory.ram.origin': f('string', 'Адрес начала ОЗУ в виде «0x20000000».', undefined, '"0x20000000"'),
  'target.memory.ram.size': f('number', 'Размер ОЗУ, байт.', undefined, '20480'),
  'target.memory.extra': f('array', 'Дополнительные области памяти (CCM, SRAM2 и т. п.): name, origin, size.'),
  sources: f('array', 'Файлы и папки с исходниками (папки обходятся рекурсивно). Пути относительные, через «/».', undefined, '["src"]'),
  includes: f('array', 'Папки заголовков: передаются компилятору как -I. Пути относительные, через «/».', undefined, '["include"]'),
  defines: f('array', 'Макросы для всех конфигураций: «NAME» или «NAME=значение».', undefined, '["STM32F103xB"]'),
  linkerScript: f('string', 'Скрипт компоновщика (.ld), путь относительно корня проекта.', undefined, '"linker/STM32F103C8T6_FLASH.ld"'),
  startupFile: f('string', 'Файл запуска (.s) с таблицей векторов прерываний.', undefined, '"startup/startup_stm32f103xb.s"'),
  svd: f('string', 'Описание регистров (.svd) для окна периферии отладчика. Необязательно.'),
  configurations: f('object', 'Конфигурации сборки. Debug и Release обязательны; можно добавлять свои.'),
  'configurations.*': f('object', 'Конфигурация сборки: оптимизация, отладочная информация, макросы, дополнительные ключи.'),
  'configurations.*.optimization': f('string', 'Уровень оптимизации: O0, O1, O2, O3, Os (размер), Og (отладка), Oz.', OPTIMIZATIONS),
  'configurations.*.debugLevel': f('string', 'Уровень отладочной информации: none, g1, g2, g3.', DEBUG_LEVELS),
  'configurations.*.defines': f('array', 'Макросы только этой конфигурации.', undefined, '["DEBUG"]'),
  'configurations.*.extraFlags': f('array', 'Дополнительные ключи компилятора или компоновщика, по одному аргументу на элемент.', undefined, '[]'),
  toolchain: f('object', 'Набор инструментов сборки.'),
  'toolchain.kind': f('string', 'Тип набора инструментов: arm-none-eabi-gcc.', ['arm-none-eabi-gcc']),
  'toolchain.version': f('string', 'Версия компилятора (необязательно).'),
  programmer: f('object', 'Программатор и отладчик.'),
  'programmer.kind': f('string', 'Тип программатора.', PROGRAMMER_KINDS),
  'programmer.interface': f('string', 'Интерфейс подключения. Сейчас только swd.', ['swd']),
  'programmer.openocdTarget': f('string', 'Файл цели OpenOCD, например target/stm32f1x.cfg. Необязательно: по умолчанию берётся из базы чипов.', undefined, '"target/stm32f1x.cfg"')
}

/** Ключи, которые есть у объекта по пути (например, «target.memory» → flash, ram, extra). */
export function childKeys(path: string[]): string[] {
  const key = normalizePath(path)
  const prefix = key ? key + '.' : ''
  const out = new Set<string>()
  for (const k of Object.keys(FIELDS)) {
    if (!k.startsWith(prefix) || k === key) continue
    const first = k.slice(prefix.length).split('.')[0]
    if (first && first !== '*') out.add(first)
  }
  return [...out]
}

/** Путь к описанию: имена конфигураций заменяются «*». */
export function normalizePath(path: string[]): string {
  return path.map((s, i) => (path[i - 1] === 'configurations' ? '*' : s)).join('.')
}

// ---- толерантный разбор JSON со смещениями ----

export interface JNode {
  kind: 'object' | 'array' | 'string' | 'number' | 'literal'
  start: number
  end: number
  members?: { key: string; keyStart: number; keyEnd: number; value: JNode }[]
  items?: JNode[]
  /** Разобрано до конца (закрывающая скобка найдена) */
  closed?: boolean
}

export function parseTree(text: string): JNode | null {
  let i = 0
  const ws = (): void => { for (;;) { const c = text[i]; if (c === ' ' || c === '\t' || c === '\n' || c === '\r') i++; else if (c === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') i++ } else if (c === '/' && text[i + 1] === '*') { const e = text.indexOf('*/', i + 2); i = e < 0 ? text.length : e + 2 } else break } }
  const str = (): { s: string; start: number; end: number } => {
    const start = i
    i++
    let s = ''
    while (i < text.length && text[i] !== '"' && text[i] !== '\n') { if (text[i] === '\\') { s += text[i + 1] ?? ''; i += 2 } else s += text[i++] }
    if (text[i] === '"') i++
    return { s, start, end: i }
  }
  const val = (): JNode | null => {
    ws()
    const c = text[i]
    if (c === undefined) return null
    if (c === '{') {
      const node: JNode = { kind: 'object', start: i, end: i, members: [] }
      i++
      for (;;) {
        ws()
        if (i >= text.length) break
        if (text[i] === '}') { i++; node.closed = true; break }
        if (text[i] === ',') { i++; continue }
        if (text[i] !== '"') { i++; continue }
        const k = str()
        ws()
        if (text[i] === ':') i++
        const v = val()
        if (v) node.members!.push({ key: k.s, keyStart: k.start, keyEnd: k.end, value: v })
      }
      node.end = i
      return node
    }
    if (c === '[') {
      const node: JNode = { kind: 'array', start: i, end: i, items: [] }
      i++
      for (;;) {
        ws()
        if (i >= text.length) break
        if (text[i] === ']') { i++; node.closed = true; break }
        if (text[i] === ',') { i++; continue }
        const before = i
        const v = val()
        if (v) node.items!.push(v)
        if (i === before) i++
      }
      node.end = i
      return node
    }
    if (c === '"') { const s = str(); return { kind: 'string', start: s.start, end: s.end } }
    const m = /^-?\d[\d.eE+-]*/.exec(text.slice(i, i + 40))
    if (m) { const n: JNode = { kind: 'number', start: i, end: i + m[0].length }; i += m[0].length; return n }
    const w = /^[A-Za-z_]+/.exec(text.slice(i, i + 20))
    if (w) { const n: JNode = { kind: 'literal', start: i, end: i + w[0].length }; i += w[0].length; return n }
    return null
  }
  return val()
}

export interface CursorPath {
  /** Ключи от корня до объекта, в котором курсор */
  path: string[]
  /** Курсор в позиции ключа */
  inKey: boolean
  /** Ключ, чьё значение редактируется (курсор в позиции значения на той же строке) */
  forKey?: string
  /** Границы слова (смещения), которое заменяется при вставке */
  wordStart: number
  wordEnd: number
}

/** Где курсор: в каком объекте и на месте ключа или значения. */
export function cursorPath(text: string, offset: number): CursorPath | null {
  const root = parseTree(text)
  if (!root || root.kind !== 'object') return null
  let obj: JNode = root
  let path: string[] = []
  for (;;) {
    const inner = (obj.members ?? []).find((m) => m.value.kind === 'object' && offset > m.value.start && (offset < m.value.end || !m.value.closed))
    if (!inner) break
    obj = inner.value
    path = [...path, inner.key]
  }
  if (!(offset > obj.start && (offset < obj.end || !obj.closed))) return null
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1
  const lineBefore = text.slice(lineStart, offset)
  const vm = /"([^"]+)"\s*:\s*"?([^",[\]{}]*)$/.exec(lineBefore)
  let s = offset
  let e = offset
  while (s > lineStart && /[\w.\-/]/.test(text[s - 1])) s--
  while (e < text.length && /[\w.\-/]/.test(text[e])) e++
  if (vm) return { path, inKey: false, forKey: vm[1], wordStart: s, wordEnd: e }
  if (/^\s*"?\w*$/.test(lineBefore) || /[{,]\s*"?\w*$/.test(lineBefore)) return { path, inKey: true, wordStart: s, wordEnd: e }
  return null
}

// ---- диагностика ----

export interface JsonIssue { start: number; end: number; severity: 'error' | 'warning'; message: string }

function findPath(root: JNode, segs: string[]): { node: JNode; key?: { start: number; end: number }; exact: boolean } {
  let cur = root
  let keyRange: { start: number; end: number } | undefined
  for (let n = 0; n < segs.length; n++) {
    const s = segs[n]
    if (cur.kind === 'object') {
      const m = cur.members?.find((x) => x.key === s)
      if (!m) return { node: cur, key: keyRange, exact: false }
      cur = m.value
      keyRange = { start: m.keyStart, end: m.keyEnd }
    } else if (cur.kind === 'array') {
      const idx = Number(s)
      const it = cur.items?.[idx]
      if (!it) return { node: cur, key: keyRange, exact: false }
      cur = it
      keyRange = undefined
    } else return { node: cur, key: keyRange, exact: false }
  }
  return { node: cur, key: keyRange, exact: true }
}

function splitPath(p: string): string[] {
  return p.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)
}

/** Диагностика файла проекта: ошибка синтаксиса JSON, затем ошибки и предупреждения validateProject. */
export function projectIssues(text: string): JsonIssue[] {
  let raw: unknown
  try { raw = JSON.parse(text) } catch (e) {
    const msg = String((e as Error).message)
    const pos = /position (\d+)/.exec(msg)
    const lc = /line (\d+) column (\d+)/.exec(msg)
    let at = pos ? Number(pos[1]) : 0
    if (!pos && lc) { const lines = text.split('\n'); at = lines.slice(0, Number(lc[1]) - 1).reduce((a, l) => a + l.length + 1, 0) + Number(lc[2]) - 1 }
    at = Math.min(Math.max(0, at), Math.max(0, text.length - 1))
    return [{ start: at, end: Math.min(text.length, at + 1), severity: 'error', message: 'Ошибка JSON: ' + msg.replace(/ in JSON at position \d+.*$/, '').replace(/^JSON\.parse: /, '') }]
  }
  const root = parseTree(text)
  if (!root) return []
  const r = validateProject(raw)
  const out: JsonIssue[] = []
  const place = (path: string, message: string, severity: 'error' | 'warning'): void => {
    const segs = splitPath(path)
    const hit = findPath(root, segs)
    let start: number
    let end: number
    if (hit.exact && segs.length === 0) { start = hit.node.start; end = Math.min(hit.node.start + 1, hit.node.end) }
    else if (hit.exact && hit.key && severity === 'warning') { start = hit.key.start; end = hit.key.end }
    else if (hit.exact) { start = hit.node.start; end = hit.node.end }
    else if (hit.key) { start = hit.key.start; end = hit.key.end }
    else { start = hit.node.start; end = Math.min(hit.node.start + 1, hit.node.end) }
    out.push({ start, end: Math.max(end, start + 1), severity, message: path ? `${path}: ${message}` : message })
  }
  if (!r.ok) for (const e of r.errors) place(e.path, e.message, 'error')
  for (const w of r.warnings) place(w.path, w.message, 'warning')
  return out
}

/** Описание поля по позиции (для наведения): путь ключа под смещением. */
export function fieldAt(text: string, offset: number): { doc: FieldDoc; key: string; start: number; end: number } | null {
  const root = parseTree(text)
  if (!root) return null
  let found: { doc: FieldDoc; key: string; start: number; end: number } | null = null
  const walk = (n: JNode, p: string[]): void => {
    if (n.kind === 'object') {
      for (const m of n.members ?? []) {
        const path = [...p, m.key]
        if (offset >= m.keyStart && offset <= m.keyEnd) {
          const d = FIELDS[normalizePath(path)]
          if (d) found = { doc: d, key: normalizePath(path), start: m.keyStart, end: m.keyEnd }
        }
        walk(m.value, path)
      }
    }
  }
  walk(root, [])
  return found
}
