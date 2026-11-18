// Платы пятой волны: Adafruit QT Py ESP32-S3 / S2 / C3, Feather M4 Express, ItsyBitsy M4 Express.
// Данные — только из официальных PDF-пинаутов Adafruit (репозитории adafruit/*-PCB), прочитанных при добавлении; см. moreSources8 и notes.
import type { BoardEntry, PinInfo } from '../types'

const pw = (label: string, kind: NonNullable<PinInfo['kind']>, notes: string): PinInfo => ({ label, gpio: null, functions: [], notes, kind })
const GND = (): PinInfo => pw('GND', 'gnd', 'Земля (общий провод).')
const V33 = (n = 'Выход 3.3 В.'): PinInfo => pw('3V3', 'power', n)
const ELEC_3V3 = (cur: string, supply: string) => ({ logic: 'Логика 3.3 В; пины не 5V-tolerant.', current: cur, supply })
const named = (label: string, n: number, functions: string[], notes?: string): PinInfo => ({ label, gpio: n, functions, notes })

// ---------- QT Py ESP32-S3 / S2 / C3 ----------
const QT_DIM = 'Не подтверждено: габариты платы (принят форм-фактор QT Py/XIAO 21 × 17.8 мм) и положение выводов вдоль платы; деталей на рендере приблизительные. Выводы SDA1/SCL1 (разъём STEMMA QT), NeoPixel и кнопка на ряды не выведены.'
const qtPower = (): PinInfo[] => [pw('5V', 'power', 'Вывод 5 В (USB/внешний).'), GND(), V33()]
const qtS3Like = (s2: boolean): PinInfo[] => [
  named('A0', 18, [s2 ? 'DAC2' : 'ADC2_7', ...(s2 ? ['ADC2_7'] : []), 'RTC GPIO18', 'UART1 RX (U1RXD)']), named('A1', 17, [s2 ? 'DAC1' : 'ADC2_6', ...(s2 ? ['ADC2_6'] : []), 'RTC GPIO17', 'UART1 TX (U1TXD)']),
  named('A2', 9, ['ADC1_8', 'Touch9', 'FSPIHD']), named('A3', 8, ['ADC1_7', 'Touch8']), named('SDA', 7, ['ADC1_6', 'Touch7', 'I2C SDA']), named('SCL', 6, ['ADC1_5', 'Touch6', 'I2C SCL']),
  named('TX', 5, ['ADC1_4', 'Touch5']), ...qtPower(),
  named('MOSI', 35, ['SPI MOSI (FSPID)']), named('MISO', 37, ['SPI MISO (FSPIQ)']), named('SCK', 36, ['SPI SCK (FSPICLK)']), named('RX', 16, ['ADC2_5', 'U0CTS', 'XTAL_32K_N'])
]
const qtS3: BoardEntry = {
  id: 'qtpy-esp32s3', name: 'Adafruit QT Py ESP32-S3', mcu: 'ESP32-S3', platform: 'esp32s3',
  pins: qtS3Like(false),
  electrical: ELEC_3V3('См. даташит ESP32-S3.', 'USB-C или вывод 5V'),
  notes: [
    'Порядок выводов (USB-C сверху) и функции — официальная схема Adafruit (PDF в репозитории adafruit/Adafruit-QT-Py-ESP32-S3-PCB): слева A0–A3, SDA, SCL, TX; справа 5V, GND, 3.3V, MOSI, MISO, SCK, RX. Имена SDA/SCL/TX/RX на плате — не аппаратные: SDA = GPIO7, SCL = GPIO6, TX = GPIO5, RX = GPIO16.',
    'Не выведено на ряды: кнопка BUTTON (GPIO0), NeoPixel (GPIO39, питание GPIO38), разъём STEMMA QT (SDA1 = GPIO41, SCL1 = GPIO40; также JTAG MTDI/MTDO).',
    QT_DIM
  ],
  specs: [['МК', 'ESP32-S3']]
}
const qtS2: BoardEntry = {
  id: 'qtpy-esp32s2', name: 'Adafruit QT Py ESP32-S2', mcu: 'ESP32-S2', platform: 'esp32s2',
  pins: qtS3Like(true),
  electrical: ELEC_3V3('См. даташит ESP32-S2.', 'USB-C или вывод 5V'),
  notes: [
    'Порядок выводов (USB-C сверху) и функции — официальная схема Adafruit (PDF в репозитории adafruit/Adafruit-QT-Py-ESP32-S2-PCB): слева A0–A3, SDA, SCL, TX; справа 5V, GND, 3.3V, MOSI, MISO, SCK, RX. A0 и A1 — также выходы ЦАП (DAC_2 и DAC_1).',
    'Не выведено на ряды: кнопка D0/BOOT (GPIO0), NeoPixel (GPIO39, питание GPIO38), разъём STEMMA QT (SDA1 = GPIO41, SCL1 = GPIO40).',
    QT_DIM
  ],
  specs: [['МК', 'ESP32-S2']]
}
const qtC3: BoardEntry = {
  id: 'qtpy-esp32c3', name: 'Adafruit QT Py ESP32-C3', mcu: 'ESP32-C3', platform: 'esp32c3',
  pins: [
    named('A0', 4, ['ADC1_4', 'JTAG MTMS']), named('A1', 3, ['ADC1_3']), named('A2', 1, ['ADC1_1', 'XTAL_32K_N']), named('A3', 0, ['ADC1_0', 'XTAL_32K_P']),
    named('SDA', 5, ['ADC2_0', 'I2C SDA', 'JTAG MTDI', 'FSPIHD']), named('SCL', 6, ['I2C SCL', 'JTAG MTCK', 'FSPICLK']), named('TX', 21, ['TX0 (UART0)']),
    ...qtPower(),
    named('MOSI', 7, ['SPI MOSI (FSPID)', 'JTAG MTDO']), named('MISO', 8, ['SPI MISO'], 'Strapping'), named('SCK', 10, ['SPI SCK', 'FSPICS0']), named('RX', 20, ['RX0 (UART0)'])
  ],
  electrical: ELEC_3V3('См. даташит ESP32-C3.', 'USB-C или вывод 5V'),
  notes: [
    'Порядок выводов (USB-C сверху) и функции — официальная схема Adafruit (PDF в репозитории adafruit/Adafruit-QT-Py-ESP32-C3-PCB): слева A0–A3, SDA, SCL, TX; справа 5V, GND, 3.3V, MOSI, MISO, SCK, RX. Имена SDA/SCL/TX/RX на плате — не аппаратные: SDA = GPIO5, SCL = GPIO6, TX = GPIO21, RX = GPIO20.',
    'Не выведено на ряды: кнопка SWITCH/BOOT (GPIO9), NeoPixel PIN_NEOPIXEL (GPIO2), разъём STEMMA QT (SDA = GPIO5, SCL = GPIO6 — те же линии, что SDA/SCL на рядах).',
    QT_DIM
  ],
  specs: [['МК', 'ESP32-C3']]
}

