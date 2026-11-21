// Поиск arm-none-eabi-gcc и установка компилятора «одной кнопкой» в папку данных приложения.
// Устанавливаемый пакет — xPack GNU Arm Embedded GCC (сборка Arm GNU Toolchain от проекта xPack): архив лежит в релизах GitHub,
// контрольная сумма SHA-256 записана в коде ниже и совпадает с файлом .sha рядом с архивом в релизе; после скачивания сумма проверяется.
import { createHash } from 'crypto'
import { createWriteStream } from 'fs'
import { mkdir, readdir, rename, rm, statfs, writeFile, access } from 'fs/promises'
import { delimiter, join } from 'path'
import { execStream } from './exec'
import { downloadsDir, toolchainDir } from '../paths'

export type ToolchainSource = 'setting' | 'app' | 'path' | 'cubeide' | 'armgnu' | 'xpack'
export interface ToolchainInfo {
  /** Папка bin (абсолютный путь, как есть в ОС) */
  bin: string
  version: string
  source: ToolchainSource
}

export const SOURCE_LABEL: Record<ToolchainSource, string> = {
  setting: 'путь из настроек', app: 'установлен приложением', path: 'найден в PATH', cubeide: 'из STM32CubeIDE', armgnu: 'Arm GNU Toolchain', xpack: 'xPack'
}

// ---------- пакет для установки ----------

export const TOOLCHAIN_PKG = {
  id: 'xpack-arm-none-eabi-gcc-14.2.1-1.1',
  title: 'xPack GNU Arm Embedded GCC 14.2.1-1.1',
  /** GCC 14.2.1 (Arm GNU Toolchain 14.2.Rel1), binutils, newlib, newlib-nano */
  gcc: '14.2.1',
  file: 'xpack-arm-none-eabi-gcc-14.2.1-1.1-win32-x64.zip',
  url: 'https://github.com/xpack-dev-tools/arm-none-eabi-gcc-xpack/releases/download/v14.2.1-1.1/xpack-arm-none-eabi-gcc-14.2.1-1.1-win32-x64.zip',
  size: 323368593,
  /** Развёрнутый размер: ≈ 1,4 ГБ (измерено при распаковке) */
  unpacked: 1_500_000_000,
  sha256: '0b2d496b383ba578182eb57b3f7d35ff510e36eda56257883b902fa07c3bba55',
  shaUrl: 'https://github.com/xpack-dev-tools/arm-none-eabi-gcc-xpack/releases/download/v14.2.1-1.1/xpack-arm-none-eabi-gcc-14.2.1-1.1-win32-x64.zip.sha',
  homepage: 'https://xpack-dev-tools.github.io/arm-none-eabi-gcc-xpack/',
  sources: 'https://github.com/xpack-dev-tools/arm-none-eabi-gcc-xpack (скрипты сборки); исходные тексты GCC, binutils и newlib — на https://developer.arm.com/downloads/-/arm-gnu-toolchain-downloads и в репозиториях gcc.gnu.org, sourceware.org',
  license: 'GPL-3.0-or-later (GCC, binutils), LGPL/BSD (newlib), см. папку distro-info/licenses в архиве',
  dir: 'xpack-arm-none-eabi-gcc-14.2.1-1.1'
} as const

/** Что нужно для установки; в автотестах (AVRIDE_E2E=1) адрес подменяется на локальный сервер. */
export interface InstallPkg { id: string; file: string; url: string; size: number; unpacked: number; sha256: string; dir: string }

export const GB = 1024 ** 3
export const fmtSize = (n: number): string => (n >= GB ? (n / GB).toFixed(1).replace('.', ',') + ' ГБ' : Math.max(1, Math.round(n / 1048576)) + ' МБ')

// ---------- поиск ----------

export interface FindDeps {
  platform: NodeJS.Platform
  env: Record<string, string | undefined>
  exists(p: string): Promise<boolean>
  listDir(p: string): Promise<string[]>
  /** Запускает gcc --version, возвращает первую строку или null */
  version(gcc: string): Promise<string | null>
}

