// Проверка avride.project.json: возвращает нормализованный проект либо список понятных ошибок (по-русски, с путём к полю).
import { CORE_KINDS, DEBUG_LEVELS, FLOAT_ABIS, FPU_KINDS, OPTIMIZATIONS, PROGRAMMER_KINDS, SCHEMA_VERSION } from './types'
import type { BuildConfiguration, Issue, MemoryRegion, NamedMemoryRegion, ProProject, ProTarget } from './types'

export type ValidationResult =
  | { ok: true; project: ProProject; warnings: Issue[] }
  | { ok: false; errors: Issue[]; warnings: Issue[] }

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)

const HEX = /^0x[0-9a-fA-F]{1,8}$/
const NAME = /^[A-Za-z0-9_][A-Za-z0-9_-]{0,62}$/
const CHIP = /^[A-Za-z][A-Za-z0-9]{2,31}$/
const DEFINE = /^[A-Za-z_][A-Za-z0-9_]*(=.*)?$/
const CONFIG_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/

/** Относительный путь внутри проекта: без «..», диска и начального «/», разделитель — «/». */
export function isProjectPath(p: string): boolean {
  if (!p || p.length > 260 || p.includes('\\') || p.includes('\0')) return false
  if (p.startsWith('/') || /^[A-Za-z]:/.test(p)) return false
  return !p.split('/').some((s) => s === '..' || s === '' || s === '.')
}

class Ctx {
  errors: Issue[] = []
  warnings: Issue[] = []
  err(path: string, message: string): void { this.errors.push({ path, message }) }
  warn(path: string, message: string): void { this.warnings.push({ path, message }) }
  unknownKeys(o: Rec, known: readonly string[], path: string): void {
    for (const k of Object.keys(o)) if (!known.includes(k)) this.warn(path ? `${path}.${k}` : k, 'Неизвестное поле — игнорируется.')
  }
}

const sub = (path: string, key: string): string => (path ? `${path}.${key}` : key)

function str(c: Ctx, o: Rec, key: string, path: string, re?: RegExp, what = 'строка'): string | undefined {
  const v = o[key]
  const p = sub(path, key)
  if (v === undefined) { c.err(p, 'Обязательное поле не задано.'); return undefined }
  if (typeof v !== 'string' || !v.trim()) { c.err(p, `Ожидается ${what}.`); return undefined }
  if (re && !re.test(v)) { c.err(p, `Недопустимое значение «${v}».`); return undefined }
  return v
}
function optStr(c: Ctx, o: Rec, key: string, path: string, re?: RegExp): string | undefined {
  return o[key] === undefined ? undefined : str(c, o, key, path, re)
}
function oneOf<T extends string>(c: Ctx, v: unknown, list: readonly T[], p: string): T | undefined {
  if (typeof v === 'string' && (list as readonly string[]).includes(v)) return v as T
  c.err(p, `Допустимые значения: ${list.join(', ')}.`)
  return undefined
}
function pathStr(c: Ctx, v: unknown, p: string): string | undefined {
  if (typeof v !== 'string' || !isProjectPath(v)) {
    c.err(p, 'Нужен относительный путь внутри проекта с разделителем «/», без «..» (например, src/main.c).')
    return undefined
  }
  return v
}
function pathList(c: Ctx, o: Rec, key: string, path: string, required: boolean): string[] {
  const v = o[key]
  const p = sub(path, key)
  if (v === undefined) { if (required) c.err(p, 'Обязательное поле не задано.'); return [] }
  if (!Array.isArray(v)) { c.err(p, 'Ожидается список путей.'); return [] }
  const out: string[] = []
  v.forEach((x, i) => { const s = pathStr(c, x, `${p}[${i}]`); if (s !== undefined) out.push(s) })
  return out
}
function strList(c: Ctx, o: Rec, key: string, path: string, re?: RegExp): string[] {
  const v = o[key]
  const p = sub(path, key)
  if (v === undefined) return []
  if (!Array.isArray(v)) { c.err(p, 'Ожидается список строк.'); return [] }
  const out: string[] = []
  v.forEach((x, i) => {
    if (typeof x !== 'string' || !x.trim()) c.err(`${p}[${i}]`, 'Ожидается непустая строка.')
    else if (re && !re.test(x)) c.err(`${p}[${i}]`, `Недопустимое значение «${x}».`)
    else out.push(x)
  })
  return out
}
function posInt(c: Ctx, v: unknown, p: string): number | undefined {
  if (typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= 0xffffffff) return v
  c.err(p, 'Ожидается целое положительное число.')
  return undefined
}

