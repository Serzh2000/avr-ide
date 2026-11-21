// Индекс проекта: объединяет разобранные файлы, отвечает на вопросы редактора (определение, члены структур, значения макросов,
// адреса периферии, дополнение, поиск). Чистая логика без файловой системы: файлы подаются готовыми.
import { evalConst, formatValue } from './expr'
import type { FileIndex, Sym } from './types'

export interface IndexFile {
  /** Абсолютный путь с «/» */
  path: string
  /** Свой файл проекта (исходники, свои заголовки); иначе — «чужой» (CMSIS, HAL, библиотеки) */
  own: boolean
  idx: FileIndex
}

export interface Instance { name: string; type: string; base: string }

export interface Layout { size: number; align: number; offsets: Map<string, number> }

const PRIM: Record<string, number> = {
  char: 1, 'signed char': 1, 'unsigned char': 1, uint8_t: 1, int8_t: 1, bool: 1, _Bool: 1,
  short: 2, 'unsigned short': 2, 'short int': 2, uint16_t: 2, int16_t: 2,
  int: 4, unsigned: 4, 'unsigned int': 4, long: 4, 'unsigned long': 4, 'long int': 4, uint32_t: 4, int32_t: 4, float: 4, size_t: 4, uintptr_t: 4, intptr_t: 4, ptrdiff_t: 4,
  'long long': 8, 'unsigned long long': 8, uint64_t: 8, int64_t: 8, double: 8
}

const PERIPH_RE = /^\(\(\s*([A-Za-z_]\w*)\s*\*\s*\)\s*([A-Za-z_]\w*|0[xX][0-9A-Fa-f]+[uUlL]*)\s*\)$/

const KIND_RANK: Record<string, number> = { function: 0, variable: 1, typedef: 2, struct: 2, union: 2, enum: 2, class: 2, enumerator: 3, macro: 4, field: 5, label: 3 }

export interface CompleteItem { sym: Sym; own: boolean }

export class ProjectIndex {
  files: IndexFile[] = []
  private byName = new Map<string, Sym[]>()
  private members = new Map<string, Sym[]>()
  private instances = new Map<string, Instance | null>()
  private layouts = new Map<string, Layout | null>()
  private sorted: Sym[] | null = null
  private sortedKeys: string[] = []
  private all: Sym[] = []

  /** Полная пересборка из списка файлов. */
  build(files: IndexFile[]): void {
    this.files = files
    this.byName = new Map()
    this.members = new Map()
    this.instances = new Map()
    this.layouts = new Map()
    this.sorted = null
    this.all = []
    for (let f = 0; f < files.length; f++) this.addFile(f)
  }

  private addFile(f: number): void {
    for (const s of this.files[f].idx.syms) {
      s.f = f
      this.all.push(s)
      const arr = this.byName.get(s.n)
      if (arr) arr.push(s)
      else this.byName.set(s.n, [s])
      if (s.p !== undefined && (s.k === 'field' || s.k === 'enumerator' || s.k === 'function') && s.p) {
        const m = this.members.get(s.p)
        if (m) m.push(s)
        else this.members.set(s.p, [s])
      }
    }
  }

  /** Заменить разбор одного файла (правка в редакторе): пересобирает только затронутое. */
  replaceFile(f: number, idx: FileIndex): void {
    const old = this.files[f].idx.syms
    const oldSet = new Set(old)
    for (const s of old) {
      const arr = this.byName.get(s.n)
      if (arr) { const nx = arr.filter((x) => !oldSet.has(x)); if (nx.length) this.byName.set(s.n, nx); else this.byName.delete(s.n) }
      if (s.p) { const m = this.members.get(s.p); if (m) { const nx = m.filter((x) => !oldSet.has(x)); if (nx.length) this.members.set(s.p, nx); else this.members.delete(s.p) } }
    }
    this.all = this.all.filter((s) => !oldSet.has(s))
    this.files[f] = { ...this.files[f], idx }
    this.addFile(f)
    this.instances = new Map()
    this.layouts = new Map()
    if (!this.files[f].own) this.sorted = null
  }

  fileOf(s: Sym): IndexFile | undefined { return s.f !== undefined ? this.files[s.f] : undefined }

  lookup(name: string): Sym[] { return this.byName.get(name) ?? [] }

  get symbolCount(): number { return this.all.length }

