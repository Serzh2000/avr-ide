import { parseDocument } from 'yaml'
import { isLibName } from '../cli/validate'

export interface DependencyLibrary {
  name: string
  version: string
  architectures: string[]
  providesIncludes?: string[]
}
export interface DependencyRequest { name: string; version?: string }
export interface DependencyChoice { header: string; libraries: DependencyRequest[] }
export interface DependencyPlan {
  install: DependencyRequest[]
  choose: DependencyChoice[]
  unknown: string[]
  conflicts: string[]
  needsIndex: boolean
  profile?: string
}

// У распространённых библиотек это публичный основной заголовок, даже если автор
// не заполнил необязательное providesIncludes. Это не нечёткий поиск по имени.
const PRIMARY: Readonly<Record<string, string>> = {
  'ArduinoJson.h': 'ArduinoJson',
  'DHT.h': 'DHT sensor library',
  'Adafruit_Sensor.h': 'Adafruit Unified Sensor',
  'Adafruit_GFX.h': 'Adafruit GFX Library',
  'Adafruit_SSD1306.h': 'Adafruit SSD1306',
  'Adafruit_NeoPixel.h': 'Adafruit NeoPixel',
  'FastLED.h': 'FastLED',
  'PubSubClient.h': 'PubSubClient',
  'SD.h': 'SD',
  'Servo.h': 'Servo',
  'ESP32Servo.h': 'ESP32Servo',
  'ESPUI.h': 'ESPUI',
  'ESPAsyncWebServer.h': 'ESP Async WebServer',
  'AsyncTCP.h': 'Async TCP',
  'ESPAsyncTCP.h': 'ESP Async TCP',
  'RPAsyncTCP.h': 'RPAsyncTCP',
  'WiFiEspAT.h': 'WiFiEspAT'
}

export function dependencyArgument({ name, version }: DependencyRequest): string {
  return version ? `${name}@${version}` : name
}

/** Профиль Arduino CLI использует отдельный кеш; не смешиваем его с глобальными библиотеками. */
export function defaultProfile(text: string): string | undefined {
  const doc = parseDocument(text, { schema: 'failsafe', strict: true })
  if (doc.errors.length) throw new Error('Не удалось разобрать sketch.yaml.')
  const profile = doc.get('default_profile')
  return typeof profile === 'string' && profile.trim() ? profile.trim().slice(0, 100) : undefined
}

export const LIBRARY_MANIFEST = 'avr-ide-libraries.json'

export function declaredDependencies(text: string): DependencyRequest[] {
  const config = JSON.parse(text.replace(/^\uFEFF/, '')) as { libraries?: unknown } | null
  if (!Array.isArray(config?.libraries) || config.libraries.length > 20 || !config.libraries.every(isLibName)) {
    throw new Error(`В ${LIBRARY_MANIFEST} нужен массив libraries (до 20 имён или Имя@версия из реестра Arduino).`)
  }
  return config.libraries.map((entry: string) => {
    const [name, version] = entry.split('@')
    return { name, version }
  })
}

/** Для автоматической установки учитываем только безусловные директивы, не ветки #if. */
export function directHeaders(code: string): string[] {
  const found = new Set<string>()
  const lines = code.replace(/\\\r?\n/g, '').replace(
    /\/\*[^]*?(?:\*\/|$)|\/\/[^\r\n]*|R"([^\s()\\]{0,16})\([^]*?(?:\)\1"|$)|"(?:\\[^\r\n]|[^"\\\r\n])*"|'(?:\\[^\r\n]|[^'\\\r\n])*'/g,
    (m) => m.startsWith('"') || m.startsWith("'") ? m : m.replace(/[^\r\n]/g, ' ')
  )
    .split(/\r?\n/)
  const directives = lines.filter((line) => line.trim() && !line.trimStart().startsWith('//'))
  const guard = /^#\s*ifndef\s+(\w+)\s*(?:\/\/.*)?$/.exec(directives[0]?.trim() ?? '')?.[1]
  const guardDepth = guard && new RegExp(`^#\\s*define\\s+${guard}\\b`).test(directives[1]?.trim() ?? '') ? 1 : 0
  let depth = 0
  let first = true
  let outerGuard = false
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('//')) continue
    if (first) { outerGuard = guardDepth === 1; first = false }
    if (/^#\s*if(n?def)?\b/.test(line)) { depth++; continue }
    if (/^#\s*endif\b/.test(line)) {
      if (depth === 1) outerGuard = false
      depth = Math.max(0, depth - 1)
      continue
    }
    if (outerGuard && depth === 1 && /^#\s*el(?:se|if)\b/.test(line)) outerGuard = false
    if (depth !== (outerGuard ? 1 : 0)) continue
    const header = /^#\s*include\s*(?:<([A-Za-z0-9_.+-]{1,100}\.h(?:pp|h|xx)?)>|"([A-Za-z0-9_.+-]{1,100}\.h(?:pp|h|xx)?)")/.exec(line)
    if (header) found.add(header[1] ?? header[2])
  }
  return [...found].slice(0, 100)
}

