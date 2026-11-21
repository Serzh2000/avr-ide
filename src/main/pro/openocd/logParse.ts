// Разбор вывода OpenOCD: фаза операции (для индикатора) и понятное объяснение ошибки с подсказкой «что делать».
// Сообщения OpenOCD взяты из исходников (src/flash, src/target, src/jtag/drivers/stlink_usb.c) и типичных журналов; разбор мягкий — несовпавшее
// просто показывается в журнале как есть, а общая ошибка получает запасное объяснение.
// J-Link и CMSIS-DAP: строки драйверов проверены по исходникам OpenOCD v0.12.0 (jlink.c: «No J-Link device found», «Failed to open device»,
// «Multiple devices found, specify the desired device»; cmsis_dap.c: «unable to find a matching CMSIS-DAP device», «CMSIS-DAP: SWD not supported»).
import { KIND_TEXTS, NO_SWD_CMSIS } from '../../../shared/pro/programmers'
import type { ProgrammerKind } from '../../../shared/pro/programmers'

export type FlashPhase = 'connect' | 'program' | 'verify' | 'reset' | 'done'

export interface PhaseInfo { phase: FlashPhase; label: string; /** примерная доля 0..1 для индикатора */ fraction: number }

const PHASES: { re: RegExp; info: PhaseInfo }[] = [
  { re: /Info\s*:\s*STLINK|Info\s*:\s*J-?Link|Info\s*:\s*CMSIS-DAP|Info\s*:\s*Target voltage|Info\s*:.*processor detected|Info\s*:\s*device id/i, info: { phase: 'connect', label: 'Подключение к плате', fraction: 0.1 } },
  { re: /\*\*\s*Programming Started/i, info: { phase: 'program', label: 'Запись во Flash', fraction: 0.3 } },
  { re: /\*\*\s*Programming Finished/i, info: { phase: 'program', label: 'Запись завершена', fraction: 0.65 } },
  { re: /\*\*\s*Verify Started/i, info: { phase: 'verify', label: 'Проверка записанного', fraction: 0.75 } },
  { re: /\*\*\s*Verified OK/i, info: { phase: 'verify', label: 'Проверка пройдена', fraction: 0.9 } },
  { re: /\*\*\s*Resetting Target/i, info: { phase: 'reset', label: 'Перезапуск платы', fraction: 0.95 } }
]

export function phaseOf(line: string): PhaseInfo | null {
  for (const p of PHASES) if (p.re.test(line)) return p.info
  return null
}

export function targetVoltage(log: string): number | null {
  const m = /Target voltage:\s*([0-9]+(?:\.[0-9]+)?)/i.exec(log)
  return m ? Number(m[1]) : null
}

export type FlashErrorKind =
  | 'no-openocd' | 'no-probe' | 'no-driver' | 'no-power' | 'wrong-target' | 'read-protected' | 'verify-failed'
  | 'port-busy' | 'no-scripts' | 'connect-failed' | 'timeout' | 'cancelled' | 'unknown'

export interface FlashError {
  kind: FlashErrorKind
  /** Короткая суть */
  title: string
  /** Что делать */
  hint: string
}

const E = (kind: FlashErrorKind, title: string, hint: string): FlashError => ({ kind, title, hint })

