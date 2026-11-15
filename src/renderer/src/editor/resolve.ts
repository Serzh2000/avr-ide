// Связка редактора со справочником: фильтр по платформе, разбор сигнатур, строгий поиск записи по слову.
import type { FuncEntry } from '../reference/types'
import type { EditorPlatform } from './types'
import { OBJECT_ALIASES } from './constants'

const ESP32_FAMILY: EditorPlatform[] = ['esp32', 'esp32s3', 'esp32c3']

export function platformMatches(entry: FuncEntry, platform: EditorPlatform | null | undefined): boolean {
  if (!platform) return true
  if (entry.platforms.includes(platform)) return true
  return ESP32_FAMILY.includes(platform) && entry.platforms.includes('esp32')
}

/** Определение платформы по тексту скетча (если плата не выбрана). null — неизвестно. */
export function detectPlatform(code: string): EditorPlatform | null {
  if (/#\s*include\s*<\s*(ESP8266\w*|ESP8266WiFi|ESPAsyncTCP|ESP8266WebServer)\.h\s*>|ICACHE_RAM_ATTR|\bESP8266\b/.test(code)) return 'esp8266'
  if (/#\s*include\s*<\s*(WebServer|Preferences|ESPmDNS|SPIFFS|HTTPClient|esp_\w+|freertos\/\w+|AsyncTCP|WiFiClientSecure)\.h\s*>|\bIRAM_ATTR\b|\bledc(Attach|Setup|Write)\b|\bxTaskCreate\b|\bESP32\b/.test(code)) return 'esp32'
  if (/#\s*include\s*<\s*avr\//.test(code) || /\b(DDR[A-L]|PORT[A-L]|PIN[A-L]|TCCR\d[AB])\b/.test(code)) return 'avr'
  return null
}

/** Синтаксически допустимое имя для подстановки в код (отсекаем «ADC2 и WiFi», «TCCRnA/TCCRnB»). */
export function isCodeName(name: string): boolean {
  return /^[A-Za-z_]\w*(\.[A-Za-z_]\w*)?$/.test(name)
}

/** Список имён регистров из записей вида DDRx/PORTx/PINx (по перечислению в сигнатуре). */
export function expandRegisterNames(e: FuncEntry): string[] {
  if (!/x$/.test(e.name) || !/^[A-Z]+x$/.test(e.name)) return []
  const base = e.name.slice(0, -1)
  const re = new RegExp(`\\b${base}[A-L]\\b`, 'g')
  return Array.from(new Set(e.signature.match(re) ?? []))
}

export interface ParsedSignature {
  /** Текст параметров как в сигнатуре. */
  params: string[]
  /** Есть ли вообще скобки (функция, а не константа/класс). */
  hasParens: boolean
}

/** Разбор «void digitalWrite(uint8_t pin, uint8_t val)» -> параметры. */
export function parseSignature(signature: string): ParsedSignature {
  const open = signature.indexOf('(')
  if (open < 0) return { params: [], hasParens: false }
  let depth = 0
  let end = -1
  for (let i = open; i < signature.length; i++) {
    const c = signature[i]
    if (c === '(' || c === '<' || c === '[') depth++
    else if (c === ')' || c === '>' || c === ']') {
      depth--
      if (depth === 0 && c === ')') {
        end = i
        break
      }
    }
  }
  if (end < 0) end = signature.length
  const inner = signature.slice(open + 1, end)
  const params: string[] = []
  let cur = ''
  depth = 0
  for (const c of inner) {
    if (c === '(' || c === '<' || c === '[') depth++
    else if (c === ')' || c === '>' || c === ']') depth--
    if (c === ',' && depth === 0) {
      params.push(cur.trim())
      cur = ''
    } else cur += c
  }
  if (cur.trim()) params.push(cur.trim())
  return { params, hasParens: true }
}

/** Монако-сниппет для вызова: имя(${1:пин}, ${2:режим}). Экранирует служебные символы. */
export function callSnippet(e: FuncEntry, member: string): string {
  const parsed = parseSignature(e.signature)
  if (!parsed.hasParens) return escapeSnippet(member)
  // имена берём из params справочника; если пусто — из сигнатуры (последнее слово)
  const names =
    e.params.length > 0
      ? e.params.map((p) => p.name)
      : parsed.params.map((p) => (/([A-Za-z_]\w*)\s*(?:=.*)?$/.exec(p)?.[1] ?? p))
  const clean = names.filter((n) => /^[A-Za-z_]\w*$/.test(n))
  if (clean.length === 0) return `${escapeSnippet(member)}($0)`
  return `${escapeSnippet(member)}(${clean.map((n, i) => `\${${i + 1}:${n}}`).join(', ')})`
}

export function escapeSnippet(s: string): string {
  return s.replace(/[$}\\]/g, '\\$&')
}

function lastSegment(name: string): string {
  const i = name.lastIndexOf('.')
  return name.slice(i + 1)
}

function pickByPlatform(list: FuncEntry[], platform: EditorPlatform | null | undefined): FuncEntry | undefined {
  return list.find((e) => platformMatches(e, platform)) ?? list[0]
}

/**
 * Строгий поиск записи справочника для слова под курсором.
 * qualifier — слово перед точкой (`Serial` в `Serial.println`); varTypes — типы переменных файла.
 * Без совпадения возвращает undefined (никаких «похожих» — чтобы не показывать подсказки не к месту).
 */
export function findEntry(
  entries: FuncEntry[],
  word: string,
  opts: { qualifier?: string | null; varTypes?: Record<string, string>; platform?: EditorPlatform | null } = {}
): FuncEntry | undefined {
  const w = word.trim()
  if (!w) return undefined
  const { qualifier, varTypes, platform } = opts
  if (qualifier) {
    const cands = [qualifier, OBJECT_ALIASES[qualifier], varTypes?.[qualifier]].filter((x): x is string => !!x)
    for (const c of cands) {
      const hit = pickByPlatform(
        entries.filter((e) => e.name === `${c}.${w}`),
        platform
      )
      if (hit) return hit
    }
    return undefined
  }
  const exact = pickByPlatform(
    entries.filter((e) => e.name === w),
    platform
  )
  if (exact) return exact
  // регистры DDRB -> DDRx
  const reg = entries.find((e) => expandRegisterNames(e).includes(w))
  if (reg) return reg
  return pickByPlatform(
    entries.filter((e) => !e.name.includes('.') && e.aliases?.includes(w)),
    platform
  )
}

/** Для «Справка»: слово, которое передаётся в onOpenReference. Для члена объекта — «Serial.println», если известно. */
export function referenceQuery(word: string, qualifier: string | null | undefined, varTypes: Record<string, string> | undefined): string {
  if (!qualifier) return word
  const q = OBJECT_ALIASES[qualifier] ?? varTypes?.[qualifier] ?? qualifier
  return `${q}.${word}`
}

export { lastSegment }
