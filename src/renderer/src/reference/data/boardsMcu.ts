import type { BoardEntry, PinInfo } from '../types'
import { stm32Funcs } from './stm32Funcs'

/**
 * Платы Raspberry Pi Pico (RP2040/RP2350) и STM32.
 * Pico: функции выводов — по таблице функций GPIO RP2040 (Pico datasheet, рис. 2; RP2040 datasheet, табл. «GPIO functions»).
 * STM32: имена выводов Arduino ↔ порт и функции (ADC, таймеры/ШИМ, I2C, SPI, UART, CAN, USB) — из таблиц PeripheralPins.c и variant_*.h
 * ядра STM32duino (https://github.com/stm32duino/Arduino_Core_STM32), см. data/stm32Funcs.ts.
 */

const pw = (label: string, kind: NonNullable<PinInfo['kind']>, notes: string, functions: string[] = []): PinInfo => ({ label, gpio: null, functions, notes, kind })
const GND = (extra = ''): PinInfo => pw('GND', 'gnd', 'Земля (общий провод).' + extra)
const NC = (notes = 'Не подключён.'): PinInfo => pw('NC', 'nc', notes)

// ---------- RP2040 / RP2350: выводы GP0–GP28 ----------

const UART_BUS = [0, 1, 1, 0, 0, 1, 1, 0]
const SPI_ROLE = ['MISO (RX)', 'SS (CSn)', 'SCK', 'MOSI (TX)']
const UART_ROLE = ['TX', 'RX', 'CTS', 'RTS']

export function gp(n: number, notes?: string, special?: PinInfo['special']): PinInfo {
  const f: string[] = ['GPIO']
  if (n >= 26 && n <= 29) f.push(`ADC${n - 26}`)
  f.push(`I2C${(n >> 1) & 1} ${n % 2 === 0 ? 'SDA' : 'SCL'}`)
  f.push(`UART${UART_BUS[n >> 2]} ${UART_ROLE[n % 4]}`)
  f.push(`SPI${(n >> 3) & 1} ${SPI_ROLE[n % 4]}`)
  f.push(`PWM${(n >> 1) & 7} ${n % 2 === 0 ? 'A' : 'B'}`)
  return { label: `GP${n}`, gpio: n, functions: f, notes, special, plain: true }
}

const PICO_NOTE_ADC = 'ADC 12 бит, 500 квыб/с; опорное напряжение — ADC_VREF. Вход не должен превышать 3.3 В (+0.3 В): у этих выводов есть обратный диод на питание IOVDD.'

function picoPins(variant: 'pico' | 'picow' | 'pico2'): PinInfo[] {
  const pins: PinInfo[] = []
  for (let n = 0; n <= 22; n++) pins.push(gp(n, n === 0 ? 'Физический вывод 1. UART0 TX по умолчанию в ядре arduino-pico (Serial1).' : n === 1 ? 'Физический вывод 2. UART0 RX по умолчанию (Serial1).' : undefined))
  pins.push(gp(26, PICO_NOTE_ADC), gp(27, PICO_NOTE_ADC), gp(28, PICO_NOTE_ADC))
  const vbus = variant === 'pico2' ? 'VBUS — 5 В с micro-USB (физ. вывод 40); при питании не от USB — 0 В.' : 'VBUS — 5 В с micro-USB (физ. вывод 40); при питании не от USB — 0 В.'
  pins.push(
    GND(' На Pico 8 выводов GND: 3, 8, 13, 18, 23, 28, 38 и AGND (33) отдельно.'),
    pw('RUN', 'reset', 'Физ. вывод 30. Разрешение работы RP: внутренняя подтяжка ≈ 50 кОм к 3.3 В; замкнуть на землю — сброс микроконтроллера. Источник: Pico datasheet.'),
    pw('ADC_VREF', 'ref', 'Физ. вывод 35. Питание и опора АЦП: на плате получается фильтрацией 3.3 В; можно подать внешнюю опору для точности.'),
    pw('AGND', 'gnd', 'Физ. вывод 33. Земля аналоговой части для GP26–GP29; если АЦП не используется — можно соединить с GND.'),
    pw('3V3', 'power', 'Физ. вывод 36. Выход 3.3 В от импульсного стабилизатора платы (питает RP и GPIO). Рекомендуется нагрузка менее 300 мА. Источник: Pico datasheet.'),
    pw('3V3_EN', 'reset', 'Физ. вывод 37. Включение стабилизатора 3.3 В; подтянут к VSYS резистором 100 кОм. Замкнуть на землю — выключить 3.3 В (и RP).'),
    pw('VSYS', 'power', 'Физ. вывод 39. Основное питание платы 1.8–5.5 В (стабилизатор делает из него 3.3 В). Подавать через диод (ИЛИ) с VBUS.'),
    pw('VBUS', 'power', vbus)
  )
  return pins
}

const picoSources = (extra: string[]): string[] => ['https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf', ...extra]

const PICO_COMMON = [
  'Все выводы GP — 3.3 В, 5 В на них подавать нельзя. Максимальный ток: 12 мА на вывод по умолчанию (настраивается 2/4/8/12 мА) — проверьте по таблице «GPIO» даташита RP2040.',
  'На любой GPIO можно вывести почти любую периферию: показаны функции по таблице функций GPIO RP2040 — I2C0/I2C1, UART0/UART1, SPI0/SPI1, 8 слайсов ШИМ (A/B). Одновременно на одном выводе — только одна функция; пины одной шины нельзя брать произвольно: I2C SDA — чётные GP (GP0, GP4, GP8…), SCL — нечётные.',
  'Выводы в схеме и на плате: левый ряд сверху вниз — физические выводы 1–20, правый ряд сверху вниз — 40–21 (USB наверху).',
  'Размер 51 × 21 мм, шаг 2.54 мм, расстояние между рядами 17.78 мм (7 шагов); по краям — позолоченные «кастелляции» для монтажа как SMD-модуля, 4 крепёжных отверстия Ø2.1 мм. Рисунок платы — упрощённая деталь Fritzing от Raspberry Pi, расположение мелких компонентов приблизительное.'
]