export const gccName = (platform: NodeJS.Platform): string => (platform === 'win32' ? 'arm-none-eabi-gcc.exe' : 'arm-none-eabi-gcc')
const joinp = (platform: NodeJS.Platform, ...p: string[]): string => (platform === 'win32' ? p.join('\\').replace(/\\{2,}/g, '\\') : join(...p))

/** Версия из первой строки «arm-none-eabi-gcc (xPack GNU Arm Embedded GCC x86_64) 14.2.1 20241119». */
export function parseGccVersion(line: string): string | null {
  const m = /arm-none-eabi-gcc[^\n]*?\)\s+(\d+\.\d+(?:\.\d+)?(?:\s+\d{8})?)/.exec(line) ?? /\b(\d+\.\d+\.\d+)\b/.exec(line)
  return m ? m[1].trim() : null
}

/** Из пути, который указал пользователь (файл gcc, папка bin или корень пакета), получает папку bin; null, если gcc там нет. */
export async function binFromUserPath(p: string, deps: FindDeps): Promise<string | null> {
  const g = gccName(deps.platform)
  const t = p.replace(/[\\/]+$/, '')
  if (/arm-none-eabi-gcc(\.exe)?$/i.test(t)) return (await deps.exists(t)) ? t.replace(/[\\/][^\\/]+$/, '') : null
  for (const d of [t, joinp(deps.platform, t, 'bin'), joinp(deps.platform, t, '.content', 'bin')]) if (await deps.exists(joinp(deps.platform, d, g))) return d
  return null
}

/** Новее — выше: сравнение по числам в имени папки («14.2 rel1» > «13.3.rel1»). */
const byVersionDesc = (a: string, b: string): number => {
  const na = a.match(/\d+/g)?.map(Number) ?? []
  const nb = b.match(/\d+/g)?.map(Number) ?? []
  for (let i = 0; i < Math.max(na.length, nb.length); i++) if ((na[i] ?? 0) !== (nb[i] ?? 0)) return (nb[i] ?? 0) - (na[i] ?? 0)
  return 0
}

/** Все места, где обычно лежит компилятор, по убыванию приоритета. */
export async function candidates(deps: FindDeps, opts: { settingPath?: string; appDir: string }): Promise<{ bin: string; source: ToolchainSource }[]> {
  const out: { bin: string; source: ToolchainSource }[] = []
  const add = (bin: string, source: ToolchainSource): void => { if (!out.some((o) => o.bin.toLowerCase() === bin.toLowerCase())) out.push({ bin, source }) }
  const g = gccName(deps.platform)
  const P = (...p: string[]): string => joinp(deps.platform, ...p)
  if (opts.settingPath) { const b = await binFromUserPath(opts.settingPath, deps); if (b) add(b, 'setting'); else add(opts.settingPath, 'setting') }
  // установленный приложением
  for (const d of (await deps.listDir(opts.appDir)).sort(byVersionDesc)) {
    for (const b of [P(opts.appDir, d, 'bin'), P(opts.appDir, d, '.content', 'bin')]) if (await deps.exists(P(b, g))) add(b, 'app')
  }
  for (const d of (deps.env['PATH'] ?? deps.env['Path'] ?? '').split(delimiter)) if (d && (await deps.exists(P(d, g)))) add(d, 'path')
  if (deps.platform === 'win32') {
    const pf = [deps.env['ProgramFiles'], deps.env['ProgramFiles(x86)'], 'C:\\Program Files', 'C:\\Program Files (x86)'].filter((x): x is string => !!x)
    for (const base of [...new Set(pf)]) {
      for (const dir of ['Arm GNU Toolchain arm-none-eabi', 'GNU Arm Embedded Toolchain', 'GNU Tools Arm Embedded']) {
        for (const v of (await deps.listDir(P(base, dir))).sort(byVersionDesc)) { const b = P(base, dir, v, 'bin'); if (await deps.exists(P(b, g))) add(b, 'armgnu') }
      }
    }
    // STM32CubeIDE: C:\ST\STM32CubeIDE_x.y.z\STM32CubeIDE\plugins\com.st.stm32cube.ide.mcu.externaltools.gnu-tools-for-stm32.<версия>\tools\bin
    const stRoots = ['C:\\ST', ...(deps.env['ProgramFiles'] ? [P(deps.env['ProgramFiles'], 'STMicroelectronics')] : [])]
    for (const st of stRoots) {
      for (const ide of (await deps.listDir(st)).filter((n) => /^STM32CubeIDE/i.test(n)).sort(byVersionDesc)) {
        const plugins = P(st, ide, 'STM32CubeIDE', 'plugins')
        for (const pl of (await deps.listDir(plugins)).filter((n) => /gnu-tools-for-stm32/i.test(n)).sort(byVersionDesc)) {
          const b = P(plugins, pl, 'tools', 'bin')
          if (await deps.exists(P(b, g))) add(b, 'cubeide')
        }
      }
    }
    const ap = deps.env['APPDATA']
    if (ap) {
      const base = P(ap, 'xPacks', '@xpack-dev-tools', 'arm-none-eabi-gcc')
      for (const v of (await deps.listDir(base)).sort(byVersionDesc)) { const b = P(base, v, '.content', 'bin'); if (await deps.exists(P(b, g))) add(b, 'xpack') }
    }
  }
  return out
}

