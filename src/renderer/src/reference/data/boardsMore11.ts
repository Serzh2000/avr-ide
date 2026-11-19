// Платы пятой волны, часть 3: Adafruit Feather ESP32 V2, Feather ESP32-S2, Feather nRF52840 Sense.
// Порядок выводов и функции — официальные схемы распиновки Adafruit (PDF в репозиториях adafruit/*-PCB), прочитанные изображением при добавлении.
import type { BoardEntry, PinInfo } from '../types'

const pw = (label: string, kind: NonNullable<PinInfo['kind']>, notes: string): PinInfo => ({ label, gpio: null, functions: [], notes, kind })
const GND = (): PinInfo => pw('GND', 'gnd', 'Земля (общий провод).')
const named = (label: string, n: number | null, functions: string[], notes?: string, special?: PinInfo['special']): PinInfo => ({ label, gpio: n, functions, notes, special })
const ELEC = (cur: string, supply: string) => ({ logic: 'Логика 3.3 В; пины не 5V-tolerant.', current: cur, supply })
const FEATHER = 'Размер Feather — стандартный 2.0″ × 0.9″ (50.8 × 22.86 мм), ряды выводов через 0.8″ (20.32 мм); положение первого вывода вдоль платы снято с рисунка Adafruit, положение деталей на рендере приблизительное.'
const POW = (): PinInfo[] => [
  pw('VBAT', 'power', 'Плюс аккумулятора (разъём JST LiPo) — вход и выход.'), pw('EN', 'reset', 'Разрешение стабилизатора 3.3 В: подтянут вверх, замыкание на землю выключает его.'), pw('VBUS', 'power', 'Плюс USB (5 В), когда USB подключён.')
]

// ---------- Adafruit ESP32 Feather V2 ----------
const esp32v2: BoardEntry = {
  id: 'feather-esp32-v2', name: 'Adafruit ESP32 Feather V2', mcu: 'ESP32-PICO-V3-02', platform: 'esp32',
  pins: [
    pw('RESET', 'reset', 'Сброс.'), pw('3V3', 'power', 'Выход 3.3 В стабилизатора.'), pw('NC', 'nc', 'Не подписан на схеме Adafruit (на месте AREF у других Feather).'), GND(),
    named('A0', 26, ['ADC2_9', 'DAC2', 'RTC GPIO7']), named('A1', 25, ['ADC2_8', 'DAC1', 'RTC GPIO6']),
    named('A2', 34, ['ADC1_6', 'RTC GPIO4'], 'Только вход', 'input-only'), named('A3', 39, ['ADC1_3', 'RTC GPIO3'], 'Только вход (SENSE_VN)', 'input-only'),
    named('A4', 36, ['ADC1_0', 'RTC GPIO0'], 'Только вход (SENSE_VP)', 'input-only'), named('A5', 4, ['ADC2_0', 'Touch0', 'HSPIHD', 'RTC GPIO10']),
    named('SCK', 5, ['SPI SCK', 'VSPICS0']), named('MOSI', 19, ['SPI MOSI', 'VSPIQ', 'U0CTS']), named('MISO', 21, ['SPI MISO', 'VSPIHD']),
    named('RX', 7, ['RX2 (UART2)', 'U2RTS']), named('TX', 8, ['TX2 (UART2)', 'U2CTS']),
    named('D37', 37, ['ADC1_1', 'RTC GPIO1'], 'Только вход (SENSE_CAPP)', 'input-only'),
    ...POW(),
    named('LED', 13, ['ADC2_4', 'Touch4', 'LED_BUILTIN', 'MTCK'], 'Красный светодиод платы (#13)'), named('D12', 12, ['ADC2_5', 'Touch5', 'MTDI'], 'Strapping: HIGH при старте задаёт 1.8 В flash', 'strapping'),
    named('D27', 27, ['ADC2_7', 'Touch7']), named('D33', 33, ['ADC1_5', 'Touch8', '32K XN']), named('D15', 15, ['ADC2_3', 'Touch3', 'MTDO'], 'Strapping', 'strapping'),
    named('D32', 32, ['ADC1_4', 'Touch9', '32K XP']), named('D14', 14, ['ADC2_6', 'Touch6', 'MTMS']),
    named('SCL', 20, ['I2C SCL']), named('SDA', 22, ['I2C SDA'])
  ],
  electrical: ELEC('См. даташит ESP32.', 'USB-C, LiPo (JST) или VBAT'),
  notes: [
    'Порядок выводов (USB-C сверху) и функции — официальная схема Adafruit «ESP32 Feather V2 Pinout» (PDF в репозитории adafruit/Adafruit-ESP32-Feather-V2-PCB). Слева: RESET, 3.3V, (не подписан), GND, A0–A5, SCK, MOSI, MISO, RX, TX, D37; справа: VBAT, EN, VBUS, LED (13), D12, D27, D33, D15, D32, D14, SCL, SDA.',
    'GPIO7 и GPIO8 (RX/TX) доступны, потому что flash находится внутри модуля ESP32-PICO-V3-02; у обычных ESP32 эти выводы заняты. Не выведено на гребёнки: измерение батареи VOLTAGE_MONITOR (GPIO35), кнопка BUTTON (GPIO38), NeoPixel (GPIO0, питание GPIO2), разъём STEMMA QT (SDA GPIO22, SCL GPIO20; питание NEOPIXEL_I2C_POWER).',
    FEATHER
  ],
  specs: [['Формат', 'Feather 50.8 × 22.86 мм']]
}

