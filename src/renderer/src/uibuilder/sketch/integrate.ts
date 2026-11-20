// «Вставить в скетч»: добавляет в .ino подключение сгенерированного заголовка страницы (ESPUI: ui_generated.h,
// веб-дизайнер: web_generated.h) и вызовы запуска/обновления страницы в setup() и loop().
// Идемпотентно: повторный вызов ничего не дублирует. Чистые функции (тестируются без IDE).
import { maskCode, parseSketch } from './parse'
import type { SketchFunc, SketchInfo } from './parse'

/** Какой конструктор: ESPUI («ui») или веб-дизайнер («web»). */
export type PageKind = 'ui' | 'web'

export interface PageSpec {
  kind: PageKind
  /** Человеческое название. */
  title: string
  /** Сгенерированный заголовок, который подключается в скетч. */
  header: string
  /** Файл, где хранится сама страница (источник истины). */
  json: string
  setupCall: string
  loopCall: string
  includeComment: string
  setupComment: string
  loopComment: string
}

export const PAGE_SPECS: Record<PageKind, PageSpec> = {
  ui: {
    kind: 'ui',
    title: 'ESPUI',
    header: 'ui_generated.h',
    json: 'ui.json',
    setupCall: 'ui_setup',
    loopCall: 'ui_loop',
    includeComment: 'веб-страница ESPUI (подключать после объявления переменных)',
    setupComment: 'запуск веб-страницы',
    loopComment: 'обновление веб-страницы'
  },
  web: {
    kind: 'web',
    title: 'веб-дизайнер',
    header: 'web_generated.h',
    json: 'web_design.json',
    setupCall: 'wdBegin',
    loopCall: 'wdLoop',
    includeComment: 'веб-страница из веб-дизайнера (подключать после объявления переменных)',
    setupComment: 'запуск веб-страницы',
    loopComment: 'обновление веб-страницы'
  }
}

export const INCLUDE_LINE = '#include "ui_generated.h"'
export const includeLineOf = (kind: PageKind): string => `#include "${PAGE_SPECS[kind].header}"`
export const otherKind = (kind: PageKind): PageKind => (kind === 'ui' ? 'web' : 'ui')

export interface IntegrationPlan {
  /** Новый текст скетча (равен исходному, если менять нечего). */
  code: string
  changed: boolean
  /** Что именно будет сделано (человеческим языком). */
  changes: string[]
  /** Что уже было на месте. */
  already: string[]
  warnings: string[]
  /** В скетче уже подключена страница другого конструктора: два веб-сервера на порту 80 одновременно не работают. */
  conflict?: { with: PageKind; message: string }
}

export interface PlanOptions {
  /** Убрать подключение другой страницы (include и вызовы), если оно есть. */
  replaceOther?: boolean
}

interface Edit {
  offset: number
  /** Конец заменяемого участка (по умолчанию — вставка в точку offset). */
  end?: number
  text: string
}

export const eol = (code: string): string => (code.includes('\r\n') ? '\r\n' : '\n')

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
export function hasCall(masked: string, name: string): boolean {
  return new RegExp(`\\b${name}\\s*\\(\\s*\\)`).test(masked)
}

/** Где вставлять новую строку-объявление/include: после всех #include, переменных и пинов, что стоят выше setup(). */
function afterDeclsOffset(code: string, info: SketchInfo): { at: number; hadDecls: boolean } {
  const limit = info.setup ? info.setup.offset : code.length
  let end = -1
  for (const i of info.includes) if (i.offset < limit) end = Math.max(end, i.endOffset)
  for (const v of info.vars) if (v.offset < limit) end = Math.max(end, v.endOffset)
  for (const p of info.pins) if (p.offset < limit) end = Math.max(end, p.endOffset)
  if (end < 0) return { at: 0, hadDecls: false }
  const nlPos = code.indexOf('\n', end)
  return { at: nlPos < 0 ? code.length : nlPos + 1, hadDecls: true }
}

/** Удалить строку целиком (вместе с переводом строки), если на ней только вырезаемое; иначе — только сам участок. */
function removeSpan(code: string, masked: string, start: number, end: number): Edit {
  const ls = lineStartOf(code, start)
  const nl = code.indexOf('\n', end)
  const le = nl < 0 ? code.length : nl
  const before = masked.slice(ls, start)
  const after = masked.slice(end, le)
  if (/^[ \t]*$/.test(before) && /^[ \t\r]*$/.test(after)) return { offset: ls, end: nl < 0 ? le : le + 1, text: '' }
  return { offset: start, end, text: '' }
}