function region(c: Ctx, v: unknown, p: string, allowName = false): MemoryRegion | undefined {
  if (!isRec(v)) { c.err(p, 'Ожидается объект {origin, size}.'); return undefined }
  c.unknownKeys(v, allowName ? ['origin', 'size', 'name'] : ['origin', 'size'], p)
  const o = v['origin']
  const origin = typeof o === 'string' && HEX.test(o) ? o : (c.err(`${p}.origin`, 'Адрес в виде «0x08000000».'), undefined)
  const size = posInt(c, v['size'], `${p}.size`)
  if (origin === undefined || size === undefined) return undefined
  if (parseInt(origin, 16) + size > 0x100000000) { c.err(p, 'Область выходит за пределы 32-битного адресного пространства.'); return undefined }
  return { origin, size }
}

function target(c: Ctx, v: unknown): ProTarget | undefined {
  if (!isRec(v)) { c.err('target', 'Обязательный раздел не задан.'); return undefined }
  c.unknownKeys(v, ['vendor', 'family', 'chip', 'board', 'core', 'fpu', 'floatAbi', 'clock', 'memory'], 'target')
  if (v['vendor'] !== 'st') c.err('target.vendor', 'Поддерживается только vendor «st».')
  const family = str(c, v, 'family', 'target', CHIP)
  const chip = str(c, v, 'chip', 'target', CHIP)
  const board = optStr(c, v, 'board', 'target')
  const core = oneOf(c, v['core'], CORE_KINDS, 'target.core')
  const fpu = v['fpu'] === undefined ? undefined : oneOf(c, v['fpu'], FPU_KINDS, 'target.fpu')
  const floatAbi = v['floatAbi'] === undefined ? undefined : oneOf(c, v['floatAbi'], FLOAT_ABIS, 'target.floatAbi')
  let clock: ProTarget['clock']
  if (v['clock'] !== undefined) {
    const k = v['clock']
    if (!isRec(k)) c.err('target.clock', 'Ожидается объект {hseHz, sysclkHz}.')
    else {
      c.unknownKeys(k, ['hseHz', 'sysclkHz'], 'target.clock')
      clock = {}
      if (k['hseHz'] !== undefined) { const n = posInt(c, k['hseHz'], 'target.clock.hseHz'); if (n !== undefined) clock.hseHz = n }
      if (k['sysclkHz'] !== undefined) { const n = posInt(c, k['sysclkHz'], 'target.clock.sysclkHz'); if (n !== undefined) clock.sysclkHz = n }
    }
  }
  let memory: ProTarget['memory'] | undefined
  const m = v['memory']
  if (!isRec(m)) c.err('target.memory', 'Обязательный раздел {flash, ram} не задан.')
  else {
    c.unknownKeys(m, ['flash', 'ram', 'extra'], 'target.memory')
    const flash = region(c, m['flash'], 'target.memory.flash')
    const ram = region(c, m['ram'], 'target.memory.ram')
    let extra: NamedMemoryRegion[] | undefined
    if (m['extra'] !== undefined) {
      if (!Array.isArray(m['extra'])) c.err('target.memory.extra', 'Ожидается список областей.')
      else {
        extra = []
        m['extra'].forEach((x, i) => {
          const p = `target.memory.extra[${i}]`
          const r = region(c, x, p, true)
          const nm = isRec(x) ? x['name'] : undefined
          const name = typeof nm === 'string' && NAME.test(nm) ? nm : (c.err(`${p}.name`, 'Нужно имя области (латиница, цифры, «_»).'), undefined)
          if (r && name) extra!.push({ name, ...r })
        })
      }
    }
    if (flash && ram) memory = { flash, ram, ...(extra ? { extra } : {}) }
  }
  if (!family || !chip || !core || !memory || v['vendor'] !== 'st') return undefined
  return { vendor: 'st', family, chip, ...(board ? { board } : {}), core, ...(fpu ? { fpu } : {}), ...(floatAbi ? { floatAbi } : {}), ...(clock ? { clock } : {}), memory }
}

function config(c: Ctx, v: unknown, p: string): BuildConfiguration | undefined {
  if (!isRec(v)) { c.err(p, 'Ожидается объект {optimization, debugLevel, defines, extraFlags}.'); return undefined }
  c.unknownKeys(v, ['optimization', 'debugLevel', 'defines', 'extraFlags'], p)
  const optimization = oneOf(c, v['optimization'], OPTIMIZATIONS, `${p}.optimization`)
  const debugLevel = oneOf(c, v['debugLevel'], DEBUG_LEVELS, `${p}.debugLevel`)
  const defines = strList(c, v, 'defines', p, DEFINE)
  const extraFlags = strList(c, v, 'extraFlags', p)
  return optimization && debugLevel ? { optimization, debugLevel, defines, extraFlags } : undefined
}

