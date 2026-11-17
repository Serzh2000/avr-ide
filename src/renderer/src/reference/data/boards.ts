import type { BoardEntry, PinInfo } from '../types'
import { mcuSources, rp2040Boards, stm32Boards } from './boardsMcu'

const d = (n: number, functions: string[], notes?: string, special?: PinInfo['special']): PinInfo =>
  ({ label: `D${n}`, gpio: n, functions: ['GPIO', ...functions], notes, special })
const g = (n: number, functions: string[], notes?: string, special?: PinInfo['special']): PinInfo =>
  ({ label: `GPIO${n}`, gpio: n, functions, notes, special })
/** Вывод без номера GPIO: питание, земля, сброс, опорное напряжение. */
const pw = (label: string, kind: NonNullable<PinInfo['kind']>, notes: string, functions: string[] = []): PinInfo =>
  ({ label, gpio: null, functions, notes, kind })
const GND = (extra = ''): PinInfo => pw('GND', 'gnd', 'Земля (общий провод).' + extra)
const V5 = (n: string): PinInfo => pw('5V', 'power', n)
const V33 = (n: string): PinInfo => pw('3V3', 'power', n)

/** Общая часть Uno/Nano (ATmega328P). */
function unoPins(): PinInfo[] {
  return [
    d(0, ['RX (Serial)'], 'Занят USB-Serial; при подключённом USB мешает загрузке', 'warning'),
    d(1, ['TX (Serial)'], 'Занят USB-Serial', 'warning'),
    d(2, ['INT0']),
    d(3, ['INT1', 'PWM']),
    d(4, []),
    d(5, ['PWM']),
    d(6, ['PWM']),
    d(7, []),
    d(8, []),
    d(9, ['PWM']),
    d(10, ['PWM', 'SPI SS']),
    d(11, ['PWM', 'SPI MOSI']),
    d(12, ['SPI MISO']),
    d(13, ['SPI SCK', 'LED_BUILTIN']),
    { label: 'A0', gpio: 14, functions: ['ADC0', 'GPIO'] },
    { label: 'A1', gpio: 15, functions: ['ADC1', 'GPIO'] },
    { label: 'A2', gpio: 16, functions: ['ADC2', 'GPIO'] },
    { label: 'A3', gpio: 17, functions: ['ADC3', 'GPIO'] },
    { label: 'A4', gpio: 18, functions: ['ADC4', 'I2C SDA', 'GPIO'] },
    { label: 'A5', gpio: 19, functions: ['ADC5', 'I2C SCL', 'GPIO'] }
  ]
}

const megaSpecial: Record<number, { f: string[]; n?: string; s?: PinInfo['special'] }> = {
  0: { f: ['RX0 (Serial)'], n: 'USB-Serial', s: 'warning' },
  1: { f: ['TX0 (Serial)'], n: 'USB-Serial', s: 'warning' },
  2: { f: ['PWM', 'INT4'] }, 3: { f: ['PWM', 'INT5'] },
  4: { f: ['PWM'] }, 5: { f: ['PWM'] }, 6: { f: ['PWM'] }, 7: { f: ['PWM'] }, 8: { f: ['PWM'] },
  9: { f: ['PWM'] }, 10: { f: ['PWM'] }, 11: { f: ['PWM'] }, 12: { f: ['PWM'] }, 13: { f: ['PWM', 'LED_BUILTIN'] },
  14: { f: ['TX3 (Serial3)'] }, 15: { f: ['RX3 (Serial3)'] },
  16: { f: ['TX2 (Serial2)'] }, 17: { f: ['RX2 (Serial2)'] },
  18: { f: ['TX1 (Serial1)', 'INT3'] }, 19: { f: ['RX1 (Serial1)', 'INT2'] },
  20: { f: ['I2C SDA', 'INT1'] }, 21: { f: ['I2C SCL', 'INT0'] },
  44: { f: ['PWM'] }, 45: { f: ['PWM'] }, 46: { f: ['PWM'] },
  50: { f: ['SPI MISO'] }, 51: { f: ['SPI MOSI'] }, 52: { f: ['SPI SCK'] }, 53: { f: ['SPI SS'] }
}

function megaPins(): PinInfo[] {
  const pins: PinInfo[] = []
  for (let n = 0; n <= 53; n++) {
    const s = megaSpecial[n]
    pins.push(d(n, s?.f ?? [], s?.n, s?.s))
  }
  for (let a = 0; a <= 15; a++) pins.push({ label: `A${a}`, gpio: 54 + a, functions: [`ADC${a}`, 'GPIO'] })
  return pins
}


/** Питание Uno/Mega/Leonardo (колодка POWER). */
function arduinoPower(): PinInfo[] {
  return [
    pw('IOREF', 'ref', 'Выдаёт рабочее напряжение логики платы (5 В) — шилды по нему выбирают уровни.'),
    pw('RESET', 'reset', 'Сброс микроконтроллера: низкий уровень = перезапуск. Дублирует кнопку RESET.'),
    V33('Выход 3.3 В от стабилизатора платы, максимальный ток 50 мА. Источник: https://store.arduino.cc/products/arduino-uno-rev3'),
    V5('Выход 5 В (от стабилизатора или USB). Питать плату отсюда можно только стабилизированным 5 В.'),
    GND(),
    pw('VIN', 'power', 'Вход внешнего питания (рекомендуется 7–12 В, допустимо 6–20 В) либо выход, когда питание идёт с гнезда DC. Источник: https://store.arduino.cc/products/arduino-uno-rev3'),
    pw('AREF', 'ref', 'Опорное напряжение АЦП (analogReference(EXTERNAL)). Не подавайте напряжение, если не вызывали analogReference().')
  ]
}

const AVR_NC = pw('NC', 'nc', 'Не подключён (зарезервирован).')