const PICO_ADC_NOTE = 'АЦП: GP26–GP28 = ADC0–ADC2 (3 канала на выводах), ADC3 = внутренний делитель VSYS/3 (GP29, на выводы не выведен), ADC4 = встроенный датчик температуры. 12 бит (в arduino-pico analogRead по умолчанию 10 бит — analogReadResolution(12)).'

export const rp2040Boards: BoardEntry[] = [
  {
    id: 'rpi-pico', name: 'Raspberry Pi Pico (RP2040)', mcu: 'RP2040', platform: 'rp2040',
    pins: picoPins('pico'),
    electrical: {
      logic: 'Логика 3.3 В (IOVDD фиксирован платой).',
      current: 'Источник/приёмник на вывод — 2/4/8/12 мА (по умолчанию 4 мА); суммарный ток ограничен питанием — проверьте даташит RP2040.',
      supply: 'USB 5 В (VBUS) или 1.8–5.5 В на VSYS',
      tolerant: 'нет: GPIO не 5V-tolerant (вход до IOVDD + 0.3 В)'
    },
    specs: [
      ['Ядро', '2 × Arm Cortex-M0+, до 133 МГц'],
      ['ОЗУ', '264 КБ SRAM (6 банков)'],
      ['Флеш', '2 МБ QSPI, внешний (XIP, кэш 16 КБ)'],
      ['PIO', '2 блока, 8 конечных автоматов'],
      ['GPIO', '26 на гребёнках (GP0–GP22, GP26–GP28); 30 в чипе'],
      ['Служебные GPIO', 'GP23 — SMPS PS (не использовать), GP24 — VBUS sense, GP25 — светодиод, GP29 — ADC3 (VSYS/3)'],
      ['АЦП', '12 бит, 500 квыб/с; 3 внешних канала + температура']
    ],
    notes: [
      ...PICO_COMMON,
      'Не выведены на гребёнки, но заняты платой: GP23 (управление режимом SMPS, не использовать), GP24 (определение VBUS, вход), GP25 (светодиод LED_BUILTIN, активный высокий уровень), GP29 (ADC3: измеряет VSYS/3). GP25 и GP23 доступны как контрольные площадки TP5/TP4. Источник: Pico datasheet, раздел 2.1.',
      PICO_ADC_NOTE,
      'Отладка: 3-контактный разъём SWD (SWCLK, GND, SWDIO) на нижнем торце платы; кнопка BOOTSEL — загрузка в режиме USB-накопителя (держать при подключении USB).',
      'Основной источник: официальный Raspberry Pi Pico Datasheet (CC BY-ND 4.0): рисунок 2/4 — назначение и нумерация выводов.'
    ]
  },
  {
    id: 'rpi-pico-w', name: 'Raspberry Pi Pico W (RP2040 + CYW43439)', mcu: 'RP2040', platform: 'rp2040',
    pins: picoPins('picow'),
    electrical: {
      logic: 'Логика 3.3 В (IOVDD фиксирован платой).',
      current: 'Источник/приёмник на вывод — 2/4/8/12 мА (по умолчанию 4 мА); проверьте даташит RP2040.',
      supply: 'USB 5 В (VBUS) или 1.8–5.5 В на VSYS',
      tolerant: 'нет: GPIO не 5V-tolerant'
    },
    specs: [
      ['Ядро', '2 × Arm Cortex-M0+, до 133 МГц'],
      ['ОЗУ', '264 КБ SRAM'],
      ['Флеш', '2 МБ QSPI, внешний'],
      ['PIO', '2 блока, 8 конечных автоматов'],
      ['Беспроводная связь', 'Infineon CYW43439: Wi-Fi 2.4 ГГц (802.11n), Bluetooth; антенна на плате'],
      ['Служебные GPIO', 'GP23 — WL_ON, GP24 — SPI-данные/IRQ радиомодуля, GP25 — CS радиомодуля, GP29 — SPI CLK радиомодуля / ADC3 (VSYS/3)'],
      ['Светодиод', 'на выводе WL_GPIO0 радиомодуля (не на GP25)']
    ],
    notes: [
      ...PICO_COMMON,
      'На Pico W GP23, GP24, GP25 и GP29 заняты радиомодулем CYW43439 (SPI) и на гребёнки не выведены; не использовать. Светодиод — WL_GPIO0 радиомодуля (управляется через драйвер CYW43, а не через digitalWrite(25)). Источник: Pico W datasheet, раздел 2.',
      'ADC3 (VSYS/3, GP29) читается только когда нет SPI-обмена с радиомодулем (GP25 в высоком уровне разрешает чтение). Внешних каналов АЦП по-прежнему 3 (GP26–GP28) + температурный датчик ADC4.',
      'Антенну нельзя закрывать металлом: зона вокруг неё на нижнем торце платы (около 14 × 9 мм) должна быть свободной. Антенна лицензирована у Abracon (Niche™).',
      'Отладка SWD: 3 контакта на нижнем торце; BOOTSEL — загрузка в режиме USB-накопителя.'
    ]
  },
  {
    id: 'rpi-pico-2', name: 'Raspberry Pi Pico 2 (RP2350)', mcu: 'RP2350A', platform: 'rp2040',
    pins: picoPins('pico2'),
    electrical: {
      logic: 'Логика 3.3 В (GPIO питаются от 3.3 В платы).',
      current: 'Ток вывода настраивается (2/4/8/12 мА); проверьте даташит RP2350.',
      supply: 'USB 5 В (VBUS) или 1.8–5.5 В на VSYS',
      tolerant: 'не заявлено в даташите Pico 2: считайте 3.3 В; входы GP26–GP29 не должны превышать IOVDD + 0.3 В'
    },
    specs: [
      ['Ядро', '2 × Arm Cortex-M33 или 2 × RISC-V Hazard3 (выбор при старте), до 150 МГц'],
      ['ОЗУ', '520 КБ SRAM'],
      ['Флеш', '4 МБ QSPI, внешний'],
      ['PIO', '3 блока, 12 конечных автоматов'],
      ['GPIO', '26 на гребёнках; 30 в RP2350A'],
      ['Служебные GPIO', 'GP23 — SMPS PS, GP24 — VBUS sense, GP25 — светодиод, GP29 — ADC3 (VSYS/3)']
    ],
    notes: [
      ...PICO_COMMON,
      'Pico 2 совместима с Pico по выводам (тот же 40-пиновый DIP-формат и распиновка); отличия: RP2350A, флеш 4 МБ, ОЗУ 520 КБ, ядра Cortex-M33/Hazard3, 3 блока PIO. Источник: Pico 2 datasheet, раздел 2.',
      'Не выведены, но заняты: GP23 (SMPS PS, не использовать), GP24 (VBUS sense), GP25 (светодиод), GP29 (ADC3 = VSYS/3).',
      'Выводы GP26–GP29 (АЦП) имеют обратный диод на IOVDD: вход не выше 3.3 В + ≈0.3 В, при неподключённом питании RP2350 подача напряжения «утекает» в рейку IOVDD. Обычные GPIO0–GP25 и отладочные выводы такого ограничения не имеют. Источник: Pico 2 datasheet, раздел 5.2.',
      'Рисунок платы — упрощённая деталь Fritzing от Raspberry Pi (без шёлкографии), положение компонентов условное. Поддержка Pico 2 в arduino-pico зависит от версии ядра (проверьте в менеджере плат).'
    ]
  }
].map((b) => ({ ...b, source: picoSources(
  b.id === 'rpi-pico' ? ['https://datasheets.raspberrypi.com/pico/pico-datasheet.pdf']
  : b.id === 'rpi-pico-w' ? ['https://datasheets.raspberrypi.com/picow/pico-w-datasheet.pdf']
  : ['https://datasheets.raspberrypi.com/pico/pico-2-datasheet.pdf', 'https://datasheets.raspberrypi.com/rp2350/rp2350-datasheet.pdf']
) })) as BoardEntry[]

