// Дополнительные платы справочника: данные только из первоисточников (официальные распиновки Arduino, Espressif, Seeed, PJRC).
// Источники указаны в moreSources; что не подтверждено — в notes каждой платы.
import type { BoardEntry, PinInfo } from '../types'
import { gp as rpGp } from './boardsMcu'

const gp = (label: string, gpio: number | null, functions: string[], notes?: string, special?: PinInfo['special']): PinInfo =>
  ({ label, gpio, functions, notes, special })
const pw = (label: string, kind: NonNullable<PinInfo['kind']>, notes: string): PinInfo => ({ label, gpio: null, functions: [], notes, kind })
const GND = (): PinInfo => pw('GND', 'gnd', 'Земля (общий провод).')
const NC = (): PinInfo => pw('NC', 'nc', 'Не подключён.')
/** Цифровой пин Arduino: D<n>, номер в скетче — n. */
const dd = (n: number, functions: string[], notes?: string, special?: PinInfo['special']): PinInfo =>
  ({ label: `D${n}`, gpio: n, functions: ['GPIO', ...functions], notes, special })
const aa = (a: number, n: number, functions: string[], notes?: string): PinInfo =>
  ({ label: `A${a}`, gpio: n, functions: [...functions, 'GPIO'], notes })
const gi = (n: number, functions: string[], notes?: string, special?: PinInfo['special']): PinInfo =>
  ({ label: `GPIO${n}`, gpio: n, functions, notes, special })

const NANO_FORM = 'Форм-фактор Nano: 45 × 18 мм, два ряда по 15 выводов, шаг 2.54 мм, ряды через 15.24 мм. Положение первого вывода вдоль платы на схеме приблизительное.'
const PIN_PDF = 'Порядок выводов и функции — по официальной схеме распиновки Arduino (PDF, CC BY-SA 4.0).'

// ---------- Arduino Nano Every (ATMega4809) ----------
const nanoEvery: BoardEntry = {
  id: 'nano-every', name: 'Arduino Nano Every', mcu: 'ATMega4809', platform: 'avr',
  pins: [
    dd(13, ['SPI SCK', 'LED_BUILTIN'], 'Порт PE2'), pw('3V3', 'power', 'Выход 3.3 В от стабилизатора платы.'),
    pw('AREF', 'ref', 'Опорное напряжение АЦП, порт PD7.'),
    aa(0, 14, ['ADC0', 'AIN3'], 'Порт PD3 (D14)'), aa(1, 15, ['ADC1', 'AIN2'], 'Порт PD2 (D15)'),
    aa(2, 16, ['ADC2', 'AIN1'], 'Порт PD1 (D16)'), aa(3, 17, ['ADC3', 'AIN0'], 'Порт PD0 (D17)'),
    aa(4, 18, ['ADC4', 'I2C SDA'], 'Порты PA2/PF2 (D18)'), aa(5, 19, ['ADC5', 'I2C SCL'], 'Порты PA3/PF3 (D19)'),
    aa(6, 20, ['ADC6', 'AIN4'], 'Порт PD4 (D20)'), aa(7, 21, ['ADC7', 'AIN5'], 'Порт PD5 (D21)'),
    pw('5V', 'power', 'Выход 5 В (USB/стабилизатор) либо вход стабилизированных 5 В.'),
    pw('RESET', 'reset', 'Сброс микроконтроллера: низкий уровень = перезапуск.'),
    GND(),
    pw('VIN', 'power', 'Вход внешнего питания 7–21 В (по схеме распиновки Arduino).'),
    dd(12, ['SPI MISO (CIPO)'], 'Порт PE1'), dd(11, ['SPI MOSI (COPI)'], 'Порт PE0'),
    dd(10, ['PWM'], 'Порт PB1'), dd(9, ['PWM'], 'Порт PB0'), dd(8, [], 'Порт PE3'), dd(7, [], 'Порт PA1'),
    dd(6, ['PWM'], 'Порт PF4'), dd(5, ['PWM'], 'Порт PB2'), dd(4, [], 'Порт PC6'), dd(3, ['PWM'], 'Порт PF5'), dd(2, [], 'Порт PA0'),
    { label: 'RX', gpio: 0, functions: ['GPIO', 'RX0 (Serial1)'], notes: 'D0/RX, порт PC5 (USART1)' },
    { label: 'TX', gpio: 1, functions: ['GPIO', 'TX0 (Serial1)'], notes: 'D1/TX, порт PC4 (USART1)' }
  ],
  electrical: {
    logic: 'Логика 5 В.',
    current: 'Схема распиновки Arduino: не более 40 мА с вывода (рекомендуется 20 мА), 200 мА на весь корпус; суммарный ток группы портов — не более 100 мА.',
    supply: 'USB 5 В или VIN 7–21 В (по схеме распиновки Arduino)'
  },
  notes: [
    PIN_PDF + ' Выводы D0/D1 на плате подписаны RX/TX (UART Serial1 на портах PC5/PC4).',
    'ШИМ (тильда на схеме): D3, D5, D6, D9, D10. I2C: SDA — A4 (D18), SCL — A5 (D19). SPI: SCK D13, CIPO D12, COPI D11. LED_BUILTIN = D13.',
    'Размер платы 45 × 18 мм (docs.arduino.cc). Шаг и ряды — стандарт Nano; положение выводов вдоль платы приблизительное.'
  ],
  specs: [['МК', 'ATMega4809'], ['Размер', '45 × 18 мм']]
}

