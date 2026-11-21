// Разбор карты компоновки GNU ld (.map) и вывода arm-none-eabi-size. Чистые функции.
import type { MapReport, MapSection, MapSymbol, SizeReport } from '../interfaces'

export interface MapRegion { name: string; origin: number; length: number }
export interface MapInputSection { name: string; section: string; size: number; file: string; address: number }
export interface ParsedMap {
  regions: MapRegion[]
  /** Выходные секции образа (размер > 0, кроме отладочных) */
  sections: (MapSection & { lma?: number })[]
  /** Входные секции из объектных файлов: основа списка «самые большие символы» */
  inputs: MapInputSection[]
}

const H = '0x[0-9a-fA-F]+'
const OUT_FULL = new RegExp(`^(\\S+)\\s+(${H})\\s+(${H})(?:\\s+load address\\s+(${H}))?\\s*$`)
const OUT_NAME = /^(\S+)\s*$/
const OUT_ADDR = new RegExp(`^\\s+(${H})\\s+(${H})(?:\\s+load address\\s+(${H}))?\\s*$`)
const IN_FULL = new RegExp(`^ (\\S+)\\s+(${H})\\s+(${H})\\s+(.+)$`)
const IN_NAME = /^ (\S+)\s*$/
const IN_ADDR = new RegExp(`^\\s{10,}(${H})\\s+(${H})\\s+(.+)$`)

const NOBITS = /bss|heap_stack|noinit|stack/i
const NOT_IMAGE = /^\.(debug|comment|ARM\.attributes|stab|gnu\.)/

/** Читаемое имя символа из имени входной секции: «.text.main» → «main». */
export function symbolFromSection(section: string, file: string): string {
  const m = /^\.(?:text|rodata|data|bss|ARM\.extab|ARM\.exidx|init_array|fini_array|noinit)(?:\.(?:unlikely|startup|hot|cold))?\.(.+)$/.exec(section)
  if (m) return m[1]
  const base = file.replace(/\\/g, '/').split('/').pop() ?? file
  return `${section} (${base.replace(/\.o$/, '')})`
}

export function parseMap(text: string): ParsedMap {
  const regions: MapRegion[] = []
  const sections: ParsedMap['sections'] = []
  const inputs: MapInputSection[] = []
  const lines = text.split(/\r?\n/)
  let i = 0
  while (i < lines.length && !/^Memory Configuration/.test(lines[i])) i++
  for (i++; i < lines.length && !/^Linker script and memory map/.test(lines[i]); i++) {
    const m = new RegExp(`^(\\S+)\\s+(${H})\\s+(${H})(?:\\s+\\S+)?\\s*$`).exec(lines[i])
    if (m && m[1] !== 'Name' && m[1] !== '*default*') regions.push({ name: m[1], origin: Number(m[2]), length: Number(m[3]) })
  }
  let cur: ParsedMap['sections'][number] | null = null
  let pendingOut: string | null = null
  let pendingIn: string | null = null
  for (i++; i < lines.length; i++) {
    const l = lines[i]
    if (!l.trim()) { pendingIn = null; continue }
    if (!l.startsWith(' ')) {
      pendingIn = null
      if (/^Cross Reference Table/.test(l)) break
      let m = OUT_FULL.exec(l)
      if (m && m[1].startsWith('.')) {
        cur = { name: m[1], origin: Number(m[2]), size: Number(m[3]), ...(m[4] ? { lma: Number(m[4]) } : {}) }
        sections.push(cur)
        pendingOut = null
        continue
      }
      m = OUT_NAME.exec(l)
      if (m && m[1].startsWith('.')) { pendingOut = m[1]; cur = null; continue }
      cur = null
      pendingOut = null
      continue
    }
    if (pendingOut) {
      const m = OUT_ADDR.exec(l)
      if (m) {
        cur = { name: pendingOut, origin: Number(m[1]), size: Number(m[2]), ...(m[3] ? { lma: Number(m[3]) } : {}) }
        sections.push(cur)
      }
      pendingOut = null
      continue
    }
    if (!cur) continue
    if (pendingIn) {
      const m = IN_ADDR.exec(l)
      if (m) {
        const size = Number(m[2])
        if (size > 0) inputs.push({ name: symbolFromSection(pendingIn, m[3]), section: pendingIn, size, file: m[3].trim(), address: Number(m[1]) })
      }
      pendingIn = null
      continue
    }
    let m = IN_FULL.exec(l)
    if (m && (m[1].startsWith('.') || m[1] === 'COMMON')) {
      const size = Number(m[3])
      if (size > 0) inputs.push({ name: symbolFromSection(m[1], m[4]), section: m[1], size, file: m[4].trim(), address: Number(m[2]) })
      continue
    }
    m = IN_NAME.exec(l)
    if (m && (m[1].startsWith('.') || m[1] === 'COMMON')) pendingIn = m[1]
  }
  return { regions, sections: sections.filter((s) => s.size > 0 && !NOT_IMAGE.test(s.name)), inputs }
}