// ---------- STM32 ----------

type Chip = 'f103c8' | 'f411ce' | 'f401re' | 'l432kc'
interface StOpts { extra?: string[]; notes?: string; special?: PinInfo['special']; fiveV?: boolean }
const st = (chip: Chip, name: string, o: StOpts = {}): PinInfo => ({
  label: name, gpio: null, code: name,
  functions: ['GPIO', ...(stm32Funcs[chip][name] ?? []), ...(o.extra ?? [])],
  notes: o.notes, special: o.special, fiveV: o.fiveV
})
const stBoard = (chip: Chip) => (name: string, o: StOpts = {}): PinInfo => st(chip, name, o)

const JTAG = 'Выход JTAG после сброса (JTDO/JTDI/NJTRST); пока JTAG не отключён в программе, использовать как GPIO нельзя (отключение: AFIO remap, оставляя SWD). Источник: RM0008.'

// --- Blue Pill (STM32F103C8T6)
const bp = stBoard('f103c8')
const BP_FT = new Set(['PA8', 'PA9', 'PA10', 'PA11', 'PA12', 'PA13', 'PA14', 'PA15', 'PB2', 'PB3', 'PB4', 'PB5', 'PB6', 'PB7', 'PB8', 'PB9', 'PB10', 'PB11', 'PB12', 'PB13', 'PB14', 'PB15'])
const bpPin = (name: string, o: StOpts = {}): PinInfo => bp(name, { fiveV: BP_FT.has(name), ...o })