// ---------- Adafruit Feather ESP32-S2 ----------
const s2: BoardEntry = {
  id: 'feather-esp32-s2', name: 'Adafruit Feather ESP32-S2', mcu: 'ESP32-S2', platform: 'esp32s2',
  pins: [
    pw('RESET', 'reset', 'Сброс.'), pw('3V3', 'power', 'Выход 3.3 В (выведен на двух контактах).'), GND(),
    named('A0', 18, ['ADC2_7', 'DAC2', 'UART1 RX (U1RXD)']), named('A1', 17, ['ADC2_6', 'DAC1', 'UART1 TX (U1TXD)']), named('A2', 16, ['ADC2_5', 'XTAL_32K_N', 'U0CTS']),
    named('A3', 15, ['ADC2_4', 'XTAL_32K_P', 'U0RTS']), named('A4', 14, ['ADC2_3', 'Touch14', 'FSPIWP']), named('A5', 8, ['ADC1_7', 'Touch8']),
    named('SCK', 36, ['SPI SCK (FSPICLK)']), named('MOSI', 35, ['SPI MOSI (FSPID)']), named('MISO', 37, ['SPI MISO (FSPIQ)']),
    named('RX', 38, ['FSPIWP', 'RX1 (Serial1)']), named('TX', 39, ['JTAG MTCK', 'TX1 (Serial1)']), named('DEBUG_TX', null, ['TX0 (UART0)'], 'Отладочный вывод DEBUG_TX по схеме Adafruit; номер GPIO не указан.'),
    ...POW(),
    named('D13', 13, ['ADC2_2', 'Touch13', 'LED_BUILTIN', 'FSPIQ']), named('D12', 12, ['ADC2_1', 'Touch12', 'FSPICLK']), named('D11', 11, ['ADC2_0', 'Touch11', 'FSPID']),
    named('D10', 10, ['ADC1_9', 'Touch10', 'FSPICS0']), named('D9', 9, ['ADC1_8', 'Touch9', 'FSPIHD']), named('D6', 6, ['ADC1_5', 'Touch6']), named('D5', 5, ['ADC1_4', 'Touch5']),
    named('SCL', 4, ['I2C SCL', 'ADC1_3', 'Touch4']), named('SDA', 3, ['I2C SDA', 'ADC1_2', 'Touch3'])
  ],
  electrical: ELEC('См. даташит ESP32-S2.', 'USB-C, LiPo (JST) или VBAT'),
  notes: [
    'Порядок выводов (USB-C сверху) и функции — официальная схема Adafruit (PDF в репозитории adafruit/Adafruit-Feather-ESP32-S2-PCB). Слева: RESET, 3.3V, 3.3V, GND, A0–A5, SCK, MOSI, MISO, RX, TX, DEBUG_TX; справа: VBAT, EN, VBUS, D13, D12, D11, D10, D9, D6, D5, SCL, SDA.',
    'Не выведено на гребёнки: NeoPixel (GPIO33, питание GPIO21), разъём STEMMA QT (SDA GPIO3, SCL GPIO4; питание VSENSOR управляется GPIO7: у ревизии B — LOW включает, у ревизии C — HIGH, по примечанию схемы).',
    FEATHER
  ],
  specs: [['Формат', 'Feather 50.8 × 22.86 мм']]
}

