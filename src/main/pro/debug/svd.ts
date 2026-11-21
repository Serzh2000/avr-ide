// Разбор файлов SVD (CMSIS-SVD): периферия → регистры → поля. Свой небольшой XML-разборщик (без зависимостей), чистый код.
// Поддержано: derivedFrom для периферии и регистров, dim/dimIncrement/dimIndex, bitOffset+bitWidth / bitRange / lsb+msb, enumeratedValues, cluster (плоско).

export interface SvdEnum { name: string; value: number; description?: string }
export interface SvdField { name: string; bitOffset: number; bitWidth: number; description?: string; access?: string; enums: SvdEnum[] }
export interface SvdRegister { name: string; offset: number; size: number; access?: string; resetValue?: number; description?: string; fields: SvdField[] }
export interface SvdPeripheral { name: string; base: number; description?: string; group?: string; registers: SvdRegister[] }
export interface SvdDevice { name: string; peripherals: SvdPeripheral[] }

// ---------- минимальный XML ----------
interface XNode { tag: string; attrs: Record<string, string>; kids: XNode[]; text: string }

const ENT: Record<string, string> = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&apos;': "'" }
const unent = (s: string): string => s.replace(/&(lt|gt|amp|quot|apos);|&#(\d+);|&#x([0-9a-f]+);/gi, (m, _n, d, h) => (d ? String.fromCodePoint(Number(d)) : h ? String.fromCodePoint(parseInt(h, 16)) : ENT[m] ?? m))

export function parseXml(src: string): XNode {
  const root: XNode = { tag: '#root', attrs: {}, kids: [], text: '' }
  const stack: XNode[] = [root]
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([^\s>]+)\s*>|<([^\s/>!?]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    const top = stack[stack.length - 1]
    if (m[1] !== undefined) top.text += m[1]
    else if (m[2]) { if (stack.length > 1) stack.pop() }
    else if (m[3]) {
      const n: XNode = { tag: m[3], attrs: {}, kids: [], text: '' }
      for (const a of m[4].matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) n.attrs[a[1]] = unent(a[2] ?? a[3] ?? '')
      top.kids.push(n)
      if (!m[5]) stack.push(n)
    } else if (m[6] !== undefined) top.text += unent(m[6])
  }
  return root.kids[0] ?? root
}

const child = (n: XNode, tag: string): XNode | undefined => n.kids.find((k) => k.tag === tag)
const text = (n: XNode, tag: string): string | undefined => { const c = child(n, tag); return c ? c.text.trim().replace(/\s+/g, ' ') : undefined }

export function parseSvdNumber(s: string | undefined): number | undefined {
  if (s === undefined) return undefined
  const t = s.trim()
  if (/^0x[0-9a-f]+$/i.test(t)) return Number(t)
  if (/^#[01]+$/.test(t)) return parseInt(t.slice(1), 2)
  if (/^[0-9]+$/.test(t)) return Number(t)
  return undefined
}

function dimNames(n: XNode, name: string): { name: string; add: number }[] {
  const dim = parseSvdNumber(text(n, 'dim'))
  if (!dim || !name.includes('%s') && !name.includes('[%s]')) return [{ name, add: 0 }]
  const inc = parseSvdNumber(text(n, 'dimIncrement')) ?? 0
  const idxText = text(n, 'dimIndex')
  let idx: string[]
  if (idxText && /^\d+-\d+$/.test(idxText)) { const [a, b] = idxText.split('-').map(Number); idx = Array.from({ length: b - a + 1 }, (_, i) => String(a + i)) }
  else if (idxText) idx = idxText.split(',').map((x) => x.trim())
  else idx = Array.from({ length: dim }, (_, i) => String(i))
  return idx.slice(0, dim).map((v, i) => ({ name: name.replace('[%s]', v).replace('%s', v), add: i * inc }))
}

function fieldOf(f: XNode): SvdField | null {
  const name = text(f, 'name')
  if (!name) return null
  let off = parseSvdNumber(text(f, 'bitOffset'))
  let width = parseSvdNumber(text(f, 'bitWidth'))
  const range = text(f, 'bitRange')
  if (range) { const m = /^\[(\d+):(\d+)\]$/.exec(range); if (m) { off = Number(m[2]); width = Number(m[1]) - Number(m[2]) + 1 } }
  const lsb = parseSvdNumber(text(f, 'lsb')); const msb = parseSvdNumber(text(f, 'msb'))
  if (lsb !== undefined && msb !== undefined) { off = lsb; width = msb - lsb + 1 }
  if (off === undefined) return null
  const enums: SvdEnum[] = []
  const ev = child(f, 'enumeratedValues')
  if (ev) for (const e of ev.kids.filter((k) => k.tag === 'enumeratedValue')) {
    const en = text(e, 'name'); const v = parseSvdNumber(text(e, 'value'))
    if (en && v !== undefined) enums.push({ name: en, value: v, description: text(e, 'description') })
  }
  return { name, bitOffset: off, bitWidth: width ?? 1, description: text(f, 'description'), access: text(f, 'access'), enums }
}

function registersOf(parent: XNode, defaults: { size: number; access?: string }, prefix = '', baseOff = 0): SvdRegister[] {
  const out: SvdRegister[] = []
  const container = child(parent, 'registers') ?? parent
  const regs = container.kids.filter((k) => k.tag === 'register')
  const byName = new Map<string, SvdRegister>()
  const build = (r: XNode): SvdRegister[] => {
    const nameRaw = text(r, 'name')
    if (!nameRaw) return []
    const from = r.attrs['derivedFrom'] ? byName.get(r.attrs['derivedFrom'].split('.').pop()!) : undefined
    const offs = parseSvdNumber(text(r, 'addressOffset')) ?? 0
    const size = parseSvdNumber(text(r, 'size')) ?? from?.size ?? defaults.size
    const fields = child(r, 'fields')?.kids.filter((k) => k.tag === 'field').map(fieldOf).filter((f): f is SvdField => !!f) ?? from?.fields ?? []
    return dimNames(r, nameRaw).map((d) => ({
      name: prefix + d.name, offset: baseOff + offs + d.add, size,
      access: text(r, 'access') ?? from?.access ?? defaults.access,
      resetValue: parseSvdNumber(text(r, 'resetValue')) ?? from?.resetValue,
      description: text(r, 'description') ?? from?.description, fields
    }))
  }
  for (const r of regs) for (const x of build(r)) { out.push(x); byName.set(x.name.slice(prefix.length), x) }
  for (const c of container.kids.filter((k) => k.tag === 'cluster')) {
    const cn = text(c, 'name') ?? ''
    const co = parseSvdNumber(text(c, 'addressOffset')) ?? 0
    for (const d of dimNames(c, cn)) out.push(...registersOf(c, defaults, prefix + d.name + '_', baseOff + co + d.add))
  }
  return out
}

export function parseSvd(xml: string): SvdDevice {
  const dev = parseXml(xml)
  if (dev.tag !== 'device') throw new Error('Это не файл SVD: нет элемента <device>.')
  const defaults = { size: parseSvdNumber(text(dev, 'size')) ?? 32, access: text(dev, 'access') }
  const pnodes = child(dev, 'peripherals')?.kids.filter((k) => k.tag === 'peripheral') ?? []
  const done = new Map<string, SvdPeripheral>()
  const list: SvdPeripheral[] = []
  // сначала те, что без derivedFrom: база нужна раньше производных
  const order = [...pnodes.filter((p) => !p.attrs['derivedFrom']), ...pnodes.filter((p) => p.attrs['derivedFrom'])]
  for (const p of order) {
    const name = text(p, 'name')
    const base = parseSvdNumber(text(p, 'baseAddress'))
    if (!name || base === undefined) continue
    const from = p.attrs['derivedFrom'] ? done.get(p.attrs['derivedFrom']) : undefined
    const dflt = { size: parseSvdNumber(text(p, 'size')) ?? defaults.size, access: text(p, 'access') ?? defaults.access }
    const regs = child(p, 'registers') ? registersOf(p, dflt) : from?.registers ?? []
    for (const d of dimNames(p, name)) {
      const per: SvdPeripheral = { name: d.name, base: base + d.add, description: text(p, 'description') ?? from?.description, group: text(p, 'groupName') ?? from?.group, registers: regs }
      done.set(d.name, per)
      list.push(per)
    }
  }
  list.sort((a, b) => a.base - b.base || a.name.localeCompare(b.name))
  return { name: text(dev, 'name') ?? '', peripherals: list }
}

/** Значение поля из значения регистра. */
export function fieldValue(reg: number, f: Pick<SvdField, 'bitOffset' | 'bitWidth'>): number {
  const mask = f.bitWidth >= 32 ? 0xffffffff : (2 ** f.bitWidth) - 1
  return Math.floor(reg / 2 ** f.bitOffset) % (mask + 1)
}

/** Значение регистра с новым значением поля. */
export function withField(reg: number, f: Pick<SvdField, 'bitOffset' | 'bitWidth'>, v: number): number {
  const width = Math.min(f.bitWidth, 32)
  const mask = (2 ** width) - 1
  const cur = fieldValue(reg, f)
  return (reg + (Math.min(v, mask) - cur) * 2 ** f.bitOffset) >>> 0
}

export const isWritable = (access?: string): boolean => !access || /write|read-write/i.test(access) && !/^read-only$/i.test(access)