export const ERR = {
  noOpenocd: E('no-openocd', 'Не найден OpenOCD', 'Нажмите «Установить OpenOCD» (скачается xPack OpenOCD) или укажите путь к openocd.exe в Настройки → Профессиональный режим.'),
  noProbe: E('no-probe', 'ST-Link не найден', 'Подключите ST-Link к USB-порту компьютера (на Nucleo — кабель в разъём ST-LINK). Если светодиод ST-Link не горит, смените кабель: бывают кабели «только для зарядки».'),
  noDriver: E('no-driver', 'ST-Link виден, но нет драйвера', 'Windows не отдала устройство программе. Установите драйвер ST-Link (STSW-LINK009 с сайта st.com) или привяжите WinUSB к ST-Link через Zadig, затем переподключите ST-Link.'),
  noPower: E('no-power', 'Нет питания цели', 'Программатор не видит напряжения на плате. Подключите 3V3 и GND к ST-Link (или подайте питание на плату по USB), проверьте, что SWDIO и SWCLK не перепутаны.'),
  wrongTarget: E('wrong-target', 'Микроконтроллер не подходит к выбранной цели', 'Идентификатор кристалла не совпал с ожидаемым. Проверьте, что в проекте выбран ваш чип (Проект → Цель), а на плате именно он. Бывают клоны (CKS, GD32) с другим IDCODE.'),
  readProtected: E('read-protected', 'Микроконтроллер защищён от чтения (RDP)', 'Включена защита Flash. Снять её можно только полным стиранием: кнопка «Стереть всю память» (вся прошивка в плате будет удалена).'),
  verifyFailed: E('verify-failed', 'Проверка записи не прошла', 'Записанное не совпало с файлом. Уменьшите скорость SWD в настройках прошивки, проверьте провода и питание, попробуйте ещё раз.'),
  portBusy: E('port-busy', 'Порт GDB занят', 'Другая копия OpenOCD или отладчика уже работает. Остановите отладку и закройте лишние окна OpenOCD.'),
  noScripts: E('no-scripts', 'У OpenOCD нет файлов настроек', 'OpenOCD не нашёл файл интерфейса программатора (interface/…cfg) или файл цели. Переустановите OpenOCD кнопкой «Установить OpenOCD» или укажите правильную папку.'),
  connectFailed: E('connect-failed', 'Не удалось подключиться к микроконтроллеру', 'Проверьте SWDIO, SWCLK, GND и питание, снизьте скорость SWD. Если прошивка отключает SWD-выводы, включите «Подключение при сбросе» (удерживайте NRST).'),
  timeout: E('timeout', 'Операция не уложилась во время', 'Плата не отвечает. Проверьте питание и провода, при необходимости включите «Подключение при сбросе».'),
  cancelled: E('cancelled', 'Остановлено', 'Операция прервана пользователем.'),
  unknown: E('unknown', 'OpenOCD завершился с ошибкой', 'Подробности — во вкладке «Вывод».')
} as const

