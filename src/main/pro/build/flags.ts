// Ключи arm-none-eabi-gcc для проекта и конфигурации (чистые функции, без Electron и файловой системы).
// Источники ключей: документация GCC для ARM (-mcpu, -mfpu, -mfloat-abi), соглашения STM32CubeIDE (-ffunction-sections, --specs=nano.specs, -Wl,--gc-sections).
import type { BuildConfiguration, CoreKind, FloatAbi, FpuKind, ProProject } from '../project/types'

export type Lang = 'c' | 'cpp' | 'asm'

/** Тип файла по расширению; null — не исходник. */
export function langOf(file: string): Lang | null {
  const m = /\.([A-Za-z0-9+]+)$/.exec(file)
  if (!m) return null
  switch (m[1]) {
    case 'c': return 'c'
    case 'cpp': case 'cc': case 'cxx': case 'C': return 'cpp'
    case 's': case 'S': return 'asm'
    default: return null
  }
}

/** FPU по умолчанию для ядра, если в проекте не указан: Cortex-M4F — fpv4-sp-d16, Cortex-M7 (с двойной точностью, как у STM32H743) — fpv5-d16. */
export const defaultFpu = (core: CoreKind): FpuKind | undefined => (core === 'cortex-m4' ? 'fpv4-sp-d16' : core === 'cortex-m7' ? 'fpv5-d16' : undefined)

/** Ключи архитектуры: -mcpu, -mthumb, -mfpu, -mfloat-abi. Одинаковые для компиляции и компоновки. */
export function archFlags(t: ProProject['target']): string[] {
  const f = [`-mcpu=${t.core}`, '-mthumb']
  const fpu = t.fpu
  const abi: FloatAbi = t.floatAbi ?? (fpu ? 'hard' : 'soft')
  if (fpu && abi !== 'soft') f.push(`-mfpu=${fpu}`, `-mfloat-abi=${abi}`)
  else f.push('-mfloat-abi=soft')
  return f
}

const LINK_ONLY = /^(-Wl,|-l|-L|-T|--specs=|-static$|-nostartfiles$|-nostdlib$|-nodefaultlibs$|-u\b|-Xlinker)/
const BOTH = /^(-m|-flto|-fuse-linker-plugin)/

/** Разделение пользовательских ключей: что идёт компилятору, а что — компоновщику. */
export function splitExtra(extra: string[]): { compile: string[]; link: string[] } {
  const compile: string[] = []
  const link: string[] = []
  for (const a of extra) {
    if (LINK_ONLY.test(a)) link.push(a)
    else { compile.push(a); if (BOTH.test(a)) link.push(a) }
  }
  return { compile, link }
}

export interface FlagSet {
  arch: string[]
  /** -DИМЯ[=значение] */
  defines: string[]
  /** Общие ключи компиляции: оптимизация, отладка, предупреждения, пользовательские */
  common: string[]
  c: string[]
  cpp: string[]
  asm: string[]
  /** Ключи компоновки без -T, карты и объектов (их добавляет сборщик) */
  link: string[]
}

export const optimizationFlag = (c: BuildConfiguration): string => '-' + c.optimization
export const debugFlag = (c: BuildConfiguration): string | null => (c.debugLevel === 'none' ? null : '-' + c.debugLevel)

/** Все ключи для конфигурации. deviceDefine — макрос устройства из базы чипов (добавляется, если его нет в defines проекта). */
export function flagsFor(project: ProProject, configuration: string, deviceDefine?: string): FlagSet {
  const cfg = project.configurations[configuration]
  if (!cfg) throw new Error(`В проекте нет конфигурации «${configuration}».`)
  const defs: string[] = []
  for (const d of [...(deviceDefine ? [deviceDefine] : []), ...project.defines, ...cfg.defines]) if (d && !defs.includes(d)) defs.push(d)
  const { compile, link } = splitExtra(cfg.extraFlags)
  const g = debugFlag(cfg)
  const common = [optimizationFlag(cfg), ...(g ? [g] : []), '-ffunction-sections', '-fdata-sections', '-Wall', ...compile]
  return {
    arch: archFlags(project.target),
    defines: defs.map((d) => '-D' + d),
    common,
    c: ['-std=gnu11'],
    cpp: ['-std=gnu++17', '-fno-exceptions', '-fno-rtti', '-fno-threadsafe-statics'],
    asm: ['-x', 'assembler-with-cpp', ...(g ? [g] : [])],
    link: ['--specs=nano.specs', '--specs=nosys.specs', '-static', '-Wl,--gc-sections', '-Wl,--print-memory-usage', ...link]
  }
}