const e32: PinInfo[] = [
      g(0, ['ADC2_1', 'Touch1', 'BOOT button'], 'Strapping: LOW при старте = режим загрузки', 'strapping'),
      g(1, ['TX0 (Serial)'], 'USB-Serial', 'warning'),
      g(2, ['ADC2_2', 'Touch2', 'LED (на многих платах)'], 'Strapping', 'strapping'),
      g(3, ['RX0 (Serial)'], 'USB-Serial', 'warning'),
      g(4, ['ADC2_0', 'Touch0']),
      g(5, ['VSPI SS'], 'Strapping (выдаёт ШИМ при загрузке)', 'strapping'),
      g(12, ['ADC2_5', 'Touch5', 'HSPI MISO'], 'Strapping: HIGH при старте задаёт 1.8 В flash — может не стартовать', 'strapping'),
      g(13, ['ADC2_4', 'Touch4', 'HSPI MOSI']),
      g(14, ['ADC2_6', 'Touch6', 'HSPI SCK']),
      g(15, ['ADC2_3', 'Touch3', 'HSPI SS'], 'Strapping (лог загрузки)', 'strapping'),
      g(16, ['UART2 RX (в ядре 2.x; в 3.x Serial2 по умолчанию на GPIO4/25)'], 'Занят PSRAM (CS) на модулях WROVER — не использовать; на WROOM свободен. Источник: https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/peripherals/gpio.html ; документация ESP-WROVER-KIT'),
      g(17, ['UART2 TX (в ядре 2.x; в 3.x Serial2 по умолчанию на GPIO4/25)'], 'Занят PSRAM (CLK) на модулях WROVER — не использовать; на WROOM свободен. Источник: https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/peripherals/gpio.html ; документация ESP-WROVER-KIT'),
      g(18, ['VSPI SCK']),
      g(19, ['VSPI MISO']),
      g(21, ['I2C SDA']),
      g(22, ['I2C SCL']),
      g(23, ['VSPI MOSI']),
      g(25, ['DAC1', 'ADC2_8']),
      g(26, ['DAC2', 'ADC2_9']),
      g(27, ['ADC2_7', 'Touch7']),
      g(32, ['ADC1_4', 'Touch9']),
      g(33, ['ADC1_5', 'Touch8']),
      g(34, ['ADC1_6'], 'Только вход, без подтяжек', 'input-only'),
      g(35, ['ADC1_7'], 'Только вход, без подтяжек', 'input-only'),
      g(36, ['ADC1_0 (VP)'], 'Только вход, без подтяжек', 'input-only'),
      g(39, ['ADC1_3 (VN)'], 'Только вход, без подтяжек', 'input-only'),
      g(6, ['flash'], 'GPIO6..11 заняты SPI flash — не использовать', 'flash'),
      g(7, ['flash'], 'GPIO6..11 заняты SPI flash — не использовать', 'flash'),
      g(8, ['flash'], 'GPIO6..11 заняты SPI flash — не использовать', 'flash'),
      g(9, ['flash'], 'GPIO6..11 заняты SPI flash — не использовать', 'flash'),
      g(10, ['flash'], 'GPIO6..11 заняты SPI flash — не использовать', 'flash'),
      g(11, ['flash'], 'GPIO6..11 заняты SPI flash — не использовать', 'flash')
    ]

const E = (n: number): PinInfo => {
  const p = e32.find((x) => x.gpio === n)
  if (!p) throw new Error('нет ESP32 GPIO' + n)
  return p
}

const s3: PinInfo[] = [
      g(0, ['BOOT button'], 'Strapping', 'strapping'),
      g(1, ['ADC1_0', 'Touch1']), g(2, ['ADC1_1', 'Touch2']),
      g(3, ['ADC1_2', 'Touch3'], 'Strapping (JTAG source)', 'strapping'),
      g(4, ['ADC1_3', 'Touch4']), g(5, ['ADC1_4', 'Touch5']), g(6, ['ADC1_5', 'Touch6']), g(7, ['ADC1_6', 'Touch7']),
      g(8, ['ADC1_7', 'Touch8', 'I2C SDA (по умолчанию в ядре)']),
      g(9, ['ADC1_8', 'Touch9', 'I2C SCL (по умолчанию в ядре)']),
      g(10, ['ADC1_9', 'Touch10', 'SPI SS (FSPI)']),
      g(11, ['ADC2_0', 'Touch11', 'SPI MOSI (FSPI)']),
      g(12, ['ADC2_1', 'Touch12', 'SPI SCK (FSPI)']),
      g(13, ['ADC2_2', 'Touch13', 'SPI MISO (FSPI)']),
      g(14, ['ADC2_3', 'Touch14']),
      g(15, ['ADC2_4', 'UART1 RX (по умолчанию)']), g(16, ['ADC2_5', 'UART1 TX (по умолчанию)']), g(17, ['ADC2_6']), g(18, ['ADC2_7']),
      g(19, ['ADC2_8', 'USB D-'], 'Используется нативным USB; не занимать, если нужен USB', 'usb'),
      g(20, ['ADC2_9', 'USB D+'], 'Используется нативным USB; не занимать, если нужен USB', 'usb'),
      g(21, []),
      g(35, [], 'Занят octal PSRAM/flash на модулях с octal-памятью (N8R8, N16R8 и т.п.): не использовать; на модулях без octal-памяти свободен. Источник: https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide_v1.1.html', 'flash'),
      g(36, [], 'Занят octal PSRAM/flash на модулях с octal-памятью (N8R8, N16R8): не использовать', 'flash'),
      g(37, [], 'Занят octal PSRAM/flash на модулях с octal-памятью (N8R8, N16R8): не использовать', 'flash'),
      g(38, []), g(39, ['JTAG MTCK']), g(40, ['JTAG MTDO']), g(41, ['JTAG MTDI']), g(42, ['JTAG MTMS']),
      g(43, ['TX0 (UART0)']), g(44, ['RX0 (UART0)']),
      g(45, [], 'Strapping (напряжение VDD_SPI)', 'strapping'),
      g(46, [], 'Strapping (режим загрузки/лог); только вход', 'strapping'),
      g(47, []),
      g(48, ['RGB LED (DevKitC-1 v1.0; у v1.1 светодиод на GPIO38)'], 'Адресуемый светодиод WS2812; в ядре LED_BUILTIN/RGB_BUILTIN указывает на GPIO48 (используйте rgbLedWrite). На v1.1 передавайте пин 38. Источники: https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide_v1.1.html ; variants/esp32s3/pins_arduino.h', 'warning')
    ]
const S = (n: number): PinInfo => {
  const p = s3.find((x) => x.gpio === n)
  if (!p) throw new Error('нет ESP32-S3 GPIO' + n)
  return p
}

