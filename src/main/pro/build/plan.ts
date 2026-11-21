// План сборки: список исходников → задания компиляции и компоновки (чистые функции).
// Пути в командах абсолютные с «/»: gcc печатает их в сообщениях как есть, и IDE по ним открывает файл по клику в «Проблемах».
import { createHash } from 'crypto'
import type { BuildPlan, ProjectContext } from '../interfaces'
import { flagsFor, langOf } from './flags'
import type { FlagSet, Lang } from './flags'

export interface CompileJob {
  /** Исходник относительно корня проекта */
  src: string
  lang: Lang
  /** Объектный файл и файл зависимостей относительно корня проекта */
  obj: string
  dep: string
  /** Программа и аргументы (абсолютные пути) */
  tool: string
  args: string[]
  /** Хэш команды: меняется при любом изменении ключей */
  sig: string
}

export interface LinkJob {
  tool: string
  args: string[]
  elf: string
  map: string
  bin: string
  hex: string
  rsp: string
  /** Содержимое файла ответов со списком объектов */
  rspText: string
  sig: string
  /** true, если есть C++ (линкуем g++, чтобы подтянуть libstdc++) */
  cpp: boolean
}

export interface FullPlan extends BuildPlan {
  root: string
  configuration: string
  jobs: CompileJob[]
  link: LinkJob
  flags: FlagSet
  /** Скрипт компоновки и startup относительно корня (для проверки перед сборкой) */
  linkerScript: string
  startupFile: string
}

const fwd = (p: string): string => p.replace(/\\/g, '/')
const abs = (root: string, rel: string): string => fwd(root).replace(/\/+$/, '') + '/' + rel
const sigOf = (parts: string[]): string => createHash('sha1').update(parts.join('\u0000')).digest('hex').slice(0, 16)

export const outDirOf = (configuration: string): string => `build/${configuration}`
export const TOOL = { cc: 'arm-none-eabi-gcc', cxx: 'arm-none-eabi-g++', objcopy: 'arm-none-eabi-objcopy', size: 'arm-none-eabi-size', objdump: 'arm-none-eabi-objdump', nm: 'arm-none-eabi-nm' } as const

/** Исходники проекта, которые нужно скомпилировать: из sources (после обхода папок) плюс startup. Порядок стабилен, дубликаты убраны. */
export function sourceList(found: string[], startupFile: string): string[] {
  const set = new Set<string>()
  const startupLang = langOf(startupFile)
  const all = [...(startupLang ? [startupFile] : []), ...found.filter((f) => langOf(f))]
  const out: string[] = []
  for (const f of all) {
    const k = fwd(f)
    if (!set.has(k)) { set.add(k); out.push(k) }
  }
  return out
}

export interface PlanInput {
  ctx: ProjectContext
  /** Все исходники (результат обхода sources проекта), относительные пути с «/» */
  sources: string[]
  /** Макрос устройства из базы чипов */
  deviceDefine?: string
  /** Папка bin компилятора (с «/», без завершающего слэша); пусто — программы берутся из PATH */
  bin?: string
}

export function makePlan(inp: PlanInput): FullPlan {
  const { ctx } = inp
  const { root, project, configuration } = ctx
  const flags = flagsFor(project, configuration, inp.deviceDefine)
  const outDir = outDirOf(configuration)
  const bin = inp.bin ? fwd(inp.bin).replace(/\/+$/, '') + '/' : ''
  const exe = (name: string): string => bin + name
  const includes = project.includes.map((i) => '-I' + abs(root, i))
  const list = sourceList(inp.sources, project.startupFile)
  const jobs: CompileJob[] = list.map((src) => {
    const lang = langOf(src)!
    const obj = `${outDir}/obj/${src}.o`
    const dep = `${outDir}/obj/${src}.d`
    const langFlags = lang === 'c' ? flags.c : lang === 'cpp' ? flags.cpp : flags.asm
    const args = [...flags.arch, ...flags.defines, ...includes, ...flags.common, ...langFlags, '-MMD', '-MP', '-MF', dep, '-c', abs(root, src), '-o', obj]
    const tool = exe(lang === 'cpp' ? TOOL.cxx : TOOL.cc)
    return { src, lang, obj, dep, tool, args, sig: sigOf([tool, ...args]) }
  })
  const cpp = jobs.some((j) => j.lang === 'cpp')
  const name = project.name
  const elf = `${outDir}/${name}.elf`
  const map = `${outDir}/${name}.map`
  const rsp = `${outDir}/objects.rsp`
  // Исходники и -I — абсолютные (по ним gcc печатает пути для «Проблем»), всё остальное — относительно корня проекта (рабочая папка сборки):
  // компоновщик Windows не открывает файлы по путям с символами вне системной кодовой страницы, а относительные пути у нас латинские
  const rspText = jobs.map((j) => `"${j.obj}"`).join('\n') + '\n'
  const ldArgs = [...flags.arch, '-T', project.linkerScript, `-Wl,-Map=${map},--cref`, ...flags.link, '@' + rsp, '-Wl,--start-group', '-lc', '-lm', '-Wl,--end-group', '-o', elf]
  const linkTool = exe(cpp ? TOOL.cxx : TOOL.cc)
  const link: LinkJob = { tool: linkTool, args: ldArgs, elf, map, bin: `${outDir}/${name}.bin`, hex: `${outDir}/${name}.hex`, rsp, rspText, sig: sigOf([linkTool, ...ldArgs, rspText]), cpp }
  return {
    root, configuration, jobs, link, flags,
    outDir, sourceFiles: list, compiler: TOOL.cc,
    cflags: [...flags.arch, ...flags.defines, ...includes.map((i) => i.replace(fwd(root), '.')), ...flags.common],
    ldflags: [...flags.arch, '-T', project.linkerScript, ...flags.link],
    linkerScript: project.linkerScript, startupFile: project.startupFile
  }
}

/** Содержимое файла состояния: хэш команды каждого объекта и последнего связывания. */
export interface BuildState {
  v: 1
  sigs: Record<string, string>
  link?: string
  /** Итог последней успешной сборки: размер и использование областей */
  last?: { at: number; text: number; data: number; bss: number; regions: { name: string; origin: number; length: number; used: number }[] }
}