// ---------- Arduino Nano 33 IoT (SAMD21G18A) ----------
const nano33iot: BoardEntry = {
  id: 'nano-33-iot', name: 'Arduino Nano 33 IoT', mcu: 'SAMD21G18A', platform: 'samd',
  pins: [
    dd(13, ['SPI SCK', 'LED_BUILTIN'], 'Порт PA17 (SERCOM1)'), pw('3V3', 'power', 'Выход 3.3 В.'),
    pw('AREF', 'ref', 'Опорное напряжение АЦП, порт PA03.'),
    aa(0, 14, ['ADC0', 'DAC0'], 'Порт PA02 (AIN0)'), aa(1, 15, ['ADC1'], 'Порт PB02 (AIN10)'),
    aa(2, 16, ['ADC2', 'PWM'], 'Порт PA11 (AIN19), D16 со знаком ШИМ на схеме'), aa(3, 17, ['ADC3', 'PWM'], 'Порт PA10 (AIN18), D17 со знаком ШИМ на схеме'),
    aa(4, 18, ['ADC4', 'I2C SDA'], 'Порт PB08 (SERCOM4)'), aa(5, 19, ['ADC5', 'I2C SCL', 'PWM'], 'Порт PB09 (SERCOM4), D19 со знаком ШИМ на схеме'),
    aa(6, 20, ['ADC6'], 'Порт PA09 (AIN17)'), aa(7, 21, ['ADC7'], 'Порт PB03 (AIN11)'),
    pw('5V', 'power', 'Выход 5 В (при питании от USB) либо вход.'), pw('RESET', 'reset', 'Сброс.'), GND(),
    pw('VIN', 'power', 'Вход внешнего питания 5–21 В (по схеме распиновки Arduino).'),
    dd(12, ['PWM', 'SPI MISO (CIPO)'], 'Порт PA19 (SERCOM1)'), dd(11, ['PWM', 'SPI MOSI (COPI)'], 'Порт PA16 (SERCOM1)'),
    dd(10, ['PWM'], 'Порт PA21'), dd(9, ['PWM'], 'Порт PA20'), dd(8, [], 'Порт PA18'), dd(7, [], 'Порт PA06'),
    dd(6, ['PWM'], 'Порт PA04'), dd(5, ['PWM'], 'Порт PA05'), dd(4, [], 'Порт PA07'), dd(3, ['PWM'], 'Порт PB11'), dd(2, ['PWM'], 'Порт PB10'),
    { label: 'RX', gpio: 0, functions: ['GPIO', 'RX (Serial1)'], notes: 'D0/RX, порт PB23' },
    { label: 'TX', gpio: 1, functions: ['GPIO', 'TX (Serial1)'], notes: 'D1/TX, порт PB22' }
  ],
  electrical: {
    logic: 'Логика 3.3 В; пины не 5V-tolerant.',
    current: 'Схема распиновки Arduino: не более 7 мА с вывода, 46 мА источник и 65 мА сток на группу выводов.',
    supply: 'Micro-USB или VIN 5–21 В (по схеме распиновки Arduino)'
  },
  notes: [
    PIN_PDF + ' Радиомодуль u-blox NINA-W102 (Wi-Fi и BLE) подключён внутри платы.',
    'Максимальный ток вывода всего 7 мА — светодиоды и реле напрямую не подключать.',
    'ШИМ (знак на схеме): D2, D3, D5, D6, D9, D10, D11, D12, а также A2 (D16), A3 (D17), A5 (D19). I2C: SDA — A4 (D18), SCL — A5 (D19). SPI: SCK D13, CIPO D12, COPI D11.',
    NANO_FORM + ' Тип разъёма USB в документации не указан; на рендере показан Micro-USB.'
  ],
  specs: [['МК', 'SAMD21G18A (Cortex-M0+)'], ['Wi-Fi/BLE', 'u-blox NINA-W102']]
}

// ---------- Arduino Nano ESP32 (u-blox NORA-W106, ESP32-S3) ----------
const nanoEsp32: BoardEntry = {
  id: 'nano-esp32', name: 'Arduino Nano ESP32', mcu: 'ESP32-S3', platform: 'esp32s3', numLabel: 'Пин Arduino №',
  pins: [
    dd(13, ['SPI SCK', 'LED_BUILTIN'], 'GPIO48'), pw('3V3', 'power', 'Выход 3.3 В.'),
    gp('B0', null, ['GPIO46'], 'Служебный вывод B0 (GPIO46) — по схеме распиновки Arduino; назначение подробно не описано.'),
    aa(0, 17, ['ADC1_0'], 'GPIO1'), aa(1, 18, ['ADC1_1'], 'GPIO2'), aa(2, 19, ['ADC1_2'], 'GPIO3'), aa(3, 20, ['ADC1_3'], 'GPIO4'),
    aa(4, 21, ['ADC2_0', 'I2C SDA'], 'GPIO11'), aa(5, 22, ['ADC2_1', 'I2C SCL'], 'GPIO12'),
    aa(6, 23, ['ADC2_2'], 'GPIO13'), aa(7, 24, ['ADC2_3'], 'GPIO14'),
    pw('VUSB', 'power', 'Выход 5 В от USB (VBUS) — на схеме Arduino помечен как выход.'),
    gp('B1', null, ['GPIO0', 'BOOT button'], 'Служебный вывод B1 (GPIO0) — по схеме распиновки Arduino.', 'strapping'),
    GND(), pw('VIN', 'power', 'Вход внешнего питания (по схеме распиновки Arduino).'),
    dd(12, ['SPI MISO (CIPO)'], 'GPIO47'), dd(11, ['SPI MOSI (COPI)'], 'GPIO38'),
    dd(10, [], 'GPIO21'), dd(9, [], 'GPIO18'), dd(8, [], 'GPIO17'), dd(7, [], 'GPIO10'),
    dd(6, [], 'GPIO9'), dd(5, [], 'GPIO8'), dd(4, [], 'GPIO7'), dd(3, [], 'GPIO6'), dd(2, [], 'GPIO5'),
    pw('RESET', 'reset', 'Сброс.'),
    { label: 'RX', gpio: 0, functions: ['GPIO', 'RX0 (UART0)'], notes: 'D0/RX, GPIO44' },
    { label: 'TX', gpio: 1, functions: ['GPIO', 'TX0 (UART0)'], notes: 'D1/TX, GPIO43' }
  ],
  electrical: {
    logic: 'Логика 3.3 В; пины не 5V-tolerant.',
    current: 'В документации Arduino не найден — смотрите даташит ESP32-S3.',
    supply: 'USB-C или VIN'
  },
  notes: [
    PIN_PDF + ' Модуль u-blox NORA-W106 с чипом ESP32-S3; flash 16 МБ (docs.arduino.cc).',
    'Номера в колонке «Пин Arduino №» — номера D из схемы Arduino (A0 = D17 … A7 = D24); в скетче можно писать и D13, A0. Номера GPIO чипа указаны в заметках каждого пина. Для режима нумерации по GPIO в ядре есть отдельная настройка — подробности в документации ядра Arduino.',
    'Выводы B0 и B1 — служебные (GPIO46 и GPIO0, BOOT); назначение по схеме не расшифровано.',
    NANO_FORM + ' Разъём USB-C.'
  ],
  specs: [['Модуль', 'u-blox NORA-W106 (ESP32-S3)'], ['Flash', '16 МБ']]
}

