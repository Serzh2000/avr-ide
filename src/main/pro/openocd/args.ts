// Формирование командной строки OpenOCD для ST-Link. Только проверенные команды (OpenOCD User's Guide, openocd.org/doc):
//   -f / -s / -c, `transport select hla_swd`, `adapter serial`, `adapter speed`, `reset_config`, `gdb_port`, `tcl_port`, `telnet_port`,
//   `program <file> [address] [verify] [reset] [exit]`, `flash erase_sector <bank> <first> <last>`, `init`, `reset halt`.
// Чистые функции без Electron — покрыты юнит-тестами.
import { getChip, listChips } from '../../../shared/pro/chipdb'
import type { ProProject } from '../project/types'

export type ResetMode = 'normal' | 'under-reset'

export interface OpenOcdBase {
  /** Каталог tcl-скриптов OpenOCD (-s); если не задан, OpenOCD ищет сам */
  scripts?: string
  /** Целевой файл, например «target/stm32f1x.cfg» */
  target: string
  /** Серийный номер ST-Link (если подключено несколько) */
  serial?: string
  /** Скорость SWD, кГц */
  speedKhz?: number
  resetMode?: ResetMode
}

export const DEFAULT_SPEED_KHZ = 1800

/** Строка для Tcl в фигурных скобках: пути с пробелами работают, обратные косые заменяются, скобки запрещены. */
export function tclPath(p: string): string {
  if (/[{}\r\n]/.test(p)) throw new Error('Путь к файлу содержит недопустимые символы ({ } или перевод строки): ' + p)
  return '{' + p.replace(/\\/g, '/') + '}'
}

/** Цель OpenOCD: поле проекта, иначе из базы чипов (stm32f103c8 → stm32f1x.cfg). */
export function pickTarget(project: ProProject): string | null {
  const t = project.programmer.openocdTarget
  if (t) return /^target\//.test(t) || /[\\/]/.test(t) ? t.replace(/\\/g, '/') : 'target/' + t
  const name = project.target.chip.toLowerCase()
  const chip = listChips().filter((c) => name.startsWith(c.id)).sort((a, b) => b.id.length - a.id.length)[0] ?? getChip(name)
  return chip ? 'target/' + chip.files.openocd : null
}

/** Общая часть: интерфейс ST-Link, SWD, серийный номер, цель, скорость, режим сброса. */
export function baseArgs(o: OpenOcdBase): string[] {
  const a: string[] = []
  if (o.scripts) a.push('-s', o.scripts.replace(/\\/g, '/'))
  a.push('-f', 'interface/stlink.cfg', '-c', 'transport select hla_swd')
  if (o.serial) {
    if (!/^[0-9A-Za-z_-]{1,64}$/.test(o.serial)) throw new Error('Недопустимый серийный номер программатора.')
    a.push('-c', `adapter serial ${o.serial}`)
  }
  a.push('-f', o.target.replace(/\\/g, '/'))
  const speed = o.speedKhz ?? DEFAULT_SPEED_KHZ
  if (!Number.isInteger(speed) || speed < 1 || speed > 24000) throw new Error('Скорость SWD должна быть от 1 до 24000 кГц.')
  a.push('-c', `adapter speed ${speed}`)
  if (o.resetMode === 'under-reset') a.push('-c', 'reset_config srst_only srst_nogate connect_assert_srst')
  return a
}

export type FileFormat = 'elf' | 'hex' | 'bin'
export function formatOf(file: string): FileFormat | null {
  const m = /\.(elf|axf|hex|ihx|bin)$/i.exec(file)
  if (!m) return null
  const e = m[1].toLowerCase()
  return e === 'bin' ? 'bin' : e === 'hex' || e === 'ihx' ? 'hex' : 'elf'
}

export interface ProgramOptions extends OpenOcdBase {
  file: string
  /** Только для .bin: адрес, hex-строка */
  address?: string
  verify?: boolean
  reset?: boolean
}

export function programArgs(o: ProgramOptions): string[] {
  const fmt = formatOf(o.file)
  if (!fmt) throw new Error('Неизвестный формат файла прошивки: нужен .elf, .hex или .bin.')
  let addr = ''
  if (fmt === 'bin') {
    if (!o.address || !/^0x[0-9a-fA-F]{1,8}$/.test(o.address)) throw new Error('Для .bin нужен адрес записи (например, 0x08000000).')
    addr = ' ' + o.address
  }
  const cmd = `program ${tclPath(o.file)}${addr}${o.verify === false ? '' : ' verify'}${o.reset === false ? '' : ' reset'} exit`
  return [...baseArgs(o), '-c', cmd]
}

/** Полное стирание Flash: остановка ядра и стирание всех секторов банка 0 (общая команда, не зависит от семейства). */
export function eraseArgs(o: OpenOcdBase): string[] {
  return [...baseArgs(o), '-c', 'init', '-c', 'reset halt', '-c', 'flash erase_sector 0 0 last', '-c', 'exit']
}

/** GDB-сервер: порт выбирает вызывающий; telnet и tcl отключены (лишние порты не нужны). */
export function gdbServerArgs(o: OpenOcdBase, port: number): string[] {
  return [...baseArgs(o), '-c', `gdb_port ${port}`, '-c', 'telnet_port disabled', '-c', 'tcl_port disabled']
}

/** Только проверка подключения: чтение без изменения прошивки (init; targets; exit). Используется для диагностики. */
export function probeCheckArgs(o: OpenOcdBase): string[] {
  return [...baseArgs(o), '-c', 'init', '-c', 'targets', '-c', 'exit']
}