  /** Лучшее объявление: определение функции > прототип; свой файл > чужой. */
  best(name: string, prefer?: { file?: number }): Sym | undefined {
    const list = this.lookup(name)
    if (list.length === 0) return undefined
    let best: Sym | undefined
    let bestScore = -1
    for (const s of list) {
      if (s.k === 'field') continue
      let sc = 1
      if (s.k === 'function') sc += s.b ? 6 : 3
      else if (s.k === 'macro') sc += 2
      else if (s.k === 'struct' || s.k === 'union' || s.k === 'enum' || s.k === 'class' || s.k === 'typedef') sc += s.t ? 3 : 5
      else if (s.k === 'variable') sc += s.s?.startsWith('extern') ? 3 : 4
      if (this.files[s.f!]?.own) sc += 4
      if (prefer?.file !== undefined && s.f === prefer.file) sc += 2
      if (sc > bestScore) { best = s; bestScore = sc }
    }
    return best ?? list[0]
  }

  /** Тип без typedef-цепочки: «GPIO_TypeDef» → «GPIO_TypeDef» (если у него есть члены), иначе по typedef/тегу. */
  resolveType(name: string | undefined): string | undefined {
    let cur = name
    for (let i = 0; i < 8 && cur; i++) {
      if (this.members.has(cur)) return cur
      const defs = this.lookup(cur).filter((s) => s.t && (s.k === 'typedef' || s.k === 'struct' || s.k === 'union' || s.k === 'enum' || s.k === 'class'))
      if (defs.length === 0) return undefined
      cur = defs[0].t
    }
    return undefined
  }

  membersOf(type: string | undefined): Sym[] {
    const t = this.resolveType(type)
    return t ? this.members.get(t) ?? [] : []
  }

  /** Периферия: макрос вида «((GPIO_TypeDef *)GPIOA_BASE)». */
  instance(name: string): Instance | undefined {
    if (this.instances.has(name)) return this.instances.get(name) ?? undefined
    let inst: Instance | null = null
    for (const s of this.lookup(name)) {
      if (s.k !== 'macro' || !s.v || s.a) continue
      const m = PERIPH_RE.exec(s.v)
      if (m) { inst = { name, type: m[1], base: m[2] }; break }
    }
    this.instances.set(name, inst)
    return inst ?? undefined
  }

  /** Значение макроса (с раскрытием вложенных макросов) или undefined. */
  macroValue(name: string): bigint | undefined {
    const look = (n: string): string | undefined => {
      const arr = this.byName.get(n)
      if (!arr) return undefined
      for (const s of arr) if (s.k === 'macro' && !s.a) return s.v ?? ''
      for (const s of arr) if (s.k === 'enumerator' && s.v) return s.v
      return undefined
    }
    const v = look(name)
    if (v === undefined) return undefined
    return evalConst(v, look)
  }

  exprValue(expr: string): bigint | undefined {
    return evalConst(expr, (n) => { for (const s of this.lookup(n)) if (s.k === 'macro' && !s.a) return s.v ?? ''; return undefined })
  }

  /** Адрес периферии («GPIOA» → 0x40010800) или undefined. */
  instanceAddress(name: string): bigint | undefined {
    const inst = this.instance(name)
    if (!inst) return undefined
    if (/^0[xX]/.test(inst.base)) return this.exprValue(inst.base)
    return this.macroValue(inst.base)
  }

  private sizeOfType(t: string | undefined, ptr: boolean | undefined, depth: number): { size: number; align: number } | undefined {
    if (ptr) return { size: 4, align: 4 }
    if (!t) return undefined
    const p = PRIM[t]
    if (p) return { size: p, align: Math.min(p, 8) }
    // typedef на примитив
    const l = this.layout(t, depth + 1)
    if (l) return { size: l.size, align: l.align }
    for (const d of this.lookup(t)) {
      if (d.k === 'typedef' && d.t && d.t !== t) {
        const base = this.sizeOfType(d.t, !!d.ptr, depth + 1)
        if (base) {
          if (d.arr) { const n = this.exprValue(d.arr); if (n === undefined) return undefined; return { size: base.size * Number(n), align: base.align } }
          return base
        }
      }
      if (d.k === 'enum') return { size: 4, align: 4 }
    }
    return undefined
  }