// ---------- Arduino Micro (ATmega32U4) ----------
const micro: BoardEntry = {
  id: 'micro', name: 'Arduino Micro', mcu: 'ATmega32U4', platform: 'avr',
  pins: [
    dd(13, ['PWM', 'LED_BUILTIN'], 'Порт PC7'), pw('3V3', 'power', 'Выход 3.3 В, ток до 50 мА (по схеме распиновки).'),
    pw('AREF', 'ref', 'Опорное напряжение АЦП.'),
    aa(0, 18, ['ADC0'], 'Порт PF7 (D18)'), aa(1, 19, ['ADC1'], 'Порт PF6 (D19)'), aa(2, 20, ['ADC2'], 'Порт PF5 (D20)'),
    aa(3, 21, ['ADC3'], 'Порт PF4 (D21)'), aa(4, 22, ['ADC4'], 'Порт PF1 (D22)'), aa(5, 23, ['ADC5'], 'Порт PF0 (D23)'),
    NC(), { ...NC(), label: 'NC2' },
    pw('5V', 'power', 'Выход 5 В либо вход стабилизированных 5 В.'), pw('RESET', 'reset', 'Сброс.'), GND(),
    pw('VIN', 'power', 'Вход внешнего питания 6–9 В (по схеме распиновки Arduino).'),
    dd(14, ['SPI MISO (CIPO)'], 'Порт PB3'), dd(15, ['SPI SCK'], 'Порт PB1'),
    dd(12, ['ADC (A11)'], 'Порт PD6'), dd(11, ['PWM'], 'Порт PB7'), dd(10, ['PWM', 'ADC (A10)'], 'Порт PB6'),
    dd(9, ['PWM', 'ADC (A9)'], 'Порт PB5'), dd(8, ['ADC (A8)'], 'Порт PB4'), dd(7, [], 'Порт PE6'),
    dd(6, ['PWM', 'ADC (A7)'], 'Порт PD7'), dd(5, ['PWM'], 'Порт PC6'), dd(4, ['ADC (A6)'], 'Порт PD4'),
    dd(3, ['I2C SCL', 'PWM'], 'Порт PD0'), dd(2, ['I2C SDA'], 'Порт PD1'),
    dd(0, ['RX1 (Serial1)'], 'Порт PD2'), dd(1, ['TX1 (Serial1)'], 'Порт PD3'),
    dd(17, ['SPI SS'], 'Порт PB0 (он же светодиод RX)'), dd(16, ['SPI MOSI (COPI)'], 'Порт PB2')
  ],
  electrical: {
    logic: 'Логика 5 В.',
    current: 'Схема распиновки Arduino: не более 40 мА с вывода, 50 мА с вывода 3.3 В.',
    supply: 'Micro-USB или VIN 6–9 В (по схеме распиновки Arduino)'
  },
  notes: [
    PIN_PDF + ' На схеме по 17 выводов с каждой стороны, включая D14–D17 (SPI): они нарисованы в том же ряду, что и остальные.',
    'USB встроен в ATmega32U4 (как у Leonardo): Serial — виртуальный порт USB, Serial1 — UART на D0/D1. ШИМ: D3, D5, D6, D9, D10, D11, D13. 12 аналоговых входов: A0–A5 и A6–A11 на D4, D6, D8, D9, D10, D12 (по схеме Arduino).',
    'Не подтверждено: размеры платы (в документации не нашёл; по справочникам 48 × 18 мм) и точное положение гребёнки вдоль платы и разъёма ICSP — на схеме по рисунку Arduino. Два вывода NC на левой стороне на плате подписаны как «NC».'
  ],
  specs: [['МК', 'ATmega32U4'], ['Размер', '≈ 48 × 18 мм (не подтверждено)']]
}

// ---------- Seeed XIAO ESP32C3 ----------
const xiaoC3: BoardEntry = {
  id: 'xiao-esp32c3', name: 'Seeed XIAO ESP32C3', mcu: 'ESP32-C3', platform: 'esp32c3',
  pins: [
    { ...gi(2, ['ADC1_2', 'A0'], 'D0. Strapping.', 'strapping'), label: 'D0' },
    { ...gi(3, ['ADC1_3', 'A1'], 'D1'), label: 'D1' },
    { ...gi(4, ['ADC1_4', 'A2', 'JTAG MTMS'], 'D2'), label: 'D2' },
    { ...gi(5, ['ADC2_0', 'A3', 'JTAG MTDI'], 'D3'), label: 'D3' },
    { ...gi(6, ['I2C SDA', 'JTAG MTCK'], 'D4'), label: 'D4' },
    { ...gi(7, ['I2C SCL', 'JTAG MTDO'], 'D5'), label: 'D5' },
    { ...gi(21, ['UART TX', 'TX0 (UART0)'], 'D6'), label: 'D6' },
    { ...gi(20, ['UART RX', 'RX0 (UART0)'], 'D7'), label: 'D7' },
    { ...gi(8, ['SPI SCK'], 'D8. Strapping.', 'strapping'), label: 'D8' },
    { ...gi(9, ['SPI MISO'], 'D9. Strapping; он же кнопка BOOT.', 'strapping'), label: 'D9' },
    { ...gi(10, ['SPI MOSI'], 'D10'), label: 'D10' },
    pw('5V', 'power', 'Вывод VBUS: 5 В от USB; вход питания — только через диод (Seeed).'),
    GND(),
    pw('3V3', 'power', 'Выход 3.3 В стабилизатора платы (Seeed: до 700 мА на странице, 500 мА в таблице характеристик — расходятся).')
  ],
  electrical: { logic: 'Логика 3.3 В; пины не 5V-tolerant.', current: 'См. даташит ESP32-C3.', supply: 'USB-C или вывод 5V' },
  notes: [
    'Сопоставление D0–D10 и GPIO — таблица на wiki.seeedstudio.com; порядок выводов (D0–D6 слева, 5V/GND/3V3/D10–D7 справа, USB-C сверху) — официальная схема распиновки Seeed. D-номера подтверждены в ядре: variants/XIAO_ESP32C3/pins_arduino.h.',
    'Размер 21 × 17.8 мм (Seeed). Выводы — зубчатые площадки по краю, шаг 2.54 мм. На обратной стороне — контакты JTAG, разъём U.FL внешней антенны и кнопки Reset/Boot; на схеме не показаны.',
    'Неточность в этой схеме: положение выводов вдоль платы определено по рисунку Seeed (шаг 2.54 мм); положение деталей на рендере приблизительное.'
  ],
  specs: [['Размер', '21 × 17.8 мм']]
}

