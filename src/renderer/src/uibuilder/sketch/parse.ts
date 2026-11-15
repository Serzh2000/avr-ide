// Разбор текста скетча (.ino): глобальные переменные, пины (#define / const), функции-обработчики ESPUI,
// положение setup()/loop() и #include. Чистые функции без зависимостей — их запускает напрямую Node (тесты).
//
// Подход: текст «маскируется» (комментарии и содержимое строк/символов заменяются пробелами, длина и переводы строк сохраняются),
// затем по маске идёт проход с учётом глубины скобок. Всё, что внутри { } функции, пропускается — поэтому локальные
// переменные никогда не принимаются за глобальные. Это не полноценный парсер C++: шаблоны, макросы с побочными эффектами
// и #if-ветвления разбираются «как есть» (см. тесты).
import type { VarType } from '../core/types'

export interface SketchVar {
  name: string
  /** Тип как в скетче («unsigned long», «float», «Servo»). */
  ctype: string
  /** Тип конструктора, или null, если не поддерживается (массив, указатель, свой класс). */
  type: VarType | null
  /** Почему тип не поддерживается (для подсказки). */
  note?: string
  /** Строка объявления (с 1). */
  line: number
  /** Смещения в тексте: начало и конец всего объявления (до «;» включительно). */
  offset: number
  endOffset: number
  isConst: boolean
  isStatic: boolean
  isArray: boolean
  /** Выражение инициализации как в тексте или null. */
  init: string | null
  /** Начальное значение, пригодное для превью (число/true/false/строка) или ''. */
  initValue: string
}

export interface SketchPin {
  name: string
  /** Числовое значение или null, если по тексту его не определить (например LED_BUILTIN на другой плате). */
  value: number | null
  /** Выражение как в скетче: «2», «D4», «LED_BUILTIN». */
  expr: string
  line: number
  kind: 'define' | 'const' | 'var'
  offset: number
  endOffset: number
}

export interface SketchFunc {
  name: string
  returnType: string
  params: string
  line: number
  offset: number
  /** Позиции { и } тела; -1 для прототипов. */
  bodyOpen: number
  bodyClose: number
  /** void name(Control*, int) — обработчик ESPUI. */
  isCallback: boolean
  isPrototype: boolean
}

export interface SketchInclude {
  header: string
  line: number
  offset: number
  endOffset: number
}

export interface SketchName {
  line: number
  kind: 'var' | 'func' | 'define' | 'const'
}

export interface SketchInfo {
  vars: SketchVar[]
  pins: SketchPin[]
  funcs: SketchFunc[]
  includes: SketchInclude[]
  setup: SketchFunc | null
  loop: SketchFunc | null
  /** Все глобальные идентификаторы (для проверки конфликтов имён). */
  names: Map<string, SketchName>
}

/** Заменяет комментарии и содержимое строк/символов пробелами (переводы строк остаются). */
export function maskCode(code: string): string {
  const out: string[] = []
  const n = code.length
  let i = 0
  const blank = (c: string): string => (c === '\n' || c === '\r' ? c : ' ')
  while (i < n) {
    const c = code[i]
    const d = code[i + 1]
    if (c === '/' && d === '/') {
      while (i < n && code[i] !== '\n') {
        out.push(code[i] === '\r' ? '\r' : ' ')
        i++
      }
    } else if (c === '/' && d === '*') {
      out.push(' ', ' ')
      i += 2
      while (i < n && !(code[i] === '*' && code[i + 1] === '/')) {
        out.push(blank(code[i]))
        i++
      }
      if (i < n) {
        out.push(' ', ' ')
        i += 2
      }
    } else if (c === '"') {
      out.push('"')
      i++
      while (i < n && code[i] !== '"' && code[i] !== '\n') {
        if (code[i] === '\\' && i + 1 < n) {
          out.push(' ', blank(code[i + 1]))
          i += 2
        } else {
          out.push(' ')
          i++
        }
      }
      if (i < n && code[i] === '"') {
        out.push('"')
        i++
      }
    } else if (c === "'" && !/[0-9A-Za-z_]/.test(code[i - 1] ?? '')) {
      // символьный литерал (после цифры/буквы апостроф — разделитель разрядов 1'000, пропускаем)
      out.push("'")
      i++
      while (i < n && code[i] !== "'" && code[i] !== '\n') {
        if (code[i] === '\\' && i + 1 < n) {
          out.push(' ', blank(code[i + 1]))
          i += 2
        } else {
          out.push(' ')
          i++
        }
      }
      if (i < n && code[i] === "'") {
        out.push("'")
        i++
      }
    } else {
      out.push(c)
      i++
    }
  }
  return out.join('')
}

