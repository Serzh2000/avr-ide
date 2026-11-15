// Модель символов библиотек проекта: индекс для автодополнения, подсказок и справочника. Чистая логика (без React/Monaco).
import type { LibSymbol, ProjectLibrary } from '../contracts'

export interface LibRef {
  lib: ProjectLibrary
  sym: LibSymbol
}

export interface LibIndex {
  libs: ProjectLibrary[]
  /** Все публичные символы. */
  all: LibRef[]
  /** Члены классов по полному имени владельца (Outer::Inner), только public/protected. */
  membersByOwner: Map<string, LibRef[]>
  /** Простое имя класса → определения (class/struct). */
  classesBySimple: Map<string, LibRef[]>
  /** Символы, доступные в коде без квалификации (без владельца, классы, значения обычных enum): по короткому имени. */
  topByName: Map<string, LibRef[]>
  /** Любые символы по короткому имени (для hover/F1). */
  byName: Map<string, LibRef[]>
  /** Имя глобального объекта → имя его класса (extern WiFiClass WiFi; ESPUIClass ESPUI;). */
  objects: Map<string, string>
  /** Значения перечислений по имени перечисления (для `Mode::On` и `Adafruit_BMP280::SAMPLING_X1`). */
  enumValuesByEnum: Map<string, LibRef[]>
}

export const EMPTY_INDEX: LibIndex = buildIndex([])

/** «detail::VariantOperators<JsonArray>» → «VariantOperators»; «const Foo*» → «Foo». */
export function simpleTypeName(type: string): string | null {
  let t = type.replace(/\b(const|volatile|struct|class|enum|typename|static|extern|unsigned|signed)\b/g, ' ')
  t = t.replace(/<[^<>]*(?:<[^<>]*>[^<>]*)*>/g, ' ').replace(/[*&\s]+/g, ' ').trim()
  if (!t) return null
  const last = t.split(/\s+/).pop()!
  const seg = last.split('::').pop()!
  return /^[A-Za-z_]\w*$/.test(seg) ? seg : null
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V): void {
  const a = m.get(k)
  if (a) a.push(v)
  else m.set(k, [v])
}

export function buildIndex(libs: ProjectLibrary[]): LibIndex {
  const all: LibRef[] = []
  const membersByOwner = new Map<string, LibRef[]>()
  const classesBySimple = new Map<string, LibRef[]>()
  const topByName = new Map<string, LibRef[]>()
  const byName = new Map<string, LibRef[]>()
  const objects = new Map<string, string>()
  const enumValuesByEnum = new Map<string, LibRef[]>()
  const classNames = new Set<string>()
  for (const lib of libs) for (const s of lib.symbols) if (s.kind === 'class' || s.kind === 'struct') classNames.add(s.name)

  for (const lib of libs) {
    for (const sym of lib.symbols) {
      if (sym.access === 'private') continue
      const ref: LibRef = { lib, sym }
      all.push(ref)
      push(byName, sym.name, ref)
      if (sym.owner) push(membersByOwner, sym.owner, ref)
      if (sym.kind === 'class' || sym.kind === 'struct') {
        push(classesBySimple, sym.name, ref)
        push(topByName, sym.name, ref)
      } else if (sym.kind === 'enumValue') {
        if (sym.returns) push(enumValuesByEnum, sym.returns, ref)
        if (!sym.signature.includes('::')) push(topByName, sym.name, ref)
      } else if (!sym.owner && sym.kind !== 'method' && sym.kind !== 'constructor') {
        push(topByName, sym.name, ref)
      }
      if (sym.kind === 'variable' && !sym.owner && sym.returns) {
        const t = simpleTypeName(sym.returns)
        if (t && classNames.has(t)) objects.set(sym.name, t)
      }
    }
  }
  // псевдонимы классов: using Servo = ServoTemplate<int>; typedef struct Foo Foo_t — переменные такого типа получают члены класса
  for (const r of all) {
    const sym = r.sym
    if (sym.kind !== 'typedef' || classesBySimple.has(sym.name)) continue
    const m = /^using\s+\w+\s*=\s*(.+)$/.exec(sym.signature) ?? /^typedef\s+(.+?)\s+\w+$/.exec(sym.signature)
    const target = m ? simpleTypeName(m[1]) : null
    const defs = target && target !== sym.name ? classesBySimple.get(target) : undefined
    if (defs) classesBySimple.set(sym.name, defs)
  }
  return { libs, all, membersByOwner, classesBySimple, topByName, byName, objects, enumValuesByEnum }
}

