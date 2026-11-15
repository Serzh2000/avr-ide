// «Вставить в скетч»: добавляет в .ino подключение ui_generated.h, вызов ui_setup() в конце setup() и ui_loop() в loop().
// Идемпотентно: повторный вызов ничего не дублирует. Чистые функции (тестируются без IDE).
import { maskCode, parseSketch } from './parse'
import type { SketchFunc } from './parse'

export const INCLUDE_LINE = '#include "ui_generated.h"'

export interface IntegrationPlan {
  /** Новый текст скетча (равен исходному, если менять нечего). */
  code: string
  changed: boolean
  /** Что именно будет сделано (человеческим языком). */
  changes: string[]
  /** Что уже было на месте. */
  already: string[]
  warnings: string[]
}

interface Edit {
  offset: number
  text: string
}

const eol = (code: string): string => (code.includes('\r\n') ? '\r\n' : '\n')

function lineStartOf(code: string, off: number): number {
  const i = code.lastIndexOf('\n', off - 1)
  return i < 0 ? 0 : i + 1
}

function indentOfLine(code: string, off: number): string {
  const ls = lineStartOf(code, off)
  const m = /^[ \t]*/.exec(code.slice(ls))
  return m ? m[0] : ''
}

/** Есть ли в маске вызов name() (вне комментариев и строк). */
function hasCall(masked: string, name: string): boolean {
  return new RegExp(`\\b${name}\\s*\\(\\s*\\)`).test(masked)
}

export function planIntegration(code: string): IntegrationPlan {
  const info = parseSketch(code)
  const masked = maskCode(code)
  const nl = eol(code)
  const edits: Edit[] = []
  const changes: string[] = []
  const already: string[] = []
  const warnings: string[] = []

  // 1) #include — после всех объявлений переменных/пинов/других #include, которые стоят выше setup()
  const hasInclude = info.includes.some((i) => i.header === 'ui_generated.h')
  if (hasInclude) already.push(`${INCLUDE_LINE} уже есть в скетче`)
  else {
    const limit = info.setup ? info.setup.offset : code.length
    let end = -1
    for (const i of info.includes) if (i.offset < limit) end = Math.max(end, i.endOffset)
    for (const v of info.vars) if (v.offset < limit) end = Math.max(end, v.endOffset)
    for (const p of info.pins) if (p.offset < limit) end = Math.max(end, p.endOffset)
    let at = 0
    if (end >= 0) {
      const nlPos = code.indexOf('\n', end)
      at = nlPos < 0 ? code.length : nlPos + 1
    }
    let text = `${INCLUDE_LINE}  // веб-страница ESPUI (подключать после объявления переменных)${nl}`
    if (at === code.length && !code.endsWith('\n') && code.length > 0) text = nl + text
    if (end >= 0 && at < code.length && code[at] !== '\r' && code[at] !== '\n') text += nl
    edits.push({ offset: at, text })
    const lineNo = code.slice(0, at).split('\n').length
    changes.push(`Добавится строка ${INCLUDE_LINE} (строка ${lineNo}, после ваших переменных)`)
    if (info.vars.some((v) => info.setup && v.offset > info.setup.offset))
      warnings.push('Некоторые переменные объявлены ниже setup() — страница их не увидит. Перенесите объявления выше setup().')
  }

  // 2) ui_setup() в конце setup()
  const addCall = (f: SketchFunc | null, name: string, where: 'end' | 'start', fnName: string): void => {
    const call = `${name}();`
    if (!f) {
      const sig = `${nl}void ${fnName}() {${nl}  ${call}${nl}}${nl}`
      edits.push({ offset: code.length, text: (code.endsWith('\n') || code.length === 0 ? '' : nl) + sig })
      changes.push(`В скетче нет ${fnName}() — будет добавлена функция с вызовом ${name}()`)
      return
    }
    if (where === 'end') {
      const close = f.bodyClose
      const ls = lineStartOf(code, close)
      const before = code.slice(ls, close)
      if (/^[ \t]*$/.test(before)) {
        // «}» на своей строке: вставляем отдельной строкой перед ней, с отступом внутренней строки
        const body = code.slice(f.bodyOpen + 1, close)
        const lines = body.split('\n').filter((l) => l.trim())
        const ind = lines.length ? (/^[ \t]*/.exec(lines[lines.length - 1]) as RegExpExecArray)[0] : before + '  '
        edits.push({ offset: ls, text: `${ind}${call}  // запуск веб-страницы${nl}` })
      } else {
        edits.push({ offset: close, text: ` ${call} ` })
      }
      changes.push(`В конец ${fnName}() добавится вызов ${call}`)
    } else {
      const open = f.bodyOpen
      const rest = code.slice(open + 1, code.indexOf('\n', open) < 0 ? code.length : code.indexOf('\n', open))
      if (/^[ \t\r]*$/.test(rest)) {
        const next = code.indexOf('\n', open)
        const ind = indentOfLine(code, open) + '  '
        edits.push({ offset: next < 0 ? code.length : next + 1, text: `${ind}${call}  // обновление веб-страницы${nl}` })
      } else {
        edits.push({ offset: open + 1, text: ` ${call}` })
      }
      changes.push(`В начало ${fnName}() добавится вызов ${call}`)
    }
  }

  if (hasCall(masked, 'ui_setup')) already.push('Вызов ui_setup() уже есть')
  else addCall(info.setup, 'ui_setup', 'end', 'setup')
  if (hasCall(masked, 'ui_loop')) already.push('Вызов ui_loop() уже есть')
  else addCall(info.loop, 'ui_loop', 'start', 'loop')

  edits.sort((a, b) => b.offset - a.offset)
  let out = code
  for (const e of edits) out = out.slice(0, e.offset) + e.text + out.slice(e.offset)
  return { code: out, changed: out !== code, changes, already, warnings }
}