export interface RegionUsage { name: string; origin: number; length: number; used: number; pct: number; overflow: boolean }

/** Использование областей: секция учитывается там, где лежит её адрес выполнения (VMA), а загружаемые данные (.data) — ещё и там, где адрес загрузки (LMA, обычно Flash). */
export function regionUsage(parsed: ParsedMap, regions: MapRegion[]): RegionUsage[] {
  const inRegion = (addr: number, r: MapRegion): boolean => addr >= r.origin && addr < r.origin + r.length
  return regions.map((r) => {
    let used = 0
    for (const s of parsed.sections) {
      if (inRegion(s.origin, r)) used += s.size
      // В карте ld у NOBITS-секций (.bss, куча и стек) тоже есть «load address», но во Flash они не записываются
      if (s.lma !== undefined && !NOBITS.test(s.name) && inRegion(s.lma, r)) used += s.size
    }
    return { name: r.name, origin: r.origin, length: r.length, used, pct: r.length ? Math.round((used / r.length) * 1000) / 10 : 0, overflow: used > r.length }
  })
}

/** Ответ интерфейса MapReport: секции с областями и самые большие символы. */
export function toMapReport(parsed: ParsedMap, regions: MapRegion[], top = 30): MapReport {
  const where = (addr: number, lma?: number): string | undefined =>
    (regions.find((r) => addr >= r.origin && addr < r.origin + r.length) ?? (lma !== undefined ? regions.find((r) => lma >= r.origin && lma < r.origin + r.length) : undefined))?.name
  const sections: MapSection[] = parsed.sections.map((s) => ({ name: s.name, origin: s.origin, size: s.size, region: where(s.origin, s.lma) }))
  const bySym = new Map<string, MapSymbol>()
  for (const s of parsed.inputs) {
    const sec = parsed.sections.find((o) => s.address >= o.origin && s.address < o.origin + o.size)
    if (!sec) continue
    const key = s.name + '|' + s.file
    const prev = bySym.get(key)
    if (prev) prev.size += s.size
    else bySym.set(key, { name: s.name, size: s.size, section: sec.name, file: s.file })
  }
  const topSymbols = [...bySym.values()].sort((a, b) => b.size - a.size).slice(0, top)
  return { sections, topSymbols }
}

/** Вывод `arm-none-eabi-size file.elf` (формат Berkeley): строка с text data bss dec hex filename. */
export function parseSizeOutput(text: string, totals: { flashTotal: number; ramTotal: number }): SizeReport | null {
  for (const l of text.split(/\r?\n/)) {
    const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+[0-9a-fA-F]+\s+\S/.exec(l)
    if (m) {
      const [t, d, b] = [Number(m[1]), Number(m[2]), Number(m[3])]
      return { textBytes: t, dataBytes: d, bssBytes: b, flashUsed: t + d, ramUsed: d + b, flashTotal: totals.flashTotal, ramTotal: totals.ramTotal }
    }
  }
  return null
}

const UNIT: Record<string, number> = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 }

/** Таблица «Memory region Used Size Region Size %age Used», которую печатает ld при -Wl,--print-memory-usage: имя области → занято байт. */
export function parseMemoryUsage(text: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const l of text.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_]\w*):\s+(\d+)\s+(B|KB|MB|GB)\s+(\d+)\s+(B|KB|MB|GB)\s+[0-9.]+%/.exec(l)
    if (m) out[m[1]] = Number(m[2]) * UNIT[m[3]]
  }
  return out
}
