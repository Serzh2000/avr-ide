// Чтение и аккуратная правка sketch.yaml (формат arduino-cli: default_fqbn, default_port).
// Чистые функции без Electron и файловой системы — тестируются напрямую.

import { isFqbn } from '../cli/fqbn'

export const SKETCH_YAML = 'sketch.yaml'

const PORT_RE = /^[A-Za-z0-9_./:\\-]{1,100}$/

export { isFqbn }
export const isPortName = (s: unknown): s is string => typeof s === 'string' && PORT_RE.test(s)

export interface SketchConfig {
  fqbn: string | null
  port: string | null
}

/** Значение скаляра YAML: без комментария в конце и без кавычек. */
function scalar(raw: string): string {
  const v = raw.trim()
  const q = v[0]
  if (q === '"' || q === "'") {
    const end = v.indexOf(q, 1)
    return end > 0 ? v.slice(1, end) : v.slice(1)
  }
  const hash = v.search(/\s#/)
  return (hash >= 0 ? v.slice(0, hash) : v).trim()
}

const keyRe = (key: string): RegExp => new RegExp('^' + key + '[ \\t]*:(.*)$')

/** Находит верхнеуровневую строку «key: …»; вложенные (с отступом) игнорируются. */
function findKey(lines: string[], key: string): number {
  const re = keyRe(key)
  return lines.findIndex((l) => re.test(l))
}

export function parseSketchYaml(text: string): SketchConfig {
  const lines = String(text ?? '').replace(/^﻿/, '').split(/\r?\n/)
  const read = (key: string): string | null => {
    const i = findKey(lines, key)
    if (i < 0) return null
    const v = scalar(keyRe(key).exec(lines[i])![1])
    return v || null
  }
  const fqbn = read('default_fqbn')
  const port = read('default_port')
  return { fqbn: isFqbn(fqbn) ? fqbn : null, port: isPortName(port) ? port : null }
}

/** Arduino CLI может сам выбрать порт по этим ключам при отсутствии --port. */
export function hasUploadDefaults(text: string): boolean {
  return text.split(/\r?\n/).some((line) => !/^\s*#/.test(line) && /\bdefault_(?:port|profile)\b/.test(line))
}

const fmtPort = (p: string): string => (/[:\\]/.test(p) ? `'${p}'` : p)

/**
 * Меняет default_fqbn / default_port, не трогая остальные строки и комментарии.
 * Поле в patch: строка — записать, null — удалить, undefined — не менять.
 */
export function updateSketchYaml(text: string, patch: { fqbn?: string | null; port?: string | null }): string {
  if (patch.fqbn != null && !isFqbn(patch.fqbn)) throw new Error('Недопустимый идентификатор платы.')
  if (patch.port != null && !isPortName(patch.port)) throw new Error('Недопустимое имя порта.')
  const src = String(text ?? '').replace(/^﻿/, '')
  const eol = src.includes('\r\n') ? '\r\n' : '\n'
  const lines = src === '' ? [] : src.split(/\r?\n/)
  if (lines.length && lines[lines.length - 1] === '') lines.pop()

  const apply = (key: string, value: string | null | undefined): void => {
    if (value === undefined) return
    const i = findKey(lines, key)
    if (value === null) {
      if (i >= 0) lines.splice(i, 1)
      return
    }
    const line = `${key}: ${key === 'default_port' ? fmtPort(value) : value}`
    if (i >= 0) lines[i] = line
    else lines.push(line)
  }
  apply('default_fqbn', patch.fqbn)
  apply('default_port', patch.port)
  return lines.length ? lines.join(eol) + eol : ''
}

/** Содержимое нового sketch.yaml. */
export function buildSketchYaml(fqbn: string, port?: string | null): string {
  return updateSketchYaml('', { fqbn, port: port ?? undefined })
}