const c3: PinInfo[] = [
      g(0, ['ADC1_0']), g(1, ['ADC1_1']),
      g(2, ['ADC1_2', 'SPI MISO (FSPIQ)'], 'Strapping', 'strapping'),
      g(3, ['ADC1_3']), g(4, ['ADC1_4', 'JTAG MTMS']),
      g(5, ['ADC2_0', 'JTAG MTDI'], 'ADC2: конфликт с WiFi; на части ревизий чипа ADC2 неработоспособен (Errata)'),
      g(6, ['JTAG MTCK', 'SPI SCK (FSPICLK)']), g(7, ['JTAG MTDO', 'SPI MOSI (FSPID)']),
      g(8, ['LED (на многих платах)', 'I2C SDA (по умолчанию в ядре)'], 'Strapping. DevKitM-1: RGB-светодиод на GPIO8; на Super Mini LED_BUILTIN тоже 8, инверсность светодиода официально не подтверждена. Источники: https://docs.espressif.com/projects/arduino-esp32/en/latest/boards/ESP32-C3-DevKitM-1.html ; variants/esp32c3 и nologo_esp32c3_super_mini/pins_arduino.h', 'strapping'),
      g(9, ['BOOT button', 'I2C SCL (по умолчанию в ядре)'], 'Strapping: LOW при старте = режим загрузки', 'strapping'),
      g(10, ['SPI CS (FSPICS0)']),
      g(18, ['USB D-'], 'Нативный USB', 'usb'), g(19, ['USB D+'], 'Нативный USB', 'usb'),
      g(20, ['RX0 (UART0)']), g(21, ['TX0 (UART0)'])
    ]
const C = (n: number): PinInfo => {
  const p = c3.find((x) => x.gpio === n)
  if (!p) throw new Error('нет ESP32-C3 GPIO' + n)
  return p
}

/** Общие пины NodeMCU (ESP-12E / ESP8266). */
const nodemcuGpio: PinInfo[] = [
      { label: 'D0', gpio: 16, functions: ['GPIO', 'Wake (deep sleep)'], notes: 'Нет ШИМ/прерываний/I2C. Светодиод на плате (инверсный)', special: 'warning' },
      { label: 'D1', gpio: 5, functions: ['GPIO', 'PWM', 'I2C SCL'] },
      { label: 'D2', gpio: 4, functions: ['GPIO', 'PWM', 'I2C SDA'] },
      { label: 'D3', gpio: 0, functions: ['GPIO', 'PWM', 'FLASH button'], notes: 'LOW при старте = режим прошивки', special: 'strapping' },
      { label: 'D4', gpio: 2, functions: ['GPIO', 'PWM', 'LED_BUILTIN', 'TXD1'], notes: 'Должен быть HIGH при старте; светодиод инверсный', special: 'strapping' },
      { label: 'D5', gpio: 14, functions: ['GPIO', 'PWM', 'SPI SCK'] },
      { label: 'D6', gpio: 12, functions: ['GPIO', 'PWM', 'SPI MISO'] },
      { label: 'D7', gpio: 13, functions: ['GPIO', 'PWM', 'SPI MOSI', 'RXD2'] },
      { label: 'D8', gpio: 15, functions: ['GPIO', 'PWM', 'SPI CS', 'TXD2'], notes: 'Должен быть LOW при старте', special: 'strapping' },
      { label: 'D9 (RX)', gpio: 3, functions: ['GPIO', 'RX0 (Serial)'], notes: 'Занят USB-Serial' },
      { label: 'D10 (TX)', gpio: 1, functions: ['GPIO', 'TX0 (Serial)'], notes: 'Занят USB-Serial', special: 'warning' },
      { label: 'SD2', gpio: 9, functions: ['flash (SD2)'], notes: 'Линия flash. Документация ядра: пины 6–11 подключены к flash, использование как GPIO обычно приводит к сбою; работать как GPIO могут только при режиме flash DIO (по умолчанию QIO). Источник: https://arduino-esp8266.readthedocs.io/en/latest/reference.html', special: 'flash' },
      { label: 'SD3', gpio: 10, functions: ['flash (SD3)'], notes: 'Линия flash; та же оговорка про режим DIO/QIO (в документации ядра явно упомянуты пины 9 и 11; для GPIO10 аналогичность не подтверждена). Источник: https://arduino-esp8266.readthedocs.io/en/latest/reference.html', special: 'flash' },
      { label: 'A0', gpio: null, functions: ['ADC (единственный)'], notes: 'На NodeMCU стоит делитель — вход до ~3.3 В; у голого чипа 0..1 В', special: 'input-only' },
      { label: 'SD1', gpio: 8, functions: ['flash (SD1)'], notes: 'Линия flash — как GPIO использовать нельзя (см. SD2).', special: 'flash' },
      { label: 'CMD', gpio: 11, functions: ['flash (CMD)'], notes: 'Линия flash — как GPIO использовать нельзя (см. SD2).', special: 'flash' },
      { label: 'SD0', gpio: 7, functions: ['flash (SD0)'], notes: 'Линия flash — как GPIO использовать нельзя (см. SD2).', special: 'flash' },
      { label: 'CLK', gpio: 6, functions: ['flash (CLK)'], notes: 'Линия flash — как GPIO использовать нельзя (см. SD2).', special: 'flash' }
    ]
const N = (label: string): PinInfo => {
  const p = nodemcuGpio.find((x) => x.label === label)
  if (!p) throw new Error('нет пина NodeMCU ' + label)
  return p
}
const EN_PIN = pw('EN', 'reset', 'Вход разрешения работы (CHIP_PU): низкий уровень выключает чип, на плате подтянут к 3.3 В.')
const RST_8266 = pw('RST', 'reset', 'Сброс ESP8266: низкий уровень = перезапуск. Дублирует кнопку RST.')
const V33_ESP = V33('3.3 В: на плате выход стабилизатора (ток ограничен им); можно питать плату напрямую 3.3 В, минуя USB.')
const VIN_ESP = pw('VIN', 'power', 'Питание платы 5 В: вход внешнего 5 В либо выход USB-5 В (до стабилизатора 3.3 В).')