const bluePillPins: PinInfo[] = [
  bpPin('PA0', { extra: ['WKUP'] }), bpPin('PA1'), bpPin('PA2', { extra: ['USART2 TX'] }), bpPin('PA3', { extra: ['USART2 RX'] }), bpPin('PA4', { extra: ['SPI1 SS'] }),
  bpPin('PA5', { extra: ['SPI1 SCK'] }), bpPin('PA6', { extra: ['SPI1 MISO'] }), bpPin('PA7', { extra: ['SPI1 MOSI'] }),
  bpPin('PA8', { extra: ['MCO'] }), bpPin('PA9', { extra: ['USART1 TX'], notes: 'USART1 TX — Serial по умолчанию в ядре STM32duino для Blue Pill (SERIAL_UART_INSTANCE 1).' }),
  bpPin('PA10', { extra: ['USART1 RX'] }),
  bpPin('PA11', { special: 'usb', notes: 'USB D− (и CAN RX): на плате подключён к USB-разъёму; не использовать как GPIO при работе с USB.' }),
  bpPin('PA12', { special: 'usb', notes: 'USB D+ (и CAN TX): подтяжка D+ на плате у части клонов выполнена резистором неверного номинала (известная проблема Blue Pill) — не подтверждено первоисточником.' }),
  bpPin('PA15', { special: 'warning', extra: ['JTDI'], notes: JTAG }),
  bpPin('PB0'), bpPin('PB1'),
  bpPin('PB3', { special: 'warning', extra: ['JTDO / SWO'], notes: JTAG }),
  bpPin('PB4', { special: 'warning', extra: ['NJTRST'], notes: JTAG }),
  bpPin('PB5'), bpPin('PB6', { notes: 'I2C1 SCL: Wire по умолчанию в ядре (PB7 = SDA).' }), bpPin('PB7'), bpPin('PB8'), bpPin('PB9'),
  bpPin('PB10'), bpPin('PB11'), bpPin('PB12', { extra: ['SPI2 SS'] }), bpPin('PB13', { extra: ['SPI2 SCK'] }), bpPin('PB14', { extra: ['SPI2 MISO'] }), bpPin('PB15', { extra: ['SPI2 MOSI'] }),
  bpPin('PC13', { special: 'warning', extra: ['LED_BUILTIN'], notes: 'Светодиод платы (включается низким уровнем). Вывод слаботочный: источник/приёмник не более 3 мА, частота ≤ 2 МГц — внешнюю нагрузку не подключать. Источник: RM0008 / datasheet, ограничения PC13–PC15.' }),
  bpPin('PC14', { special: 'warning', extra: ['OSC32_IN'], notes: 'Вход кварца часов реального времени 32.768 кГц; слаботочный (≤ 3 мА).' }),
  bpPin('PC15', { special: 'warning', extra: ['OSC32_OUT'], notes: 'Выход кварца часов реального времени 32.768 кГц; слаботочный (≤ 3 мА).' }),
  bp('PA13', { extra: ['SWDIO'], fiveV: true, notes: 'Данные SWD (разъём SWD «DIO»). Назначение по умолчанию после сброса — не занимать, иначе пропадёт отладка/прошивка по ST-Link.' }),
  bp('PA14', { extra: ['SWCLK'], fiveV: true, notes: 'Такт SWD (разъём SWD «CLK»). Не занимать, иначе пропадёт отладка/прошивка по ST-Link.' }),
  pw('NRST', 'reset', 'Сброс микроконтроллера (на плате «R»): низкий уровень — перезапуск. Дублирует кнопку RESET.'),
  pw('VBAT', 'power', 'Питание часов реального времени и резервных регистров от батареи 1.8–3.6 В (на плате «VB»). По умолчанию соединён с 3.3 В платы.'),
  pw('3V3', 'power', 'Шина 3.3 В: выход стабилизатора платы (≈ 100 мА); два вывода «3.3» на гребёнках и один на разъёме SWD соединены.'),
  pw('5V', 'power', 'Шина 5 В: напрямую соединена с VBUS разъёма USB (вход питания платы или выход USB-5 В). Не подавайте одновременно USB и внешние 5 В.'),
  GND(' Несколько выводов GND на плате соединены.')
]

// --- Black Pill (WeAct STM32F411CEU6)
const kp = stBoard('f411ce')
const blackPillPins: PinInfo[] = [
  kp('PA0', { extra: ['KEY (кнопка, активный низкий)'], notes: 'Пользовательская кнопка KEY на плате (подтягивает вывод к земле при нажатии); также WKUP.' }),
  kp('PA1'), kp('PA2', { extra: ['USART2 TX'] }), kp('PA3', { extra: ['USART2 RX'] }), kp('PA4'), kp('PA5'), kp('PA6'), kp('PA7'),
  kp('PA8'), kp('PA9', { extra: ['USART1 TX'], notes: 'USART1 TX: Serial по умолчанию в ядре STM32duino (PA9/PA10).' }), kp('PA10', { extra: ['USART1 RX'] }),
  kp('PA11', { special: 'usb', notes: 'USB D− (OTG FS): подключён к разъёму USB-C через резистор 10 Ом; не использовать как GPIO при работе с USB.' }),
  kp('PA12', { special: 'usb', notes: 'USB D+ (OTG FS): подключён к разъёму USB-C через резистор 10 Ом; не использовать как GPIO при работе с USB.' }),
  kp('PA15', { special: 'warning', extra: ['JTDI'], notes: 'Выход JTAG (JTDI) после сброса; можно перенастроить, оставив SWD.' }),
  kp('PB0'), kp('PB1'),
  kp('PB2', { special: 'strapping', extra: ['BOOT1'], notes: 'BOOT1: вместе с BOOT0 выбирает область загрузки; в норме держать низкий уровень при старте.' }),
  kp('PB3', { special: 'warning', extra: ['JTDO / SWO'], notes: 'Выход JTAG (JTDO), трассировка SWO; можно перенастроить.' }),
  kp('PB4', { special: 'warning', extra: ['NJTRST'], notes: 'Выход JTAG (NJTRST) после сброса; можно перенастроить.' }),
  kp('PB5'), kp('PB6', { notes: 'I2C1 SCL: Wire по умолчанию в ядре (PB7 = SDA).' }), kp('PB7'), kp('PB8'), kp('PB9'), kp('PB10'),
  kp('PB12'), kp('PB13'), kp('PB14'), kp('PB15'),
  kp('PC13', { special: 'warning', extra: ['LED_BUILTIN'], notes: 'Светодиод платы (включается низким уровнем). Вывод слаботочный: ограничение тока PC13–PC15 (до 3 мА) по даташиту STM32F411 — не нагружать.' }),
  kp('PC14', { special: 'warning', extra: ['OSC32_IN'], notes: 'Вход кварца 32.768 кГц (LSE) — на плате установлен; слаботочный.' }),
  kp('PC15', { special: 'warning', extra: ['OSC32_OUT'], notes: 'Выход кварца 32.768 кГц (LSE); слаботочный.' }),
  kp('PA13', { extra: ['SWDIO'], notes: 'Данные SWD (разъём SWD «DIO»). Не занимать, иначе пропадёт отладка.' }),
  kp('PA14', { extra: ['SWCLK'], notes: 'Такт SWD (разъём SWD «CLK»). Не занимать, иначе пропадёт отладка.' }),
  pw('NRST', 'reset', 'Сброс микроконтроллера (на плате «R»); дублирует кнопку NRST.'),
  pw('VBAT', 'power', 'Питание часов реального времени от батареи (на плате «VB»), 1.65–3.6 В; на плате соединён с 3.3 В.'),
  pw('3V3', 'power', 'Шина 3.3 В: выход стабилизатора AP7343 (до 300 мА) либо вход внешнего 3.3 В.'),
  pw('5V', 'power', 'Шина 5 В: прямо соединена с VBUS разъёма USB-C без защиты — не питайте одновременно от USB и внешним 5 В.'),
  GND(' Несколько выводов GND соединены.')
]

