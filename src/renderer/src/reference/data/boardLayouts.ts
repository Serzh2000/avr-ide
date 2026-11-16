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
const col = (x: number, y: number, labels: BoardHeader['labels'], pins: (string | number)[]): BoardHeader => ({ x, y, dir: 'down', pins, labels })
const row = (x: number, y: number, labels: BoardHeader['labels'], pins: (string | number)[]): BoardHeader => ({ x, y, dir: 'right', pins, labels })
const seq = (prefix: string, from: number, to: number): string[] => {
  const out: string[] = []
  if (from <= to) for (let i = from; i <= to; i++) out.push(prefix + i)
  else for (let i = from; i >= to; i--) out.push(prefix + i)
  return out
}

const nodemcuRight = ['D0', 'D1', 'D2', 'D3', 'D4', '3V3', 'GND', 'D5', 'D6', 'D7', 'D8', 'D9 (RX)|RX', 'D10 (TX)|TX', 'GND', '3V3']

const handDrawn: Record<string, BoardLayout> = {





  'nodemcu-v2': {
    w: 25.4, h: 49, pcb: '#1b1e23', corner: 1.2, size: '≈ 49 × 25.4 мм',
    headers: [
      col(1.27, 6.5, 'l', ['A0', 'RSV', 'RSV', 'SD3', 'SD2', 'SD1', 'CMD', 'SD0', 'CLK', 'GND', '3V3', 'EN', 'RST', 'GND', 'VIN']),
      col(24.13, 6.5, 'r', nodemcuRight)
    ],
    comps: [
      { t: 'module', x: 4.7, y: -0.5, w: 16, h: 25.5, text: 'ESP-12E', ant: 6.5, antSide: 't' },
      { t: 'led', x: 5.2, y: 27.2, color: '#4aa3ff', label: '' },
      { t: 'led', x: 19.2, y: 27.2, color: '#4aa3ff', label: '' },
      { t: 'rect', x: 9.5, y: 29.5, w: 6.4, h: 4.4, fill: '#1a1a1a' },
      { t: 'chip', x: 10, y: 35.4, w: 5.4, h: 5.4, text: 'CP2102', leads: 'qfp' },
      { t: 'usb', x: 8.7, y: 43.2, w: 8, h: 7, kind: 'micro', side: 'b' },
      { t: 'btn', x: 4.4, y: 45.6, label: 'RST', lp: 'b' },
      { t: 'btn', x: 20.6, y: 45.6, label: 'FLASH', lp: 'b' }
    ]
  },

  'nodemcu-v3': {
    w: 31, h: 58, pcb: '#1d2530', corner: 1.2, size: '≈ 58 × 31 мм',
    headers: [
      col(1.5, 8.5, 'l', ['A0', 'GND', 'VU', 'SD3', 'SD2', 'SD1', 'CMD', 'SD0', 'CLK', 'GND', '3V3', 'EN', 'RST', 'GND', 'VIN']),
      col(29.5, 8.5, 'r', nodemcuRight)
    ],
    comps: [
      { t: 'module', x: 7.5, y: -0.5, w: 16, h: 25.5, text: 'ESP-12E', ant: 6.5, antSide: 't' },
      { t: 'led', x: 7.5, y: 28, color: '#4aa3ff' },
      { t: 'led', x: 21.5, y: 28, color: '#4aa3ff' },
      { t: 'rect', x: 11.5, y: 31, w: 8, h: 5.5, fill: '#1a1a1a' },
      { t: 'chip', x: 10.5, y: 39, w: 10, h: 5, text: 'CH340G', leads: 'sop' },
      { t: 'usb', x: 11.5, y: 52, w: 8, h: 7, kind: 'micro', side: 'b' },
      { t: 'btn', x: 5.6, y: 53.6, label: 'RST', lp: 'b' },
      { t: 'btn', x: 25.2, y: 53.6, label: 'FLASH', lp: 'b' }
    ]
  },



  'esp32-devkitc': {
    w: 27.9, h: 54.4, pcb: '#15181c', corner: 1.2, size: '≈ 54 × 27.9 мм',
    headers: [
      col(1.25, 4, 'l', ['3V3', 'EN', 'GPIO36|VP', 'GPIO39|VN', io(34), io(35), io(32), io(33), io(25), io(26), io(27), io(14), io(12), 'GND', io(13), 'GPIO9|SD2', 'GPIO10|SD3', 'GPIO11|CMD', '5V']),
      col(26.65, 4, 'r', ['GND', io(23), io(22), 'GPIO1|TXD0', 'GPIO3|RXD0', io(21), 'GND', io(19), io(18), io(5), io(17), io(16), io(4), io(0), io(2), io(15), 'GPIO8|SD1', 'GPIO7|SD0', 'GPIO6|CLK'])
    ],
    comps: [
      { t: 'module', x: 4.9, y: -0.3, w: 18, h: 25.5, text: 'ESP32-WROOM-32', ant: 6.6, antSide: 't' },
      { t: 'led', x: 7, y: 28.6, color: '#ff4d4d', label: '' },
      { t: 'chip', x: 8.6, y: 31.6, w: 5.4, h: 5.4, text: 'CP2102N', leads: 'qfp' },
      { t: 'rect', x: 16.5, y: 30, w: 5.4, h: 4, fill: '#222' },
      { t: 'usb', x: 10, y: 48.2, w: 8, h: 7, kind: 'micro', side: 'b' },
      { t: 'btn', x: 5.4, y: 49, label: 'BOOT', lp: 't' },
      { t: 'btn', x: 22.5, y: 49, label: 'EN', lp: 't' }
    ]
  },

  'esp32-s3': {
    w: 25.4, h: 69, pcb: '#16191e', corner: 1.2, size: '≈ 69 × 25.4 мм',
    headers: [
      col(1.27, 6, 'l', ['3V3', '3V3', 'RST', ...[4, 5, 6, 7, 15, 16, 17, 18, 8, 3, 46, 9, 10, 11, 12, 13, 14].map((n) => 'GPIO' + n), '5V', 'GND']),
      col(24.13, 6, 'r', ['GND', 'GPIO43|TX', 'GPIO44|RX', ...[1, 2, 42, 41, 40, 39, 38, 37, 36, 35, 0, 45, 48, 47, 21, 20, 19].map((n) => 'GPIO' + n), 'GND', 'GND'])
    ],
    comps: [
      { t: 'module', x: 3.7, y: -0.3, w: 18, h: 25.5, text: 'ESP32-S3-WROOM-1', ant: 6.6, antSide: 't' },
      { t: 'led', x: 5, y: 27.8, color: '#ff4d4d' },
      { t: 'led', x: 17.6, y: 27.8, color: '#e8e8e8', label: 'RGB' },
      { t: 'chip', x: 8, y: 52.8, w: 5, h: 5, text: 'CP2102N', leads: 'qfp' },
      { t: 'usb', x: 4.4, y: 63.6, w: 8, h: 6.8, kind: 'micro', side: 'b' },
      { t: 'usb', x: 14.2, y: 63.6, w: 8, h: 6.8, kind: 'micro', side: 'b' },
      { t: 'btn', x: 5.2, y: 58.6, label: 'BOOT', lp: 't' },
      { t: 'btn', x: 20.2, y: 58.6, label: 'RST', lp: 't' },
      { t: 'text', x: 8.4, y: 62.2, text: 'UART', size: 1.5 },
      { t: 'text', x: 18.2, y: 62.2, text: 'USB', size: 1.5 }
    ]
  },

  'esp32-c3': {
    w: 25.4, h: 52, pcb: '#15181c', corner: 1.2, size: '≈ 52 × 25.4 мм',
    headers: [
      col(1.27, 6, 'l', ['GND', '3V3', '3V3', 'GPIO2', 'GPIO3', 'GND', 'RST', 'GND', 'GPIO0', 'GPIO1', 'GPIO10', 'GND', '5V', '5V', 'GND']),
      col(24.13, 6, 'r', ['GND', 'GPIO21|TX', 'GPIO20|RX', 'GND', 'GPIO9', 'GPIO8', 'GND', 'GPIO7', 'GPIO6', 'GPIO5', 'GPIO4', 'GND', 'GPIO18', 'GPIO19', 'GND'])
    ],
    comps: [
      { t: 'module', x: 6, y: -0.3, w: 13.2, h: 16.6, text: 'ESP32-C3-MINI-1', ant: 4.6, antSide: 't' },
      { t: 'led', x: 6.4, y: 20.5, color: '#ff4d4d' },
      { t: 'led', x: 17.4, y: 20.5, color: '#e8e8e8', label: 'RGB' },
      { t: 'rect', x: 15, y: 24, w: 5, h: 4, fill: '#222' },
      { t: 'chip', x: 8.4, y: 33.6, w: 5, h: 5, text: 'CP2102N', leads: 'qfp' },
      { t: 'usb', x: 8.7, y: 45.8, w: 8, h: 7, kind: 'micro', side: 'b' },
      { t: 'btn', x: 4.2, y: 45.4, label: 'BOOT', lp: 't' },
      { t: 'btn', x: 21.2, y: 45.4, label: 'RST', lp: 't' }
    ]
  },

  'esp32-c3-supermini': {
    w: 18, h: 22.5, pcb: '#1a1e25', corner: 1, size: '≈ 22.5 × 18 мм',
    headers: [
      col(1.37, 3.5, 'l', ['5V', 'GND', '3V3', num(4), num(3), num(2), num(1), num(0)]),
      col(16.63, 3.5, 'r', [num(5), num(6), num(7), num(8), num(9), num(10), 'GPIO20|20 RX', 'GPIO21|21 TX'])
    ],
    comps: [
      { t: 'usb', x: 4.5, y: -1.1, w: 9, h: 7.6, kind: 'c', side: 't' },
      { t: 'btn', x: 5.1, y: 8.4, label: 'RST', lp: 'b' },
      { t: 'btn', x: 12.9, y: 8.4, label: 'BOOT', lp: 'b' },
      { t: 'chip', x: 6.5, y: 12.6, w: 5, h: 5, text: 'C3', leads: 'qfp' },
      { t: 'led', x: 4.6, y: 18.3, color: '#4aa3ff' },
      { t: 'led', x: 13.4, y: 18.3, color: '#ff4d4d' }
    ]
  }
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
  w: round2(boardArt[art].x + boardArt[art].w), h: boardArt[art].h, pcb: '#000', headers, comps: [], art, ...extra
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

export const layouts: Record<string, BoardLayout> = { ...handDrawn, ...art }