const ELEC_E32 = {
  logic: 'Логика 3.3 В; пины не 5V-tolerant — подача 5 В может повредить чип.',
  current: 'Даташит ESP32: до 40 мА с вывода (абсолютный максимум); практически закладывайте ≤ 20 мА. Проверить по datasheet.',
  supply: '5 В через USB или вывод 5V/VIN (стабилизатор 3.3 В на плате)'
}
const ELEC_8266 = {
  logic: 'Логика 3.3 В; пины не 5V-tolerant.',
  current: 'Даташит ESP8266EX: до 12 мА с вывода. Проверить по datasheet.',
  supply: '5 В через Micro-USB или вывод VIN/5V (стабилизатор 3.3 В на плате)'
}
const ELEC_AVR = (supply: string, mcu: string) => ({
  logic: 'Логика 5 В',
  current: `С вывода рекомендуется ≤ 20 мА, абсолютный максимум 40 мА (даташит ${mcu}).`,
  supply
})

const boardList: BoardEntry[] = [
  {
    id: 'uno', name: 'Arduino Uno R3', mcu: 'ATmega328P', platform: 'avr',
    pins: [...unoPins(), ...arduinoPower(), AVR_NC],
    electrical: ELEC_AVR('USB 5 В или гнездо DC 7–12 В (VIN)', 'ATmega328P'),
    notes: [
      'Логика 5 В, ток с пина: рекомендуется ≤ 20 мА, абсолютный максимум 40 мА. Источник: https://store.arduino.cc/products/arduino-uno-rev3',
      'ШИМ (~): 3, 5, 6, 9, 10, 11. Частота: ~490 Гц; на 5 и 6 — ~980 Гц.',
      'I2C: A4 (SDA), A5 (SCL) — те же линии выведены и отдельными гнёздами SDA/SCL рядом с AREF. SPI: SS 10, MOSI 11, MISO 12, SCK 13. LED_BUILTIN = 13. Источник: https://github.com/arduino/ArduinoCore-avr/blob/master/variants/standard/pins_arduino.h ; https://www.arduino.cc/reference/en/language/functions/analog-io/analogwrite/',
      'Внешние прерывания: только D2 (INT0) и D3 (INT1).',
      'ОЗУ 2 КБ, flash 32 КБ (0.5 КБ занимает загрузчик), EEPROM 1 КБ.',
      'Размер платы 68.6 × 53.3 мм. Положение разъёмов и выводов на схеме — по чертежу платы, с точностью около 1–2 мм.'
    ]
  },
  {
    id: 'nano', name: 'Arduino Nano', mcu: 'ATmega328P', platform: 'avr',
    pins: [
      ...unoPins(),
      { label: 'A6', gpio: 20, functions: ['ADC6'], notes: 'Только аналоговый вход, цифрового режима нет', special: 'input-only' },
      { label: 'A7', gpio: 21, functions: ['ADC7'], notes: 'Только аналоговый вход, цифрового режима нет', special: 'input-only' },
      pw('RST', 'reset', 'Сброс: низкий уровень = перезапуск. Два вывода RST на плате соединены.'),
      V5('Выход 5 В (после стабилизатора/USB) либо вход стабилизированных 5 В при питании не от USB/VIN.'),
      V33('Выход 3.3 В (от преобразователя USB-Serial), ток до 50 мА (Nano 3.x). Источник: https://docs.arduino.cc/hardware/nano/'),
      GND(),
      pw('VIN', 'power', 'Вход внешнего питания 7–12 В (на стабилизатор платы).'),
      pw('AREF', 'ref', 'Опорное напряжение АЦП (analogReference(EXTERNAL)).')
    ],
    electrical: ELEC_AVR('Mini-B USB 5 В или VIN 7–12 В', 'ATmega328P'),
    notes: [
      'Распиновка совпадает с Uno, плюс A6 и A7 (только analogRead). Колодки: слева (USB сверху) — TX1, RX0, RST, GND, D2…D12; справа — VIN, GND, RST, 5V, A7…A0, AREF, 3V3, D13.',
      'У клонов на CH340 — свой драйвер; старые Nano используют «Old Bootloader» (меню платы).',
      'Размер платы 45 × 18 мм, шаг выводов 2.54 мм, ряды через 15.24 мм (0.6″).'
    ]
  },
  {
    id: 'mega', name: 'Arduino Mega 2560', mcu: 'ATmega2560', platform: 'avr',
    pins: [...megaPins(), ...arduinoPower(), AVR_NC],
    electrical: ELEC_AVR('USB 5 В или гнездо DC 7–12 В (VIN)', 'ATmega2560'),
    notes: [
      'ШИМ: 2..13 и 44..46.',
      'Аппаратные UART: Serial (0/1), Serial1 (19/18), Serial2 (17/16), Serial3 (15/14).',
      'Внешние прерывания: 2, 3, 18, 19, 20, 21.',
      'I2C: SDA — 20, SCL — 21 (также выведены рядом с AREF). SPI: MISO 50, MOSI 51, SCK 52, SS 53.',
      'ОЗУ 8 КБ, flash 256 КБ, EEPROM 4 КБ. LED_BUILTIN = 13. Источник: https://github.com/arduino/ArduinoCore-avr/blob/master/variants/mega/pins_arduino.h',
      'Аналоговых входов 16: A0–A15 = пины 54–69.',
      'Размер платы 101.6 × 53.3 мм. Положение гребёнки A8–A15 и двухрядной колодки 22–53 на схеме приблизительное (по чертежу платы); порядок выводов проверен по документации.'
    ]
  },
  {
    id: 'promini', name: 'Arduino Pro Mini (5 В / 16 МГц)', mcu: 'ATmega328P', platform: 'avr',
    pins: [
      ...unoPins(),
      { label: 'A6', gpio: 20, functions: ['ADC6'], notes: 'Контактная площадка на плате; только аналоговый вход', special: 'input-only' },
      { label: 'A7', gpio: 21, functions: ['ADC7'], notes: 'Контактная площадка на плате; только аналоговый вход', special: 'input-only' },
      pw('RAW', 'power', 'Вход внешнего питания на стабилизатор платы: 5 В версия — 5–12 В; 3.3 В версия — 3.35–12 В. Источник: даташит Pro Mini (SparkFun).'),
      pw('VCC', 'power', 'Питание микроконтроллера: выход стабилизатора либо вход стабилизированных 5 В (у версии 3.3 В — 3.3 В).'),
      GND(),
      pw('RST', 'reset', 'Сброс: низкий уровень = перезапуск. Выведен дважды (боковая колодка и рядом с кнопкой).'),
      pw('DTR', 'reset', 'Линия DTR переходника USB-Serial: через конденсатор 0.1 мкФ сбрасывает плату перед загрузкой.')
    ],
    electrical: {
      logic: 'Логика 5 В (версия 5 В / 16 МГц) или 3.3 В (версия 3.3 В / 8 МГц)',
      current: 'С вывода рекомендуется ≤ 20 мА, максимум 40 мА (даташит ATmega328P).',
      supply: 'RAW 5–12 В либо VCC напрямую; USB-разъёма нет'
    },
    notes: [
      'Нет USB-разъёма: для загрузки нужен переходник FTDI/CP2102/CH340 (6-контактная гребёнка вверху: GND, GND, VCC, RXI, TXO, DTR). Выбирайте в меню плату «Arduino Pro or Pro Mini» с нужным процессором.',
      'Аналоговые входы A4 и A5 (они же I2C SDA/SCL), A6 и A7 — контактные площадки, а не штыри по краю: положение на схеме приблизительное — сверяйтесь с вашей платой, на клонах оно различается.',
      'Колодки: слева (гребёнка FTDI вверху) — TXO(D1), RXI(D0), RST, GND, D2…D9; справа — RAW, GND, RST, VCC, A3…A0, D13…D10. Источник: схема SparkFun Pro Mini 328 5V/16MHz.',
      'Размер 33 × 18 мм. Светодиод D13 (LED_BUILTIN) и светодиод питания на плате. ШИМ: 3, 5, 6, 9, 10, 11; прерывания: D2, D3.'
    ]
  },
  {
    id: 'leonardo', name: 'Arduino Leonardo', mcu: 'ATmega32U4', platform: 'avr',
    pins: [
      d(0, ['RX1 (Serial1)', 'INT2'], 'UART Serial1; к USB не относится (USB встроен в чип)'),
      d(1, ['TX1 (Serial1)', 'INT3'], 'UART Serial1; к USB не относится'),
      d(2, ['I2C SDA', 'INT1'], 'Он же вывод SDA рядом с AREF'),
      d(3, ['I2C SCL', 'INT0', 'PWM'], 'Он же вывод SCL рядом с AREF'),
      d(4, ['ADC (A6)']),
      d(5, ['PWM']),
      d(6, ['PWM', 'ADC (A7)']),
      d(7, ['INT6']),
      d(8, ['ADC (A8)']),
      d(9, ['PWM', 'ADC (A9)']),
      d(10, ['PWM', 'ADC (A10)']),
      d(11, ['PWM']),
      d(12, ['ADC (A11)']),
      d(13, ['PWM', 'LED_BUILTIN']),
      { label: 'A0', gpio: 18, functions: ['ADC0', 'GPIO'] },
      { label: 'A1', gpio: 19, functions: ['ADC1', 'GPIO'] },
      { label: 'A2', gpio: 20, functions: ['ADC2', 'GPIO'] },
      { label: 'A3', gpio: 21, functions: ['ADC3', 'GPIO'] },
      { label: 'A4', gpio: 22, functions: ['ADC4', 'GPIO'] },
      { label: 'A5', gpio: 23, functions: ['ADC5', 'GPIO'] },
      { label: 'MISO', gpio: null, functions: ['SPI MISO'], notes: 'SPI выведен только на разъём ICSP (пины 11–13 к SPI не относятся)' },
      { label: 'MOSI', gpio: null, functions: ['SPI MOSI'], notes: 'SPI выведен только на разъём ICSP' },
      { label: 'SCK', gpio: null, functions: ['SPI SCK'], notes: 'SPI выведен только на разъём ICSP' },
      ...arduinoPower(),
      AVR_NC
    ],
    electrical: ELEC_AVR('Micro-USB 5 В или гнездо DC 7–12 В (VIN)', 'ATmega32U4'),
    notes: [
      'USB встроен в ATmega32U4: Serial — это виртуальный порт USB (CDC), а Serial1 — аппаратный UART на пинах 0 (RX) и 1 (TX). При перезагрузке порт на время пропадает и появляется заново.',
      'ШИМ: 3, 5, 6, 9, 10, 11, 13. I2C: SDA = D2, SCL = D3 (отдельные SDA/SCL рядом с AREF — те же линии). SPI только на ICSP. Источник: https://docs.arduino.cc/hardware/leonardo/',
      'Аналоговых входов 12: A0–A5 и 6 на цифровых пинах (D4 = A6, D6 = A7, D8 = A8, D9 = A9, D10 = A10, D12 = A11). Внешние прерывания: 0, 1, 2, 3, 7.',
      'Размер платы 68.6 × 53.3 мм, форма как у Uno. Положение выводов ICSP на схеме приблизительное.'
    ]
  },
  {
    id: 'nodemcu-v2', name: 'NodeMCU v2 Amica (ESP-12E)', mcu: 'ESP8266', platform: 'esp8266',
    pins: [
      N('A0'), pw('RSV', 'nc', 'Зарезервировано (на Amica не подключено, не использовать).'),
      N('SD3'), N('SD2'), N('SD1'), N('CMD'), N('SD0'), N('CLK'),
      GND(), V33_ESP, EN_PIN, RST_8266, VIN_ESP,
      N('D0'), N('D1'), N('D2'), N('D3'), N('D4'), N('D5'), N('D6'), N('D7'), N('D8'), N('D9 (RX)'), N('D10 (TX)')
    ],
    electrical: ELEC_8266,
    notes: [
      'Логика 3.3 В, пины не 5V-tolerant.',
      'Соответствие D-меток GPIO задано константами D0..D8 в ядре; на других платах (Wemos D1 mini) метки совпадают, но проверьте свою плату.',
      'Для «безопасных» пинов общего назначения см. D1, D2, D5, D6, D7.',
      'Порядок выводов Amica (USB внизу): слева A0, RSV, RSV, SD3, SD2, SD1, CMD, SD0, CLK, GND, 3V3, EN, RST, GND, VIN; справа D0…D4, 3V3, GND, D5…D8, RX, TX, GND, 3V3. Размер около 49 × 25.5 мм, ряды через 22.86 мм (0.9″) — размеры приблизительные.',
      'Два светодиода: на GPIO16 (D0) и на GPIO2 (D4), оба зажигаются низким уровнем. Кнопки FLASH (GPIO0) и RST.'
    ]
  },
  {
    id: 'nodemcu-v3', name: 'NodeMCU v3 LoLin (ESP-12E)', mcu: 'ESP8266', platform: 'esp8266',
    pins: [
      N('A0'), GND(), pw('VU', 'power', 'Выход 5 В прямо с USB (до стабилизатора) — только у LoLin V3. Проверить по вашей ревизии.'),
      N('SD3'), N('SD2'), N('SD1'), N('CMD'), N('SD0'), N('CLK'),
      V33_ESP, EN_PIN, RST_8266, VIN_ESP,
      N('D0'), N('D1'), N('D2'), N('D3'), N('D4'), N('D5'), N('D6'), N('D7'), N('D8'), N('D9 (RX)'), N('D10 (TX)')
    ],
    electrical: ELEC_8266,
    notes: [
      'Та же логика D-пинов, что и у NodeMCU v2; плата крупнее (около 58 × 31 мм, ряды через 27.94 мм).',
      'Отличие от Amica — две верхние позиции левой колодки: у LoLin V3 это GND и VU (5 В с USB) вместо двух RSV. Не подтверждено официальным источником (схема из открытого доступа по памяти); сверяйтесь с надписями на плате.',
      'Слева сверху вниз: A0, GND, VU, SD3, SD2, SD1, CMD, SD0, CLK, GND, 3V3, EN, RST, GND, VIN; справа D0…D4, 3V3, GND, D5…D8, RX, TX, GND, 3V3. Порядок GND на левой колодке уточните по плате.'
    ]
  },
  {
    id: 'wemos-d1-mini', name: 'Wemos (LOLIN) D1 mini', mcu: 'ESP8266', platform: 'esp8266',
    pins: [
      N('A0'), RST_8266, N('D0'), N('D5'), N('D6'), N('D7'), N('D8'), V33_ESP,
      N('D9 (RX)'), N('D10 (TX)'), N('D1'), N('D2'), N('D3'), N('D4'), GND(), V5('5 В: вход питания платы либо выход с USB (через диод).')
    ],
    electrical: ELEC_8266,
    notes: [
      'Размер платы 34.2 × 25.6 мм. Все выводы 3.3 В; аналоговый вход A0 рассчитан на максимум 3.2 В (на плате делитель). Источник: https://www.wemos.cc/en/latest/d1/d1_mini.html',
      'Левая колодка (USB внизу): RST, A0, D0, D5, D6, D7, D8, 3V3; правая: TX, RX, D1, D2, D3, D4, G, 5V. D1 и D2 — I2C (SCL/SDA), D5–D8 — SPI. Прерывания, ШИМ, I2C — на всех пинах, кроме D0. Порядок по распространённой схеме платы, официальная страница даёт только картинку: сверяйтесь с шёлкографией.',
      'Светодиод на D4 (GPIO2), зажигается низким уровнем. На D3 и D4 стоят подтяжки 10 кОм к 3.3 В, на D8 — подтяжка к земле 10 кОм (поэтому подключённые к ним устройства могут мешать загрузке).'
    ]
  },
  {
    id: 'esp32-devkit', name: 'ESP32 DevKit V1 (30 pin)', mcu: 'ESP32', platform: 'esp32',
    pins: [
      pw('EN', 'reset', 'Вход разрешения работы (CHIP_PU); низкий уровень — перезапуск. Дублирует кнопку EN.'),
      E(36), E(39), E(34), E(35), E(32), E(33), E(25), E(26), E(27), E(14), E(12), E(13),
      GND(), pw('VIN', 'power', 'Питание платы 5 В (вход или выход USB-5 В); дальше стабилизатор 3.3 В.'),
      E(23), E(22), E(1), E(3), E(21), E(19), E(18), E(5), E(17), E(16), E(4), E(2), E(15),
      V33('Выход стабилизатора 3.3 В платы (ток ограничен стабилизатором; проверьте вашу плату).')
    ],
    electrical: ELEC_E32,
    notes: [
      'Логика 3.3 В, пины не 5V-tolerant.',
      'ADC2 (0, 2, 4, 12–15, 25–27) не работает при включённом WiFi — для аналоговых входов используйте GPIO32–39. Источник: https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/peripherals/adc_oneshot.html',
      'Порядок выводов (USB внизу), слева сверху вниз: EN, VP(36), VN(39), 34, 35, 32, 33, 25, 26, 27, 14, 12, 13, GND, VIN; справа: 23, 22, TX0(1), RX0(3), 21, 19, 18, 5, TX2(17), RX2(16), 4, 2, 15, GND, 3V3. GPIO0 и GPIO6–11 на 30-пиновой плате не выведены (GPIO0 — только под кнопкой BOOT). Порядок собран по распространённой распиновке DOIT DevKit V1 (официальной документации нет): у других производителей он отличается — сверяйтесь с шёлкографией. Размеры приблизительные.',
      'Пины по умолчанию (variants/esp32/pins_arduino.h): I2C SDA 21 / SCL 22; SPI (VSPI) SS 5, MOSI 23, MISO 19, SCK 18; Serial — GPIO1/3. Serial2: в ядре 2.x RX16/TX17, в 3.x RX4/TX25 (HardwareSerial.h); пины всегда можно задать в begin(). Источник: https://github.com/espressif/arduino-esp32/blob/master/variants/esp32/pins_arduino.h',
      'Встроенный светодиод на GPIO2 есть не у всех плат: в общем варианте esp32 LED_BUILTIN не определён.'
    ]
  },
  {
    id: 'esp32-devkitc', name: 'ESP32 DevKitC V4 (38 pin)', mcu: 'ESP32', platform: 'esp32',
    pins: [
      V33('Выход стабилизатора 3.3 В платы (внешних потребителей лучше не перегружать).'),
      pw('EN', 'reset', 'Вход разрешения работы (CHIP_PU); низкий уровень — перезапуск. Дублирует кнопку EN.'),
      E(36), E(39), E(34), E(35), E(32), E(33), E(25), E(26), E(27), E(14), E(12), GND(), E(13),
      E(9), E(10), E(11), V5('5 В: вход питания платы либо выход USB-5 В.'),
      E(23), E(22), E(1), E(3), E(21), E(19), E(18), E(5), E(17), E(16), E(4), E(0), E(2), E(15), E(8), E(7), E(6)
    ],
    electrical: ELEC_E32,
    notes: [
      'Логика 3.3 В, пины не 5V-tolerant. GPIO6–11 заняты flash модуля: на плате выведены как CLK/SD0/SD1/SD2/SD3/CMD, но использовать их нельзя.',
      'Порядок выводов по документации Espressif (USB внизу). Колодка J2 (справа) сверху вниз: GND, IO23, IO22, TXD0, RXD0, IO21, GND, IO19, IO18, IO5, IO17, IO16, IO4, IO0, IO2, IO15, SD1(IO8), SD0(IO7), CLK(IO6); колодка J3 (слева): 3V3, EN, SENSOR_VP(IO36), SENSOR_VN(IO39), IO34, IO35, IO32, IO33, IO25, IO26, IO27, IO14, IO12, GND, IO13, SD2(IO9), SD3(IO10), CMD(IO11), 5V. Источник: https://docs.espressif.com/projects/esp-idf/en/v4.4/esp32/hw-reference/esp32/get-started-devkitc.html',
      'Размеры платы (около 54 × 28 мм) приблизительные. Клоны «38 pin» (DOIT и др.) могут иметь другую подпись и порядок — сверяйтесь с шёлкографией.'
    ]
  },
  {
    id: 'esp32-s3', name: 'ESP32-S3 DevKitC-1', mcu: 'ESP32-S3', platform: 'esp32s3',
    pins: [
      V33('Выход стабилизатора 3.3 В (два вывода 3V3 соединены).'),
      pw('RST', 'reset', 'Сброс (EN, CHIP_PU): низкий уровень — перезапуск. Дублирует кнопку RST.'),
      S(4), S(5), S(6), S(7), S(15), S(16), S(17), S(18), S(8), S(3), S(46), S(9), S(10), S(11), S(12), S(13), S(14),
      V5('5 В: вход питания платы либо выход USB-5 В.'), GND(),
      S(43), S(44), S(1), S(2), S(42), S(41), S(40), S(39), S(38), S(37), S(36), S(35), S(0), S(45), S(48), S(47), S(21), S(20), S(19)
    ],
    electrical: {
      logic: 'Логика 3.3 В; пины не 5V-tolerant.',
      current: 'Даташит ESP32-S3: до 40 мА с вывода (абсолютный максимум), практически ≤ 20 мА. Проверить по datasheet.',
      supply: '5 В через любой из двух USB-портов или вывод 5V'
    },
    notes: [
      'Логика 3.3 В. Каналов ADC: ADC1 — GPIO1–10, ADC2 — GPIO11–20 (ADC2 конфликтует с WiFi).',
      'GPIO26–32 заняты SPI flash/PSRAM — не использовать (на плате не выведены). GPIO33 и GPIO34 тоже не выведены.',
      'Есть сенсорные пины (GPIO1–14), нет ЦАП.',
      'Пины по умолчанию (variants/esp32s3): I2C SDA 8 / SCL 9; SPI SS 10, MOSI 11, SCK 12, MISO 13; Serial1 RX15/TX16. Сенсорные T1..T14 = GPIO1..14. Источник: https://github.com/espressif/arduino-esp32/blob/master/variants/esp32s3/pins_arduino.h',
      'Strapping: GPIO0, 3, 45, 46. GPIO19/20 — USB, GPIO39–42 — JTAG, GPIO43/44 — UART0. Octal flash/PSRAM занимают GPIO33–37 (на DevKitC-1 выведены 35–37). Источник: даташит ESP32-S3 https://documentation.espressif.com/esp32-s3_datasheet_en.pdf',
      'Два USB-порта: Serial через порт UART — «USB CDC On Boot: Disabled», через нативный USB — «Enabled» (иначе вывод Serial не виден). Источник: https://docs.espressif.com/projects/arduino-esp32/en/latest/troubleshooting.html',
      'Порядок выводов (версия 1.1, USB внизу): колодка J1 слева сверху вниз — 3V3, 3V3, RST, 4, 5, 6, 7, 15, 16, 17, 18, 8, 3, 46, 9, 10, 11, 12, 13, 14, 5V, G; J3 справа — G, TX(43), RX(44), 1, 2, 42, 41, 40, 39, 38, 37, 36, 35, 0, 45, 48, 47, 21, 20, 19, G, G. Источник: https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide_v1.1.html',
      'Размеры (около 69 × 25.4 мм) и тип USB-разъёмов (Micro-USB / USB-C зависит от ревизии) на схеме приблизительные.'
    ]
  },
  {
    id: 'esp32-c3', name: 'ESP32-C3 DevKitM-1', mcu: 'ESP32-C3', platform: 'esp32c3',
    pins: [
      GND(), V33('Выход стабилизатора 3.3 В (два вывода 3V3 соединены).'),
      C(2), C(3), pw('RST', 'reset', 'Сброс (CHIP_PU): низкий уровень — перезапуск. Дублирует кнопку RST.'),
      C(0), C(1), C(10), V5('5 В: вход питания платы либо выход USB-5 В (два вывода соединены).'),
      C(21), C(20), C(9), C(8), C(7), C(6), C(5), C(4), C(18), C(19)
    ],
    electrical: {
      logic: 'Логика 3.3 В; пины не 5V-tolerant.',
      current: 'Даташит ESP32-C3: до 40 мА с вывода (абсолютный максимум), практически ≤ 20 мА. Проверить по datasheet.',
      supply: '5 В через Micro-USB или вывод 5V'
    },
    notes: [
      'Логика 3.3 В; одно RISC-V ядро.',
      'GPIO12–17 заняты SPI flash — не использовать (не выведены).',
      'Нет сенсорных пинов и ЦАП. ADC1 — GPIO0–4, ADC2 — GPIO5. LEDC: 6 каналов. Strapping: GPIO2, 8, 9. Источник: даташит ESP32-C3 https://documentation.espressif.com/esp32-c3_datasheet_en.pdf',
      'Пины по умолчанию в ядре (variants/esp32c3): I2C SDA 8 / SCL 9; SPI SCK 4, MISO 5, MOSI 6, SS 7; Serial (UART0) TX21 / RX20; Serial1 RX18/TX19 (совпадает с USB). Показанные у GPIO6/7/2/10 функции SPI — аппаратные FSPI-пины (IO MUX), а не значения по умолчанию в Arduino. Источник: https://github.com/espressif/arduino-esp32/blob/master/variants/esp32c3/pins_arduino.h',
      'Serial через нативный USB (GPIO18/19) на C3 работает при «USB CDC On Boot: Enabled»; иначе Serial — UART0 (GPIO20/21). Источник: https://docs.espressif.com/projects/arduino-esp32/en/latest/troubleshooting.html',
      'Порядок выводов (USB внизу): J1 слева сверху вниз — GND, 3V3, 3V3, IO2, IO3, GND, RST, GND, IO0, IO1, IO10, GND, 5V, 5V, GND; J3 справа — GND, TX(21), RX(20), GND, IO9, IO8, GND, IO7, IO6, IO5, IO4, GND, IO18, IO19, GND. Источник: https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32c3/esp32-c3-devkitm-1/user_guide.html',
      'Светодиод RGB на GPIO8 (WS2812). Габариты платы в документации не указаны — на схеме приблизительные.'
    ]
  },
  {
    id: 'esp32-c3-supermini', name: 'ESP32-C3 SuperMini', mcu: 'ESP32-C3', platform: 'esp32c3',
    pins: [
      V5('5 В: вход питания платы либо выход USB-5 В.'), GND(),
      V33('3.3 В: выход стабилизатора платы либо вход внешнего 3.3 В.'),
      C(4), C(3), C(2), C(1), C(0),
      C(5), C(6), C(7), C(8), C(9), C(10), C(20), C(21)
    ],
    electrical: {
      logic: 'Логика 3.3 В; пины не 5V-tolerant.',
      current: 'Даташит ESP32-C3: до 40 мА с вывода (абсолютный максимум), практически ≤ 20 мА. Проверить по datasheet.',
      supply: '5 В через USB-C или вывод 5V'
    },
    notes: [
      'Плата очень маленькая (около 22.5 × 18 мм): два ряда по 8 выводов, шаг 2.54 мм, USB-C. GPIO18/19 (USB) на гребёнки не выведены.',
      'Светодиод на GPIO8, зажигается низким уровнем; кнопка BOOT — GPIO9, кнопка RESET — на CHIP_PU. Источник: https://lastminuteengineers.com/esp32-c3-super-mini-pinout-reference/',
      'Не подтверждено официальной документацией (у платы нет единого производителя): порядок выводов (слева сверху вниз 5V, GND, 3V3, 4, 3, 2, 1, 0; справа 5, 6, 7, 8, 9, 10, 20, 21) и сторона, на которую выведена каждая колонка, — по распространённой распиновке; сверяйтесь с шёлкографией вашей платы. Размеры приблизительные.',
      'Аппаратные FSPI-пины: SCK=6, MOSI=7, MISO=2, CS=10. Фиксированного I2C нет (в ядре по умолчанию SDA 8 / SCL 9 — оба strapping, лучше переназначить Wire.begin).',
      'Serial через USB-C — при «USB CDC On Boot: Enabled»; иначе Serial — UART0 (GPIO20/21).'
    ]
  }
]

