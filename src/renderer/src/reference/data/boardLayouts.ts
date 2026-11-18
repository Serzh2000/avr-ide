import type { BoardHeader, BoardLayout } from '../types'
import { boardArt } from './boardArt'

/**
 * Физические схемы плат (вид сверху): габариты, гребёнки в реальном порядке выводов, разъёмы и компоненты.
 * Координаты — мм от левого верхнего угла платы; шаг выводов 2.54 мм.
 * Токен вывода: «label» или «label|надпись на шёлкографии»; число — дополнительный зазор.
 * Размеры и положение компонентов приблизительные (по чертежам и фото), порядок выводов — по документации.
 */

const io = (n: number): string => `GPIO${n}|IO${n}`
const num = (n: number): string => `GPIO${n}|${n}`
const dn = (n: number): string => `GPIO${n}|D${n}`
const seq = (prefix: string, from: number, to: number): string[] => {
  const out: string[] = []
  if (from <= to) for (let i = from; i <= to; i++) out.push(prefix + i)
  else for (let i = from; i >= to; i--) out.push(prefix + i)
  return out
}


// ---------- платы на готовых рисунках (см. boardArt.ts и licenses/THIRD_PARTY.md) ----------

type Item = [string | [number, number], string]
const round2 = (n: number): number => Math.round(n * 100) / 100
const pinAt = (art: string, n: string | [number, number]): [number, number] => {
  if (Array.isArray(n)) return n
  const p = boardArt[art].pins[n]
  if (!p) throw new Error(`${art}: в рисунке нет вывода ${n}`)
  return p
}
const artHeader = (art: string, labels: BoardHeader['labels'], items: Item[], bare = false): BoardHeader => ({
  x: 0, y: 0, dir: 'down', labels, bare, pins: items.map((i) => i[1]), pts: items.map((i) => pinAt(art, i[0]))
})
const artBoard = (art: string, headers: BoardHeader[], extra: Partial<BoardLayout> = {}): BoardLayout => ({
  w: boardArt[art].bw ?? round2(boardArt[art].x + boardArt[art].w), h: boardArt[art].bh ?? boardArt[art].h, pcb: '#000', headers, comps: [], art, ...extra
})
const digital = (names: string[]): Item[] => names.map((n) => [n, 'D' + n])
const dd = (names: string[]): Item[] => names.map((n) => ['D' + n, 'D' + n])
const analog = (from: number, to: number): Item[] => seq('A', from, to).map((n) => [n, n])

/** На один шаг левее вывода — позиция контакта NC, которого нет в рисунке-источнике. */
const before = (art: string, name: string): [number, number] => { const [x, y] = pinAt(art, name); return [round2(x - 2.54), y] }

