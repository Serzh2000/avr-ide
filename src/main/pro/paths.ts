// Папки данных Pro-режима. Корень — userData приложения (задаётся при старте main в registerProIpc); в тестах — любая пустая папка.
//   <корень>/pro-tools/<пакет>/bin   — компилятор, установленный приложением (общая папка инструментов этапов B и C: в ней же ищутся gdb и OpenOCD)
//   <корень>/pro/support             — кэш файлов CMSIS (пакеты поддержки чипов)
//   <корень>/pro/downloads           — недокачанные и временные архивы
// Переменная AVRIDE_PRO_DIR важнее — так автотесты не трогают данные пользователя.
import { join } from 'path'
import { tmpdir } from 'os'

let root = process.env['AVRIDE_PRO_DIR'] || join(tmpdir(), 'avride-pro-data')
export const setProDataDir = (userData: string): void => { root = process.env['AVRIDE_PRO_DIR'] || userData }
export const proDataDir = (): string => join(root, 'pro')
export const toolchainDir = (): string => join(root, 'pro-tools')
export const supportDir = (): string => join(root, 'pro', 'support')
export const downloadsDir = (): string => join(root, 'pro', 'downloads')
