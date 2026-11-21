// Общий слой «тип программатора» Pro-режима: ST-Link, J-Link, CMSIS-DAP. Чистые данные и функции без Electron и Node:
// их используют и main (командная строка OpenOCD, список USB-устройств), и интерфейс (подписи, подсказки).
//
// Источники (проверены по документации; ничего не выдумано):
//  - OpenOCD User's Guide, openocd.org/doc: `adapter driver`, `adapter serial`, `transport select`; interface/{stlink,jlink,cmsis-dap}.cfg
//    (исходники OpenOCD v0.12.0, tcl/interface). interface/cmsis-dap.cfg и interface/jlink.cfg драйвер включают, транспорт выбирает пользователь.
//  - Для ST-Link (hla) транспорт `hla_swd`; для J-Link и CMSIS-DAP — `swd` (нативный DAP).
//  - VID/PID SEGGER J-Link: правила udev из OpenOCD (contrib/60-openocd.rules): VID 1366, PID 0101-0105, 0107, 0108, 1010-1018, 1020, 1051, 1055, 1061.
//    Руководство SEGGER: VID SEGGER всегда 1366, PID первого J-Link 0101, второго 0102 и т. д.
//  - CMSIS-DAP: OpenOCD без VID/PID находит устройства по строке продукта «CMSIS-DAP» (cmsis_dap_usb_bulk.c; правило udev ATTRS{product}=="*CMSIS-DAP*").
//    Известные: Arm DAPLink 0D28:0204 (микрокомпьютеры micro:bit, платы mbed), Raspberry Pi Debug Probe 2E8A:000C (документация Raspberry Pi).
//  - ST-Link: VID 0483, PID из probes.ts (3748, 374B, 3752, 374E, 374F, 3753, 3754).

export type ProgrammerKind = 'stlink' | 'jlink' | 'cmsis-dap'
export const PROGRAMMER_KINDS: readonly ProgrammerKind[] = ['stlink', 'jlink', 'cmsis-dap']
export const DEFAULT_PROGRAMMER: ProgrammerKind = 'stlink'

export interface ProgrammerSpec {
  kind: ProgrammerKind
  label: string
  /** Файл интерфейса OpenOCD (относительно папки scripts) */
  interfaceFile: string
  /** Команда выбора транспорта (SWD) */
  transportCmd: string
  /** Короткое пояснение «что это» для интерфейса */
  about: string
}

export const PROGRAMMERS: Record<ProgrammerKind, ProgrammerSpec> = {
  stlink: { kind: 'stlink', label: 'ST-Link', interfaceFile: 'interface/stlink.cfg', transportCmd: 'transport select hla_swd', about: 'ST-Link V2, V2-1 и V3, в том числе встроенный в Nucleo' },
  jlink: { kind: 'jlink', label: 'J-Link', interfaceFile: 'interface/jlink.cfg', transportCmd: 'transport select swd', about: 'SEGGER J-Link (и встроенные J-Link OB)' },
  'cmsis-dap': { kind: 'cmsis-dap', label: 'CMSIS-DAP', interfaceFile: 'interface/cmsis-dap.cfg', transportCmd: 'transport select swd', about: 'DAPLink, Raspberry Pi Debug Probe и другие совместимые с CMSIS-DAP' }
}

export const isProgrammerKind = (v: unknown): v is ProgrammerKind => typeof v === 'string' && (PROGRAMMER_KINDS as readonly string[]).includes(v)

/** Допускает старые и неполные значения: неизвестное становится ST-Link (старые файлы проекта). */
export function normalizeProgrammerKind(v: unknown): ProgrammerKind { return isProgrammerKind(v) ? v : DEFAULT_PROGRAMMER }

export const programmerLabel = (k: string): string => (isProgrammerKind(k) ? PROGRAMMERS[k].label : 'Программатор')

// ---------- USB ----------

export const VID = { st: '0483', segger: '1366', arm: '0D28', rpi: '2E8A' } as const

/** Известные CMSIS-DAP по VID:PID. Остальные ищутся по строке «CMSIS-DAP» в названии (так же делает OpenOCD). */
export const CMSIS_DAP_IDS: Record<string, string> = {
  '0D28:0204': 'DAPLink',
  '2E8A:000C': 'Raspberry Pi Debug Probe'
}

