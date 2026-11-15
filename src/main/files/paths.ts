// Чистые функции проверки путей и имён (без Electron — тестируются напрямую).
import { isAbsolute, relative, resolve, sep } from 'path'
import { SKETCH_NAME_RE } from './naming'

export { SKETCH_NAME_RE }

/** Лежит ли путь `p` внутри `root` (или совпадает с ним). Чисто лексическая проверка. */
export function isInside(root: string, p: string): boolean {
  if (typeof root !== 'string' || typeof p !== 'string' || !root || !p || p.includes('\0')) return false
  const rel = relative(resolve(root), resolve(p))
  if (rel === '') return true
  return rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel)
}

const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i

/** Имя одного файла/папки: без разделителей и запрещённых в Windows символов. */
export function isValidEntryName(name: unknown): name is string {
  if (typeof name !== 'string') return false
  if (name.length === 0 || name.length > 120) return false
  if (name === '.' || name === '..') return false
  if (/[\\/:*?"<>|\x00-\x1f]/.test(name)) return false
  if (/[. ]$/.test(name) || /^ /.test(name)) return false
  if (RESERVED.test(name)) return false
  return true
}

export const isSketchName = (s: unknown): s is string => typeof s === 'string' && SKETCH_NAME_RE.test(s)

/** Расширения, которые конструкторы могут записывать в папку скетча. */
export const SKETCH_FILE_EXTS = ['.h', '.hpp', '.c', '.cpp', '.ino', '.json', '.html', '.css', '.js', '.txt', '.md']

export function isSketchFileName(name: unknown): name is string {
  if (!isValidEntryName(name)) return false
  const i = name.lastIndexOf('.')
  return i > 0 && SKETCH_FILE_EXTS.includes(name.slice(i).toLowerCase())
}