const TYPE_MAP: Record<string, VarType> = {
  bool: 'bool',
  boolean: 'bool',
  int: 'int',
  long: 'int',
  short: 'int',
  'long long': 'int',
  'long int': 'int',
  'short int': 'int',
  'long long int': 'int',
  unsigned: 'int',
  'unsigned int': 'int',
  'unsigned long': 'int',
  'unsigned long int': 'int',
  'unsigned short': 'int',
  'unsigned short int': 'int',
  'unsigned long long': 'int',
  'signed int': 'int',
  signed: 'int',
  uint8_t: 'int',
  uint16_t: 'int',
  uint32_t: 'int',
  uint64_t: 'int',
  int8_t: 'int',
  int16_t: 'int',
  int32_t: 'int',
  int64_t: 'int',
  byte: 'int',
  word: 'int',
  size_t: 'int',
  float: 'float',
  double: 'float',
  String: 'String'
}

const QUALIFIERS = new Set(['static', 'const', 'volatile', 'extern', 'constexpr', 'register', 'inline', 'constinit', 'mutable', 'IRAM_ATTR', 'RTC_DATA_ATTR', 'DRAM_ATTR'])
const SKIP_START = /^(typedef|using|template|friend|return|namespace|struct|class|union|enum|public|private|protected|static_assert|goto|else|delete|new)\b/

export function mapCType(ctype: string): { type: VarType | null; note?: string } {
  const t = ctype.replace(/\s+/g, ' ').trim()
  if (/[*&]/.test(t)) return { type: null, note: 'указатель или ссылка — конструктор такие переменные не поддерживает' }
  if (t === 'char') return { type: null, note: 'одиночный символ — используйте String или int' }
  const m = TYPE_MAP[t]
  if (m) return { type: m }
  return { type: null, note: `тип «${t}» конструктор не поддерживает (нужны bool, int, float, String)` }
}

/** Значение инициализации для превью: число, true/false или строка без кавычек; иначе ''. */
function initPreview(rawInit: string | null, type: VarType | null): string {
  if (rawInit === null || type === null) return ''
  let s = rawInit.trim()
  while (s.startsWith('(') && s.endsWith(')')) s = s.slice(1, -1).trim()
  if (type === 'String') {
    const m = /^(?:String\s*\(\s*)?"((?:[^"\\]|\\.)*)"\s*\)?$/.exec(s)
    return m ? m[1].replace(/\\(.)/g, '$1') : ''
  }
  if (type === 'bool') return s === 'true' || s === 'false' ? s : s === '1' ? 'true' : s === '0' ? 'false' : ''
  const num = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?[fFuUlL]*$/.exec(s)
  if (num) return s.replace(/[fFuUlL]+$/, '')
  const hex = /^0[xX]([0-9a-fA-F]+)[uUlL]*$/.exec(s)
  if (hex) return String(parseInt(hex[1], 16))
  return ''
}

/** Числовое значение пина по выражению; null, если не определить. */
export function pinValueOf(expr: string): number | null {
  const s = expr.trim().replace(/^\(\s*([^()]*?)\s*\)$/, '$1')
  if (/^\d+$/.test(s)) return parseInt(s, 10)
  if (/^0[xX][0-9a-fA-F]+$/.test(s)) return parseInt(s, 16)
  return null
}

const PIN_NAME_RE = /pin|led|relay|btn|button|buzz|motor|sensor|trig|echo|servo|^d\d+$|^gpio|rx$|tx$|sda|scl|pwm|fan|pump|valve|lamp|light/i

function isIdentStart(c: string): boolean {
  return /[A-Za-z_]/.test(c)
}

/** Разбивает по запятым верхнего уровня (вне скобок/фигурных/квадратных). Возвращает [начало, конец) в исходной строке. */
function splitTopLevel(s: string): Array<[number, number]> {
  const out: Array<[number, number]> = []
  let depth = 0
  let start = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') depth--
    else if (c === ',' && depth === 0) {
      out.push([start, i])
      start = i + 1
    }
  }
  out.push([start, s.length])
  return out
}