/** Первый рабочий компилятор: каждый кандидат проверяется запуском gcc --version. tried — что проверено (для сообщения «не найден»). */
export async function findToolchain(deps: FindDeps, opts: { settingPath?: string; appDir: string }): Promise<{ found: ToolchainInfo | null; tried: string[]; settingBad: boolean }> {
  const list = await candidates(deps, opts)
  const tried: string[] = []
  let settingBad = !!opts.settingPath
  for (const c of list) {
    tried.push(c.bin)
    const v = await deps.version(joinp(deps.platform, c.bin, gccName(deps.platform)))
    const ver = v ? parseGccVersion(v) : null
    if (ver) {
      if (c.source === 'setting') settingBad = false
      return { found: { bin: c.bin, version: ver, source: c.source }, tried, settingBad }
    }
  }
  return { found: null, tried, settingBad }
}

export function realDeps(): FindDeps {
  return {
    platform: process.platform,
    env: process.env,
    exists: async (p) => { try { await access(p); return true } catch { return false } },
    listDir: async (p) => { try { return await readdir(p) } catch { return [] } },
    version: async (gcc) => {
      const r = await execStream(gcc, ['--version'], { maxBuffer: 20000 }).catch(() => null)
      if (!r || r.code !== 0) return null
      return r.stdout.split(/\r?\n/)[0] ?? null
    }
  }
}

// ---------- установка ----------

export interface InstallHooks {
  log: (text: string) => void
  progress: (label: string, pct: number | null) => void
  signal: AbortSignal
}

export class InstallError extends Error {}