// ---------- Feather M4 Express / ItsyBitsy M4 Express (SAMD51) ----------
const FEATHER_NOTE = 'Размер Feather — стандартный 2.0″ × 0.9″ (50.8 × 22.86 мм), ряды выводов через 0.8″ (20.32 мм); положение первого вывода вдоль платы снято с рисунка Adafruit, положение деталей на рендере приблизительное.'
const ITSY_DIM = 'Не подтверждено: габариты (36 × 18 мм) и ряды 12.7 мм — по масштабу схемы Adafruit; положение деталей на рендере приблизительное. Нижние контактные площадки (D4, D3, EN, SWDIO, SWCLK, APA102) на схему не включены.'
const sm = (name: string, n: number, port: string, functions: string[] = [], notes = ''): PinInfo =>
  ({ label: name, gpio: n, functions, notes: `Порт ${port}${notes ? '. ' + notes : ''}` })
const feather4: BoardEntry = {
  id: 'feather-m4-express', name: 'Adafruit Feather M4 Express', mcu: 'SAMD51J19', platform: 'samd', numLabel: 'Пин Arduino №',
  pins: [
    pw('RESET', 'reset', 'Сброс.'), V33(), pw('AREF', 'ref', 'Опорное напряжение АЦП.'), GND(),
    sm('A0', 14, 'PA02', ['ADC0', 'DAC0 (VOUT0)']), sm('A1', 15, 'PA05', ['ADC1', 'DAC1 (VOUT1)']), sm('A2', 16, 'PB08', ['ADC2']), sm('A3', 17, 'PB09', ['ADC3']),
    sm('A4', 18, 'PA04', ['ADC4']), sm('A5', 19, 'PA06', ['ADC5']),
    sm('SCK', 25, 'PA17', ['SPI SCK']), sm('MOSI', 24, 'PB23', ['SPI MOSI']), sm('MISO', 23, 'PB22', ['SPI MISO']),
    sm('D0', 0, 'PB17', ['RX (Serial1)']), sm('D1', 1, 'PB16', ['TX (Serial1)']), sm('D4', 4, 'PA14'),
    pw('VBAT', 'power', 'Плюс аккумулятора (JST LiPo).'), pw('EN', 'reset', 'Разрешение стабилизатора 3.3 В.'), pw('VBUS', 'power', 'Плюс USB (5 В).'),
    sm('D13', 13, 'PA23', ['LED_BUILTIN']), sm('D12', 12, 'PA22'), sm('D11', 11, 'PA21'), sm('D10', 10, 'PA20'), sm('D9', 9, 'PA19', ['ADC (A7)']), sm('D6', 6, 'PA18'), sm('D5', 5, 'PA16'),
    sm('SCL', 22, 'PA13', ['I2C SCL']), sm('SDA', 21, 'PA12', ['I2C SDA'])
  ],
  electrical: ELEC_3V3('См. даташит SAMD51.', 'Micro-USB, LiPo (JST) или VBAT/VBUS'),
  notes: [
    'Порядок выводов (micro-USB сверху) и порты — официальная схема распиновки Adafruit (PDF в репозитории adafruit/Adafruit-Feather-M4-Express-PCB). Слева: RESET, 3.3V, AREF, GND, A0–A5, SCK, MOSI, MISO, D0, D1, D4; справа: VBAT, EN, VBUS, D13, D12, D11, D10, D9, D6, D5, SCL, SDA. Arduino-номера — из той же схемы (A0 = 14 … A5 = 19).',
    'Не выведено: адресуемый светодиод NeoPixel (пин 8, PB03). Все GPIO — 3.3 В (по схеме Adafruit); SAMD51 — Cortex-M4F, 120 МГц, до 1 МБ flash.',
    FEATHER_NOTE
  ],
  specs: [['МК', 'ATSAMD51J19 (Cortex-M4F)'], ['Формат', 'Feather 50.8 × 22.86 мм']]
}
const itsy4: BoardEntry = {
  id: 'itsybitsy-m4-express', name: 'Adafruit ItsyBitsy M4 Express', mcu: 'SAMD51G19', platform: 'samd', numLabel: 'Пин Arduino №',
  pins: [
    pw('RESET', 'reset', 'Сброс.'), V33(), pw('AREF', 'ref', 'Опорное напряжение АЦП.'), pw('VHI', 'power', 'Вывод VHI (подпись на плате «VHI») — по схеме Adafruit; назначение в схеме не расшифровано.'),
    sm('A0', 14, 'PA02', ['ADC0', 'DAC0 (VOUT0)']), sm('A1', 15, 'PA05', ['ADC1', 'DAC1 (VOUT1)']), sm('A2', 16, 'PB08', ['ADC2']), sm('A3', 17, 'PB09', ['ADC3']),
    sm('A4', 18, 'PA04', ['ADC4']), sm('A5', 19, 'PA06', ['ADC5']),
    sm('SCK', 24, 'PA01', ['SPI SCK']), sm('MOSI', 25, 'PA00', ['SPI MOSI']), sm('MISO', 23, 'PB23', ['SPI MISO']), sm('D2', 2, 'PA07', ['ADC (A6)']),
    pw('VBAT', 'power', 'Плюс аккумулятора (JST LiPo).'), GND(), pw('VBUS', 'power', 'Плюс USB (5 В).'),
    sm('D13', 13, 'PA22', ['LED_BUILTIN']), sm('D12', 12, 'PA23'), sm('D11', 11, 'PA21'), sm('D10', 10, 'PA20'), sm('D9', 9, 'PA19'), sm('D7', 7, 'PA18'), sm('D5', 5, 'PA15'),
    sm('SCL', 22, 'PA13', ['I2C SCL']), sm('SDA', 21, 'PA12', ['I2C SDA']), sm('D1', 1, 'PA17', ['TX (Serial1)']), sm('D0', 0, 'PA16', ['RX (Serial1)'])
  ],
  electrical: ELEC_3V3('См. даташит SAMD51.', 'Micro-USB, LiPo (JST) или VBAT/VBUS'),
  notes: [
    'Порядок выводов (micro-USB сверху) и порты — официальная схема распиновки Adafruit (PDF в репозитории adafruit/Adafruit-ItsyBitsy-M4-PCB). Слева: RESET, 3.3V, AREF, VHI, A0–A5, SCK, MOSI, MISO, D2; справа: VBAT, GND, VBUS, D13, D12, D11, D10, D9, D7, D5, SCL, SDA, D1, D0.',
    'Площадки внизу: D4 (4, PA14), D3 (3, PB22), SWCLK, SWDIO, EN; светодиод APA102 (MOSI — пин 8 / PB03, SCK — пин 6 / PB02) — на схему не включены. Все GPIO — 3.3 В.',
    ITSY_DIM
  ],
  specs: [['МК', 'ATSAMD51G19 (Cortex-M4F)']]
}

export const moreBoards8: BoardEntry[] = [qtS3, qtS2, qtC3, feather4, itsy4]

export const moreSources8: Record<string, string[]> = {
  'qtpy-esp32s3': ['https://github.com/adafruit/Adafruit-QT-Py-ESP32-S3-PCB', 'https://www.adafruit.com/product/5426'],
  'qtpy-esp32s2': ['https://github.com/adafruit/Adafruit-QT-Py-ESP32-S2-PCB', 'https://www.adafruit.com/product/5325'],
  'qtpy-esp32c3': ['https://github.com/adafruit/Adafruit-QT-Py-ESP32-C3-PCB', 'https://www.adafruit.com/product/5405'],
  'feather-m4-express': ['https://github.com/adafruit/Adafruit-Feather-M4-Express-PCB', 'https://www.adafruit.com/product/3857'],
  'itsybitsy-m4-express': ['https://github.com/adafruit/Adafruit-ItsyBitsy-M4-PCB', 'https://www.adafruit.com/product/3800']
}