// ---------- Espressif ESP32-S2-DevKitM-1 ----------
const s2: BoardEntry = {
  id: 'esp32-s2-devkitm', name: 'ESP32-S2-DevKitM-1', mcu: 'ESP32-S2', platform: 'esp32s2',
  pins: [
    pw('3V3', 'power', 'Выход 3.3 В; вход тоже допустим при питании не от USB.'),
    gi(0, ['RTC_GPIO0', 'BOOT button'], 'Strapping: LOW при старте = режим загрузки', 'strapping'),
    gi(1, ['ADC1_0', 'Touch1']), gi(2, ['ADC1_1', 'Touch2']), gi(3, ['ADC1_2', 'Touch3']), gi(4, ['ADC1_3', 'Touch4']),
    gi(5, ['ADC1_4', 'Touch5']), gi(6, ['ADC1_5', 'Touch6']), gi(7, ['ADC1_6', 'Touch7']), gi(8, ['ADC1_7', 'Touch8']),
    gi(9, ['ADC1_8', 'Touch9', 'SPI HD (FSPIHD)']), gi(10, ['ADC1_9', 'Touch10', 'SPI CS (FSPICS0)']),
    gi(11, ['ADC2_0', 'Touch11', 'SPI MOSI (FSPID)']), gi(12, ['ADC2_1', 'Touch12', 'SPI SCK (FSPICLK)']),
    gi(13, ['ADC2_2', 'Touch13', 'SPI MISO (FSPIQ)']), gi(14, ['ADC2_3', 'Touch14', 'SPI WP (FSPIWP)']),
    gi(15, ['ADC2_4', 'U0RTS']), gi(16, ['ADC2_5', 'U0CTS']), gi(17, ['ADC2_6', 'DAC1', 'U1TXD']),
    pw('5V', 'power', 'Вход/выход 5 В; взаимно исключается с питанием по Micro-USB.'), GND(),
    pw('RST', 'reset', 'CHIP_PU: высокий — чип включён, низкий — выключен.'),
    gi(46, [], 'Strapping, только вход.', 'strapping'), gi(45, [], 'Strapping.', 'strapping'),
    { ...gi(44, ['RX0 (UART0)', 'CLK_OUT2']), label: 'RX' }, { ...gi(43, ['TX0 (UART0)', 'CLK_OUT1']), label: 'TX' },
    gi(42, ['JTAG MTMS']), gi(41, ['JTAG MTDI', 'CLK_OUT1']), gi(40, ['JTAG MTDO', 'CLK_OUT2']), gi(39, ['JTAG MTCK', 'CLK_OUT3']),
    gi(38, ['SPI WP (FSPIWP)']), gi(37, ['SPIDQS', 'SPI MISO (FSPIQ)']), gi(36, ['SPI SCK (FSPICLK)']), gi(35, ['SPI MOSI (FSPID)']),
    gi(34, ['SPI CS (FSPICS0)']), gi(33, ['SPI HD (FSPIHD)']), gi(26, ['SPICS1']),
    gi(21, ['RTC_GPIO21']), gi(20, ['ADC2_9', 'U1CTS', 'USB D+'], 'Нативный USB (D+), не занимать при использовании USB.', 'usb'),
    gi(19, ['ADC2_8', 'U1RTS', 'USB D-'], 'Нативный USB (D−).', 'usb'),
    gi(18, ['ADC2_7', 'DAC2', 'U1RXD', 'CLK_OUT3', 'RGB LED'], 'Светодиод RGB платы (по документации Espressif).')
  ],
  electrical: { logic: 'Логика 3.3 В; пины не 5V-tolerant.', current: 'Не проверено: см. даташит ESP32-S2.', supply: '5 В через Micro-USB или вывод 5V' },
  notes: [
    'Порядок выводов — таблица Header Block в руководстве Espressif (J1 слева сверху вниз: 3V3, IO0–IO17, 5V, G; J3 справа: G, RST, IO46, IO45, RX, TX, IO42…IO33, IO26, IO21, IO20, IO19, IO18). Источник: https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s2/esp32-s2-devkitm-1/user_guide.html',
    'Модуль ESP32-S2-MINI-2 (4 МБ flash, 2 МБ PSRAM) либо старые варианты MINI-1; порт Micro-USB через мост USB-UART. Нативный USB чипа (GPIO19/20) выведен только на гребёнку.',
    'Не подтверждено: габариты платы. Руководство даёт их отдельным PDF/DXF (по ссылке на странице); в сторонних каталогах — 54 × 25.4 мм, но при 21 выводе на сторону это противоречит шагу 2.54 мм, поэтому размер на схеме условный (≈ 67 × 25.4 мм). Положение деталей на рендере приблизительное.'
  ],
  specs: [['Модуль', 'ESP32-S2-MINI-2'], ['Flash/PSRAM', '4 МБ / 2 МБ']]
}