// --- Nucleo-64 (NUCLEO-F401RE)
const nu = stBoard('f401re')
const nuNote: Record<string, StOpts> = {
  PA2: { extra: ['USART2 TX (VCP ST-LINK)'], notes: 'USART2 TX: соединён с виртуальным COM-портом ST-LINK (перемычки SB13/SB14): Serial по умолчанию. Arduino D1.' },
  PA3: { extra: ['USART2 RX (VCP ST-LINK)'], notes: 'USART2 RX: виртуальный COM-порт ST-LINK. Arduino D0.' },
  PA5: { extra: ['LED_BUILTIN (LD2)'], notes: 'Зелёный светодиод LD2 (включается высоким уровнем); он же D13/SCK. Источник: STM32duino variant_NUCLEO_F401RE.h (LED_GREEN = PA5).' },
  PC13: { extra: ['B1 USER (кнопка)'], notes: 'Синяя кнопка B1 USER (при нажатии — низкий уровень). Источник: STM32duino variant (USER_BTN = PC13).' },
  PA13: { extra: ['SWDIO'], notes: 'Данные SWD (подключены к ST-LINK). Не занимать — пропадёт отладка/прошивка.' },
  PA14: { extra: ['SWCLK'], notes: 'Такт SWD (подключён к ST-LINK). Не занимать.' },
  PB3: { extra: ['SWO'], notes: 'Трассировка SWO (JTDO). Arduino D3.' },
  PA15: { special: 'warning', extra: ['JTDI'], notes: 'Вывод JTAG (JTDI) после сброса; можно перенастроить.' },
  PB4: { special: 'warning', extra: ['NJTRST'], notes: 'Вывод JTAG (NJTRST) после сброса; можно перенастроить.' },
  PA11: { special: 'usb', extra: [], notes: 'USB OTG FS D− (на плате USB-разъём не установлен — выведен на Morpho).' },
  PA12: { special: 'usb', extra: [], notes: 'USB OTG FS D+ (на плате USB-разъём не установлен — выведен на Morpho).' },
  PB8: { notes: 'I2C1 SCL (Arduino D15 / SCL), Wire по умолчанию.' },
  PB9: { notes: 'I2C1 SDA (Arduino D14 / SDA), Wire по умолчанию.' },
  PC14: { extra: ['OSC32_IN'] }, PC15: { extra: ['OSC32_OUT'] },
  PH0: { extra: ['OSC_IN'] }, PH1: { extra: ['OSC_OUT'] }
}
const NUCLEO64_NAMES = ['PA0', 'PA1', 'PA2', 'PA3', 'PA4', 'PA5', 'PA6', 'PA7', 'PA8', 'PA9', 'PA10', 'PA11', 'PA12', 'PA13', 'PA14', 'PA15', 'PB0', 'PB1', 'PB2', 'PB3', 'PB4', 'PB5', 'PB6', 'PB7', 'PB8', 'PB9', 'PB10', 'PB12', 'PB13', 'PB14', 'PB15', 'PC0', 'PC1', 'PC2', 'PC3', 'PC4', 'PC5', 'PC6', 'PC7', 'PC8', 'PC9', 'PC10', 'PC11', 'PC12', 'PC13', 'PC14', 'PC15', 'PD2', 'PH0', 'PH1']
const nucleo64Pins: PinInfo[] = [
  ...NUCLEO64_NAMES.map((n) => nu(n, nuNote[n] ?? {})),
  pw('NRST', 'reset', 'Сброс (RESET на CN6/CN7): низкий уровень — перезапуск; дублирует чёрную кнопку B2 RESET.'),
  pw('BOOT0', 'power', 'Вход BOOT0 (Morpho CN7-7): высокий уровень при сбросе — загрузка из системной памяти (DFU/UART). Подтянут к земле на плате.'),
  pw('IOREF', 'ref', 'Опорное напряжение логики платы (3.3 В) для шилдов Arduino.'),
  pw('3V3', 'power', 'Выход стабилизатора 3.3 В (LD39050PU33R) — до 500 мА суммарно.'),
  pw('5V', 'power', 'Шина 5 В: выход (от USB ST-LINK / VIN / E5V). Питание платы отсюда не подавать.'),
  pw('VIN', 'power', 'Вход внешнего питания 7–12 В (Arduino-совместимо).'),
  pw('E5V', 'power', 'Вход внешнего 5 В (JP5 в положении E5V); без перемычки — не питает плату.'),
  pw('U5V', 'power', '5 В от USB ST-LINK (выход, для JP5).'),
  pw('VDD', 'power', 'VDD микроконтроллера (3.3 В), CN7-5; используется для измерения тока (JP6/IDD).'),
  pw('AVDD', 'ref', 'Питание аналоговой части/опора АЦП VDDA (CN5/CN10-7).'),
  pw('AGND', 'gnd', 'Земля аналоговой части (CN10-32).'),
  pw('VBAT', 'power', 'Питание батарейного домена (CN7-33): на плате соединён с VDD через резистор/перемычку (по умолчанию — 3.3 В; проверьте SB по схеме).'),
  GND(' Несколько выводов GND соединены.'),
  NC('Не подключён (резервируется).')
]

