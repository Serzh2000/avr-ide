// Платы второй волны, часть 2: Arduino Due и Teensy 4.1.
import type { BoardEntry, PinInfo } from '../types'

const pw = (label: string, kind: NonNullable<PinInfo['kind']>, notes: string): PinInfo => ({ label, gpio: null, functions: [], notes, kind })
const GND = (): PinInfo => pw('GND', 'gnd', 'Земля (общий провод).')

// ---------- Arduino Due (AT91SAM3X8E) ----------
// Порты — таблица в variants/arduino_due_x/variant.cpp ядра ArduinoCore-sam и официальная схема распиновки Arduino (A000056).
const DUE_PORTS: Record<number, string> = {
  0: 'PA8', 1: 'PA9', 2: 'PB25', 3: 'PC28', 4: 'PA29', 5: 'PC25', 6: 'PC24', 7: 'PC23', 8: 'PC22', 9: 'PC21', 10: 'PA28', 11: 'PD7', 12: 'PD8', 13: 'PB27',
  14: 'PD4', 15: 'PD5', 16: 'PA13', 17: 'PA12', 18: 'PA11', 19: 'PA10', 20: 'PB12', 21: 'PB13', 22: 'PB26', 23: 'PA14', 24: 'PA15', 25: 'PD0', 26: 'PD1', 27: 'PD2',
  28: 'PD3', 29: 'PD6', 30: 'PD9', 31: 'PA7', 32: 'PD10', 33: 'PC1', 34: 'PC2', 35: 'PC3', 36: 'PC4', 37: 'PC5', 38: 'PC6', 39: 'PC7', 40: 'PC8', 41: 'PC9',
  42: 'PA19', 43: 'PA20', 44: 'PC19', 45: 'PC18', 46: 'PC17', 47: 'PC16', 48: 'PC15', 49: 'PC14', 50: 'PC13', 51: 'PC12', 52: 'PB21', 53: 'PB14'
}
const DUE_FUNC: Record<number, string[]> = {
  0: ['RX0 (Serial)'], 1: ['TX0 (Serial)'], 13: ['LED_BUILTIN'], 14: ['TX3 (Serial3)'], 15: ['RX3 (Serial3)'], 16: ['TX2 (Serial2)'], 17: ['RX2 (Serial2)'],
  18: ['TX1 (Serial1)'], 19: ['RX1 (Serial1)'], 20: ['I2C SDA (Wire)'], 21: ['I2C SCL (Wire)']
}
const dueDigital = (n: number): PinInfo => {
  const f = ['GPIO', ...(n >= 2 && n <= 13 ? ['PWM'] : []), ...(DUE_FUNC[n] ?? [])]
  const notes = `Порт ${DUE_PORTS[n]}` + (n === 13 ? '; светодиод L' : n === 20 || n === 21 ? '; на колодке связи (рядом с D19); TWI1' : '')
  return { label: `D${n}`, gpio: n, functions: f, notes }
}
const dueAnalog = (a: number, n: number, port: string): PinInfo => ({ label: `A${a}`, gpio: n, functions: [`ADC${a}`, 'GPIO'], notes: `Порт ${port} (пин ${n})` })