// ---------- Espressif ESP32-C6-DevKitC-1 ----------
const c6: BoardEntry = {
  id: 'esp32-c6-devkitc', name: 'ESP32-C6-DevKitC-1', mcu: 'ESP32-C6', platform: 'esp32c6',
  pins: [
    pw('3V3', 'power', 'Выход 3.3 В.'), pw('RST', 'reset', 'CHIP_PU: высокий — чип включён, низкий — выключен.'),
    gi(4, ['ADC1_4', 'LP_GPIO4', 'JTAG MTMS', 'SPI HD (FSPIHD)']), gi(5, ['ADC1_5', 'LP_GPIO5', 'JTAG MTDI', 'SPI WP (FSPIWP)']),
    gi(6, ['ADC1_6', 'LP_GPIO6', 'I2C SDA (LP_I2C)', 'JTAG MTCK', 'SPI SCK (FSPICLK)']),
    gi(7, ['LP_GPIO7', 'I2C SCL (LP_I2C)', 'JTAG MTDO', 'SPI MOSI (FSPID)']),
    gi(0, ['ADC1_0', 'LP_GPIO0', 'XTAL_32K_P']), gi(1, ['ADC1_1', 'LP_GPIO1', 'XTAL_32K_N']),
    gi(8, ['RGB LED'], 'Strapping; на этой плате управляет RGB-светодиодом (по документации Espressif).', 'strapping'),
    gi(10, []), gi(11, []), gi(2, ['ADC1_2', 'LP_GPIO2', 'SPI MISO (FSPIQ)']), gi(3, ['ADC1_3', 'LP_GPIO3']),
    pw('5V', 'power', 'Вход/выход 5 В.'), GND(), NC(),
    { ...gi(16, ['TX0 (UART0)', 'SPI CS (FSPICS0)']), label: 'TX' }, { ...gi(17, ['RX0 (UART0)', 'SPI CS1 (FSPICS1)']), label: 'RX' },
    gi(15, [], 'Strapping.', 'strapping'), gi(23, ['SDIO_DATA3']), gi(22, ['SDIO_DATA2']), gi(21, ['SDIO_DATA1']), gi(20, ['SDIO_DATA0']),
    gi(19, ['SDIO_CLK']), gi(18, ['SDIO_CMD']), gi(9, ['BOOT button'], 'Strapping: LOW при старте = режим загрузки.', 'strapping'),
    gi(13, ['USB D+'], 'Нативный USB чипа.', 'usb'), gi(12, ['USB D-'], 'Нативный USB чипа.', 'usb')
  ],
  electrical: { logic: 'Логика 3.3 В; пины не 5V-tolerant.', current: 'Не проверено: см. даташит ESP32-C6.', supply: '5 В через любой из двух USB-C или вывод 5V' },
  notes: [
    'Порядок выводов — таблица Header Block руководства Espressif (J1 слева сверху вниз: 3V3, RST, IO4–IO7, IO0, IO1, IO8, IO10, IO11, IO2, IO3, 5V, G, NC; J3 справа: G, TX, RX, IO15, IO23…IO18, IO9, G, IO13, IO12, G, NC). Источник: https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32c6/esp32-c6-devkitc-1/user_guide.html',
    'Два USB-C: UART-мост (питание, прошивка, консоль) и нативный USB чипа (GPIO12/13, USB/JTAG). Модуль ESP32-C6-WROOM-1 (8 МБ flash); Wi-Fi 6, Bluetooth 5, 802.15.4.',
    'Не подтверждено: габариты платы (в руководстве только отдельный PDF/DXF; в сторонних каталогах 51.8 × 25.4 мм) — на схеме приблизительно. Положение деталей на рендере приблизительное.'
  ],
  specs: [['Модуль', 'ESP32-C6-WROOM-1'], ['Flash', '8 МБ']]
}

// ---------- Teensy 4.0 (PJRC) ----------
const teensy40: BoardEntry = {
  id: 'teensy-40', name: 'Teensy 4.0', mcu: 'i.MX RT1062', platform: 'teensy',
  pins: [
    pw('VIN', 'power', 'Вход 3.6–5.5 В (по карточке PJRC).'), GND(), pw('3V3', 'power', 'Выход 3.3 В, до 250 мА (по карточке PJRC).'),
    dd(23, ['PWM', 'ADC9 (A9)', 'CAN1 RX', 'MCLK1']), dd(22, ['PWM', 'ADC8 (A8)', 'CAN1 TX']), dd(21, ['ADC7 (A7)', 'RX5', 'BCLK1']), dd(20, ['ADC6 (A6)', 'TX5', 'LRCLK1']),
    dd(19, ['PWM', 'ADC5 (A5)', 'I2C SCL']), dd(18, ['PWM', 'ADC4 (A4)', 'I2C SDA']), dd(17, ['ADC3 (A3)', 'TX4', 'I2C SDA1']), dd(16, ['ADC2 (A2)', 'RX4', 'I2C SCL1']),
    dd(15, ['PWM', 'ADC1 (A1)', 'RX3', 'SPDIF IN']), dd(14, ['PWM', 'ADC0 (A0)', 'TX3', 'SPDIF OUT']), dd(13, ['PWM', 'SPI SCK', 'LED_BUILTIN']),
    dd(0, ['PWM', 'RX1', 'CAN2 RX', 'SPI CS1']), dd(1, ['PWM', 'TX1', 'CAN2 TX', 'SPI MISO1']), dd(2, ['PWM', 'OUT2']), dd(3, ['PWM', 'LRCLK2']), dd(4, ['PWM', 'BCLK2']),
    dd(5, ['PWM', 'IN2']), dd(6, ['PWM', 'OUT1D']), dd(7, ['PWM', 'RX2', 'OUT1A']), dd(8, ['PWM', 'TX2', 'IN1']), dd(9, ['PWM', 'OUT1C']),
    dd(10, ['PWM', 'SPI CS', 'MQSR']), dd(11, ['PWM', 'SPI MOSI', 'CAN1 TX']), dd(12, ['PWM', 'SPI MISO', 'MQSL'])
  ],
  electrical: { logic: 'Логика 3.3 В; пины не 5V-tolerant (проверьте даташит i.MX RT1062 и страницу PJRC).', current: 'Не подтверждено в этой сессии.', supply: 'Micro-USB 5 В или вывод VIN 3.6–5.5 В (по карточке PJRC)' },
  notes: [
    'Порядок выводов и функции — карточка распиновки PJRC (https://www.pjrc.com/teensy/card10a_rev2_web.pdf, https://www.pjrc.com/teensy/pinout.html): верхний ряд от USB — VIN, GND, 3.3V, 23…13; нижний — GND, 0…12.',
    'Показаны только штыревые выводы (28). Контактные площадки на нижней стороне и торце (24–33, VBAT, On/Off, Program, 3.3V, GND) на схему не включены. Функции пинов считаны с карточки PJRC (ШИМ — пины 0–15, 18, 19, 22, 23; у пина 11 CAN1 TX на карточке показан бледным; для пинов 0 и 1 SPI-функции CS1/MISO1 — по странице pinout.html).',
    'Не подтверждено: габариты платы (на странице PJRC — только рисунок; по стандарту DIP-28 1.4″ × 0.7″ = 35.56 × 17.78 мм). Положение деталей на рендере приблизительное.'
  ],
  specs: [['МК', 'NXP i.MX RT1062 (Cortex-M7)']]
}


