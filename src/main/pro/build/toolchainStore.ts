// Текущий компилятор Pro-режима: поиск с кэшем, настройка пути (общая с этапом C: userData/pro-tools.json), сведения для интерфейса.
import { access } from 'fs/promises'
import { join } from 'path'
import { toolchainDir } from '../paths'
import { readToolPaths, setToolPath } from '../tools/config'
import { SOURCE_LABEL, TOOLCHAIN_PKG, findToolchain, gccName, realDeps } from './toolchain'
import type { ToolchainInfo } from './toolchain'
import type { ToolchainStatus } from './types'

let cached: ToolchainInfo | null = null
const KEY = 'arm-none-eabi-gcc'

/** Автотесты (AVRIDE_E2E=1, AVRIDE_PRO_GCC=none): компилятор «не установлен», как бы ни был настроен компьютер. */
const hidden = (): boolean => process.env['AVRIDE_E2E'] === '1' && process.env['AVRIDE_PRO_GCC'] === 'none'

const alive = async (t: ToolchainInfo): Promise<boolean> => { try { await access(join(t.bin, gccName(process.platform))); return true } catch { return false } }

/** Путь из настройки или из переменной окружения AVRIDE_PRO_GCC (путь к arm-none-eabi-gcc.exe или папке bin). */
const settingPath = (): string | undefined => process.env['AVRIDE_PRO_GCC'] || readToolPaths()[KEY] || undefined

/** Найденный компилятор (результат запоминается, пока файл на месте). Только положительный результат кэшируется. */
export async function resolveToolchain(refresh = false): Promise<ToolchainInfo | null> {
  if (hidden()) return null
  if (!refresh && cached && (await alive(cached))) return cached
  const r = await findToolchain(realDeps(), { settingPath: settingPath(), appDir: toolchainDir() })
  cached = r.found
  return cached
}

export const invalidateToolchain = (): void => { cached = null }

export const packageInfo = (): ToolchainStatus['pkg'] => ({
  title: TOOLCHAIN_PKG.title, downloadBytes: TOOLCHAIN_PKG.size, diskBytes: TOOLCHAIN_PKG.size + TOOLCHAIN_PKG.unpacked, host: new URL(TOOLCHAIN_PKG.url).host,
  url: TOOLCHAIN_PKG.url, sha256: TOOLCHAIN_PKG.sha256, license: TOOLCHAIN_PKG.license, sources: TOOLCHAIN_PKG.sources, homepage: TOOLCHAIN_PKG.homepage, supported: process.platform === 'win32'
})

export async function toolchainStatus(): Promise<ToolchainStatus> {
  const sp = hidden() ? undefined : settingPath()
  const r = hidden() ? { found: null, tried: [], settingBad: false } : await findToolchain(realDeps(), { settingPath: sp, appDir: toolchainDir() })
  cached = r.found
  let appInstalled = false
  try { await access(join(toolchainDir(), TOOLCHAIN_PKG.dir, 'bin', gccName(process.platform))); appInstalled = true } catch { /* нет */ }
  return {
    found: !!r.found, bin: r.found?.bin, version: r.found?.version, source: r.found?.source, sourceLabel: r.found ? SOURCE_LABEL[r.found.source] : undefined,
    settingPath: sp, settingBad: r.settingBad, tried: r.tried.slice(0, 12), appInstalled, pkg: packageInfo()
  }
}

/** Сохраняет путь к компилятору (null — сбросить). Хранится путь к arm-none-eabi-gcc.exe: так его читает и этап «Отладка». */
export async function setToolchainPath(gccPath: string | null): Promise<ToolchainStatus> {
  setToolPath(KEY, gccPath)
  invalidateToolchain()
  return toolchainStatus()
}