const due: BoardEntry = {
  id: 'due', name: 'Arduino Due', mcu: 'AT91SAM3X8E', platform: 'samd', numLabel: 'Пин Arduino №',
  pins: [
    { label: 'SDA1', gpio: 70, functions: ['I2C SDA (Wire1)'], notes: 'Порт PA17 (TWD0); выведен рядом с AREF, на схеме Arduino подписан D20/SDA. Номер 70 — по ядру' },
    { label: 'SCL1', gpio: 71, functions: ['I2C SCL (Wire1)'], notes: 'Порт PA18 (TWCK0); выведен рядом с AREF, на схеме Arduino подписан D21/SCL. Номер 71 — по ядру' },
    pw('AREF', 'ref', 'Опорное напряжение АЦП (по схеме Arduino рядом с SDA1); порт AREF в источниках не указан.'),
    GND(),
    ...Array.from({ length: 54 }, (_, n) => dueDigital(n)),
    dueAnalog(0, 54, 'PA16'), dueAnalog(1, 55, 'PA24'), dueAnalog(2, 56, 'PA23'), dueAnalog(3, 57, 'PA22'), dueAnalog(4, 58, 'PA6'), dueAnalog(5, 59, 'PA4'),
    dueAnalog(6, 60, 'PA3'), dueAnalog(7, 61, 'PA2'), dueAnalog(8, 62, 'PB17'), dueAnalog(9, 63, 'PB18'), dueAnalog(10, 64, 'PB19'), dueAnalog(11, 65, 'PB20'),
    { label: 'DAC0', gpio: 66, functions: ['DAC0'], notes: 'Порт PB15; на колодке подписан DAC0' },
    { label: 'DAC1', gpio: 67, functions: ['DAC1'], notes: 'Порт PB16; на колодке подписан DAC1' },
    { label: 'CANRX', gpio: 68, functions: ['CAN RX'], notes: 'Порт PA1; шина CAN0 (нужен внешний трансивер)' },
    { label: 'CANTX', gpio: 69, functions: ['CAN TX'], notes: 'Порт PA0; шина CAN0 (нужен внешний трансивер)' },
    pw('IOREF', 'ref', 'Напряжение логики платы (3.3 В) — шилды по нему выбирают уровни.'),
    pw('RESET', 'reset', 'Сброс.'), pw('3V3', 'power', 'Выход 3.3 В.'), pw('5V', 'power', 'Выход 5 В (на колодке и на двухрядной колодке D22–D53).'),
    pw('VIN', 'power', 'Вход внешнего питания (по схеме распиновки Arduino Due).'), pw('NC', 'nc', 'Не подключён.')
  ],
  electrical: {
    logic: 'Логика 3.3 В; пины не 5V-tolerant — подача 5 В может повредить SAM3X8E.',
    current: 'Схема распиновки Arduino Due: 130 мА на линии ввода-вывода (формулировка схемы); на отдельный вывод ток существенно меньше — см. даташит SAM3X8E.',
    supply: 'Micro-USB или гнездо DC (VIN) по схеме распиновки Arduino'
  },
  notes: [
    'Порядок выводов и функции — официальная схема распиновки Arduino Due (A000056, PDF) и таблица портов в variants/arduino_due_x/variant.cpp ядра ArduinoCore-sam. Колодки в формате Mega: сверху SDA1/SCL1, AREF, GND, D13…D0, D14…D21; внизу NC, IOREF, RESET, 3V3, 5V, GND, GND, VIN, A0…A11, DAC0, DAC1, CANRX, CANTX; двухрядная колодка 5V, D22…D53, GND.',
    'Дублирующиеся D20/D21 на схеме Arduino по ядру: пины 20/21 (PB12/PB13, Wire) — на колодке связи рядом с D19; пины 70/71 (PA17/PA18, Wire1: SDA1/SCL1) — рядом с AREF. На схеме выше они поэтому подписаны SDA1/SCL1.',
    'ШИМ: D2–D13 (12 каналов, по документации Arduino); АЦП — A0–A11; ЦАП — DAC0/DAC1; светодиоды L (D13), RX (пин 72), TX (пин 73) на гребёнки не выведены; SPI — отдельная 6-контактная колодка (пины 74–76 по ядру).',
    'Не подтверждено: габариты (принято как у Mega 101.6 × 53.3 мм по формату колодок), положение разъёмов и деталей на рендере — приблизительное; порт вывода AREF в источниках не указан.'
  ],
  specs: [['МК', 'AT91SAM3X8E (Cortex-M3, 84 МГц)'], ['Формат', 'Mega']]
}