// --- Nucleo-32 (NUCLEO-L432KC)
const nk = stBoard('l432kc')
const nucleo32Pins: PinInfo[] = [
  nk('PA10', { extra: ['USART1 RX (Serial1)'], notes: 'Arduino D0 (RX).' }),
  nk('PA9', { extra: ['USART1 TX (Serial1)'], notes: 'Arduino D1 (TX).' }),
  nk('PA12', { notes: 'Arduino D2.' }), nk('PB0', { notes: 'Arduino D3.' }),
  nk('PB7', { notes: 'Arduino D4; I2C1 SDA — Wire по умолчанию в ядре STM32duino для этой платы.' }), nk('PB6', { notes: 'Arduino D5; I2C1 SCL — Wire по умолчанию.' }),
  nk('PB1', { notes: 'Arduino D6.' }),
  nk('PC14', { special: 'warning', notes: 'Arduino D7. По умолчанию перемычка SB6 разомкнута: PC14 не подключён к D7 (variant_NUCLEO_L432KC.h) — для использования замкнуть SB6.' }),
  nk('PC15', { special: 'warning', notes: 'Arduino D8. По умолчанию перемычка SB8 разомкнута: PC15 не подключён к D8 — замкнуть SB8.' }),
  nk('PA8', { notes: 'Arduino D9.' }), nk('PA11', { special: 'usb', notes: 'Arduino D10; также USB D− (USB-разъёма на плате нет).' }),
  nk('PB5', { notes: 'Arduino D11 (SPI1 MOSI).' }), nk('PB4', { notes: 'Arduino D12 (SPI1 MISO).' }),
  nk('PB3', { extra: ['LED_BUILTIN (LD3)'], notes: 'Arduino D13 (SPI1 SCK) и зелёный светодиод LD3 (STM32duino: LED_BUILTIN = PB3).' }),
  nk('PA0', { notes: 'Arduino A0.' }), nk('PA1', { notes: 'Arduino A1.' }), nk('PA3', { extra: ['USART2 RX'], notes: 'Arduino A2.' }), nk('PA4', { notes: 'Arduino A3.' }),
  nk('PA5', { notes: 'Arduino A4 (в ядре STM32duino A4 = PA5; I2C-линии Wire — на D4/D5, а не на A4/A5).' }), nk('PA6', { notes: 'Arduino A5 (PA6).' }),
  nk('PA7', { notes: 'Arduino A6.' }), nk('PA2', { extra: ['USART2 TX (VCP ST-LINK)'], notes: 'Arduino A7; также TX виртуального COM-порта ST-LINK (SB2).' }),
  pw('NRST', 'reset', 'Сброс микроконтроллера (RESET на CN3/CN4): низкий уровень — перезапуск; дублирует кнопку RESET.'),
  pw('AREF', 'ref', 'Опорное напряжение АЦП (VREF+) — на CN4 «AREF»; по умолчанию через перемычку соединён с VDDA.'),
  pw('3V3', 'power', 'Выход стабилизатора 3.3 В.'),
  pw('5V', 'power', 'Шина 5 В (от USB ST-LINK / VIN).'),
  pw('VIN', 'power', 'Вход внешнего питания (7–12 В); Arduino-Nano-совместимо.'),
  GND()
]

const LOGIC33 = 'Логика 3.3 В.'
const FT_NOTE = 'FT (5V-tolerant) — выводы, выдерживающие 5 В, перечислены в таблице выводов даташита; помечены на схеме зелёным кольцом.'