  /** Раскладка структуры/объединения в памяти (ARM, без упаковки). undefined — не удалось (битовые поля, неизвестные типы). */
  layout(type: string, depth = 0): Layout | undefined {
    const t = this.resolveType(type)
    if (!t || depth > 6) return undefined
    if (this.layouts.has(t)) return this.layouts.get(t) ?? undefined
    this.layouts.set(t, null)
    const isUnion = this.lookup(t).some((s) => s.k === 'union')
    const offsets = new Map<string, number>()
    let off = 0
    let maxAlign = 1
    let size = 0
    for (const f of this.members.get(t) ?? []) {
      if (f.k !== 'field') continue
      if (f.bits !== undefined) return undefined
      const base = this.sizeOfType(f.t, !!f.ptr, depth)
      if (!base) return undefined
      let n = 1
      if (f.arr) { const v = this.exprValue(f.arr); if (v === undefined) return undefined; n = Number(v) }
      const sz = base.size * n
      if (isUnion) { offsets.set(f.n, 0); size = Math.max(size, sz) } else {
        off = Math.ceil(off / base.align) * base.align
        offsets.set(f.n, off)
        off += sz
        size = off
      }
      maxAlign = Math.max(maxAlign, base.align)
    }
    size = Math.ceil(size / maxAlign) * maxAlign
    const lay: Layout = { size, align: maxAlign, offsets }
    this.layouts.set(t, lay)
    return lay
  }

  fieldOffset(type: string, field: string): number | undefined {
    return this.layout(type)?.offsets.get(field)
  }

  /** Тип корня выражения: периферия, глобальная переменная, локальная по тексту перед курсором. */
  rootType(name: string, before: string): string | undefined {
    const inst = this.instance(name)
    if (inst) return inst.type
    for (const s of this.lookup(name)) if ((s.k === 'variable' || s.k === 'field') && s.t) return s.t
    // локальная переменная или параметр: «Type *name», «Type name»
    const re = new RegExp(`(?:^|[\\s,(;{])((?:struct\\s+|union\\s+)?[A-Za-z_]\\w*)(?:\\s+(?:const|volatile))*\\s*[*&]*\\s*(?:const\\s+)?${name.replace(/[$]/g, '\\$')}\\b\\s*(?:[;=,)\\[]|$)`, 'g')
    let last: string | undefined
    const tail = before.length > 12000 ? before.slice(-12000) : before
    for (let m = re.exec(tail); m; m = re.exec(tail)) {
      const ty = m[1].replace(/^(?:struct|union)\s+/, '')
      if (this.resolveType(ty)) last = ty
    }
    return last
  }

  /** Тип выражения «a.b->c»: по цепочке полей. */
  chainType(chain: string[], before: string): string | undefined {
    if (chain.length === 0) return undefined
    let t = this.rootType(chain[0], before)
    for (let i = 1; i < chain.length && t; i++) {
      const f = this.membersOf(t).find((m) => m.n === chain[i] && m.k === 'field')
      t = f?.t
    }
    return this.resolveType(t)
  }

  // ----- поиск -----

  private ensureSorted(): void {
    if (this.sorted) return
    const arr = this.all.filter((s) => s.k !== 'field' && !(s.k === 'enumerator' && false))
    const keyed = arr.map((s) => [s.n.toLowerCase(), s] as const).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    this.sorted = keyed.map((x) => x[1])
    this.sortedKeys = keyed.map((x) => x[0])
  }

  /** Кандидаты автодополнения по префиксу (без учёта регистра). Поля структур не входят: они предлагаются после «->». */
  complete(prefix: string, limit: number): CompleteItem[] {
    this.ensureSorted()
    const p = prefix.toLowerCase()
    const keys = this.sortedKeys
    let lo = 0
    let hi = keys.length
    while (lo < hi) { const mid = (lo + hi) >> 1; if (keys[mid] < p) lo = mid + 1; else hi = mid }
    const seen = new Set<string>()
    const found: Sym[] = []
    for (let i = lo; i < keys.length && keys[i].startsWith(p); i++) {
      const s = this.sorted![i]
      if (seen.has(s.n)) { continue }
      seen.add(s.n)
      found.push(this.best(s.n) ?? s)
      if (found.length > 4000) break
    }
    const rank = (s: Sym): number => (this.files[s.f!]?.own ? 0 : 100) + (KIND_RANK[s.k] ?? 5) * 10 + (s.k === 'macro' && /_(Pos|Msk)$/.test(s.n) ? 5 : 0)
    found.sort((a, b) => rank(a) - rank(b) || a.n.length - b.n.length || (a.n < b.n ? -1 : 1))
    return found.slice(0, limit).map((s) => ({ sym: s, own: !!this.files[s.f!]?.own }))
  }