/** Подсказка для заготовки функции-обработчика по типу элемента. */
function stubBody(widget: string): string[] {
  switch (widget) {
    case 'switcher':
      return ['bool on = (type == S_ACTIVE);  // true — включён', '// TODO: ваш код']
    case 'button':
      return ['if (type == B_DOWN) {', '  // кнопка нажата', '} else {', '  // кнопка отпущена', '}']
    case 'slider':
    case 'number':
      return ['int value = sender->value.toInt();  // значение элемента', '// TODO: ваш код']
    case 'pad':
    case 'padCenter':
      return ['// type: P_FOR_DOWN / P_BACK_DOWN / P_LEFT_DOWN / P_RIGHT_DOWN (отрицательные — нажата), положительные — отпущена', '// TODO: ваш код']
    default:
      return ['String value = sender->value;  // значение элемента', '// TODO: ваш код']
  }
}

/** Добавляет в конец скетча заготовку обработчика void fn(Control* sender, int type). Если функция уже есть — ничего не меняет. */
export function addCallbackStub(code: string, fn: string, widget: string, label: string): string {
  const info = parseSketch(code)
  if (info.funcs.some((f) => f.name === fn)) return code
  const nl = eol(code)
  const body = stubBody(widget).map((l) => `  ${l}`)
  const text = [
    '',
    `// Обработчик элемента «${label.replace(/[\r\n]+/g, ' ')}»: type — событие, sender->value — значение.`,
    `void ${fn}(Control* sender, int type) {`,
    ...body,
    '}',
    ''
  ].join(nl)
  const base = code.endsWith('\n') || code.length === 0 ? code : code + nl
  return base + text
}

// ---------- построчный diff ----------

export interface DiffLine {
  kind: 'same' | 'add' | 'del'
  text: string
  oldNo?: number
  newNo?: number
}

export function lineDiff(a: string, b: string): DiffLine[] {
  const x = a.split(/\r?\n/)
  const y = b.split(/\r?\n/)
  // отсекаем общие начало и конец — быстро для «вставок»
  let s = 0
  while (s < x.length && s < y.length && x[s] === y[s]) s++
  let ex = x.length
  let ey = y.length
  while (ex > s && ey > s && x[ex - 1] === y[ey - 1]) {
    ex--
    ey--
  }
  const mid: DiffLine[] = []
  const xm = x.slice(s, ex)
  const ym = y.slice(s, ey)
  const n = xm.length
  const m = ym.length
  const dp: Uint32Array[] = []
  for (let i = 0; i <= n; i++) dp.push(new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) dp[i][j] = xm[i] === ym[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  let i = 0
  let j = 0
  while (i < n || j < m) {
    if (i < n && j < m && xm[i] === ym[j]) {
      mid.push({ kind: 'same', text: xm[i] })
      i++
      j++
    } else if (j < m && (i === n || dp[i][j + 1] >= dp[i + 1][j])) {
      mid.push({ kind: 'add', text: ym[j] })
      j++
    } else {
      mid.push({ kind: 'del', text: xm[i] })
      i++
    }
  }
  const all: DiffLine[] = [
    ...x.slice(0, s).map((t): DiffLine => ({ kind: 'same', text: t })),
    ...mid,
    ...x.slice(ex).map((t): DiffLine => ({ kind: 'same', text: t }))
  ]
  let o = 0
  let nn = 0
  for (const l of all) {
    if (l.kind !== 'add') l.oldNo = ++o
    if (l.kind !== 'del') l.newNo = ++nn
  }
  return all
}

/** Сворачивает неизменённые участки, оставляя context строк вокруг изменений; свёрнутое — kind 'gap'. */
export function diffHunks(lines: DiffLine[], context = 2): Array<DiffLine | { kind: 'gap'; count: number }> {
  const keep = new Array<boolean>(lines.length).fill(false)
  lines.forEach((l, i) => {
    if (l.kind === 'same') return
    for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k++) keep[k] = true
  })
  const out: Array<DiffLine | { kind: 'gap'; count: number }> = []
  let gap = 0
  lines.forEach((l, i) => {
    if (keep[i]) {
      if (gap) out.push({ kind: 'gap', count: gap })
      gap = 0
      out.push(l)
    } else gap++
  })
  if (gap) out.push({ kind: 'gap', count: gap })
  return out
}