// ---------- Adafruit Feather nRF52840 Sense ----------
const nrfp = (label: string, n: number, port: string, functions: string[] = [], notes = ''): PinInfo => ({ label, gpio: n, functions, notes: `Порт ${port}${notes ? '. ' + notes : ''}` })
const nrf: BoardEntry = {
  id: 'feather-nrf52840-sense', name: 'Adafruit Feather nRF52840 Sense', mcu: 'nRF52840', platform: 'nrf52', numLabel: 'Пин Arduino №',
  pins: [
    pw('RESET', 'reset', 'Сброс.'), pw('3V3', 'power', 'Выход 3.3 В стабилизатора.'), nrfp('AREF', 21, 'P0.31', ['ADC7'], 'Вывод AREF; на схеме 21/A7 (AIN7)'), GND(),
    nrfp('A0', 14, 'P0.04', ['ADC0 (AIN2)']), nrfp('A1', 15, 'P0.05', ['ADC1 (AIN3)']), nrfp('A2', 16, 'P0.30', ['ADC2 (AIN6)']), nrfp('A3', 17, 'P0.28', ['ADC3 (AIN4)']),
    nrfp('A4', 18, 'P0.02', ['ADC4 (AIN0)']), nrfp('A5', 19, 'P0.03', ['ADC5 (AIN1)']),
    nrfp('SCK', 26, 'P0.14', ['SPI SCK']), nrfp('MOSI', 25, 'P0.13', ['SPI MOSI']), nrfp('MISO', 24, 'P0.15', ['SPI MISO']),
    nrfp('RX', 1, 'P0.24', ['RX (Serial1)']), nrfp('TX', 0, 'P0.25', ['TX (Serial1)']), nrfp('D2', 2, 'P0.10', [], 'Он же NFC2'),
    ...POW(),
    nrfp('D13', 13, 'P1.09', ['LED_BUILTIN']), nrfp('D12', 12, 'P0.08'), nrfp('D11', 11, 'P0.06'), nrfp('D10', 10, 'P0.27'), nrfp('D9', 9, 'P0.26'), nrfp('D6', 6, 'P0.07'), nrfp('D5', 5, 'P1.08'),
    nrfp('SCL', 23, 'P0.11', ['I2C SCL']), nrfp('SDA', 22, 'P0.12', ['I2C SDA'])
  ],
  electrical: ELEC('См. даташит nRF52840; на схеме Adafruit пометка LS (низкоскоростные выводы) — выше 10 кГц могут влиять на радио.', 'USB-C, LiPo (JST) или VBAT'),
  notes: [
    'Порядок выводов (USB-C сверху) и порты — официальная схема Adafruit (PDF «Feather nRF52840 Sense pinout» в репозитории adafruit/Adafruit-Feather-nRF52840-Sense-PCB). Слева: RESET, 3.3V, AREF, GND, A0–A5, SCK, MOSI, MISO, RX, TX, D2; справа: VBAT, EN, VBUS, D13, D12, D11, D10, D9, D6, D5, SCL, SDA. Arduino-номера — из той же схемы.',
    'На плате, не на гребёнках: кнопка SWITCH (7, P1.02), синий светодиод (4, P1.10), NeoPixel (8, P0.16), NFC1 (33, P0.09), микрофон (данные 34 / P0.00, такт 35 / P0.01), датчик приближения (прерывание 36, P1.00), монитор напряжения (20/A6, P0.29), прерывание акселерометра/гироскопа (3, P1.11). Версия Express (без датчиков) — отдельная плата, схема не открывалась.',
    FEATHER
  ],
  specs: [['МК', 'Nordic nRF52840 (Cortex-M4F, 64 МГц)'], ['Формат', 'Feather 50.8 × 22.86 мм']]
}

export const moreBoards11: BoardEntry[] = [esp32v2, s2, nrf]

export const moreSources11: Record<string, string[]> = {
  'feather-esp32-v2': ['https://github.com/adafruit/Adafruit-ESP32-Feather-V2-PCB', 'https://www.adafruit.com/product/5400'],
  'feather-esp32-s2': ['https://github.com/adafruit/Adafruit-Feather-ESP32-S2-PCB', 'https://www.adafruit.com/product/5000'],
  'feather-nrf52840-sense': ['https://github.com/adafruit/Adafruit-Feather-nRF52840-Sense-PCB', 'https://www.adafruit.com/product/4516']
}