const XIAO_FORM = 'Размер 21 × 17.8 мм (Seeed). Выводы — зубчатые площадки по краю платы, шаг 2.54 мм; USB-C сверху. Порядок: слева D0–D6, справа 5V, GND, 3V3, D10–D7 (официальная схема распиновки Seeed). Контактные площадки на обратной стороне на схему не включены; положение деталей на рендере приблизительное.'
const xiaoPower = (): PinInfo[] => [
  pw('5V', 'power', 'Вывод VBUS: 5 В от USB; как вход питания — только через диод (Seeed).'),
  GND(), pw('3V3', 'power', 'Выход 3.3 В стабилизатора платы.')
]

// ---------- Seeed XIAO ESP32S3 ----------
const xiaoS3: BoardEntry = {
  id: 'xiao-esp32s3', name: 'Seeed XIAO ESP32S3', mcu: 'ESP32-S3', platform: 'esp32s3',
  pins: [
    { ...gi(1, ['ADC1_0 (A0)', 'Touch1']), label: 'D0' }, { ...gi(2, ['ADC1_1 (A1)', 'Touch2']), label: 'D1' },
    { ...gi(3, ['ADC1_2 (A2)', 'Touch3']), label: 'D2' }, { ...gi(4, ['ADC1_3 (A3)', 'Touch4']), label: 'D3' },
    { ...gi(5, ['ADC1_4 (A4)', 'Touch5', 'I2C SDA']), label: 'D4' }, { ...gi(6, ['ADC1_5 (A5)', 'Touch6', 'I2C SCL']), label: 'D5' },
    { ...gi(43, ['UART TX', 'TX0 (UART0)']), label: 'D6' }, { ...gi(44, ['UART RX', 'RX0 (UART0)']), label: 'D7' },
    { ...gi(7, ['ADC1_6 (A8)', 'Touch7', 'SPI SCK']), label: 'D8' }, { ...gi(8, ['ADC1_7 (A9)', 'Touch8', 'SPI MISO']), label: 'D9' },
    { ...gi(9, ['ADC1_8 (A10)', 'Touch9', 'SPI MOSI']), label: 'D10' },
    ...xiaoPower()
  ],
  electrical: { logic: 'Логика 3.3 В; пины не 5V-tolerant.', current: 'См. даташит ESP32-S3.', supply: 'USB-C или вывод 5V' },
  notes: [
    'Соответствие D0–D10 и GPIO — таблица и схема распиновки на wiki.seeedstudio.com. Кнопка BOOT — GPIO0, пользовательский светодиод — GPIO21, кнопка RESET — CHIP_PU (на схеме Seeed); эти линии на гребёнку не выведены.',
    'Контакты D11/D12 (GPIO42/41) выведены на обратную сторону (в таблице Seeed они же JTAG MTMS/MTDI) и здесь не показаны. Плата XIAO ESP32S3 Sense (с камерой) и Plus — другие модели, не включены.',
    XIAO_FORM
  ],
  specs: [['Размер', '21 × 17.8 мм']]
}

// ---------- Seeed XIAO RP2040 ----------
const rpx = (d: number, n: number, notes?: string): PinInfo => ({ ...rpGp(n, notes), label: `D${d}` })
const xiaoRp: BoardEntry = {
  id: 'xiao-rp2040', name: 'Seeed XIAO RP2040', mcu: 'RP2040', platform: 'rp2040',
  pins: [
    rpx(0, 26, 'Подпись A0'), rpx(1, 27, 'Подпись A1'), rpx(2, 28, 'Подпись A2'), rpx(3, 29, 'Подпись A3'),
    rpx(4, 6, 'I2C0 SDA по схеме Seeed'), rpx(5, 7, 'I2C0 SCL по схеме Seeed'),
    rpx(6, 0, 'UART0 TX по схеме Seeed'), rpx(7, 1, 'UART0 RX по схеме Seeed'),
    rpx(8, 2, 'SPI0 SCK по схеме Seeed'), rpx(9, 4, 'SPI0 MISO по схеме Seeed'), rpx(10, 3, 'SPI0 MOSI по схеме Seeed'),
    ...xiaoPower()
  ],
  electrical: { logic: 'Логика 3.3 В; пины не 5V-tolerant.', current: 'См. даташит RP2040.', supply: 'USB-C или вывод 5V' },
  notes: [
    'Соответствие D0–D10 и GPIO — таблица и схема распиновки на wiki.seeedstudio.com. Функции в колонке — все возможные для данного GPIO (таблица функций RP2040); назначение по умолчанию на плате — по схеме Seeed (в заметках).',
    'Внутри платы: RGB-светодиод (GPIO17/16/25 — красный/зелёный/синий светодиоды, GPIO12 — адресуемый RGB), кнопка BOOT (QSPI_CSN), кнопка RESET (RUN) — на гребёнку не выведены.',
    XIAO_FORM
  ],
  specs: [['Размер', '21 × 17.8 мм']]
}

// ---------- Seeed XIAO SAMD21 ----------
const sx = (d: number, port: string, functions: string[], notes = ''): PinInfo =>
  ({ label: `D${d}`, gpio: d, functions: ['GPIO', ...functions], notes: `Порт ${port}${notes ? '. ' + notes : ''}` })