export function planIntegration(code: string, kind: PageKind = 'ui', opts: PlanOptions = {}): IntegrationPlan {
  const spec = PAGE_SPECS[kind]
  const other = PAGE_SPECS[otherKind(kind)]
  const includeLine = includeLineOf(kind)
  const info = parseSketch(code)
  const masked = maskCode(code)
  const nl = eol(code)
  const edits: Edit[] = []
  const changes: string[] = []
  const already: string[] = []
  const warnings: string[] = []
  let conflict: IntegrationPlan['conflict']

  // 0) Вторая страница в том же скетче: ESPUI и веб-дизайнер поднимают свой веб-сервер на порту 80 — одновременно нельзя
  const otherInc = info.includes.filter((i) => i.header === other.header)
  if (otherInc.length || hasCall(masked, other.setupCall)) {
    if (opts.replaceOther) {
      for (const i of otherInc) edits.push(removeSpan(code, masked, i.offset, i.endOffset))
      for (const name of [other.setupCall, other.loopCall]) {
        const re = new RegExp(`\\b${name}\\s*\\(\\s*\\)\\s*;`, 'g')
        let m: RegExpExecArray | null
        while ((m = re.exec(masked))) edits.push(removeSpan(code, masked, m.index, m.index + m[0].length))
      }
      changes.push(`Будет убрано подключение ${other.title}: строка ${other.header} и вызовы ${other.setupCall}() / ${other.loopCall}()`)
    } else {
      conflict = {
        with: otherKind(kind),
        message: `В скетче уже подключена страница ${other.title} (${other.header}). Две страницы сразу работать не могут: обе запускают веб-сервер на порту 80. Оставьте одну: страница ${spec.title} заменит ${other.title}, либо отмените вставку.`
      }
      warnings.push(conflict.message)
    }
  }

  // 1) #include — после всех объявлений переменных/пинов/других #include, которые стоят выше setup()
  const hasInclude = info.includes.some((i) => i.header === spec.header)
  if (hasInclude) already.push(`${includeLine} уже есть в скетче`)
  else {
    const { at, hadDecls } = afterDeclsOffset(code, info)
    let text = `${includeLine}  // ${spec.includeComment}${nl}`
    if (at === code.length && !code.endsWith('\n') && code.length > 0) text = nl + text
    if (hadDecls && at < code.length && code[at] !== '\r' && code[at] !== '\n') text += nl
    edits.push({ offset: at, text })
    const lineNo = code.slice(0, at).split('\n').length
    changes.push(`Добавится строка ${includeLine} (строка ${lineNo}, после ваших переменных)`)
    if (info.vars.some((v) => info.setup && v.offset > info.setup.offset))
      warnings.push('Некоторые переменные объявлены ниже setup() — страница их не увидит. Перенесите объявления выше setup().')
  }

  // 2) запуск страницы в конце setup(), обновление в начале loop()
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
        edits.push({ offset: ls, text: `${ind}${call}  // ${spec.setupComment}${nl}` })
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
        edits.push({ offset: next < 0 ? code.length : next + 1, text: `${ind}${call}  // ${spec.loopComment}${nl}` })
      } else {
        edits.push({ offset: open + 1, text: ` ${call}` })
      }
      changes.push(`В начало ${fnName}() добавится вызов ${call}`)
    }
  }

  if (hasCall(masked, spec.setupCall)) already.push(`Вызов ${spec.setupCall}() уже есть`)
  else addCall(info.setup, spec.setupCall, 'end', 'setup')
  if (hasCall(masked, spec.loopCall)) already.push(`Вызов ${spec.loopCall}() уже есть`)
  else addCall(info.loop, spec.loopCall, 'start', 'loop')

  // При конфликте без согласия на замену скетч не меняем — только предупреждаем
  if (conflict) return { code, changed: false, changes: [], already, warnings, conflict }

  edits.sort((a, b) => b.offset - a.offset)
  let out = code
  for (const e of edits) out = out.slice(0, e.offset) + e.text + out.slice(e.end ?? e.offset)
  return { code: out, changed: out !== code, changes, already, warnings }
}

export type VarCType = 'bool' | 'int' | 'float' | 'String'

/** Строка объявления для «Создать переменную в скетче». */
export function declarationLine(name: string, type: VarCType, init = ''): string {
  const s = init.trim()
  switch (type) {
    case 'bool':
      return `bool ${name} = ${s === 'true' ? 'true' : 'false'};`
    case 'int':
      return `int ${name} = ${/^-?\d+$/.test(s) ? s : '0'};`
    case 'float':
      return `float ${name} = ${s !== '' && Number.isFinite(Number(s)) ? s : '0.0'};`
    default:
      return `String ${name} = "${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}";`
  }
}

/** «Создать переменную в скетче»: объявление встаёт выше подключения страницы (если оно есть) или после прочих объявлений, всегда выше setup(). */
export function planDeclareVariable(code: string, name: string, type: VarCType, init = ''): IntegrationPlan {
  const info = parseSketch(code)
  const nl = eol(code)
  const taken = info.names.get(name)
  if (taken) {
    const kindRu = taken.kind === 'func' ? 'функция' : taken.kind === 'define' ? 'макрос' : 'переменная'
    const same = info.vars.some((v) => v.name === name)
    return {
      code,
      changed: false,
      changes: [],
      already: same ? [`Переменная «${name}» уже объявлена в скетче (строка ${taken.line})`] : [],
      warnings: same ? [] : [`Имя «${name}» уже занято в скетче (${kindRu}, строка ${taken.line}) — выберите другое`]
    }
  }
  const limit = info.setup ? info.setup.offset : code.length
  const pageInc = info.includes.find((i) => (i.header === PAGE_SPECS.ui.header || i.header === PAGE_SPECS.web.header) && i.offset < limit)
  const decl = declarationLine(name, type, init)
  let at: number
  let text = decl + nl
  if (pageInc) at = lineStartOf(code, pageInc.offset)
  else {
    const r = afterDeclsOffset(code, info)
    at = r.at
    if (at === code.length && !code.endsWith('\n') && code.length > 0) text = nl + text
    if (r.hadDecls && at < code.length && code[at] !== '\r' && code[at] !== '\n') text += nl
  }
  const out = code.slice(0, at) + text + code.slice(at)
  const lineNo = code.slice(0, at).split('\n').length
  return { code: out, changed: true, changes: [`В скетч добавится объявление ${decl} (строка ${lineNo}, выше подключения страницы и setup())`], already: [], warnings: [] }
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