const art: Record<string, BoardLayout> = {
  uno: artBoard('uno', [
    artHeader('uno', 't', [['A5.2', 'A5|SCL'], ['A4.2', 'A4|SDA'], ['AREF', 'AREF'], ['GND.1', 'GND'], ...digital(['13', '12', '11', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1', '0'])]),
    artHeader('uno', 'b', [[before('uno', 'IOREF'), 'NC'], ['IOREF', 'IOREF'], ['RESET', 'RESET'], ['3.3V', '3V3'], ['5V', '5V'], ['GND.2', 'GND'], ['GND.3', 'GND'], ['VIN', 'VIN'], ...analog(0, 5)])
  ], { size: '68.6 × 53.3 мм' }),

  nano: artBoard('nano', [
    artHeader('nano', 't', [...digital(['12', '11', '10', '9', '8', '7', '6', '5', '4', '3', '2']), ['GND.2', 'GND'], ['RESET.2', 'RST'], ['0', 'D0|RX0'], ['1', 'D1|TX1']]),
    artHeader('nano', 'b', [['13', 'D13'], ['3.3V', '3V3'], ['AREF', 'AREF'], ...analog(0, 7), ['5V', '5V'], ['RESET', 'RST'], ['GND.1', 'GND'], ['VIN', 'VIN']])
  ], { size: '45 × 18 мм' }),

  mega: artBoard('mega', [
    artHeader('mega', 't', [['SCL', 'D21|SCL'], ['SDA', 'D20|SDA'], ['AREF', 'AREF'], ['GND.1', 'GND'], ...digital(['13', '12', '11', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1', '0', '14', '15', '16', '17', '18', '19', '20', '21'])]),
    artHeader('mega', 'b', [[before('mega', 'IOREF'), 'NC'], ['IOREF', 'IOREF'], ['RESET', 'RESET'], ['3.3V', '3V3'], ['5V', '5V'], ['GND.2', 'GND'], ['GND.3', 'GND'], ['VIN', 'VIN'], ...analog(0, 15)]),
    artHeader('mega', 'l', [['5V.1', '5V'], ...digital(['22', '24', '26', '28', '30', '32', '34', '36', '38', '40', '42', '44', '46', '48', '50', '52']), ['GND.4', 'GND']]),
    artHeader('mega', 'r', [['5V.2', '5V'], ...digital(['23', '25', '27', '29', '31', '33', '35', '37', '39', '41', '43', '45', '47', '49', '51', '53']), ['GND.5', 'GND']])
  ], { size: '101.6 × 53.3 мм' }),

  leonardo: artBoard('leonardo', [
    artHeader('leonardo', 't', [['SCL', 'D3|SCL'], ['SDA', 'D2|SDA'], ['AREF', 'AREF'], ['GND.104', 'GND'], ['D13 PWM', 'D13'], ['D12/A11', 'D12'], ['D11 PWM', 'D11'], ['D10 PWM/A10', 'D10'], ['D9 PWM/A9', 'D9'], ['D8/A8', 'D8'], ['D7', 'D7'], ['D6 PWM/A7', 'D6'], ['D5 PWM', 'D5'], ['D4/A6', 'D4'], ['D3 PWM/SCL', 'D3'], ['D2/SDA', 'D2'], ['D1/TX', 'D1'], ['D0/RX', 'D0']]),
    artHeader('leonardo', 'l', [[[63.7, 22.7], 'MISO'], [[63.7, 25.24], 'SCK'], [[63.7, 27.78], 'RESET']]),
    artHeader('leonardo', 'r', [[[66.24, 22.7], '5V'], [[66.24, 25.24], 'MOSI'], [[66.24, 27.78], 'GND']]),
    artHeader('leonardo', 'b', [['n.c.', 'NC'], ['IOREF', 'IOREF'], ['RESET', 'RESET'], ['3V3', '3V3'], ['5V', '5V'], ['GND', 'GND'], ['GND.90', 'GND'], ['VIN', 'VIN'], ...analog(0, 5)])
  ], { size: '68.6 × 53.3 мм' }),

  promini: artBoard('promini', [
    artHeader('promini', 't', [['GND.19', 'GND'], ['GND', 'GND'], ['VCC', 'VCC'], ['RXI', 'D0|RXI'], ['TXO', 'D1|TXO'], ['DTR', 'DTR']], true),
    artHeader('promini', 'l', [['TXO.48', 'D1|TXO'], ['RXI.47', 'D0|RXI'], ['RESET.46', 'RST'], ['GND.45', 'GND'], ...dd(['2', '3', '4', '5', '6', '7', '8', '9'])]),
    artHeader('promini', 'r', [['RAW', 'RAW'], ['GND.26', 'GND'], ['RESET', 'RST'], ['VCC.28', 'VCC'], ['A3', 'A3'], ['A2', 'A2'], ['A1', 'A1'], ['A0', 'A0'], ['SCK', 'D13'], ['MISO', 'D12'], ['MOSI', 'D11'], ['D10', 'D10']]),
    artHeader('promini', 'l', [['A5', 'A5'], ['A4', 'A4'], ['A7', 'A7'], ['A6', 'A6']], true)
  ], { size: '33 × 18 мм' }),

  'wemos-d1-mini': artBoard('wemos-d1-mini', [
    artHeader('wemos-d1-mini', 'l', [['RST', 'RST'], ['A0', 'A0'], ['D0', 'D0'], ['D5', 'D5'], ['D6', 'D6'], ['D7', 'D7'], ['D8', 'D8'], ['3V3', '3V3']]),
    artHeader('wemos-d1-mini', 'r', [['TX', 'D10 (TX)|TX'], ['RX', 'D9 (RX)|RX'], ['D1', 'D1'], ['D2', 'D2'], ['D3', 'D3'], ['D4', 'D4'], ['G', 'GND|G'], ['5V', '5V']])
  ], { size: '34.2 × 25.6 мм' }),

  'esp32-devkit': artBoard('esp32-devkit', [
    artHeader('esp32-devkit', 'l', [['EN', 'EN'], ['VP', 'GPIO36|VP'], ['VN', 'GPIO39|VN'], ['D34', dn(34)], ['D35', dn(35)], ['D32', dn(32)], ['D33', dn(33)], ['D25', dn(25)], ['D26', dn(26)], ['D27', dn(27)], ['D14', dn(14)], ['D12', dn(12)], ['D13', dn(13)], ['GND.2', 'GND'], ['VIN', 'VIN']]),
    artHeader('esp32-devkit', 'r', [['D23', dn(23)], ['D22', dn(22)], ['TX0', 'GPIO1|TX0'], ['RX0', 'GPIO3|RX0'], ['D21', dn(21)], ['D19', dn(19)], ['D18', dn(18)], ['D5', dn(5)], ['TX2', 'GPIO17|TX2'], ['RX2', 'GPIO16|RX2'], ['D4', dn(4)], ['D2', dn(2)], ['D15', dn(15)], ['GND.1', 'GND'], ['3V3', '3V3']])
  ], { size: '≈ 52 × 28 мм' })
}

// ---------- Raspberry Pi Pico и STM32 ----------

const PICO_L = ['GP0', 'GP1', 'GND', 'GP2', 'GP3', 'GP4', 'GP5', 'GND', 'GP6', 'GP7', 'GP8', 'GP9', 'GND', 'GP10', 'GP11', 'GP12', 'GP13', 'GND', 'GP14', 'GP15']
const PICO_R = ['GP16', 'GP17', 'GND', 'GP18', 'GP19', 'GP20', 'GP21', 'GND', 'GP22', 'RUN', 'GP26', 'GP27', 'AGND', 'GP28', 'ADC_VREF', '3V3', '3V3_EN', 'GND', 'VSYS', 'VBUS']
const picoBoard = (id: string): BoardLayout => artBoard(id, [
  artHeader(id, 'l', PICO_L.map((t, i) => [`p${i + 1}`, t] as Item)),
  artHeader(id, 'r', PICO_R.map((t, i) => [`p${i + 21}`, t] as Item))
], { size: '51 × 21 мм (+ 2 мм USB)' })

const tokRow = (prefix: string, toks: string[]): Item[] => toks.map((t, i) => [`${prefix}:${i}`, t] as Item)
const PILL_TOP = ['GND', 'GND', '3V3|3.3', 'NRST|R', 'PB11|B11', 'PB10|B10', 'PB1|B1', 'PB0|B0', 'PA7|A7', 'PA6|A6', 'PA5|A5', 'PA4|A4', 'PA3|A3', 'PA2|A2', 'PA1|A1', 'PA0|A0', 'PC15|C15', 'PC14|C14', 'PC13|C13', 'VBAT|VB']
const PILL_BOT = ['PB12|B12', 'PB13|B13', 'PB14|B14', 'PB15|B15', 'PA8|A8', 'PA9|A9', 'PA10|A10', 'PA11|A11', 'PA12|A12', 'PA15|A15', 'PB3|B3', 'PB4|B4', 'PB5|B5', 'PB6|B6', 'PB7|B7', 'PB8|B8', 'PB9|B9', '5V', 'GND', '3V3|3.3']
const SWD = ['3V3|3.3', 'PA13|DIO', 'PA14|CLK', 'GND']
const BLACK_TOP = ['5V', 'GND', '3V3|3.3', 'PB10|B10', 'PB2|B2', 'PB1|B1', 'PB0|B0', 'PA7|A7', 'PA6|A6', 'PA5|A5', 'PA4|A4', 'PA3|A3', 'PA2|A2', 'PA1|A1', 'PA0|A0', 'NRST|R', 'PC15|C15', 'PC14|C14', 'PC13|C13', 'VBAT|VB']
const NK_TOP = ['VIN', 'GND', 'NRST|RST', '5V', 'PA2|A7', 'PA7|A6', 'PA6|A5', 'PA5|A4', 'PA4|A3', 'PA3|A2', 'PA1|A1', 'PA0|A0', 'AREF|REF', '3V3', 'PB3|D13']
const NK_BOT = ['PA9|D1', 'PA10|D0', 'NRST|RST', 'GND', 'PA12|D2', 'PB0|D3', 'PB7|D4', 'PB6|D5', 'PB1|D6', 'PC14|D7', 'PC15|D8', 'PA8|D9', 'PA11|D10', 'PB5|D11', 'PB4|D12']

// Nucleo-64: Morpho CN7 / CN10 (по 2 × 19), порядок выводов — таблицы разъёмов Nucleo-64 (см. заметки платы)
const CN7 = ['PC10', 'PC11', 'PC12', 'PD2', 'VDD', 'E5V', 'BOOT0', 'GND', 'NC', 'NC', 'NC', 'IOREF', 'PA13', 'NRST', 'PA14', '3V3', 'PA15', '5V', 'GND', 'GND', 'PB7', 'GND', 'PC13', 'VIN', 'PC14', 'NC', 'PC15', 'PA0', 'PH0', 'PA1', 'PH1', 'PA4', 'VBAT', 'PB0', 'PC2', 'PC1', 'PC3', 'PC0']
const CN10 = ['PC9', 'PC8', 'PB8', 'PC6', 'PB9', 'PC5', 'AVDD', 'U5V', 'GND', 'NC', 'PA5', 'PA12', 'PA6', 'PA11', 'PA7', 'PB12', 'PB6', 'NC', 'PC7', 'GND', 'PA9', 'PB2', 'PA8', 'PB1', 'PB10', 'PB15', 'PB4', 'PB14', 'PB5', 'PB13', 'PB3', 'AGND', 'PA10', 'PC4', 'PA2', 'NC', 'PA3', 'NC']
const morpho = (cn: string, toks: string[], parity: 0 | 1): Item[] => toks.flatMap((t, i): Item[] => (i % 2 === parity ? [[`${cn}:${i + 1}`, t]] : []))

const stLayouts: Record<string, BoardLayout> = {
  bluepill: artBoard('bluepill', [artHeader('bluepill', 't', tokRow('t', PILL_TOP)), artHeader('bluepill', 'b', tokRow('b', PILL_BOT)), artHeader('bluepill', 'r', tokRow('swd', SWD))], { size: '≈ 53 × 22.8 мм' }),
  'blackpill-f411': artBoard('blackpill', [artHeader('blackpill', 't', tokRow('t', BLACK_TOP)), artHeader('blackpill', 'b', tokRow('b', PILL_BOT)), artHeader('blackpill', 'r', tokRow('swd', SWD))], { size: '52.8 × 20.8 мм' }),
  'nucleo-l432kc': artBoard('nucleo32', [artHeader('nucleo32', 't', tokRow('t', NK_TOP)), artHeader('nucleo32', 'b', tokRow('b', NK_BOT))], { size: '≈ 43.2 × 18.5 мм' }),
  'nucleo-f401re': artBoard('nucleo64', [
    artHeader('nucleo64', 't', morpho('CN10', CN10, 1), true), artHeader('nucleo64', 'b', morpho('CN10', CN10, 0), true),
    artHeader('nucleo64', 't', morpho('CN7', CN7, 1), true), artHeader('nucleo64', 'b', morpho('CN7', CN7, 0), true),
    artHeader('nucleo64', 'b', [['D15', 'PB8|D15'], ['D14', 'PB9|D14'], ['AREF', 'AVDD'], ['GND.a', 'GND'], ['D13', 'PA5|D13'], ['D12', 'PA6|D12'], ['D11', 'PA7|D11'], ['D10', 'PB6|D10'], ['D9', 'PC7|D9'], ['D8', 'PA9|D8']]),
    artHeader('nucleo64', 'b', [['D7', 'PA8|D7'], ['D6', 'PB10|D6'], ['D5', 'PB4|D5'], ['D4', 'PB5|D4'], ['D3', 'PB3|D3'], ['D2', 'PA10|D2'], ['D1', 'PA2|D1'], ['D0', 'PA3|D0']]),
    artHeader('nucleo64', 't', [['NC.a', 'NC'], ['IOREF', 'IOREF'], ['RESET', 'NRST'], ['3V3', '3V3'], ['5V', '5V'], ['GND.b', 'GND'], ['GND.c', 'GND'], ['VIN', 'VIN']]),
    artHeader('nucleo64', 't', [['A0', 'PA0|A0'], ['A1', 'PA1|A1'], ['A2', 'PA4|A2'], ['A3', 'PB0|A3'], ['A4', 'PC1|A4'], ['A5', 'PC0|A5']])
  ], { size: 'плата 70 × 82.5 мм, схема ×1.7' })
}


// Платы ESP: рендеры 3D-моделей (scripts/boardart); выводы — по координатам площадок модели: L/R — левый/правый ряд сверху вниз
const nodemcuRight = ['D0', 'D1', 'D2', 'D3', 'D4', '3V3', 'GND', 'D5', 'D6', 'D7', 'D8', 'D9 (RX)|RX', 'D10 (TX)|TX', 'GND', '3V3']
const g = (ns: number[]): string[] => ns.map((n) => 'GPIO' + n)
const espLayouts: Record<string, BoardLayout> = {
  'nodemcu-v2': artBoard('nodemcu-v2', [
    artHeader('nodemcu-v2', 'l', tokRow('L', ['A0', 'RSV', 'RSV', 'SD3', 'SD2', 'SD1', 'CMD', 'SD0', 'CLK', 'GND', '3V3', 'EN', 'RST', 'GND', 'VIN'])),
    artHeader('nodemcu-v2', 'r', tokRow('R', nodemcuRight))
  ], { size: '≈ 49 × 25.4 мм' }),
  'nodemcu-v3': artBoard('nodemcu-v3', [
    artHeader('nodemcu-v3', 'l', tokRow('L', ['A0', 'GND', 'VU', 'SD3', 'SD2', 'SD1', 'CMD', 'SD0', 'CLK', 'GND', '3V3', 'EN', 'RST', 'GND', 'VIN'])),
    artHeader('nodemcu-v3', 'r', tokRow('R', nodemcuRight))
  ], { size: '≈ 58 × 31 мм' }),
  'esp32-devkitc': artBoard('esp32-devkitc', [
    artHeader('esp32-devkitc', 'l', tokRow('L', ['3V3', 'EN', 'GPIO36|VP', 'GPIO39|VN', io(34), io(35), io(32), io(33), io(25), io(26), io(27), io(14), io(12), 'GND', io(13), 'GPIO9|SD2', 'GPIO10|SD3', 'GPIO11|CMD', '5V'])),
    artHeader('esp32-devkitc', 'r', tokRow('R', ['GND', io(23), io(22), 'GPIO1|TXD0', 'GPIO3|RXD0', io(21), 'GND', io(19), io(18), io(5), io(17), io(16), io(4), io(0), io(2), io(15), 'GPIO8|SD1', 'GPIO7|SD0', 'GPIO6|CLK']))
  ], { size: '≈ 54 × 27.9 мм' }),
  'esp32-s3': artBoard('esp32-s3', [
    artHeader('esp32-s3', 'l', tokRow('L', ['3V3', '3V3', 'RST', ...g([4, 5, 6, 7, 15, 16, 17, 18, 8, 3, 46, 9, 10, 11, 12, 13, 14]), '5V', 'GND'])),
    artHeader('esp32-s3', 'r', tokRow('R', ['GND', 'GPIO43|TX', 'GPIO44|RX', ...g([1, 2, 42, 41, 40, 39, 38, 37, 36, 35, 0, 45, 48, 47, 21, 20, 19]), 'GND', 'GND']))
  ], { size: '≈ 69 × 25.4 мм' }),
  'esp32-c3': artBoard('esp32-c3', [
    artHeader('esp32-c3', 'l', tokRow('L', ['GND', '3V3', '3V3', 'GPIO2', 'GPIO3', 'GND', 'RST', 'GND', 'GPIO0', 'GPIO1', 'GPIO10', 'GND', '5V', '5V', 'GND'])),
    artHeader('esp32-c3', 'r', tokRow('R', ['GND', 'GPIO21|TX', 'GPIO20|RX', 'GND', 'GPIO9', 'GPIO8', 'GND', 'GPIO7', 'GPIO6', 'GPIO5', 'GPIO4', 'GND', 'GPIO18', 'GPIO19', 'GND']))
  ], { size: '≈ 52 × 25.4 мм' }),
  'esp32-c3-supermini': artBoard('esp32-c3-supermini', [
    artHeader('esp32-c3-supermini', 'l', tokRow('L', ['5V', 'GND', '3V3', num(4), num(3), num(2), num(1), num(0)])),
    artHeader('esp32-c3-supermini', 'r', tokRow('R', [num(5), num(6), num(7), num(8), num(9), num(10), 'GPIO20|20 RX', 'GPIO21|21 TX']))
  ], { size: '≈ 22.5 × 18 мм' })
}

// ---------- Платы, добавленные позже: Nano-семейство, Micro, XIAO, Espressif DevKit, Teensy (рендеры scripts/boardart/boards3.py) ----------
const dl = (...ns: number[]): string[] => ns.map((n) => `D${n}`)
const NANO_L = ['D13', '3V3', 'AREF', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', '5V', 'RESET|RST', 'GND', 'VIN']
const NANO_R = [...dl(12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2), 'GND', 'RESET|RST', 'RX', 'TX']
const nanoForm = (id: string, left: string[]): BoardLayout => artBoard(id, [
  artHeader(id, 'l', tokRow('L', left)), artHeader(id, 'r', tokRow('R', NANO_R))
], { size: '45 × 18 мм' })
const gl = (ns: number[]): string[] => ns.map((n) => `GPIO${n}|${n}`)
const xiaoForm = (id: string): BoardLayout => artBoard(id, [
  artHeader(id, 'l', tokRow('L', dl(0, 1, 2, 3, 4, 5, 6))),
  artHeader(id, 'r', tokRow('R', ['5V', 'GND', '3V3', 'D10', 'D9', 'D8', 'D7']))
], { size: '21 × 17.8 мм' })
const moreLayouts: Record<string, BoardLayout> = {
  zero: artBoard('zero', [
    artHeader('zero', 't', [['A5.2', 'D21|SCL'], ['A4.2', 'D20|SDA'], ['AREF', 'AREF'], ['GND.1', 'GND'], ...digital(['13', '12', '11', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1', '0'])]),
    artHeader('zero', 'b', [[before('zero', 'IOREF'), 'ATN'], ['IOREF', 'IOREF'], ['RESET', 'RESET'], ['3.3V', '3V3'], ['5V', '5V'], ['GND.2', 'GND'], ['GND.3', 'GND'], ['VIN', 'VIN'], ...analog(0, 5)])
  ], { size: '68.6 × 53.3 мм (формат Uno)' }),
  'nano-every': nanoForm('nano-every', NANO_L),
  'nano-33-iot': nanoForm('nano-33-iot', NANO_L),
  'nano-esp32': nanoForm('nano-esp32', ['D13', '3V3', 'B0', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'VUSB', 'B1', 'GND', 'VIN']),
  micro: artBoard('micro', [
    artHeader('micro', 'l', tokRow('L', ['D13', '3V3', 'AREF', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'NC', 'NC2|NC', '5V', 'RESET|RST', 'GND', 'VIN', 'D14', 'D15'])),
    artHeader('micro', 'r', tokRow('R', [...dl(12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2), 'GND', 'RESET|RST', 'D0', 'D1', 'D17', 'D16']))
  ], { size: '≈ 48 × 18 мм' }),
  'xiao-esp32c3': xiaoForm('xiao-esp32c3'),
  'xiao-esp32s3': xiaoForm('xiao-esp32s3'),
  'xiao-rp2040': xiaoForm('xiao-rp2040'),
  'xiao-samd21': xiaoForm('xiao-samd21'),
  'pro-micro': artBoard('pro-micro', [
    artHeader('pro-micro', 'l', tokRow('L', ['D1|TXO', 'D0|RXI', 'GND', 'GND', ...dl(2, 3, 4, 5, 6, 7, 8, 9)])),
    artHeader('pro-micro', 'r', tokRow('R', ['RAW', 'GND', 'RST', 'VCC', 'A3', 'A2', 'A1', 'A0', 'D15', 'D14', 'D16', 'D10']))
  ], { size: '33 × 17.8 мм' }),
  'esp32-s2-devkitm': artBoard('esp32-s2-devkitm', [
    artHeader('esp32-s2-devkitm', 'l', tokRow('L', ['3V3', ...gl([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]), '5V', 'GND|G'])),
    artHeader('esp32-s2-devkitm', 'r', tokRow('R', ['GND|G', 'RST', ...gl([46, 45]), 'RX', 'TX', ...gl([42, 41, 40, 39, 38, 37, 36, 35, 34, 33, 26, 21, 20, 19, 18])]))
  ], { size: '≈ 67 × 25.4 мм (условно)' }),
  'esp32-c6-devkitc': artBoard('esp32-c6-devkitc', [
    artHeader('esp32-c6-devkitc', 'l', tokRow('L', ['3V3', 'RST', ...gl([4, 5, 6, 7, 0, 1, 8, 10, 11, 2, 3]), '5V', 'GND|G', 'NC'])),
    artHeader('esp32-c6-devkitc', 'r', tokRow('R', ['GND|G', 'TX', 'RX', ...gl([15, 23, 22, 21, 20, 19, 18, 9]), 'GND|G', ...gl([13, 12]), 'GND|G', 'NC']))
  ], { size: '≈ 51.8 × 25.4 мм' }),
  'teensy-40': artBoard('teensy-40', [
    artHeader('teensy-40', 't', tokRow('t', ['VIN', 'GND', '3V3', ...dl(23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13).map((x) => `${x}|${x.slice(1)}`)])),
    artHeader('teensy-40', 'b', tokRow('b', ['GND', ...dl(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12).map((x) => `${x}|${x.slice(1)}`)]))
  ], { size: '≈ 35.6 × 17.8 мм' })
}

// ---------- Вторая волна: Feather, Wemos Mini, T-Display, Heltec V3, ESP-01S, ESP32-CAM (scripts/boardart/boards4.py) ----------
const gs = (ns: (number | string)[]): string[] => ns.map((n) => (typeof n === 'number' ? `GPIO${n}|${n}` : n))
const mkRow = (art: string, side: BoardHeader['labels'], prefix: string, toks: string[], bare = false): BoardHeader => artHeader(art, side, tokRow(prefix, toks), bare)
const feather = (id: string, left: string[]): BoardLayout => artBoard(id, [
  mkRow(id, 'l', 'L', left),
  mkRow(id, 'r', 'R', ['VBAT', 'EN', 'VBUS', 'D13', 'D12', 'D11', 'D10', 'D9', 'D6', 'D5', 'SCL', 'SDA'])
], { size: '50.8 × 22.86 мм (Feather)' })
const mini2 = (id: string, lo: (number | string)[], li: (number | string)[], ri: (number | string)[], ro: (number | string)[]): BoardLayout => artBoard(id, [
  mkRow(id, 'l', 'LO', gs(lo)), mkRow(id, 'r', 'LI', gs(li), true), mkRow(id, 'l', 'RI', gs(ri), true), mkRow(id, 'r', 'RO', gs(ro))
], { size: '34.3 × 25.4 мм' })
const moreLayouts2: Record<string, BoardLayout> = {
  'feather-esp32s3': feather('feather-esp32s3', ['RESET', '3V3', '3V3', 'GND', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'SCK', 'MOSI', 'MISO', 'RX', 'TX', 'TXD0']),
  'feather-rp2040': feather('feather-rp2040', ['RESET', '3V3', '3V3', 'GND', 'A0', 'A1', 'A2', 'A3', 'D24', 'D25', 'SCK', 'MOSI', 'MISO', 'RX', 'TX', 'D4']),
  'feather-m0-express': feather('feather-m0-express', ['RESET', '3V3', 'AREF', 'GND', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'SCK', 'MOSI', 'MISO', 'RX', 'TX', 'GND']),
  'lolin-s2-mini': mini2('lolin-s2-mini', ['EN', 3, 5, 7, 9, 11, 12, '3V3'], [1, 2, 4, 6, 8, 10, 13, 14], [40, 38, 36, 34, 21, 17, 'GND', 15], [39, 37, 35, 33, 18, 16, 'GND', 'VBUS']),
  'lolin-s3-mini': mini2('lolin-s3-mini', ['EN', 2, 4, 12, 13, 11, 10, '3V3'], [1, 3, 5, 6, 7, 8, 9, 14], [33, 37, 38, 34, 21, 17, 'GND', 15], [43, 44, 36, 35, 18, 16, 'GND', 'VBUS']),
  'lolin-c3-mini': artBoard('lolin-c3-mini', [
    mkRow('lolin-c3-mini', 'l', 'L', ['EN', ...gs([3, 2, 1, 0, 4, 5]), '3V3']),
    mkRow('lolin-c3-mini', 'r', 'R', ['GPIO21|21 TX', 'GPIO20|20 RX', ...gs([10, 8, 7, 6]), 'GND', 'VBUS'])
  ], { size: '34.3 × 25.4 мм' }),
  'ttgo-t-display': artBoard('ttgo-t-display', [
    mkRow('ttgo-t-display', 'l', 'L', ['GND', 'GND', ...gs([21, 22, 17, 2, 15, 13, 12]), 'GND', 'GND', '3V3']),
    mkRow('ttgo-t-display', 'r', 'R', ['3V3', ...gs([36, 37, 38, 39, 32, 33, 25, 26, 27]), 'GND', '5V'])
  ], { size: '≈ 25 × 51.5 мм' }),
  'heltec-lora32-v3': artBoard('heltec-lora32-v3', [
    mkRow('heltec-lora32-v3', 'l', 'L', [...gs([7, 6, 5, 4, 3, 2, 1, 38, 39, 40, 41, 42, 45, 46, 37]), '3V3', '3V3', 'GND']),
    mkRow('heltec-lora32-v3', 'r', 'R', [...gs([19, 20, 21, 26, 48, 47, 33, 34, 35, 36, 0]), 'RST', 'GPIO43|43 TX', 'GPIO44|44 RX', 'Ve', 'Ve', '5V', 'GND'])
  ], { size: '≈ 25.4 × 52.5 мм' }),
  'esp-01s': artBoard('esp-01s', [
    mkRow('esp-01s', 't', 'I', ['RXD|RX', 'IO0', 'IO2', 'GND'], true), mkRow('esp-01s', 'b', 'O', ['VCC|3V3', 'RST', 'EN', 'TXD|TX'], true)
  ], { size: '24.4 × 14.4 мм' }),
  'esp32-cam': artBoard('esp32-cam', [
    mkRow('esp32-cam', 'l', 'L', ['5V', 'GND', ...gs([12, 13, 15, 14, 2, 4]).map((x) => x.replace('|', '|IO'))]),
    mkRow('esp32-cam', 'r', 'R', ['3V3|3.3V', 'GPIO16|IO16', 'GPIO0|IO0', 'GND', 'VCC', 'U0R', 'U0T', 'GND'])
  ], { size: '40.5 × 27 мм' })
}

// ---------- Arduino Due (формат Mega) и Teensy 4.1 (scripts/boardart/boards5.py) ----------
const dueAnalogs = [...Array.from({ length: 12 }, (_, i) => `A${i}`)]
const moreLayouts3: Record<string, BoardLayout> = {
  due: artBoard('due', [
    artHeader('due', 't', [['SCL', 'SCL1|SCL'], ['SDA', 'SDA1|SDA'], ['AREF', 'AREF'], ['GND.1', 'GND'], ...digital(['13', '12', '11', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1', '0', '14', '15', '16', '17', '18', '19', '20', '21'])]),
    artHeader('due', 'b', [[before('due', 'IOREF'), 'NC'], ['IOREF', 'IOREF'], ['RESET', 'RESET'], ['3.3V', '3V3'], ['5V', '5V'], ['GND.2', 'GND'], ['GND.3', 'GND'], ['VIN', 'VIN'], ...dueAnalogs.map((n): Item => [n, n]), ['A12', 'DAC0'], ['A13', 'DAC1'], ['A14', 'CANRX'], ['A15', 'CANTX']]),
    artHeader('due', 'l', [['5V.1', '5V'], ...digital(['22', '24', '26', '28', '30', '32', '34', '36', '38', '40', '42', '44', '46', '48', '50', '52']), ['GND.4', 'GND']]),
    artHeader('due', 'r', [['5V.2', '5V'], ...digital(['23', '25', '27', '29', '31', '33', '35', '37', '39', '41', '43', '45', '47', '49', '51', '53']), ['GND.5', 'GND']])
  ], { size: '101.6 × 53.3 мм (формат Mega)' }),
  'teensy-41': artBoard('teensy-41', [
    artHeader('teensy-41', 't', tokRow('t', ['VIN', 'GND', '3V3', ...dl(23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13).map((x) => `${x}|${x.slice(1)}`), 'GND', ...dl(41, 40, 39, 38, 37, 36, 35, 34, 33).map((x) => `${x}|${x.slice(1)}`)])),
    artHeader('teensy-41', 'b', tokRow('b', ['GND', ...dl(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12).map((x) => `${x}|${x.slice(1)}`), '3V3', ...dl(24, 25, 26, 27, 28, 29, 30, 31, 32).map((x) => `${x}|${x.slice(1)}`)]))
  ], { size: '≈ 61 × 17.8 мм' })
}

export const layouts: Record<string, BoardLayout> = {
  ...art, ...stLayouts, ...espLayouts, ...moreLayouts, ...moreLayouts2, ...moreLayouts3,
  'rpi-pico': picoBoard('pico'), 'rpi-pico-w': picoBoard('picow'), 'rpi-pico-2': picoBoard('pico2')
}