/** Владелец-класс (по простому имени), включая вложенные: все qname, у которых последний сегмент совпадает. */
function ownerKeys(index: LibIndex, className: string): string[] {
  const out: string[] = []
  for (const r of index.classesBySimple.get(className) ?? []) out.push(r.sym.owner ? `${r.sym.owner}::${r.sym.name}` : r.sym.name)
  return out
}

/** Члены класса (с наследованием внутри известных библиотек). Перегрузки сохраняются. */
export function membersOf(index: LibIndex, className: string, opts: { inherited?: boolean; kinds?: LibSymbol['kind'][] } = {}): LibRef[] {
  const out: LibRef[] = []
  const seenClasses = new Set<string>()
  const visit = (name: string, depth: number): void => {
    if (depth > 5 || seenClasses.has(name)) return
    seenClasses.add(name)
    for (const key of ownerKeys(index, name)) for (const m of index.membersByOwner.get(key) ?? []) if (!opts.kinds || opts.kinds.includes(m.sym.kind)) out.push(m)
    if (opts.inherited === false) return
    for (const c of index.classesBySimple.get(name) ?? []) {
      for (const b of c.sym.bases ?? []) {
        const bn = simpleTypeName(b)
        if (bn) visit(bn, depth + 1)
      }
    }
  }
  visit(className, 0)
  return out
}

export function isKnownClass(index: LibIndex, name: string): boolean {
  return index.classesBySimple.has(name)
}

/** Тип объекта: сначала локальные переменные файла, затем глобальные объекты библиотек. */
export function classOfObject(index: LibIndex, name: string, fileTypes: Record<string, string> | undefined, libTypes?: Record<string, string>): string | undefined {
  const t = libTypes?.[name] ?? fileTypes?.[name]
  if (t && isKnownClass(index, t)) return t
  const g = index.objects.get(name)
  if (g) return g
  return undefined
}

/**
 * Переменные файла, чей тип — класс из библиотек: `Adafruit_BMP280 bmp;`, `DHT dht(2, DHT22);`,
 * `WiFiClient client = server.available();`, `AsyncWebServer *server = new AsyncWebServer(80);`, `StaticJsonDocument<200> doc;`.
 * masked — текст без комментариев и строк. Работает и для локальных переменных внутри функций.
 */
export function variableClasses(masked: string, index: LibIndex): Record<string, string> {
  const out: Record<string, string> = {}
  if (index.classesBySimple.size === 0) return out
  const names = [...index.classesBySimple.keys()].filter((n) => /^[A-Za-z_]\w*$/.test(n))
  if (names.length === 0) return out
  // длинный список имён — в один regexp; экранировать не нужно (только \w)
  const re = new RegExp(`(?:^|[\\s;{}(,])(?:(?:const|static|volatile|extern)\\s+)*(?:[A-Za-z_]\\w*::)*(${names.join('|')})(?![\\w])(?:\\s*<[^<>;(){}]*(?:<[^<>;(){}]*>[^<>;(){}]*)*>)?\\s*[*&]*\\s*([A-Za-z_]\\w*)\\s*(?=[=;(\\[{,)])`, 'g')
  let m: RegExpExecArray | null
  let guard = 0
  while ((m = re.exec(masked)) && guard++ < 5000) {
    const [, cls, v] = m
    if (v === cls || /^(const|static|return|new|delete|public|private|protected|operator|class|struct)$/.test(v)) continue
    out[v] = cls
  }
  return out
}

// ---- «показываемые» подписи ----

/** Подпись без шаблонного префикса (для компактных подсказок). */
export function shortSignature(sym: LibSymbol): string {
  let s = sym.signature
  if (sym.template && s.startsWith(sym.template)) s = s.slice(sym.template.length).trim()
  else if (s.startsWith('template')) {
    // template <...> …
    let d = 0
    let i = s.indexOf('<')
    for (; i >= 0 && i < s.length; i++) {
      if (s[i] === '<') d++
      else if (s[i] === '>') {
        d--
        if (d === 0) {
          s = s.slice(i + 1).trim()
          break
        }
      }
    }
  }
  return s
}