const xiaoSamd: BoardEntry = {
  id: 'xiao-samd21', name: 'Seeed XIAO SAMD21', mcu: 'SAMD21G18', platform: 'samd', numLabel: 'Пин Arduino №',
  pins: [
    sx(0, 'PA02', ['ADC0 (A0)', 'DAC0'], 'Единственный ЦАП'), sx(1, 'PA04', ['ADC1 (A1)']), sx(2, 'PA10', ['ADC2 (A2)']), sx(3, 'PA11', ['ADC3 (A3)']),
    sx(4, 'PA08', ['ADC4 (A4)', 'I2C SDA']), sx(5, 'PA09', ['ADC5 (A5)', 'I2C SCL']),
    sx(6, 'PB08', ['ADC6 (A6)', 'UART TX']), sx(7, 'PB09', ['ADC7 (A7)', 'UART RX']),
    sx(8, 'PA07', ['ADC8 (A8)', 'SPI SCK']), sx(9, 'PA05', ['ADC9 (A9)', 'SPI MISO']), sx(10, 'PA06', ['ADC10 (A10)', 'SPI MOSI']),
    ...xiaoPower()
  ],
  electrical: { logic: 'Логика 3.3 В; пины не 5V-tolerant.', current: 'См. даташит SAMD21.', supply: 'USB-C или вывод 5V' },
  notes: [
    'Таблица портов и схема распиновки — wiki.seeedstudio.com/Seeeduino-XIAO. Светодиоды на плате: пользовательский (D13, PA17), TX (D11, PA19) и RX (D12, PA18) — на гребёнку не выведены.',
    'Номера в колонке «Пин Arduino №» совпадают с D-номерами схемы Seeed (на схеме Arduino-имена 0–10 и A0–A10).',
    XIAO_FORM
  ],
  specs: [['МК', 'SAMD21G18 (Cortex-M0+)'], ['Размер', '21 × 17.8 мм']]
}

// ---------- SparkFun Pro Micro (5 В / 16 МГц, ATmega32U4) ----------
const proMicro: BoardEntry = {
  id: 'pro-micro', name: 'SparkFun Pro Micro (5 В / 16 МГц)', mcu: 'ATmega32U4', platform: 'avr',
  pins: [
    dd(1, ['TX1 (Serial1)', 'INT3'], 'Порт PD3; подпись на плате TXO'), dd(0, ['RX1 (Serial1)', 'INT2'], 'Порт PD2; подпись на плате RXI'),
    GND(),
    dd(2, ['I2C SDA', 'INT1'], 'Порт PD1'), dd(3, ['I2C SCL', 'INT0', 'PWM'], 'Порт PD0; 8-битный ШИМ (OC0B)'),
    dd(4, ['ADC (A6)'], 'Порт PD4'), dd(5, ['PWM'], 'Порт PC6; 10-битный ШИМ (OC3A)'),
    dd(6, ['PWM', 'ADC (A7)'], 'Порт PD7; 10-битный ШИМ (OC4D)'), dd(7, ['INT6'], 'Порт PE6'),
    dd(8, ['ADC (A8)'], 'Порт PB4'), dd(9, ['PWM', 'ADC (A9)'], 'Порт PB5; 16-битный ШИМ (OC1A)'),
    pw('RAW', 'power', 'Вход неподготовленного питания 6–16 В на стабилизатор платы (SparkFun).'),
    pw('RST', 'reset', 'Сброс: низкий уровень = перезапуск. Двойное замыкание на GND входит в загрузчик на 8 секунд (SparkFun).'),
    pw('VCC', 'power', 'Питание микроконтроллера 5 В (ток до 500 мА по документу SparkFun); вход стабилизированных 5 В либо выход стабилизатора.'),
    aa(3, 21, ['ADC4'], 'Порт PF4'), aa(2, 20, ['ADC5'], 'Порт PF5'), aa(1, 19, ['ADC6'], 'Порт PF6'), aa(0, 18, ['ADC7'], 'Порт PF7'),
    dd(15, ['SPI SCK'], 'Порт PB1'), dd(14, ['SPI MISO'], 'Порт PB3'), dd(16, ['SPI MOSI'], 'Порт PB2'),
    dd(10, ['PWM', 'ADC (A10)'], 'Порт PB6; 16-битный ШИМ (OC1B)')
  ],
  electrical: { logic: 'Логика 5 В (вариант 5 В / 16 МГц).', current: 'Графическая документация SparkFun: не более 40 мА с вывода (рекомендуется 20 мА), 200 мА на микросхему.', supply: 'Micro-USB, RAW 6–16 В или VCC 5 В' },
  notes: [
    'Порядок выводов и функции — «Graphical Datasheet» SparkFun (https://cdn.sparkfun.com/assets/f/d/8/0/d/ProMicro16MHzv2.pdf, CC BY-SA). Слева сверху вниз: TXO, RXI, GND, GND, D2…D9; справа: RAW, GND, RST, VCC, A3, A2, A1, A0, D15, D14, D16, D10.',
    'USB встроен в ATmega32U4 (HID, как Leonardo): Serial — виртуальный порт USB, Serial1 — UART на D0/D1. Светодиоды RX (D17/PB0) и TX (D30/PD5) на выводы не выведены.',
    'Размер 1.3″ × 0.7″ (33.02 × 17.78 мм) по странице товара SparkFun. Номера A0–A3 = D18–D21 — по ядру Leonardo (в документе SparkFun только имена A0–A3). Много клонов с другим расположением (в т. ч. с USB-C) — сверяйтесь с вашей платой. Есть вариант на 3.3 В / 8 МГц — другая плата.'
  ],
  specs: [['МК', 'ATmega32U4'], ['Размер', '33.02 × 17.78 мм']]
}

// ---------- Arduino Zero (ATSAMD21G18A) ----------
const zp = (n: number, port: string, functions: string[], notes = ''): PinInfo =>
  ({ label: `D${n}`, gpio: n, functions: ['GPIO', ...functions], notes: `Порт ${port}${notes ? '. ' + notes : ''}` })