/** Скачивает архив, проверяет SHA-256, распаковывает во «папка данных/toolchain/<id>». Возвращает папку bin. */
export async function installToolchain(h: InstallHooks, pkg: InstallPkg = TOOLCHAIN_PKG, fetchImpl: typeof fetch = fetch): Promise<string> {
  if (process.platform !== 'win32') throw new InstallError('Автоматическая установка компилятора доступна только в Windows. Установите arm-none-eabi-gcc вручную и укажите папку в настройках.')
  const tcDir = toolchainDir()
  const final = join(tcDir, pkg.dir)
  const dlDir = downloadsDir()
  await mkdir(tcDir, { recursive: true })
  await mkdir(dlDir, { recursive: true })
  // свободное место: архив + распакованный пакет
  try {
    const s = await statfs(tcDir)
    const free = Number(s.bavail) * Number(s.bsize)
    const need = pkg.size + pkg.unpacked + 200 * 1048576
    if (free < need) throw new InstallError(`Недостаточно места на диске: нужно около ${fmtSize(need)}, свободно ${fmtSize(free)}. Освободите место и повторите.`)
  } catch (e) { if (e instanceof InstallError) throw e }
  const part = join(dlDir, pkg.file + '.part')
  h.log(`Скачиваю ${pkg.file} (${fmtSize(pkg.size)}) с ${new URL(pkg.url).host}\n`)
  h.progress('Скачивание компилятора ARM', 0)
  let res: Response
  try { res = await fetchImpl(pkg.url, { signal: h.signal, redirect: 'follow' }) } catch (e) {
    if (h.signal.aborted) throw new InstallError('Установка отменена.')
    throw new InstallError('Не удалось подключиться к ' + new URL(pkg.url).host + '. Проверьте интернет и повторите.')
  }
  if (!res.ok || !res.body) throw new InstallError(`Сервер ответил ${res.status}. Повторите позже или скачайте архив вручную: ${pkg.url}`)
  const hash = createHash('sha256')
  const out = createWriteStream(part)
  let got = 0
  try {
    const reader = res.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      hash.update(value)
      got += value.length
      if (!out.write(value)) await new Promise<void>((r) => out.once('drain', r))
      h.progress('Скачивание компилятора ARM', Math.min(99, Math.floor((got / pkg.size) * 100)))
    }
    await new Promise<void>((r, j) => { out.end(() => r()); out.on('error', j) })
  } catch (e) {
    out.destroy()
    await rm(part, { force: true })
    if (h.signal.aborted) throw new InstallError('Установка отменена.')
    throw new InstallError('Скачивание прервалось: ' + (e instanceof Error ? e.message : String(e)))
  }
  const sum = hash.digest('hex')
  if (sum !== pkg.sha256) {
    await rm(part, { force: true })
    throw new InstallError(`Контрольная сумма SHA-256 архива не совпала (получено ${sum.slice(0, 16)}…, ожидалось ${pkg.sha256.slice(0, 16)}…). Файл удалён, установка прекращена.`)
  }
  h.log(`SHA-256 совпала: ${sum}\n`)
  const archive = join(dlDir, pkg.file)
  await rm(archive, { force: true })
  await rename(part, archive)
  h.progress('Распаковка компилятора (около минуты)', null)
  h.log('Распаковываю (tar)…\n')
  const tmp = join(tcDir, '.tmp-' + Date.now())
  await mkdir(tmp, { recursive: true })
  const tar = join(process.env['SystemRoot'] ?? 'C:\\Windows', 'System32', 'tar.exe')
  const r = await execStream(tar, ['-xf', archive, '-C', tmp], { signal: h.signal })
  if (r.cancelled) { await rm(tmp, { recursive: true, force: true }); throw new InstallError('Установка отменена.') }
  if (r.code !== 0) { await rm(tmp, { recursive: true, force: true }); throw new InstallError('Не удалось распаковать архив: ' + (r.stderr.trim().slice(0, 300) || 'код ' + r.code)) }
  await rm(final, { recursive: true, force: true })
  await rename(join(tmp, pkg.dir), final)
  await rm(tmp, { recursive: true, force: true })
  await rm(archive, { force: true })
  const bin = join(final, 'bin')
  const v = await realDeps().version(join(bin, 'arm-none-eabi-gcc.exe'))
  if (!v || !parseGccVersion(v)) { await rm(final, { recursive: true, force: true }); throw new InstallError('Компилятор распакован, но не запускается. Папка удалена.') }
  await writeFile(join(final, '.avride-installed.json'), JSON.stringify({ id: pkg.id, sha256: pkg.sha256, url: pkg.url, at: new Date().toISOString() }, null, 2))
  h.log(`Готово: ${v}\n`)
  h.progress('Компилятор установлен', 100)
  return bin
}

/** Удаляет установленный приложением компилятор. */
export async function uninstallToolchain(pkg: InstallPkg = TOOLCHAIN_PKG): Promise<void> {
  await rm(join(toolchainDir(), pkg.dir), { recursive: true, force: true })
}