  /** Все символы своих файлов (для дополнения без префикса и Ctrl+T). */
  ownSymbols(): Sym[] {
    return this.all.filter((s) => this.files[s.f!]?.own && s.k !== 'field')
  }

  /** Поиск по проекту (Ctrl+T): точное > начало > вхождение > подпоследовательность. */
  search(query: string, limit: number): Sym[] {
    const q = query.trim().toLowerCase()
    if (!q) return this.ownSymbols().filter((s) => s.k === 'function' || s.k === 'struct' || s.k === 'typedef' || s.k === 'enum' || s.k === 'variable' || s.k === 'union' || s.k === 'class').slice(0, limit)
    const scored: [number, Sym][] = []
    let strong = 0
    for (const s of this.all) {
      if (s.k === 'field' && s.p === undefined) continue
      const n = s.n.toLowerCase()
      let sc: number
      if (n === q) sc = 0
      else if (n.startsWith(q)) sc = 10 + n.length - q.length
      else if (n.includes(q)) sc = 100 + n.indexOf(q)
      else {
        // подпоследовательность (только для запросов короче имени)
        let i = 0
        for (let j = 0; j < n.length && i < q.length; j++) if (n[j] === q[i]) i++
        if (i < q.length || q.length < 2) continue
        sc = 1000 + n.length
      }
      if (sc < 1000) strong++
      if (this.files[s.f!]?.own) sc -= 5
      sc += (KIND_RANK[s.k] ?? 5) * 3
      scored.push([sc, s])
    }
    // нестрогие совпадения (подпоследовательность букв) — только если точных мало: иначе это шум
    const list = strong >= 12 ? scored.filter(([sc]) => sc < 1000) : scored
    list.sort((a, b) => a[0] - b[0] || (a[1].n < b[1].n ? -1 : 1))
    const out: Sym[] = []
    const seen = new Set<string>()
    for (const [, s] of list) {
      const key = `${s.n}|${s.k}|${s.f}|${s.l}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(s)
      if (out.length >= limit) break
    }
    return out
  }

  /** Макросы-биты регистра: префикс «<Периферия>_<РЕГИСТР>_» (RCC_APB2ENR_, GPIO_ODR_, USART_CR1_). */
  bitMacros(type: string, reg: string, limit: number): Sym[] {
    const base = type.replace(/_TypeDef$/i, '').replace(/_Type$/i, '')
    const out: Sym[] = []
    this.ensureSorted()
    const p = `${base}_${reg}_`.toLowerCase()
    const keys = this.sortedKeys
    let lo = 0
    let hi = keys.length
    while (lo < hi) { const mid = (lo + hi) >> 1; if (keys[mid] < p) lo = mid + 1; else hi = mid }
    const seen = new Set<string>()
    for (let i = lo; i < keys.length && keys[i].startsWith(p); i++) {
      const s = this.sorted![i]
      if (s.k !== 'macro' || seen.has(s.n)) continue
      seen.add(s.n)
      out.push(s)
    }
    // сначала «основные» (без _Pos/_Msk и без номеров позиций)
    out.sort((a, b) => Number(/_(Pos|Msk)$/.test(a.n)) - Number(/_(Pos|Msk)$/.test(b.n)) || a.n.length - b.n.length)
    return out.slice(0, limit)
  }

  /** Определения символа для перехода: сначала определение функции, затем объявления. */
  definitions(name: string): Sym[] {
    const list = this.lookup(name).filter((s) => s.k !== 'field' || true)
    const score = (s: Sym): number => (s.k === 'function' && s.b ? 0 : s.k === 'function' ? 2 : s.k === 'macro' ? 1 : (s.k === 'variable' && s.s?.startsWith('extern')) ? 3 : 1) + (this.files[s.f!]?.own ? 0 : 5)
    return [...list].sort((a, b) => score(a) - score(b))
  }

  /** Описание значения макроса для hover: «0x4 (4)». */
  describeMacro(name: string): string | undefined {
    const v = this.macroValue(name)
    return v === undefined ? undefined : formatValue(v)
  }
}