export function refName(sym: LibSymbol): string {
  if (sym.owner && (sym.kind === 'method' || sym.kind === 'constructor' || sym.kind === 'enumValue' || sym.kind === 'variable' || sym.kind === 'constant' || sym.kind === 'function' || sym.kind === 'typedef' || sym.kind === 'enum')) {
    return `${sym.owner}.${sym.name}`
  }
  return sym.name
}

export function locationOf(r: LibRef): string {
  return `${r.sym.header}:${r.sym.line}`
}

export function kindLabel(kind: LibSymbol['kind']): string {
  switch (kind) {
    case 'function': return 'функция'
    case 'method': return 'метод'
    case 'constructor': return 'конструктор'
    case 'class': return 'класс'
    case 'struct': return 'структура'
    case 'enum': return 'перечисление'
    case 'enumValue': return 'значение перечисления'
    case 'macro': return 'макрос'
    case 'constant': return 'константа'
    case 'typedef': return 'тип'
    case 'variable': return 'переменная'
  }
}

// ---- поиск (справочник) ----

function tokens(q: string): string[] {
  return q.toLowerCase().split(/[^\p{L}\p{N}_:]+/u).filter(Boolean)
}

export function scoreRef(r: LibRef, query: string): number {
  const q = query.trim().toLowerCase()
  if (!q) return 1
  const s = r.sym
  const name = s.name.toLowerCase()
  const full = (s.owner ? `${s.owner}.${s.name}` : s.name).toLowerCase()
  const fullColons = (s.owner ? `${s.owner}::${s.name}` : s.name).toLowerCase()
  let score = 0
  if (full === q || fullColons === q) score += 1000
  else if (name === q) score += 900
  else if (full.startsWith(q) || fullColons.startsWith(q)) score += 500
  else if (name.startsWith(q)) score += 450
  const sig = s.signature.toLowerCase()
  const doc = (s.doc ?? '').toLowerCase()
  const lib = r.lib.name.toLowerCase()
  for (const t of tokens(query)) {
    let k = 0
    if (full.includes(t)) k += 40
    else if (sig.includes(t)) k += 8
    if (doc.includes(t)) k += 4
    if (lib.includes(t)) k += 6
    if (k === 0) return 0
    score += k
  }
  // служебное реже полезно, чем методы и функции
  if (s.kind === 'enumValue' || s.kind === 'macro') score -= 1
  return Math.max(score, 1)
}

export function searchRefs(index: LibIndex, query: string, limit = 400): LibRef[] {
  if (!query.trim()) return index.all.slice(0, limit)
  const scored: { r: LibRef; s: number; i: number }[] = []
  index.all.forEach((r, i) => {
    const s = scoreRef(r, query)
    if (s > 0) scored.push({ r, s, i })
  })
  scored.sort((a, b) => b.s - a.s || a.i - b.i)
  return scored.slice(0, limit).map((x) => x.r)
}

/**
 * Точный поиск по слову для F1/справочника: «Class.method», «Class::method», «name».
 * Возвращает первое подходящее определение (для методов — первая перегрузка).
 */
export function lookupRef(index: LibIndex, word: string): LibRef | undefined {
  const w = word.trim()
  if (!w) return undefined
  const m = /^(.+?)(?:\.|::)([A-Za-z_]\w*)$/.exec(w)
  if (m) {
    const [, owner, name] = m
    const ownerSimple = owner.split('::').pop()!
    const cands = [...(index.membersByOwner.get(owner) ?? []), ...membersOf(index, ownerSimple)]
    const hit = cands.find((r) => r.sym.name === name && r.sym.kind !== 'constructor') ?? cands.find((r) => r.sym.name === name)
    if (hit) return hit
  }
  const top = index.topByName.get(w) ?? index.byName.get(w)
  if (top?.length) return top.find((r) => r.sym.kind !== 'constructor') ?? top[0]
  return undefined
}