const BUILT_INS = /^(?:Arduino|HardwareSerial|SoftwareSerial|Wire|SPI|EEPROM|WiFi|WiFiClient|WiFiServer|WiFiUdp|WiFiClientSecure|Client|Server|Stream|Print|String|FS|ESP8266WiFi|HTTPClient|WebServer|USB|LittleFS|SPIFFS|pgmspace|Preferences|Update|ESPmDNS|ArduinoOTA|DNSServer|Ticker|Esp|IPAddress|Udp|Wire1|ui_generated|web_generated)\.h$/i
// Стандартные C/C++ заголовки и заголовки SDK платы: их не нужно искать в реестре библиотек.
const SYSTEM = /^(?:assert|ctype|errno|float|inttypes|limits|math|setjmp|signal|stdarg|stdbool|stddef|stdint|stdio|stdlib|string|strings|time|wchar|stdlib_noniso|cmath|cstdint|cstdlib|cstring|cstdio|esp_[\w]*|esp32-hal[\w-]*|soc|driver|freertos|nvs[\w]*|lwip|rom|hal[\w]*|pico[\w]*|hardware_[\w]*)\.h(?:pp)?$/i
const nameKey = (name: string): string => name.toLowerCase()
const compatible = (lib: DependencyLibrary, arch: string): boolean =>
  lib.architectures.some((a) => a === '*' || a.toLowerCase() === arch.toLowerCase())
const versions = new Intl.Collator('en', { numeric: true })
const compareVersion = (a: string, b: string): number =>
  Number(b.includes('-')) - Number(a.includes('-')) || versions.compare(a, b)

export function resolveDependencyPlan(input: {
  headers: string[]; availableHeaders: ReadonlySet<string>; installed: ReadonlyMap<string, string>
  declared: DependencyRequest[]; index: DependencyLibrary[] | null; arch: string
  /** Индекс неполный (только встроенные библиотеки): то, чего в нём нет, ещё может быть в реестре. */
  partial?: boolean
}): DependencyPlan {
  const { headers, availableHeaders, installed, declared, index, arch, partial } = input
  const plan: DependencyPlan = { install: [], choose: [], unknown: [], conflicts: [], needsIndex: false }
  const selected = new Map<string, DependencyRequest>()
  const seenDeclared = new Map<string, DependencyRequest>()
  const mismatches = new Set<string>()
  for (const dep of declared) {
    const key = nameKey(dep.name)
    const prior = seenDeclared.get(key)
    if (prior && prior.version !== dep.version) mismatches.add(key)
    seenDeclared.set(key, dep)
  }
  const active = (index ?? []).filter((l) => compatible(l, arch))
  for (const [key, dep] of seenDeclared) {
    if (mismatches.has(key)) { plan.conflicts.push(`${dep.name}: в манифесте указаны разные версии.`); continue }
    const have = installed.get(key)
    if (have !== undefined) {
      if (dep.version && have !== dep.version) plan.conflicts.push(`${dep.name}: установлена ${have || 'неизвестная версия'}, проекту нужна ${dep.version}.`)
      continue
    }
    if (!index) { plan.needsIndex = true; continue }
    const match = active.filter((l) => nameKey(l.name) === key && (!dep.version || l.version === dep.version))
      .sort((a, b) => compareVersion(b.version, a.version))[0]
    if (match) selected.set(key, { name: match.name, version: match.version })
    else if (partial) plan.needsIndex = true
    else plan.conflicts.push(`${dependencyArgument(dep)}: нет совместимой версии в реестре Arduino.`)
  }
  const includes = new Set(headers)
  // TCP-transport выбирается по архитектуре и не везде описан в depends библиотеки.
  // ESPUI строится поверх ESP Async WebServer, хотя в метаданных библиотеки это не объявлено.
  if (includes.has('ESPUI.h')) includes.add('ESPAsyncWebServer.h')
  if (includes.has('ESPUI.h') || includes.has('ESPAsyncWebServer.h')) {
    if (arch === 'esp32') includes.add('AsyncTCP.h')
    else if (arch === 'esp8266') includes.add('ESPAsyncTCP.h')
    else if (arch === 'rp2040' || arch === 'rp2350') includes.add('RPAsyncTCP.h')
  }
  for (const header of includes) {
    if (availableHeaders.has(header) || BUILT_INS.test(header) || SYSTEM.test(header)) continue
    if (!index) { plan.needsIndex = true; continue }
    const primary = Object.hasOwn(PRIMARY, header) ? PRIMARY[header] : undefined
    const candidates = new Map<string, DependencyLibrary>()
    for (const l of active) {
      if (l.name !== primary && !l.providesIncludes?.includes(header)) continue
      const key = nameKey(l.name)
      const prev = candidates.get(key)
      if (isLibName(l.name) && !l.name.includes('@') && (!prev || compareVersion(l.version, prev.version) > 0)) candidates.set(key, l)
    }
    const matches = [...candidates.entries()]
    if (matches.some(([key]) => selected.has(key) || seenDeclared.has(key))) continue
    if (matches.length > 1) plan.choose.push({ header, libraries: matches.map(([, lib]) => ({ name: lib.name, version: lib.version })).sort((a, b) => a.name.localeCompare(b.name)) })
    else if (matches.length === 1) {
      const [key, lib] = matches[0]
      if (!installed.has(key)) selected.set(key, { name: lib.name, version: lib.version })
      else plan.conflicts.push(`${header}: установлена ${lib.name}, но её заголовок не найден для выбранной платы.`)
    } else if (partial) plan.needsIndex = true
    else plan.unknown.push(header)
  }
  plan.install = [...selected.values()].slice(0, 20)
  if (selected.size > plan.install.length) plan.conflicts.push('За один проход устанавливается не больше 20 библиотек.')
  return plan
}