/** Проверяет произвольные данные как проект схемы версии 1 (миграции выполняются раньше, см. migrate.ts). */
export function validateProject(raw: unknown): ValidationResult {
  const c = new Ctx()
  if (!isRec(raw)) return { ok: false, errors: [{ path: '', message: 'Файл проекта должен быть JSON-объектом.' }], warnings: [] }
  c.unknownKeys(raw, ['schemaVersion', 'name', 'target', 'sources', 'includes', 'defines', 'linkerScript', 'startupFile', 'svd', 'configurations', 'toolchain', 'programmer'], '')
  if (raw['schemaVersion'] !== SCHEMA_VERSION) c.err('schemaVersion', `Ожидается версия схемы ${SCHEMA_VERSION}.`)
  const name = str(c, raw, 'name', '', NAME, 'имя проекта (латиница, цифры, «_» и «-»)')
  const tgt = target(c, raw['target'])
  const sources = pathList(c, raw, 'sources', '', true)
  if (Array.isArray(raw['sources']) && raw['sources'].length === 0) c.err('sources', 'Добавьте хотя бы один файл или папку с исходниками.')
  const includes = pathList(c, raw, 'includes', '', false)
  const defines = strList(c, raw, 'defines', '', DEFINE)
  const linkerScript = raw['linkerScript'] === undefined ? (c.err('linkerScript', 'Обязательное поле не задано.'), undefined) : pathStr(c, raw['linkerScript'], 'linkerScript')
  const startupFile = raw['startupFile'] === undefined ? (c.err('startupFile', 'Обязательное поле не задано.'), undefined) : pathStr(c, raw['startupFile'], 'startupFile')
  const svd = raw['svd'] === undefined ? undefined : pathStr(c, raw['svd'], 'svd')

  const configurations: Record<string, BuildConfiguration> = {}
  const cfgRaw = raw['configurations']
  if (!isRec(cfgRaw)) c.err('configurations', 'Обязательный раздел не задан.')
  else {
    for (const [k, v] of Object.entries(cfgRaw)) {
      if (!CONFIG_NAME.test(k)) { c.err(`configurations.${k}`, 'Недопустимое имя конфигурации.'); continue }
      const cfg = config(c, v, `configurations.${k}`)
      if (cfg) configurations[k] = cfg
    }
    for (const need of ['Debug', 'Release']) if (!(need in cfgRaw)) c.err(`configurations.${need}`, `Конфигурация «${need}» обязательна.`)
  }

  let toolchain: ProProject['toolchain'] | undefined
  const tc = raw['toolchain']
  if (!isRec(tc)) c.err('toolchain', 'Обязательный раздел не задан.')
  else {
    c.unknownKeys(tc, ['kind', 'version'], 'toolchain')
    if (tc['kind'] !== 'arm-none-eabi-gcc') c.err('toolchain.kind', 'Поддерживается только «arm-none-eabi-gcc».')
    else { const version = optStr(c, tc, 'version', 'toolchain'); toolchain = { kind: 'arm-none-eabi-gcc', ...(version ? { version } : {}) } }
  }

  let programmer: ProProject['programmer'] | undefined
  const pr = raw['programmer']
  if (!isRec(pr)) c.err('programmer', 'Обязательный раздел не задан.')
  else {
    c.unknownKeys(pr, ['kind', 'interface', 'openocdTarget'], 'programmer')
    const kind = oneOf(c, pr['kind'], PROGRAMMER_KINDS, 'programmer.kind')
    if (pr['interface'] !== 'swd') c.err('programmer.interface', 'Поддерживается только «swd».')
    const openocdTarget = optStr(c, pr, 'openocdTarget', 'programmer', /^[A-Za-z0-9_./-]+$/)
    if (kind && pr['interface'] === 'swd') programmer = { kind, interface: 'swd', ...(openocdTarget ? { openocdTarget } : {}) }
  }

  if (c.errors.length || !name || !tgt || !linkerScript || !startupFile || !toolchain || !programmer) return { ok: false, errors: c.errors, warnings: c.warnings }
  const project: ProProject = {
    schemaVersion: SCHEMA_VERSION, name, target: tgt, sources, includes, defines, linkerScript, startupFile, ...(svd ? { svd } : {}),
    configurations: configurations as ProProject['configurations'], toolchain, programmer
  }
  return { ok: true, project, warnings: c.warnings }
}

/** Ошибки одной строкой для сообщения пользователю. */
export function formatIssues(list: Issue[], max = 4): string {
  const shown = list.slice(0, max).map((i) => (i.path ? `${i.path}: ${i.message}` : i.message))
  return shown.join(' ') + (list.length > max ? ` …и ещё ${list.length - max}.` : '')
}