export const stm32Boards: BoardEntry[] = [
  {
    id: 'bluepill', name: 'Blue Pill (STM32F103C8T6)', mcu: 'STM32F103C8T6', platform: 'stm32',
    pins: bluePillPins,
    electrical: {
      logic: LOGIC33 + ' VDD 2.0–3.6 В.',
      current: 'До 25 мА с вывода (абсолютный максимум), суммарно по портам ограничено; PC13–PC15 — не более 3 мА.',
      supply: 'USB 5 В (micro-USB) или 5 В на «5V»; стабилизатор на плате даёт 3.3 В, либо 3.3 В прямо на «3.3»',
      tolerant: 'FT-выводы: PA8–PA15, PB2–PB15 выдерживают 5 В (зелёное кольцо); PA0–PA7, PB0, PB1 и PC13–PC15 — нет'
    },
    specs: [
      ['Ядро', 'Arm Cortex-M3, до 72 МГц'],
      ['Флеш / ОЗУ', '64 КБ (по даташиту; на многих платах реально 128 КБ) / 20 КБ'],
      ['Логика', '3.3 В'],
      ['5V-tolerant', 'PA8–PA15, PB2–PB15 (кроме PB0, PB1)'],
      ['АЦП', '2 × 12 бит, 10 каналов (PA0–PA7, PB0, PB1)'],
      ['Интерфейсы', '3 USART, 2 SPI, 2 I2C, USB 2.0 FS, CAN 2.0B'],
      ['Загрузка', 'перемычки BOOT0/BOOT1 (BOOT1 = PB2)']
    ],
    notes: [
      'Порядок выводов (USB слева, как на схеме): верхний ряд слева направо — G, G, 3.3, R(NRST), B11, B10, B1, B0, A7…A0, C15, C14, C13, VB(VBAT); нижний — B12, B13, B14, B15, A8…A12, A15, B3…B9, 5V, G, 3.3; разъём SWD (4 контакта) у дальнего торца: 3.3, DIO (PA13), CLK (PA14), GND. Порядок взят с описания плат на stm32-base.org; расстояние между рядами 17.78 мм (0.7″) и размеры платы (≈ 53 × 22.8 мм) приблизительные, не подтверждены чертежом — сверяйтесь с шёлкографией. Источник: https://stm32-base.org/boards/STM32F103C8T6-Blue-Pill',
      'Имена выводов в коде — «PA0», «PC13» и т.п. (pinMode(PC13, OUTPUT)); PB2 (BOOT1) на гребёнку не выведен.',
      'Загрузка: BOOT0 = 0 — запуск из флеша, BOOT0 = 1 — системный загрузчик (UART1: PA9/PA10); BOOT1 = PB2. Перемычки — два трёхконтактных разъёма у кнопки RESET.',
      'Часто встречаются «клоны» с другими кристаллами (CKS32F103C8T6, GD32F103 и т.п.): идентификатор в отладчике отличается (напр. 0x2BA01477 вместо 0x1BA01477), объём флеша может быть 128 КБ, частота — до 108 МГц у GD32. Прошивка по ST-Link без исправления ID не пройдёт.',
      'Функции выводов (ADC, ШИМ-таймеры, I2C, SPI, USART, CAN, USB) — по таблицам PeripheralPins.c ядра STM32duino (с учётом ремапов AFIO): одна и та же периферия может быть доступна на нескольких выводах.',
      FT_NOTE + ' Отметки FT для F103 — по сводке из даташита DS5319; прямую проверку по PDF ST выполнить не удалось (сайт ST недоступен).',
      'PA11/PA12 — USB D−/D+ (на плате подтяжка D+ — резистор); PA13/PA14 — SWD (разъём SWD), PA15/PB3/PB4 — выводы JTAG после сброса.'
    ]
  },
  {
    id: 'blackpill-f411', name: 'Black Pill (WeAct STM32F411CEU6)', mcu: 'STM32F411CEU6', platform: 'stm32',
    pins: blackPillPins,
    electrical: {
      logic: LOGIC33 + ' VDD 1.7–3.6 В.',
      current: 'Проверьте даташит STM32F411 (до 25 мА абсолютный максимум на вывод; PC13–PC15 — до 3 мА).',
      supply: 'USB-C 5 В или 5 В на «5V» (стабилизатор AP7343: 3.3 В до 300 мА)',
      tolerant: 'У STM32F411 большинство выводов — 5V-tolerant (тип FT в таблице выводов даташита); исключения (аналоговые TTa, BOOT0, NRST, PC13–PC15) — сверяйте по даташиту. Отдельные выводы на схеме не помечены.'
    },
    specs: [
      ['Ядро', 'Arm Cortex-M4F (FPU), до 100 МГц'],
      ['Флеш / ОЗУ', '512 КБ / 128 КБ'],
      ['Логика', '3.3 В'],
      ['5V-tolerant', 'по таблице выводов даташита (тип FT); не размечено поштучно'],
      ['Генераторы', 'HSE 25 МГц, LSE 32.768 кГц'],
      ['USB', 'USB-C (OTG FS): PA11 (D−) / PA12 (D+)'],
      ['Кнопки', 'NRST, BOOT0, KEY (PA0)']
    ],
    notes: [
      'Порядок выводов (USB-C слева): верхний ряд слева направо — 5V, G, 3.3, B10, B2, B1, B0, A7…A0, R(NRST), C15, C14, C13, VB; нижний — B12…B15, A8…A12, A15, B3…B9, 5V, G, 3.3; SWD (4 контакта): 3.3, DIO (PA13), CLK (PA14), GND. Порядок и размеры (52.81 × 20.78 мм) — по описанию платы на stm32-base.org; расстояние между рядами 17.78 мм не подтверждено чертежом. Источник: https://stm32-base.org/boards/STM32F411CEU6-WeAct-Black-Pill-V2.0',
      'Выводы PA11/PA12 — USB (через резисторы 10 Ом), PB2 — BOOT1, PA0 — кнопка KEY, PC13 — светодиод (низкий уровень), PA13/PA14 — SWD. Разъём USB-C: линии CC подтянуты резисторами 5.1 кОм.',
      'Версии платы WeAct (V2.0, V3.0, V3.1) могут отличаться разводкой и кристаллом (у V3.x возможны STM32F411CEU6 и F401CCU6): проверяйте маркировку чипа. Здесь — F411CE по описанию V2.0.',
      'В STM32duino плата называется «BlackPill F411CE» (variant_BLACKPILL_F411CE): Serial = USART1 (PA9/PA10), LED_BUILTIN = PC13, USER_BTN = PA0, Wire = PB7/PB6. USB — «Serial» через CDC (опция USB support). Источник: https://github.com/stm32duino/Arduino_Core_STM32/tree/main/variants/STM32F4xx/F411C(C-E)(U-Y)',
      'Загрузка: удерживая BOOT0 нажать и отпустить NRST — системный загрузчик (USB DFU). Источник: схема платы https://github.com/WeActStudio/WeActStudio.MiniSTM32F4x1'
    ]
  },
  {
    id: 'nucleo-f401re', name: 'Nucleo-64 NUCLEO-F401RE', mcu: 'STM32F401RET6', platform: 'stm32',
    pins: nucleo64Pins,
    electrical: {
      logic: LOGIC33 + ' VDD = 3.3 В.',
      current: 'Проверьте даташит STM32F401 (до 25 мА на вывод).',
      supply: 'USB ST-LINK (5 В), VIN 7–12 В или E5V 5 В; выбор перемычкой JP5',
      tolerant: 'У STM32F401 большинство выводов 5V-tolerant (тип FT), исключения — аналоговые TTa и др.; сверяйте по таблице даташита'
    },
    specs: [
      ['Ядро', 'Arm Cortex-M4F (FPU), до 84 МГц'],
      ['Флеш / ОЗУ', '512 КБ / 96 КБ'],
      ['Логика', '3.3 В'],
      ['Разъёмы', 'Arduino Uno V3 (CN5, CN6, CN8, CN9) + ST Morpho (CN7, CN10, по 2 × 19)'],
      ['ST-LINK/V2-1', 'отладка/прошивка по USB, виртуальный COM-порт (USART2: PA2/PA3)'],
      ['Светодиод', 'LD2 = PA5 (D13)'],
      ['Кнопки', 'B1 USER = PC13, B2 RESET']
    ],
    notes: [
      'Схема в масштабе ×1.7 для читаемости подписей (реальная плата 70 × 82.5 мм); рисунок — деталь Fritzing «STM32 Nucleo boards» (CC BY-SA 3.0), повёрнута: ST-LINK слева. Верхняя пара рядов — Morpho CN10 (внешний — чётные выводы, внутренний — нечётные), нижняя — CN7 (внешний — нечётные, внутренний — чётные); номера выводов растут слева направо.',
      'Arduino-разъёмы: CN5 (D15/SCL, D14/SDA, AVDD, GND, D13…D8), CN9 (D7…D0), CN6 (NC, IOREF, NRST, 3V3, 5V, GND, GND, VIN), CN8 (A0…A5). Соответствие Arduino ↔ порт: D0 PA3, D1 PA2, D2 PA10, D3 PB3, D4 PB5, D5 PB4, D6 PB10, D7 PA8, D8 PA9, D9 PC7, D10 PB6, D11 PA7, D12 PA6, D13 PA5, D14 PB9, D15 PB8, A0 PA0, A1 PA1, A2 PA4, A3 PB0, A4 PC1, A5 PC0. Источник: STM32duino variant_NUCLEO_F401RE.h; сверено с таблицей разъёмов Morpho/Arduino в Fritzing-детали. Таблица UM1724 (ST) напрямую не читалась — сайт ST недоступен из среды разработки.',
      'Не подтверждено: вывод CN10-18 (на схеме NC) — в общем файле STM32duino и в детали Fritzing указан PB11, но у STM32F401RE такого вывода в корпусе нет (в других Nucleo-64 на CN10-18 — PB11); VBAT (CN7-33) в Fritzing подписан VLCD (плата L152RE).',
      'ST-LINK: USART2 (PA2/PA3) соединён с виртуальным COM-портом (Serial по умолчанию), SWD — PA13/PA14. Светодиод LD2 — PA5 (зелёный), кнопка B1 — PC13.',
      'Платы NUCLEO-F446RE / F411RE в Arduino-разъёмах совпадают, но отличаются функциями выводов и таблицей Morpho — отдельно не добавлены.'
    ]
  },
  {
    id: 'nucleo-l432kc', name: 'Nucleo-32 NUCLEO-L432KC', mcu: 'STM32L432KCU6', platform: 'stm32',
    pins: nucleo32Pins,
    electrical: {
      logic: LOGIC33 + ' VDD = 3.3 В.',
      current: 'Проверьте даташит STM32L432 (до 20 мА на вывод).',
      supply: 'USB ST-LINK (5 В) или VIN 7–12 В',
      tolerant: 'У STM32L432 часть выводов 5V-tolerant (тип FT/FT_a) — сверяйте по таблице выводов даташита'
    },
    specs: [
      ['Ядро', 'Arm Cortex-M4F (FPU), до 80 МГц'],
      ['Флеш / ОЗУ', '256 КБ / 64 КБ'],
      ['Логика', '3.3 В'],
      ['Форм-фактор', 'Arduino Nano (2 × 15 выводов, шаг 2.54 мм, ряды 15.24 мм)'],
      ['ST-LINK/V2-1', 'отладка/прошивка по USB, виртуальный COM-порт (USART2: PA2/PA15)'],
      ['Светодиод', 'LD3 = PB3 (D13)']
    ],
    notes: [
      'Разъёмы Arduino Nano: CN3 (D1, D0, NRST, GND, D2…D12) и CN4 (VIN, GND, NRST, 5V, A7…A0, AREF, 3V3, D13); на схеме USB слева: верхний ряд — CN4 слева направо, нижний — CN3. Источник: STM32duino variant_NUCLEO_L432KC.cpp/.h (digitalPin[], комментарии о перемычках SB).',
      'Выводы D7 (PC14) и D8 (PC15) по умолчанию не подключены к гребёнке (SB6/SB8 разомкнуты); PA13/PA14 и PH3 (BOOT0) не доступны на разъёмах.',
      'Размеры (≈ 43.2 × 18.5 мм) и расположение микросхем на рисунке приблизительные — по общему виду платы.',
      'Подробная таблица разъёмов UM1956 (ST) напрямую не читалась — сайт ST недоступен из среды разработки; соответствие Arduino ↔ порт взято из STM32duino.'
    ]
  }
]

/** Первоисточники по платам. */
export const mcuSources: Record<string, string[]> = {
  'blackpill-f411': ['https://stm32-base.org/boards/STM32F411CEU6-WeAct-Black-Pill-V2.0', 'https://github.com/WeActStudio/WeActStudio.MiniSTM32F4x1', 'https://github.com/stm32duino/Arduino_Core_STM32/tree/main/variants/STM32F4xx/F411C(C-E)(U-Y)'],
  bluepill: ['https://stm32-base.org/boards/STM32F103C8T6-Blue-Pill', 'https://github.com/stm32duino/Arduino_Core_STM32/tree/main/variants/STM32F1xx/F103C8T_F103CB(T-U)'],
  'nucleo-f401re': ['https://www.st.com/resource/en/user_manual/um1724-stm32-nucleo64-boards-mb1136-stmicroelectronics.pdf', 'https://github.com/stm32duino/Arduino_Core_STM32/tree/main/variants/STM32F4xx/F401R(B-C-D-E)T'],
  'nucleo-l432kc': ['https://www.st.com/en/evaluation-tools/nucleo-l432kc.html', 'https://github.com/stm32duino/Arduino_Core_STM32/tree/main/variants/STM32L4xx/L432K(B-C)U_L442KCU']
}