/** Объясняет сбой по журналу OpenOCD. Порядок проверок важен: от более конкретного к общему. */
export function explainOpenOcdLog(log: string, kind: ProgrammerKind = 'stlink'): FlashError {
  const t = log
  const tx = KIND_TEXTS[kind]
  const noDriver = kind === 'stlink' ? ERR.noDriver : E('no-driver', tx.noDriverTitle, tx.noDriverHint)
  const noProbe = kind === 'stlink' ? ERR.noProbe : E('no-probe', tx.noProbeTitle, tx.noProbeHint)
  if (/нет блока TPIU/.test(t)) return E('unknown', 'У цели нет блока TPIU: SWO недоступен', 'Файл цели OpenOCD для этого чипа не создаёт объект TPIU (tpiu create), поэтому принять SWO через OpenOCD нельзя. Проверьте цель проекта (programmer.openocdTarget) или используйте UART.')
  if (/couldn't bind .*socket|Address already in use|Only one usage of each socket address/i.test(t)) return ERR.portBusy
  if (/Can't find (interface|target|openocd)|can't find .*\.cfg|embedded:startup\.tcl/i.test(t)) return ERR.noScripts
  if (/LIBUSB_ERROR_(NOT_SUPPORTED|ACCESS|NOT_FOUND|IO)|libusb_open\(\) failed|usb_open failed|failed to open .*ST-?LINK.*driver/i.test(t) && (kind !== 'stlink' || /ST-?LINK|libusb/i.test(t)) && !/No ST-?LINK/i.test(t)) return noDriver
  if (kind === 'jlink') {
    if (/Multiple devices found, specify the desired device/i.test(t)) return E('no-probe', 'Подключено несколько J-Link', 'Выберите нужный J-Link в списке программаторов панели «Прошивка» (выбор идёт по серийному номеру).')
    if (/Failed to open device/i.test(t)) return noDriver
    if (/No J-Link device found|jaylink_discovery_scan\(\) failed/i.test(t) && !/voltage/i.test(t)) return noProbe
    if (/Device supports JTAG transport only|Selected transport is not supported by the device/i.test(t)) return E('connect-failed', 'J-Link не поддерживает SWD', 'Этот J-Link (или его прошивка) не предлагает SWD. Pro-режим работает через SWD: попробуйте другой программатор или обновите прошивку J-Link.')
  }
  if (kind === 'cmsis-dap') {
    if (/unable to find a matching CMSIS-DAP device/i.test(t)) return noProbe
    if (/CMSIS-DAP: SWD not supported/i.test(t)) return E('connect-failed', 'Программатор не поддерживает SWD', NO_SWD_CMSIS)
  }
  if (/No ST-?LINK (detected|found)|no device found|ST-?LINK.*not found|open failed\s*$/im.test(t) && !/voltage/i.test(t)) return noProbe
  if (/device is protected|read protect|Flash.*protected|RDP.*(level|active)|stm32\w*x? device protected|Debug.*(read|access).*protect/i.test(t)) return ERR.readProtected
  if (/\*\*\s*Verify Failed|checksum mismatch|diff \d+ address 0x|verify failed/i.test(t)) return ERR.verifyFailed
  const v = targetVoltage(t)
  if (v !== null && v < 1.5 && /init mode failed|unable to connect|Cannot read IDR|DP initialisation failed|examination failed|AP.*not.*respond/i.test(t)) return ERR.noPower
  if (/UNEXPECTED idcode|expected \d+ of \d+: 0x[0-9a-f]+|Cannot identify target as a STM32|cannot identify target|device id mismatch|wrong target|invalid core id/i.test(t)) return ERR.wrongTarget
  if (/init mode failed|unable to connect to the target|Examination failed|DP initialisation failed|Cannot read IDR|Debug regions are unpowered|communication failure|jtag status contains invalid mode/i.test(t)) return v !== null && v < 1.5 ? ERR.noPower : ERR.connectFailed
  if (/timed out|timeout/i.test(t)) return ERR.timeout
  return ERR.unknown
}

export interface FlashSummary { wroteBytes?: number; seconds?: number; verified: boolean; deviceId?: string; flashKiB?: number; target?: string; probe?: string }

/** Итоги успешной прошивки из журнала. */
export function summarizeFlash(log: string): FlashSummary {
  const w = /wrote (\d+) bytes from file .* in ([0-9.]+)s/i.exec(log)
  const id = /device id = (0x[0-9a-f]+)/i.exec(log)
  const fl = /flash size = (\d+)\s*(?:KiB|kbytes)/i.exec(log)
  const tg = /\[([\w.]+)\]\s*(Cortex-M\d\+?[^\n]*?) processor detected/i.exec(log)
  const pr = /Info\s*:\s*(STLINK [^\n(]*|J-Link [^\n]*?(?= compiled|\n|$)|CMSIS-DAP: [^\n]*)/i.exec(log)
  return {
    wroteBytes: w ? Number(w[1]) : undefined,
    seconds: w ? Number(w[2]) : undefined,
    verified: /\*\*\s*Verified OK/i.test(log),
    deviceId: id?.[1],
    flashKiB: fl ? Number(fl[1]) : undefined,
    target: tg ? tg[2].trim() : undefined,
    probe: pr?.[1].trim()
  }
}

export class FlashFailure extends Error {
  readonly detail: FlashError
  constructor(detail: FlashError) { super(`${detail.title}. ${detail.hint}`); this.name = 'FlashFailure'; this.detail = detail }
}

/** «Нет программатора» и «нет драйвера» с текстами для конкретного типа (ST-Link, J-Link, CMSIS-DAP). */
export const noProbeError = (kind: ProgrammerKind): FlashError => E('no-probe', KIND_TEXTS[kind].noProbeTitle, KIND_TEXTS[kind].noProbeHint)
export const noDriverError = (kind: ProgrammerKind): FlashError => E('no-driver', KIND_TEXTS[kind].noDriverTitle, KIND_TEXTS[kind].noDriverHint)