// ---------- Teensy 4.1 (PJRC) ----------
const dd = (n: number, functions: string[], notes?: string): PinInfo => ({ label: `D${n}`, gpio: n, functions: ['GPIO', ...functions], notes })
const teensy41: BoardEntry = {
  id: 'teensy-41', name: 'Teensy 4.1', mcu: 'i.MX RT1062', platform: 'teensy',
  pins: [
    pw('VIN', 'power', 'Вход 3.6–5.5 В (по карточке PJRC).'), GND(), pw('3V3', 'power', 'Выход 3.3 В, до 250 мА (по карточке PJRC); выведен на двух контактах.'),
    dd(23, ['PWM', 'ADC9 (A9)', 'CAN1 RX', 'MCLK1']), dd(22, ['PWM', 'ADC8 (A8)', 'CAN1 TX']), dd(21, ['ADC7 (A7)', 'RX5', 'BCLK1']), dd(20, ['ADC6 (A6)', 'TX5', 'LRCLK1']),
    dd(19, ['PWM', 'ADC5 (A5)', 'I2C SCL']), dd(18, ['PWM', 'ADC4 (A4)', 'I2C SDA']), dd(17, ['PWM', 'ADC3 (A3)', 'TX4', 'I2C SDA1']), dd(16, ['ADC2 (A2)', 'RX4', 'I2C SCL1']),
    dd(15, ['PWM', 'ADC1 (A1)', 'RX3', 'SPDIF IN']), dd(14, ['PWM', 'ADC0 (A0)', 'TX3', 'SPDIF OUT']), dd(13, ['PWM', 'SPI SCK', 'LED_BUILTIN']),
    dd(41, ['ADC17 (A17)']), dd(40, ['ADC16 (A16)']), dd(39, ['ADC15 (A15)', 'SPI MISO1']), dd(38, ['ADC14 (A14)', 'SPI CS1']), dd(37, ['SPI CS']), dd(36, ['SPI CS']),
    dd(35, ['TX8']), dd(34, ['RX8']), dd(33, ['PWM', 'MCLK2']),
    dd(0, ['PWM', 'RX1', 'CAN2 RX', 'SPI CS1']), dd(1, ['PWM', 'TX1', 'CAN2 TX', 'SPI MISO1']), dd(2, ['PWM', 'OUT2']), dd(3, ['PWM', 'LRCLK2']), dd(4, ['PWM', 'BCLK2']),
    dd(5, ['PWM', 'IN2']), dd(6, ['PWM', 'OUT1D']), dd(7, ['PWM', 'RX2', 'OUT1A']), dd(8, ['PWM', 'TX2', 'IN1']), dd(9, ['PWM', 'OUT1C']),
    dd(10, ['PWM', 'SPI CS', 'MQSR']), dd(11, ['PWM', 'SPI MOSI', 'CAN1 TX']), dd(12, ['PWM', 'SPI MISO', 'MQSL']),
    dd(24, ['PWM', 'ADC10 (A10)', 'TX6', 'I2C SCL2']), dd(25, ['PWM', 'ADC11 (A11)', 'RX6', 'I2C SDA2']), dd(26, ['ADC12 (A12)', 'SPI MOSI1']), dd(27, ['ADC13 (A13)', 'SPI SCK1']),
    dd(28, ['PWM', 'RX7']), dd(29, ['PWM', 'TX7']), dd(30, ['CAN3 RX']), dd(31, ['CAN3 TX']), dd(32, ['OUT1B'])
  ],
  electrical: { logic: 'Логика 3.3 В; пины не 5V-tolerant (проверьте даташит i.MX RT1062 и страницу PJRC).', current: 'Не подтверждено в этой сессии.', supply: 'Micro-USB 5 В или вывод VIN 3.6–5.5 В (по карточке PJRC)' },
  notes: [
    'Порядок выводов и функции — карточка распиновки PJRC (https://www.pjrc.com/teensy/card11a_rev4_web.pdf, https://www.pjrc.com/teensy/pinout.html): верхний ряд от USB — VIN, GND, 3.3V, 23…13, GND, 41…33; нижний — GND, 0…12, 3.3V, 24…32.',
    'Не подтверждено: часть функций пинов 33–41 на карточке читается неоднозначно (колонки SPI/MQS/PWM) — показаны только однозначные (A14–A17, CS/CS1, MISO1, TX8/RX8, MCLK2). Контактные площадки на нижней стороне, слот microSD и 5 В USB-хоста на схему не включены.',
    'Не подтверждено: габариты платы (на странице PJRC только рисунок; принято 2.4″ × 0.7″ ≈ 60.96 × 17.78 мм по числу выводов и шагу). Положение деталей на рендере приблизительное.'
  ],
  specs: [['МК', 'NXP i.MX RT1062 (Cortex-M7)'], ['Карта', 'слот microSD']]
}

export const moreBoards3: BoardEntry[] = [due, teensy41]

export const moreSources3: Record<string, string[]> = {
  due: ['https://docs.arduino.cc/hardware/due/', 'https://docs.arduino.cc/resources/pinouts/A000056-full-pinout.pdf', 'https://github.com/arduino/ArduinoCore-sam/blob/master/variants/arduino_due_x/variant.cpp'],
  'teensy-41': ['https://www.pjrc.com/teensy/pinout.html', 'https://www.pjrc.com/teensy/card11a_rev4_web.pdf']
}
