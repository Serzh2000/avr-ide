// Минимальный читатель zip (центральный каталог + deflate через zlib) — без зависимостей.
// Нужен, чтобы ДО установки проверить архив: нет ли подозрительных путей, раздутых размеров
// и есть ли внутри library.properties / заголовочные файлы.
import { inflateRawSync } from 'zlib'
import { parseProperties } from './props'

export interface ZipEntry {
  name: string
  method: number
  csize: number
  usize: number
  offset: number
}

export const MAX_ZIP_ENTRIES = 20_000
export const MAX_UNPACKED = 300 * 1024 * 1024

export function listZip(buf: Buffer): ZipEntry[] {
  // Конец центрального каталога ищем с хвоста (комментарий до 64 КБ)
  const min = Math.max(0, buf.length - 22 - 0xffff)
  let eocd = -1
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('Файл не похож на zip-архив.')
  const total = buf.readUInt16LE(eocd + 10)
  const cdSize = buf.readUInt32LE(eocd + 12)
  const cdOff = buf.readUInt32LE(eocd + 16)
  if (total === 0xffff || cdSize === 0xffffffff || cdOff === 0xffffffff) throw new Error('Архивы zip64 не поддерживаются (слишком большой).')
  if (total > MAX_ZIP_ENTRIES) throw new Error(`В архиве слишком много файлов (${total}).`)
  const out: ZipEntry[] = []
  let p = cdOff
  for (let i = 0; i < total; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Повреждён каталог zip-архива.')
    const flags = buf.readUInt16LE(p + 8)
    const method = buf.readUInt16LE(p + 10)
    const csize = buf.readUInt32LE(p + 20)
    const usize = buf.readUInt32LE(p + 24)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const offset = buf.readUInt32LE(p + 42)
    const name = buf.toString(flags & 0x800 ? 'utf8' : 'latin1', p + 46, p + 46 + nameLen)
    out.push({ name, method, csize, usize, offset })
    p += 46 + nameLen + extraLen + commentLen
  }
  return out
}

export function readEntry(buf: Buffer, e: ZipEntry, maxSize = 1024 * 1024): Buffer {
  if (e.usize > maxSize) throw new Error('Файл в архиве слишком большой.')
  if (buf.readUInt32LE(e.offset) !== 0x04034b50) throw new Error('Повреждён заголовок файла в zip.')
  const start = e.offset + 30 + buf.readUInt16LE(e.offset + 26) + buf.readUInt16LE(e.offset + 28)
  const raw = buf.subarray(start, start + e.csize)
  if (e.method === 0) return Buffer.from(raw)
  if (e.method === 8) return inflateRawSync(raw, { maxOutputLength: maxSize })
  throw new Error(`Неподдерживаемый способ сжатия (${e.method}).`)
}

export interface ZipInspection {
  ok: boolean
  /** Причина отказа (если ok = false) */
  error?: string
  warnings: string[]
  /** Содержимое library.properties (если найден) */
  props?: Record<string, string>
  hasProperties: boolean
  headers: number
  entries: number
  unpacked: number
}

const unsafeName = (n: string): boolean =>
  n.startsWith('/') || n.startsWith('\\') || /^[A-Za-z]:/.test(n) || n.split(/[\\/]/).includes('..') || n.includes('\u0000')

/** Проверяет архив библиотеки: безопасные пути, разумный размер, наличие library.properties / .h. */
export function inspectLibraryZip(buf: Buffer): ZipInspection {
  const res: ZipInspection = { ok: false, warnings: [], hasProperties: false, headers: 0, entries: 0, unpacked: 0 }
  let list: ZipEntry[]
  try { list = listZip(buf) } catch (e) { res.error = (e as Error).message; return res }
  res.entries = list.length
  let unpacked = 0
  let propEntry: ZipEntry | null = null
  for (const e of list) {
    if (unsafeName(e.name)) { res.error = `В архиве небезопасный путь «${e.name}».`; return res }
    unpacked += e.usize
    const parts = e.name.split('/').filter(Boolean)
    const base = parts[parts.length - 1] ?? ''
    if (/\.(h|hpp)$/i.test(base)) res.headers++
    if (base === 'library.properties' && parts.length <= 2 && (!propEntry || parts.length < propEntry.name.split('/').filter(Boolean).length)) propEntry = e
  }
  res.unpacked = unpacked
  if (unpacked > MAX_UNPACKED) { res.error = `Архив слишком велик после распаковки (${Math.round(unpacked / 1048576)} МБ).`; return res }
  if (propEntry) {
    res.hasProperties = true
    try { res.props = parseProperties(readEntry(buf, propEntry).toString('utf8')) } catch (e) { res.warnings.push('Не удалось прочитать library.properties: ' + (e as Error).message) }
  } else if (res.headers > 0) {
    res.warnings.push('В репозитории нет library.properties — это не библиотека в формате Arduino 1.5; arduino-cli может отказаться её ставить.')
  } else {
    res.error = 'В архиве нет ни library.properties, ни заголовочных файлов (.h) — это не библиотека Arduino.'
    return res
  }
  res.ok = true
  return res
}