export function parseSketch(code: string): SketchInfo {
  const m = maskCode(code)
  const n = m.length
  const lineStarts: number[] = [0]
  for (let i = 0; i < n; i++) if (code[i] === '\n') lineStarts.push(i + 1)
  const lineOf = (off: number): number => {
    let lo = 0
    let hi = lineStarts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (lineStarts[mid] <= off) lo = mid
      else hi = mid - 1
    }
    return lo + 1
  }

  const info: SketchInfo = { vars: [], pins: [], funcs: [], includes: [], setup: null, loop: null, names: new Map() }
  const claim = (name: string, line: number, kind: SketchName['kind']): void => {
    if (!info.names.has(name)) info.names.set(name, { line, kind })
  }

  /** Индекс парной закрывающей скобки (по маске) или n. */
  const matchBrace = (open: number): number => {
    let d = 0
    for (let i = open; i < n; i++) {
      if (m[i] === '{') d++
      else if (m[i] === '}') {
        d--
        if (d === 0) return i
      }
    }
    return n
  }

  // ---- анализ объявления ----
  const analyzeDecl = (start: number, end: number): void => {
    // текст по маске и по оригиналу (для строк-инициализаторов)
    const text = m.slice(start, end)
    const trimmed = text.trim()
    if (!trimmed || SKIP_START.test(trimmed)) return
    const parts = splitTopLevel(text)
    const first = text.slice(parts[0][0], parts[0][1])
    // имя первого объявляемого: последний идентификатор до «=» / «[» / «{» / конца
    const eq = firstTopLevel(first, '=')
    const bracket = firstTopLevel(first, '[')
    const par = firstTopLevel(first, '(')
    if (par >= 0 && (eq < 0 || par < eq)) return // прототип функции, объект с конструктором (Servo s(9)) и т.п.
    let declEnd = first.length
    if (eq >= 0) declEnd = Math.min(declEnd, eq)
    if (bracket >= 0) declEnd = Math.min(declEnd, bracket)
    const brace = first.indexOf('{')
    if (brace >= 0) declEnd = Math.min(declEnd, brace)
    const head = first.slice(0, declEnd)
    const nm = /([A-Za-z_]\w*)\s*$/.exec(head)
    if (!nm) return
    const nameStart = nm.index
    const rawType = head.slice(0, nameStart).trim()
    if (!rawType) return // без типа — не объявление
    // квалификаторы
    const words = rawType.split(/\s+/)
    let isConst = false
    let isStatic = false
    const typeWords: string[] = []
    let pointer = ''
    for (const w of words) {
      const stripped = w.replace(/[*&]+/g, (x) => {
        pointer += x
        return ''
      })
      if (!stripped) continue
      if (QUALIFIERS.has(stripped)) {
        if (stripped === 'const' || stripped === 'constexpr') isConst = true
        if (stripped === 'static') isStatic = true
        continue
      }
      typeWords.push(stripped)
    }
    // «const char *p»: звёздочка могла прилипнуть к имени, учитываем и её
    if (/[*&]/.test(rawType)) pointer = pointer || '*'
    const ctype = typeWords.join(' ')
    if (!ctype) return
    if (/^[0-9]/.test(ctype)) return
    const base = start + parts[0][0]
    const decls: Array<{ name: string; nameOff: number; rest: string; restOff: number; isArray: boolean; ptr: boolean }> = []
    {
      const rest = first.slice(declEnd)
      decls.push({
        name: nm[1],
        nameOff: base + nameStart,
        rest,
        restOff: base + declEnd,
        isArray: bracket >= 0 && (eq < 0 || bracket < eq),
        ptr: !!pointer
      })
    }
    for (let k = 1; k < parts.length; k++) {
      const seg = text.slice(parts[k][0], parts[k][1])
      const sm = /^\s*([*&]*)\s*([A-Za-z_]\w*)\s*/.exec(seg)
      if (!sm) continue
      const after = seg.slice(sm[0].length)
      decls.push({
        name: sm[2],
        nameOff: start + parts[k][0] + sm[0].indexOf(sm[2]),
        rest: after,
        restOff: start + parts[k][0] + sm[0].length,
        isArray: after.trimStart().startsWith('['),
        ptr: !!sm[1] || !!pointer
      })
    }
    for (const d of decls) {
      let init: string | null = null
      const r = d.rest
      const e = firstTopLevel(r, '=')
      if (e >= 0) init = code.slice(d.restOff + e + 1, d.restOff + r.length).trim()
      else {
        const b = r.indexOf('{')
        if (b >= 0) init = code.slice(d.restOff + b, d.restOff + r.length).trim()
      }
      const mapped = d.isArray
        ? { type: null as VarType | null, note: 'массив — конструктор такие переменные не поддерживает' }
        : d.ptr
          ? { type: null as VarType | null, note: 'указатель или ссылка — конструктор такие переменные не поддерживает' }
          : mapCType(ctype)
      const line = lineOf(d.nameOff)
      const v: SketchVar = {
        name: d.name,
        ctype: ctype + (d.ptr ? ' *' : '') + (d.isArray ? '[]' : ''),
        type: mapped.type,
        line,
        offset: start,
        endOffset: end,
        isConst,
        isStatic,
        isArray: d.isArray,
        init,
        initValue: initPreview(init, mapped.type)
      }
      if (mapped.note) v.note = mapped.note
      if (info.names.has(d.name)) continue // повторное объявление (#if-ветки) — первое побеждает
      info.vars.push(v)
      claim(d.name, line, isConst ? 'const' : 'var')
      // пины: const-целое с литералом, либо «похожая на пин» переменная
      const integral = mapped.type === 'int' && !d.isArray && !d.ptr
      if (integral && init !== null) {
        const val = pinValueOf(init)
        if (val !== null && val >= 0 && val <= 99 && (isConst || PIN_NAME_RE.test(d.name)))
          info.pins.push({ name: d.name, value: val, expr: init, line, kind: isConst ? 'const' : 'var', offset: start, endOffset: end })
      }
    }
  }

  const firstTopLevel = (s: string, ch: string): number => {
    let depth = 0
    for (let i = 0; i < s.length; i++) {
      const c = s[i]
      if (depth === 0 && c === ch) return i
      if (c === '(' || c === '[' || c === '{') depth++
      else if (c === ')' || c === ']' || c === '}') depth--
    }
    return -1
  }

  // ---- основной проход ----
  let i = 0
  let stmtStart = -1
  let parenDepth = 0
  let atLineStart = true
  /** Есть ли пропущенные { } внутри текущего оператора (инициализатор/тело struct). */
  while (i < n) {
    const c = m[i]
    if (c === '\n') {
      atLineStart = true
      i++
      continue
    }
    if (c === ' ' || c === '\t' || c === '\r') {
      i++
      continue
    }
    if (atLineStart && c === '#' && parenDepth === 0 && stmtStart < 0) {
      // препроцессорная строка (с продолжениями через \)
      const ls = i
      let j = i
      while (j < n) {
        if (m[j] === '\n') {
          // продолжение строки?
          let k = j - 1
          while (k > ls && (m[k] === '\r' || m[k] === ' ')) k--
          if (m[k] === '\\') {
            j++
            continue
          }
          break
        }
        j++
      }
      handleDirective(ls, j)
      i = j
      continue
    }
    atLineStart = false
    if (stmtStart < 0) stmtStart = i
    if (c === '(' || c === '[') parenDepth++
    else if (c === ')' || c === ']') parenDepth = Math.max(0, parenDepth - 1)
    else if (c === ';' && parenDepth === 0) {
      analyzeDecl(stmtStart, i)
      stmtStart = -1
    } else if (c === '{' && parenDepth === 0) {
      const head = m.slice(stmtStart, i)
      const close = matchBrace(i)
      const hp = firstTopLevel(head, '(')
      const he = firstTopLevel(head, '=')
      const isFunc = hp >= 0 && (he < 0 || hp < he) && !SKIP_START.test(head.trim()) && /\)\s*(const|noexcept|override|final|\s)*\s*$/.test(head)
      if (isFunc) {
        recordFunc(stmtStart, head, hp, i, close, false)
        stmtStart = -1
        i = close + 1
        continue
      }
      // инициализатор или тело struct/enum/namespace — пропускаем и продолжаем оператор
      i = close + 1
      continue
    } else if (c === '}') {
      // лишняя скобка — сбрасываем оператор
      stmtStart = -1
    }
    i++
  }

  function handleDirective(ls: number, le: number): void {
    const maskedLine = m.slice(ls, le)
    const line = lineOf(ls)
    const inc = /^#\s*include\s*([<"])/.exec(maskedLine)
    if (inc) {
      const orig = code.slice(ls, le)
      const hm = /^#\s*include\s*[<"]([^>"]+)[>"]/.exec(orig)
      info.includes.push({ header: hm ? hm[1] : '', line, offset: ls, endOffset: le })
      return
    }
    const def = /^#\s*define\s+([A-Za-z_]\w*)(\()?/.exec(maskedLine)
    if (!def) return
    const name = def[1]
    claim(name, line, 'define')
    if (def[2]) return // функциональный макрос
    const body = maskedLine.slice(def[0].length).trim().replace(/\\\s*$/, '').trim()
    if (!body) return
    const val = pinValueOf(body)
    const isPinLike = /^(\(?\s*)?(\d+|0[xX][0-9a-fA-F]+|[AD]\d+|LED_BUILTIN|GPIO\d+)(\s*\)?)?$/.test(body)
    if (isPinLike) info.pins.push({ name, value: val, expr: body.replace(/^\(\s*|\s*\)$/g, ''), line, kind: 'define', offset: ls, endOffset: le })
  }

  function recordFunc(start: number, head: string, hp: number, open: number, close: number, proto: boolean): void {
    const before = head.slice(0, hp)
    const nm = /([A-Za-z_]\w*)\s*$/.exec(before)
    if (!nm) return
    const name = nm[1]
    if (/::\s*$/.test(before.slice(0, nm.index))) return // метод класса вне класса
    // параметры — до парной «)»
    let d = 0
    let pe = hp
    for (let k = hp; k < head.length; k++) {
      if (head[k] === '(') d++
      else if (head[k] === ')') {
        d--
        if (d === 0) {
          pe = k
          break
        }
      }
    }
    const params = head.slice(hp + 1, pe).replace(/\s+/g, ' ').trim()
    const returnType = before.slice(0, nm.index).replace(/\s+/g, ' ').trim()
    const isCallback = /^void$/.test(returnType.replace(/\b(static|inline)\b/g, '').trim()) && /^Control\s*\*\s*\w*\s*,\s*int\s*\w*$/.test(params)
    const f: SketchFunc = {
      name,
      returnType,
      params,
      line: lineOf(start + nm.index),
      offset: start,
      bodyOpen: proto ? -1 : open,
      bodyClose: proto ? -1 : close,
      isCallback,
      isPrototype: proto
    }
    info.funcs.push(f)
    claim(name, f.line, 'func')
    if (name === 'setup' && !info.setup && !proto) info.setup = f
    if (name === 'loop' && !info.loop && !proto) info.loop = f
  }

  // прототипы обработчиков: «void onFoo(Control*, int);» — проход по оставшимся объявлениям не видит их (analyzeDecl пропускает «(»)
  const protoRe = /(^|\n)[ \t]*void[ \t]+([A-Za-z_]\w*)[ \t]*\(\s*Control\s*\*\s*\w*\s*,\s*int\s*\w*\s*\)\s*;/g
  for (let pm = protoRe.exec(m); pm; pm = protoRe.exec(m)) {
    const name = pm[2]
    if (info.funcs.some((f) => f.name === name)) continue
    const off = pm.index + pm[1].length
    // только верхний уровень: проверяем глубину фигурных скобок
    if (braceDepthAt(m, off) !== 0) continue
    const f: SketchFunc = {
      name,
      returnType: 'void',
      params: 'Control* sender, int type',
      line: lineOf(off),
      offset: off,
      bodyOpen: -1,
      bodyClose: -1,
      isCallback: true,
      isPrototype: true
    }
    info.funcs.push(f)
    claim(name, f.line, 'func')
  }

  return info
}