const zero: BoardEntry = {
  id: 'zero', name: 'Arduino Zero', mcu: 'SAMD21G18A', platform: 'samd', numLabel: 'Пин Arduino №',
  pins: [
    zp(21, 'PA23', ['I2C SCL'], 'Выведен в верхнем ряду рядом с AREF'), zp(20, 'PA22', ['I2C SDA'], 'Выведен в верхнем ряду рядом с AREF'),
    pw('AREF', 'ref', 'Опорное напряжение АЦП, порт PA03.'), GND(),
    zp(13, 'PA17', ['PWM', 'SPI SCK', 'LED_BUILTIN']), zp(12, 'PA19', ['PWM', 'SPI MISO (CIPO)']), zp(11, 'PA16', ['PWM', 'SPI MOSI (COPI)']),
    zp(10, 'PA18', ['PWM', 'SPI SS']), zp(9, 'PA07', ['PWM']), zp(8, 'PA06', ['PWM']),
    zp(7, 'PA21', []), zp(6, 'PA20', ['PWM']), zp(5, 'PA15', ['PWM']), zp(4, 'PA08', ['PWM']), zp(3, 'PA09', ['PWM']), zp(2, 'PA14', []),
    { label: 'D1', gpio: 1, functions: ['GPIO', 'TX (Serial1)'], notes: 'D1/TX, порт PA10' },
    { label: 'D0', gpio: 0, functions: ['GPIO', 'RX (Serial1)'], notes: 'D0/RX, порт PA11' },
    pw('ATN', 'nc', 'Вывод ATN на колодке питания (первый); в документации Arduino страница его не описывает — назначение не подтверждено.'),
    pw('IOREF', 'ref', 'Напряжение логики платы (3.3 В) — шилды по нему выбирают уровни.'),
    pw('RESET', 'reset', 'Сброс.'), pw('3V3', 'power', 'Выход 3.3 В.'), pw('5V', 'power', 'Выход 5 В (USB/стабилизатор).'),
    pw('VIN', 'power', 'Вход внешнего питания (по схеме распиновки Arduino Zero).'),
    { label: 'A0', gpio: 14, functions: ['ADC0', 'DAC0', 'GPIO'], notes: 'Порт PA02 (D14)' },
    { label: 'A1', gpio: 15, functions: ['ADC1', 'GPIO'], notes: 'Порт PB08 (D15)' }, { label: 'A2', gpio: 16, functions: ['ADC2', 'GPIO'], notes: 'Порт PB09 (D16)' },
    { label: 'A3', gpio: 17, functions: ['ADC3', 'GPIO'], notes: 'Порт PA04 (D17)' }, { label: 'A4', gpio: 18, functions: ['ADC4', 'GPIO'], notes: 'Порт PA05 (D18)' },
    { label: 'A5', gpio: 19, functions: ['ADC5', 'GPIO'], notes: 'Порт PB02 (D19)' }
  ],
  electrical: {
    logic: 'Логика 3.3 В; пины не 5V-tolerant.',
    current: 'Схема распиновки Arduino: не более 7 мА с вывода (источник 46 мА, сток 65 мА на группу выводов).',
    supply: 'Micro-USB (два разъёма: Native USB и Debug) или VIN (по схеме Arduino)'
  },
  notes: [
    'Порядок выводов и функции — официальная схема распиновки Arduino Zero (PDF, CC BY-SA 4.0). Колодки в формате Uno: сверху SCL, SDA, AREF, GND, D13…D0, внизу ATN, IOREF, RESET, 3V3, 5V, GND, GND, VIN и A0–A5. ШИМ (тильда на схеме): D3, D4, D5, D6, D8, D9, D10, D11, D12, D13.',
    'Светодиоды TX (PA27), RX (PB03) и статуса на плате и порты, не выведенные на колодки, на схему не включены. Габариты и разъёмы по формату Uno (68.6 × 53.3 мм) — подробности в документации Arduino не проверялись; положение деталей на рендере приблизительное.'
  ],
  specs: [['МК', 'ATSAMD21G18A (Cortex-M0+)'], ['Формат', 'Uno']]
}

export const moreBoards: BoardEntry[] = [zero, nanoEvery, nano33iot, nanoEsp32, micro, proMicro, xiaoC3, xiaoS3, xiaoRp, xiaoSamd, s2, c6, teensy40]

export const moreSources: Record<string, string[]> = {
  zero: ['https://docs.arduino.cc/hardware/zero/', 'https://docs.arduino.cc/resources/pinouts/ABX00003-full-pinout.pdf'],
  'nano-every': ['https://docs.arduino.cc/hardware/nano-every/', 'https://docs.arduino.cc/resources/pinouts/ABX00028-full-pinout.pdf'],
  'nano-33-iot': ['https://docs.arduino.cc/hardware/nano-33-iot/', 'https://docs.arduino.cc/resources/pinouts/ABX00027-full-pinout.pdf'],
  'nano-esp32': ['https://docs.arduino.cc/hardware/nano-esp32/', 'https://docs.arduino.cc/resources/pinouts/ABX00083-full-pinout.pdf'],
  micro: ['https://docs.arduino.cc/hardware/micro/', 'https://docs.arduino.cc/resources/pinouts/A000053-full-pinout.pdf'],
  'xiao-esp32c3': ['https://wiki.seeedstudio.com/XIAO_ESP32C3_Getting_Started/', 'https://files.seeedstudio.com/wiki/XIAO_WiFi/XIAO_ESP32-C3_front_pinout.png', 'https://github.com/espressif/arduino-esp32/blob/master/variants/XIAO_ESP32C3/pins_arduino.h'],
  'esp32-s2-devkitm': ['https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s2/esp32-s2-devkitm-1/user_guide.html'],
  'esp32-c6-devkitc': ['https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32c6/esp32-c6-devkitc-1/user_guide.html'],
  'xiao-esp32s3': ['https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/', 'https://files.seeedstudio.com/wiki/SeeedStudio-XIAO-ESP32S3/img/XIAO_ESP32-S3_front_pinout.png'],
  'xiao-rp2040': ['https://wiki.seeedstudio.com/XIAO-RP2040/', 'https://files.seeedstudio.com/wiki/XIAO-RP2040/img/XIAO_RP2040_front_pinout.png', 'https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf'],
  'xiao-samd21': ['https://wiki.seeedstudio.com/Seeeduino-XIAO/', 'https://files.seeedstudio.com/wiki/Seeeduino-XIAO/img/XIAO_SAMD21_front_pinout.png'],
  'pro-micro': ['https://www.sparkfun.com/products/12640', 'https://cdn.sparkfun.com/assets/f/d/8/0/d/ProMicro16MHzv2.pdf'],
  'teensy-40': ['https://www.pjrc.com/teensy/pinout.html', 'https://www.pjrc.com/teensy/card10a_rev2_web.pdf']
}