/** Первоисточники по платам. Для плат без официальной страницы с распиновкой это распространённая схема — см. заметки платы. */
const SOURCES: Record<string, string[]> = {
  uno: ['https://store.arduino.cc/products/arduino-uno-rev3', 'https://github.com/arduino/ArduinoCore-avr/blob/master/variants/standard/pins_arduino.h'],
  nano: ['https://docs.arduino.cc/hardware/nano/', 'https://github.com/arduino/ArduinoCore-avr/blob/master/variants/eightanaloginputs/pins_arduino.h'],
  mega: ['https://docs.arduino.cc/hardware/mega-2560/', 'https://github.com/arduino/ArduinoCore-avr/blob/master/variants/mega/pins_arduino.h'],
  promini: ['https://docs.arduino.cc/retired/boards/arduino-pro-mini/', 'https://learn.sparkfun.com/tutorials/pro-mini-atmega328-hookup-guide'],
  leonardo: ['https://docs.arduino.cc/hardware/leonardo/', 'https://github.com/arduino/ArduinoCore-avr/blob/master/variants/leonardo/pins_arduino.h'],
  'nodemcu-v2': ['https://nodemcu.readthedocs.io/en/latest/', 'https://arduino-esp8266.readthedocs.io/en/latest/reference.html'],
  'nodemcu-v3': ['https://nodemcu.readthedocs.io/en/latest/', 'https://arduino-esp8266.readthedocs.io/en/latest/reference.html'],
  'wemos-d1-mini': ['https://www.wemos.cc/en/latest/d1/d1_mini.html', 'https://arduino-esp8266.readthedocs.io/en/latest/reference.html'],
  'esp32-devkit': ['https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/peripherals/gpio.html', 'https://github.com/espressif/arduino-esp32/blob/master/variants/esp32/pins_arduino.h'],
  'esp32-devkitc': ['https://docs.espressif.com/projects/esp-idf/en/v4.4/esp32/hw-reference/esp32/get-started-devkitc.html'],
  'esp32-s3': ['https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide_v1.1.html', 'https://github.com/espressif/arduino-esp32/blob/master/variants/esp32s3/pins_arduino.h'],
  'esp32-c3': ['https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32c3/esp32-c3-devkitm-1/user_guide.html', 'https://github.com/espressif/arduino-esp32/blob/master/variants/esp32c3/pins_arduino.h'],
  'esp32-c3-supermini': ['https://lastminuteengineers.com/esp32-c3-super-mini-pinout-reference/', 'https://documentation.espressif.com/esp32-c3_datasheet_en.pdf']
}

export const boards: BoardEntry[] = [...boardList.map((b) => ({ ...b, source: SOURCES[b.id] })), ...rp2040Boards, ...stm32Boards.map((b) => ({ ...b, source: mcuSources[b.id] }))]