/** PID SEGGER из правил udev OpenOCD. Точная модель по PID не определяется (серийный номер и имя есть у самого J-Link), поэтому показываем «J-Link». */
export const JLINK_PIDS: readonly string[] = ['0101', '0102', '0103', '0104', '0105', '0107', '0108', '1010', '1011', '1012', '1013', '1014', '1015', '1016', '1017', '1018', '1020', '1051', '1055', '1061']

export const isJlinkPid = (pid: string): boolean => JLINK_PIDS.includes(pid.toUpperCase())

// ---------- тексты по типам (ошибки и пояснения) ----------

export interface KindTexts {
  noProbeTitle: string
  noProbeHint: string
  noDriverTitle: string
  noDriverHint: string
  /** Шаги для карточки «нет драйвера» */
  driverSteps: string[]
}

export const KIND_TEXTS: Record<ProgrammerKind, KindTexts> = {
  stlink: {
    noProbeTitle: 'ST-Link не найден',
    noProbeHint: 'Подключите ST-Link к USB-порту компьютера (на Nucleo — кабель в разъём ST-LINK). Если светодиод ST-Link не горит, смените кабель: бывают кабели «только для зарядки».',
    noDriverTitle: 'ST-Link виден, но нет драйвера',
    noDriverHint: 'Windows не отдала устройство программе. Установите драйвер ST-Link (STSW-LINK009 с сайта st.com) или привяжите WinUSB к ST-Link через Zadig, затем переподключите ST-Link.',
    driverSteps: [
      'Скачайте драйвер ST-Link (STSW-LINK009) с сайта st.com и установите его, либо привяжите WinUSB к ST-Link утилитой Zadig.',
      'Отключите ST-Link от USB и подключите снова.',
      'Нажмите «Проверить программатор снова».'
    ]
  },
  jlink: {
    noProbeTitle: 'J-Link не найден',
    noProbeHint: 'Подключите J-Link к USB-порту. Если он подключён, а OpenOCD пишет «No J-Link device found», скорее всего у J-Link стоит драйвер SEGGER, а не WinUSB: OpenOCD (через libjaylink) работает с WinUSB. Проверьте подключение и драйвер.',
    noDriverTitle: 'J-Link виден, но у него не тот драйвер',
    noDriverHint: 'OpenOCD открывает J-Link через WinUSB (libusb). Драйвер SEGGER для него не подходит. Рекомендация: привяжите WinUSB к J-Link утилитой Zadig (IDE ничего не устанавливает сама). После этого программы SEGGER (J-Flash, Ozone) перестанут видеть этот J-Link, пока вы не вернёте драйвер SEGGER.',
    driverSteps: [
      'Запустите Zadig (zadig.akeo.ie) и выберите в списке J-Link (Options → List All Devices).',
      'В поле драйвера выберите WinUSB и нажмите «Replace Driver» (или «Install»). IDE это не делает за вас.',
      'Отключите J-Link от USB и подключите снова, затем нажмите «Проверить программатор снова».'
    ]
  },
  'cmsis-dap': {
    noProbeTitle: 'CMSIS-DAP не найден',
    noProbeHint: 'Подключите DAPLink или другой CMSIS-DAP программатор (например, Raspberry Pi Debug Probe) к USB. OpenOCD ищет устройства, в названии которых есть «CMSIS-DAP»; если у вашего устройства другое название, укажите VID/PID вручную в настройках OpenOCD.',
    noDriverTitle: 'CMSIS-DAP виден, но недоступен для OpenOCD',
    noDriverHint: 'Windows не отдала устройство программе. У CMSIS-DAP v2 (USB bulk) нужен драйвер WinUSB (на DAPLink он выдаётся устройством сам); v1 работает как HID без драйвера. Проверьте «Диспетчер устройств» или привяжите WinUSB утилитой Zadig.',
    driverSteps: [
      'Откройте «Диспетчер устройств» и найдите программатор без жёлтого значка.',
      'Если у интерфейса CMSIS-DAP v2 нет драйвера, привяжите WinUSB утилитой Zadig (IDE ничего не устанавливает сама).',
      'Отключите программатор от USB и подключите снова, затем нажмите «Проверить программатор снова».'
    ]
  }
}

export const NO_SWD_CMSIS = 'Этот CMSIS-DAP программатор не поддерживает SWD (OpenOCD: «SWD not supported»). Pro-режим работает через SWD.'