function braceDepthAt(m: string, off: number): number {
  let d = 0
  for (let i = 0; i < off; i++) {
    if (m[i] === '{') d++
    else if (m[i] === '}') d--
  }
  return d
}

// ---- Разрешение пинов под платформу ----

const ESP8266_D: Record<string, number> = { D0: 16, D1: 5, D2: 4, D3: 0, D4: 2, D5: 14, D6: 12, D7: 13, D8: 15, D9: 3, D10: 1 }

/** Числовой номер пина (GPIO) по выражению из скетча для платформы; null, если определить нельзя. */
export function resolvePinExpr(expr: string, platform: 'esp8266' | 'esp32' | 'avr' | null): number | null {
  const s = expr.trim()
  const v = pinValueOf(s)
  if (v !== null) return v
  if (/^GPIO\d+$/.test(s)) return parseInt(s.slice(4), 10)
  if (s === 'LED_BUILTIN') return platform === 'esp32' || platform === 'esp8266' || platform === null ? 2 : 13
  if (platform === 'esp8266') {
    if (s === 'A0') return 17
    if (s in ESP8266_D) return ESP8266_D[s]
  }
  return null
}

/** Номер пина для выбора из списка скетча (значение либо разрешённое по платформе). */
export function resolvePin(p: SketchPin, platform: 'esp8266' | 'esp32' | 'avr' | null): number | null {
  if (p.value !== null) return p.value
  return resolvePinExpr(p.expr, platform)
}
