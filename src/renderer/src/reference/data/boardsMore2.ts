// Платы второй волны: Adafruit Feather, Wemos/Lolin Mini, LILYGO T-Display, Heltec WiFi LoRa 32 V3, ESP-01S, AI-Thinker ESP32-CAM.
// Данные — только из первоисточников, прочитанных при добавлении (официальные схемы распиновки и документация), см. moreSources2 и notes каждой платы.
import type { BoardEntry, PinInfo } from '../types'
import { gp as rpGp } from './boardsMcu'

const pw = (label: string, kind: NonNullable<PinInfo['kind']>, notes: string): PinInfo => ({ label, gpio: null, functions: [], notes, kind })
const GND = (): PinInfo => pw('GND', 'gnd', 'Земля (общий провод).')
const V33 = (n = 'Выход 3.3 В стабилизатора платы.'): PinInfo => pw('3V3', 'power', n)
const gi = (n: number, functions: string[], notes?: string, special?: PinInfo['special'], label = `GPIO${n}`): PinInfo =>
  ({ label, gpio: n, functions, notes, special })
const named = (label: string, n: number, functions: string[], notes?: string, special?: PinInfo['special']): PinInfo => gi(n, functions, notes, special, label)

const ELEC_3V3 = (cur: string, supply: string) => ({ logic: 'Логика 3.3 В; пины не 5V-tolerant.', current: cur, supply })

// ---------- Adafruit Feather ESP32-S3 ----------
const FEATHER_NOTE = 'Размер Feather — стандартный 2.0″ × 0.9″ (50.8 × 22.86 мм), ряды выводов через 0.8″ (20.32 мм); положение первого вывода вдоль платы снято с рисунка Adafruit, положение деталей на рендере приблизительное.'
const featherS3: BoardEntry = {
  id: 'feather-esp32s3', name: 'Adafruit Feather ESP32-S3', mcu: 'ESP32-S3', platform: 'esp32s3',
  pins: [
    pw('RESET', 'reset', 'Сброс: низкий уровень = перезапуск.'), V33('Выход 3.3 В стабилизатора (выведен на двух контактах).'), GND(),
    named('A0', 18, ['ADC2_7', 'RTC GPIO18', 'UART1 RX (U1RXD)']), named('A1', 17, ['ADC2_6', 'RTC GPIO17', 'UART1 TX (U1TXD)']),
    named('A2', 16, ['ADC2_5', 'RTC GPIO16', 'U0CTS', 'XTAL_32K_N']), named('A3', 15, ['ADC2_4', 'RTC GPIO15', 'U0RTS', 'XTAL_32K_P']),
    named('A4', 14, ['ADC2_3', 'RTC GPIO14', 'Touch14', 'FSPIWP']), named('A5', 8, ['ADC1_7', 'RTC GPIO8', 'Touch8']),
    named('SCK', 36, ['SPI SCK (FSPICLK)']), named('MOSI', 35, ['SPI MOSI (FSPID)']), named('MISO', 37, ['SPI MISO (FSPIQ)']),
    named('RX', 38, ['RX1 (Serial1)', 'FSPIWP']), named('TX', 39, ['TX1 (Serial1)', 'JTAG MTCK']),
    { label: 'TXD0', gpio: null, functions: ['TX0 (UART0)'], notes: 'Отладочный вывод TXD0 (подпись на плате DB) — по схеме Adafruit; номер GPIO на схеме не указан.' },
    pw('VBAT', 'power', 'Плюс аккумулятора (разъём JST LiPo) — вход и выход.'), pw('EN', 'reset', 'Разрешение работы стабилизатора 3.3 В: подтянут вверх, замыкание на землю выключает стабилизатор.'),
    pw('VBUS', 'power', 'Плюс USB (5 В), когда USB подключён.'),
    named('D13', 13, ['ADC2_2', 'RTC GPIO13', 'Touch13', 'LED_BUILTIN', 'FSPIQ'], 'Красный светодиод платы (#13)'),
    named('D12', 12, ['ADC2_1', 'RTC GPIO12', 'Touch12', 'FSPICLK']), named('D11', 11, ['ADC2_0', 'RTC GPIO11', 'Touch11', 'FSPID']),
    named('D10', 10, ['ADC1_9', 'RTC GPIO10', 'Touch10', 'FSPICS0']), named('D9', 9, ['ADC1_8', 'RTC GPIO9', 'Touch9', 'FSPIHD']),
    named('D6', 6, ['ADC1_5', 'RTC GPIO6', 'Touch6']), named('D5', 5, ['ADC1_4', 'RTC GPIO5', 'Touch5']),
    named('SCL', 4, ['I2C SCL', 'ADC1_3', 'RTC GPIO4', 'Touch4'], 'Он же I2C разъёма STEMMA QT'), named('SDA', 3, ['I2C SDA', 'ADC1_2', 'RTC GPIO3', 'Touch3'], 'Он же I2C разъёма STEMMA QT')
  ],
  electrical: ELEC_3V3('См. даташит ESP32-S3.', 'USB-C, LiPo (JST 2-pin) или вывод VBAT; 3.3 В стабилизатор на плате'),
  notes: [
    'Порядок выводов (USB-C сверху) и функции — официальная схема распиновки Adafruit (PDF «Adafruit Feather ESP32-S3 Pinout» в репозитории adafruit/Adafruit-Feather-ESP32-S3-PCB). Слева: RESET, 3V, 3V, GND, A0–A5, SCK, MOSI, MISO, RX, TX, TXD0; справа: VBAT, EN, VBUS, D13, D12, D11, D10, D9, D6, D5, SCL, SDA.',
    'Не выведено на гребёнки: кнопка BOOT (GPIO0), адресуемый светодиод NeoPixel (GPIO33) и его питание NEOPIXEL_POWER (GPIO21), питание порта STEMMA QT (GPIO7, низкий уровень отключает его) — по схеме Adafruit.',
    'Вариант платы (память, PSRAM, TFT) в схеме не различается. Не подтверждено: тип разъёма на рендере (по рисунку Adafruit — USB-C).',
    FEATHER_NOTE
  ],
  specs: [['Формат', 'Feather 50.8 × 22.86 мм'], ['Модуль', 'ESP32-S3-MINI-1']]
}

// ---------- Adafruit Feather RP2040 ----------
const fr = (name: string, n: number, notes?: string): PinInfo => ({ ...rpGp(n, notes), label: name })
const featherRp: BoardEntry = {
  id: 'feather-rp2040', name: 'Adafruit Feather RP2040', mcu: 'RP2040', platform: 'rp2040',
  pins: [
    pw('RESET', 'reset', 'Сброс.'), V33('Выход 3.3 В (выведен на двух контактах).'), GND(),
    fr('A0', 26, 'ADC0'), fr('A1', 27, 'ADC1'), fr('A2', 28, 'ADC2'), fr('A3', 29, 'ADC3'),
    fr('D24', 24), fr('D25', 25), fr('SCK', 18, 'SPI0 SCK по схеме Adafruit'), fr('MOSI', 19, 'SPI0 MOSI по схеме Adafruit'), fr('MISO', 20, 'SPI0 MISO по схеме Adafruit'),
    fr('RX', 1, 'UART0 RX по схеме Adafruit'), fr('TX', 0, 'UART0 TX по схеме Adafruit'), fr('D4', 6),
    pw('VBAT', 'power', 'Плюс аккумулятора (разъём JST LiPo).'), pw('EN', 'reset', 'Разрешение стабилизатора 3.3 В (подтянут вверх).'), pw('VBUS', 'power', 'Плюс USB (5 В).'),
    fr('D13', 13, 'Красный светодиод платы'), fr('D12', 12), fr('D11', 11), fr('D10', 10), fr('D9', 9), fr('D6', 8), fr('D5', 7),
    fr('SCL', 3, 'I2C1 SCL по схеме Adafruit (и разъём STEMMA QT)'), fr('SDA', 2, 'I2C1 SDA по схеме Adafruit (и разъём STEMMA QT)')
  ],
  electrical: ELEC_3V3('См. даташит RP2040.', 'USB-C, LiPo (JST 2-pin) или VBAT'),
  notes: [
    'Порядок выводов (USB-C сверху) и функции — официальная схема распиновки Adafruit (PDF в репозитории adafruit/Adafruit-Feather-RP2040-PCB). Функции в колонке — все возможные для GPIO (таблица функций RP2040); имена на плате и назначение по умолчанию — по схеме Adafruit (в заметках).',
    'Имена выводов Feather (D4, D5, D6, D9…) не совпадают с номерами GPIO: D6 = GPIO8, D5 = GPIO7. Не выведено на гребёнки: адресуемый светодиод NeoPixel (GPIO16), кнопка BOOTSEL (на схеме указана GPIO4 для ревизии D и новее; для первых ревизий не подтверждено).',
    FEATHER_NOTE
  ],
  specs: [['Формат', 'Feather 50.8 × 22.86 мм']]
}

// ---------- Adafruit Feather M0 Express ----------
const fm = (name: string, n: number, port: string, functions: string[] = [], notes = ''): PinInfo =>
  ({ label: name, gpio: n, functions, notes: `Порт ${port}${notes ? '. ' + notes : ''}` })
const featherM0: BoardEntry = {
  id: 'feather-m0-express', name: 'Adafruit Feather M0 Express', mcu: 'SAMD21G18', platform: 'samd', numLabel: 'Пин Arduino №',
  pins: [
    pw('RESET', 'reset', 'Сброс.'), V33(), pw('AREF', 'ref', 'Опорное напряжение АЦП (порт PA03); 3.3 В — максимум.'), GND(),
    fm('A0', 14, 'PA02', ['ADC0', 'DAC0'], 'Единственный ЦАП'), fm('A1', 15, 'PB08', ['ADC1']), fm('A2', 16, 'PB09', ['ADC2']),
    fm('A3', 17, 'PA04', ['ADC3']), fm('A4', 18, 'PA05', ['ADC4']), fm('A5', 19, 'PB02', ['ADC5']),
    fm('SCK', 30, 'PB11', ['SPI SCK']), fm('MOSI', 29, 'PB10', ['SPI MOSI']), fm('MISO', 28, 'PA12', ['SPI MISO']),
    fm('RX', 0, 'PA11', ['RX (Serial1)', 'ADC (A10)']), fm('TX', 1, 'PA10', ['TX (Serial1)', 'ADC (A11)']),
    pw('VBAT', 'power', 'Плюс аккумулятора (разъём JST LiPo).'), pw('EN', 'reset', 'Разрешение стабилизатора 3.3 В.'), pw('VBUS', 'power', 'Плюс USB (5 В).'),
    fm('D13', 13, 'PA17', ['LED_BUILTIN']), fm('D12', 12, 'PA19'), fm('D11', 11, 'PA16'), fm('D10', 10, 'PA18'), fm('D9', 9, 'PA07', ['ADC (A7)'], 'Подключён к делителю батареи'),
    fm('D6', 6, 'PA20'), fm('D5', 5, 'PA15'), fm('SCL', 27, 'PA23', ['I2C SCL']), fm('SDA', 26, 'PA22', ['I2C SDA'])
  ],
  electrical: ELEC_3V3('См. даташит SAMD21.', 'Micro-USB, LiPo (JST 2-pin) или VBAT'),
  notes: [
    'Порядок выводов (micro-USB сверху) и порты — официальная схема распиновки Adafruit (PDF в репозитории adafruit/Adafruit-Feather-M0-Express-PCB); Arduino-номера — из той же схемы. Справа в 16-выводной колодке последний вывод — вторая земля.',
    'Не выведено на гребёнки: адресуемый светодиод NeoPixel (PA06, пин 8/A6). Номера A0–A5 = 14–19 (D14–D19) по схеме Adafruit; AREF отмечен 41/A12 на схеме и в данных не используется как номер.',
    FEATHER_NOTE
  ],
  specs: [['МК', 'ATSAMD21G18 (Cortex-M0+)'], ['Формат', 'Feather 50.8 × 22.86 мм']]
}

// ---------- Wemos (Lolin) S2 / S3 / C3 Mini ----------
const WMINI = 'Размер 34.3 × 25.4 мм (wemos.cc); порядок выводов (USB-C снизу) — картинка пинаута на wemos.cc. Выводы расположены двумя столбцами на каждой стороне (внешний и внутренний), шаг 2.54 мм; на схеме внутренние столбцы подписаны без тегов функций. Положение выводов вдоль платы снято с рисунка Wemos, детали на рендере приблизительные.'
const s2g = (n: number, f: string[] = [], notes?: string, sp?: PinInfo['special']): PinInfo => gi(n, f, notes, sp)
const lolinS2: BoardEntry = {
  id: 'lolin-s2-mini', name: 'Wemos (Lolin) S2 Mini', mcu: 'ESP32-S2', platform: 'esp32s2',
  pins: [
    pw('EN', 'reset', 'Сброс (CHIP_PU).'), V33(), pw('VBUS', 'power', 'Плюс USB (5 В).'), GND(),
    s2g(1, ['ADC1_0 (A0)', 'Touch1']), s2g(2, ['ADC1_1 (A1)', 'Touch2']), s2g(3, ['ADC1_2 (A2)', 'Touch3']), s2g(4, ['ADC1_3 (A3)', 'Touch4']),
    s2g(5, ['ADC1_4 (A4)', 'Touch5']), s2g(6, ['ADC1_5 (A5)', 'Touch6']), s2g(7, ['ADC1_6 (A6)', 'Touch7', 'SPI SCK']), s2g(8, ['ADC1_7 (A7)', 'Touch8']),
    s2g(9, ['ADC1_8 (A8)', 'Touch9', 'SPI MISO']), s2g(10, ['ADC1_9 (A9)', 'Touch10']), s2g(11, ['ADC2_0 (A10)', 'Touch11', 'SPI MOSI']),
    s2g(12, ['ADC2_1 (A11)', 'Touch12', 'SPI SS']), s2g(13, ['ADC2_2 (A12)', 'Touch13']), s2g(14, ['ADC2_3 (A13)', 'Touch14']),
    s2g(15, ['ADC2_4 (A14)', 'LED_BUILTIN'], 'Светодиод платы (подпись 15 у светодиода)'), s2g(16, ['ADC2_5 (A15)']), s2g(17, ['ADC2_6 (A16)', 'DAC1']),
    s2g(18, ['ADC2_7 (A17)', 'DAC2']), s2g(21, []), s2g(33, ['I2C SDA']), s2g(34, []), s2g(35, ['I2C SCL']), s2g(36, []), s2g(37, ['RX (UART)']),
    s2g(38, []), s2g(39, ['TX (UART)']), s2g(40, [])
  ],
  electrical: ELEC_3V3('См. даташит ESP32-S2.', 'USB-C или вывод VBUS'),
  notes: [
    'Порядок выводов — картинка пинаута Wemos (https://www.wemos.cc/en/latest/_images/s2_mini_v1.0.0_4_16x9.jpg). Соответствие SDA/SCL, SPI, TX/RX, A-имён — файл ядра arduino-esp32 variants/lolin_s2_mini/pins_arduino.h (SDA = 33, SCL = 35, SCK = 7, MISO = 9, MOSI = 11, SS = 12, TX = 39, RX = 37, LED_BUILTIN = 15). Ножки ЦАП и ADC — по общей таблице ESP32-S2 в ядре (не проверялись по даташиту).',
    'Кнопки: RST и «0» (GPIO0, BOOT) — на плате, на гребёнки не выведены. GPIO19/20 (USB) заняты разъёмом USB-C.',
    WMINI
  ],
  specs: [['Размер', '34.3 × 25.4 мм']]
}
const lolinS3: BoardEntry = {
  id: 'lolin-s3-mini', name: 'Wemos (Lolin) S3 Mini', mcu: 'ESP32-S3', platform: 'esp32s3',
  pins: [
    pw('EN', 'reset', 'Сброс (CHIP_PU).'), V33(), pw('VBUS', 'power', 'Плюс USB (5 В).'), GND(),
    s2g(1, ['ADC1_0 (A0)', 'Touch1']), s2g(2, ['ADC1_1 (A1)', 'Touch2']), s2g(3, ['ADC1_2 (A2)', 'Touch3'], 'Strapping (JTAG)', 'strapping'),
    s2g(4, ['ADC1_3 (A3)', 'Touch4']), s2g(5, ['ADC1_4 (A4)', 'Touch5']), s2g(6, ['ADC1_5 (A5)', 'Touch6']), s2g(7, ['ADC1_6 (A6)', 'Touch7']),
    s2g(8, ['ADC1_7 (A7)', 'Touch8']), s2g(9, ['ADC1_8 (A8)', 'Touch9']), s2g(10, ['ADC1_9 (A9)', 'Touch10', 'SPI SS']),
    s2g(11, ['ADC2_0 (A10)', 'Touch11', 'SPI MOSI']), s2g(12, ['ADC2_1 (A11)', 'Touch12', 'SPI SCK']), s2g(13, ['ADC2_2 (A12)', 'Touch13', 'SPI MISO']),
    s2g(14, ['ADC2_3 (A13)', 'Touch14']), s2g(15, ['ADC2_4 (A14)']), s2g(16, ['ADC2_5 (A15)']), s2g(17, ['ADC2_6 (A16)']), s2g(18, ['ADC2_7 (A17)']),
    s2g(21, []), s2g(33, []), s2g(34, []), s2g(35, ['I2C SDA']), s2g(36, ['I2C SCL']), s2g(37, []),
    s2g(38, []), s2g(43, ['TX0 (UART0)']), s2g(44, ['RX0 (UART0)'])
  ],
  electrical: ELEC_3V3('См. даташит ESP32-S3.', 'USB-C или вывод VBUS'),
  notes: [
    'Порядок выводов — картинка пинаута Wemos (https://www.wemos.cc/en/latest/_static/boards/s3_mini_v1.0.0_4_16x9.jpg). SDA = 35, SCL = 36, SCK = 12, MISO = 13, MOSI = 11, SS = 10, TX = 43, RX = 44 — файл ядра arduino-esp32 variants/lolin_s3_mini/pins_arduino.h. Светодиод RGB (WS2812) — GPIO47 (подпись 47 у светодиода на картинке Wemos).',
    'Кнопки: RST и «0» (GPIO0, BOOT) — на плате. Не подтверждено: какие GPIO заняты внутренней памятью модуля — сверьтесь с даташитом вашей версии (для GPIO33–37 у S3 с octal-памятью есть ограничения).',
    WMINI
  ],
  specs: [['Размер', '34.3 × 25.4 мм']]
}
const lolinC3: BoardEntry = {
  id: 'lolin-c3-mini', name: 'Wemos (Lolin) C3 Mini', mcu: 'ESP32-C3', platform: 'esp32c3',
  pins: [
    pw('EN', 'reset', 'Сброс (CHIP_PU).'), V33(), pw('VBUS', 'power', 'Плюс USB (5 В).'), GND(),
    gi(0, ['ADC1_0 (A0)']), gi(1, ['ADC1_1 (A1)']), gi(2, ['ADC1_2 (A2)', 'SPI SCK'], 'Strapping', 'strapping'), gi(3, ['ADC1_3 (A3)', 'SPI MISO']),
    gi(4, ['ADC1_4 (A4)', 'SPI MOSI', 'JTAG MTMS']), gi(5, ['ADC2_0 (A5)', 'SPI SS', 'JTAG MTDI']), gi(6, ['JTAG MTCK']), gi(7, ['RGB LED'], 'RGB-светодиод WS2812 (GPIO7)'),
    gi(8, ['I2C SDA'], 'Strapping', 'strapping'), gi(10, ['I2C SCL']), gi(20, ['RX0 (UART0)']), gi(21, ['TX0 (UART0)'])
  ],
  electrical: ELEC_3V3('См. даташит ESP32-C3.', 'USB-C или вывод VBUS'),
  notes: [
    'Порядок выводов — картинка пинаута Wemos (https://www.wemos.cc/en/latest/_images/c3_mini_v2.1.0_4_16x9.png): слева EN, 3, 2, 1, 0, 4, 5, 3.3V; справа TX(21), RX(20), 10, 8, 7, 6, GND, VBUS. Соответствие SDA/SCL, SPI, A0–A5 — arduino-esp32 variants/lolin_c3_mini/pins_arduino.h (SDA = 8, SCL = 10, SCK = 2, MISO = 3, MOSI = 4, SS = 5, TX = 21, RX = 20, RGB = GPIO7).',
    'Кнопки: RST и «9» (GPIO9, BOOT) — на плате и на гребёнки не выведены. GPIO18/19 (USB) заняты разъёмом.',
    'Размер 34.3 × 25.4 мм (wemos.cc); положение выводов вдоль платы снято с рисунка Wemos, детали на рендере приблизительные. Строгое подтверждение версии платы (v2.1.0) — на картинке Wemos.'
  ],
  specs: [['Размер', '34.3 × 25.4 мм']]
}

// ---------- LILYGO TTGO T-Display ----------
const tg = (n: number, f: string[], notes?: string, sp?: PinInfo['special']): PinInfo => gi(n, f, notes, sp)
const tDisplay: BoardEntry = {
  id: 'ttgo-t-display', name: 'LILYGO TTGO T-Display (ESP32)', mcu: 'ESP32', platform: 'esp32',
  pins: [
    GND(), tg(21, ['I2C SDA (Wire)']), tg(22, ['I2C SCL (Wire)']), tg(17, []),
    tg(2, ['ADC2_2 (ADC12)', 'Touch2'], 'Strapping', 'strapping'), tg(15, ['ADC2_3 (ADC13)', 'Touch3'], 'Strapping', 'strapping'),
    tg(13, ['ADC2_4 (ADC14)', 'Touch4']), tg(12, ['ADC2_5 (ADC15)', 'Touch5'], 'Strapping', 'strapping'),
    V33('3.3 В (два вывода: вход и выход по схеме производителя).'),
    tg(36, ['ADC1_0 (SVP)'], 'Только вход', 'input-only'), tg(37, [], 'Только вход; на схеме производителя выведен', 'input-only'),
    tg(38, [], 'Только вход; на схеме производителя выведен', 'input-only'), tg(39, ['ADC1_3 (SVN)'], 'Только вход', 'input-only'),
    tg(32, ['ADC1_4', 'Touch9']), tg(33, ['ADC1_5', 'Touch8']), tg(25, ['ADC2_8 (ADC18)', 'DAC1']), tg(26, ['ADC2_9 (ADC19)', 'DAC2']),
    tg(27, ['ADC2_7 (ADC17)', 'Touch7']), pw('5V', 'power', 'Вход/выход 5 В.')
  ],
  electrical: ELEC_3V3('См. даташит ESP32.', 'USB-C 5 В или вывод 5V; разъём батареи BAT на схеме производителя'),
  notes: [
    'Порядок выводов и функции — схема pinmap.jpg производителя (https://github.com/Xinyuan-LilyGO/TTGO-T-Display/blob/master/image/pinmap.jpg), «ESP32 TTGO T-Display V1.1». Слева сверху вниз: GND, GND, 21, 22, 17, 2, 15, 13, 12, GND, GND, 3V; справа: 3V, 36, 37, 38, 39, 32, 33, 25, 26, 27, GND, 5V.',
    'Дисплей IPS 1.14″ ST7789V подключён внутри: MOSI 19, SCLK 18, CS 5, DC 16, RST 23, BL 4 (по схеме производителя). Кнопки на GPIO0 и GPIO35 (подписи на схеме) — на гребёнки не выведены.',
    'Не подтверждено: габариты платы — оценка по масштабу рисунка производителя (≈ 25 × 51.5 мм); положение выводов вдоль платы и деталей на рендере приблизительные.'
  ],
  specs: [['Дисплей', 'IPS 1.14″ ST7789V']]
}

// ---------- Heltec WiFi LoRa 32 V3 ----------
const hv = (n: number, f: string[], notes?: string, sp?: PinInfo['special']): PinInfo => gi(n, f, notes, sp)
const heltecV3: BoardEntry = {
  id: 'heltec-lora32-v3', name: 'Heltec WiFi LoRa 32 V3', mcu: 'ESP32-S3', platform: 'esp32s3',
  pins: [
    hv(7, ['ADC1_6', 'Touch7']), hv(6, ['ADC1_5', 'Touch6']), hv(5, ['ADC1_4', 'Touch5']), hv(4, ['ADC1_3', 'Touch4']),
    hv(3, ['ADC1_2', 'Touch3'], 'Strapping', 'strapping'), hv(2, ['ADC1_1', 'Touch2']), hv(1, ['ADC1_0', 'Touch1'], 'Измерение напряжения батареи (VBAT_Read) по схеме Heltec'),
    hv(38, ['SPI WP (FSPIWP)']), hv(39, ['JTAG MTCK']), hv(40, ['JTAG MTDO']), hv(41, ['JTAG MTDI']), hv(42, ['JTAG MTMS']),
    hv(45, [], 'Strapping', 'strapping'), hv(46, [], 'Strapping', 'strapping'), hv(37, ['ADC_Ctrl'], 'ADC_Ctrl по схеме Heltec'),
    V33('3.3 В (два вывода J3).'), GND(),
    hv(19, ['ADC2_8', 'USB D-', 'UART1 RTS (U1RTS)'], 'Нативный USB', 'usb'), hv(20, ['ADC2_9', 'USB D+', 'UART1 CTS (U1CTS)'], 'Нативный USB', 'usb'),
    hv(21, ['OLED_RST'], 'Сброс OLED (по схеме Heltec)'), hv(26, ['SPICS1']), hv(48, []), hv(47, []),
    hv(33, ['SPIIO4', 'FSPIHD']), hv(34, ['SPIIO5', 'FSPICS0']), hv(35, ['SPIIO6', 'FSPID', 'LED_Write'], 'LED_Write по схеме Heltec'),
    hv(36, ['SPIIO7', 'FSPICLK', 'Vext_Ctrl'], 'Vext_Ctrl — включение внешнего питания Ve (по схеме Heltec)'),
    hv(0, ['USER_SW', 'BOOT button'], 'Кнопка PRG; strapping', 'strapping'),
    pw('RST', 'reset', 'Сброс (RST_SW).'),
    { ...gi(43, ['TX0 (UART0)', 'CP2102_RX'], 'U0TXD'), label: 'GPIO43' }, { ...gi(44, ['RX0 (UART0)', 'CP2102_TX'], 'U0RXD'), label: 'GPIO44' },
    pw('Ve', 'power', 'Выход внешнего питания Ve (включается сигналом Vext_Ctrl, GPIO36); выведен на двух контактах.'),
    pw('5V', 'power', 'Вход/выход 5 В.')
  ],
  electrical: ELEC_3V3('См. даташит ESP32-S3.', 'USB-C 5 В или вывод 5V; разъём батареи на плате'),
  notes: [
    'Порядок выводов и функции — официальная карта выводов Heltec «Wi-Fi LoRa32 V3.2 Pinmap» (https://resource.heltec.cn/download/WiFi_LoRa_32_V3/Wi-Fi_LoRa32_V3.2_Pinmap.png). J3 слева сверху вниз: GPIO7…GPIO1, GPIO38…GPIO42, GPIO45, GPIO46, GPIO37, 3V3, 3V3, GND; J2 справа: GPIO19, 20, 21, 26, 48, 47, 33…36, 0, RST, 43, 44, Ve, Ve, 5V, GND.',
    'Внутри платы (на гребёнки не выведены): радиомодуль LoRa SX1262 — GPIO8 (NSS), 9 (SCK), 10 (MOSI), 11 (MISO), 12 (RST), 13 (BUSY), 14 (DIO1); OLED I2C — GPIO17 (SDA), GPIO18 (SCL), сброс GPIO21 — по схеме Heltec.',
    'Не подтверждено: габариты платы — оценка по масштабу рисунка Heltec (≈ 25.4 × 52.5 мм); положение деталей на рендере приблизительное. Выводы Ve на схеме отдельно от VCC и управляются GPIO36.'
  ],
  specs: [['Радио', 'LoRa SX1262'], ['Дисплей', 'OLED 0.96″']]
}

// ---------- AI-Thinker ESP-01S ----------
const esp01: BoardEntry = {
  id: 'esp-01s', name: 'ESP-01 / ESP-01S (ESP8266)', mcu: 'ESP8266', platform: 'esp8266', numLabel: 'GPIO',
  pins: [
    { label: 'RXD', gpio: 3, functions: ['UART0 RX (Serial)', 'GPIO3'], notes: 'Вывод 4 модуля' },
    { label: 'IO0', gpio: 0, functions: ['GPIO0', 'FLASH button'], notes: 'Вывод 3. Режим загрузки: внешний низкий уровень; рабочий режим — высокий или не подключён', special: 'strapping' },
    { label: 'IO2', gpio: 2, functions: ['GPIO2', 'UART1 TX'], notes: 'Вывод 2. Должен быть высоким при старте', special: 'strapping' },
    GND(),
    pw('VCC', 'power', 'Вывод 8. Питание 3.3 В; источник должен давать не менее 500 мА (по документу Ai-Thinker). Не подавать 5 В.'),
    pw('RST', 'reset', 'Вывод 7. Сброс; по документу — подтянуть к VCC.'),
    pw('EN', 'reset', 'Вывод 6 (CH_PD). Разрешение чипа, активный высокий уровень; подтянуть к VCC.'),
    { label: 'TXD', gpio: 1, functions: ['UART0 TX (Serial)', 'GPIO1'], notes: 'Вывод 5', special: 'warning' }
  ],
  electrical: { logic: 'Логика 3.3 В; пины не 5V-tolerant.', current: 'См. даташит ESP8266EX.', supply: '3.3 В на VCC (не менее 500 мА)' },
  notes: [
    'Порядок выводов — спецификация Ai-Thinker ESP-01S V1.0 (зеркало https://static.chipdip.ru/lib/088/DOC013088932.pdf): вывод 1 GND, 2 IO2, 3 IO0, 4 RXD, 5 TXD, 6 EN, 7 RST, 8 VCC. На схеме — вид, как на картинке документа: верхний ряд RX, IO0, IO2, GND, нижний 3V3, RST, EN, TX (слева направо).',
    'Размер модуля 24.4 × 14.4 мм (по той же спецификации); выводы двумя рядами по 4 с шагом 2.54 мм. Использовать GPIO1/GPIO3 как GPIO можно только когда UART не нужен. У ESP-01 (не S) выводы те же — различие в микросхеме памяти/подтяжках не проверялось.',
    'Таблица режимов загрузки по документу: загрузка — GPIO0 низкий, GPIO2 высокий, GPIO15 низкий (внутри модуля), EN и RST высокие.'
  ],
  specs: [['Размер', '24.4 × 14.4 мм']]
}

// ---------- AI-Thinker ESP32-CAM ----------
const cam: BoardEntry = {
  id: 'esp32-cam', name: 'AI-Thinker ESP32-CAM', mcu: 'ESP32', platform: 'esp32',
  pins: [
    pw('5V', 'power', 'Вход питания 5 В.'), GND(),
    gi(12, ['ADC2_5', 'Touch5', 'SD_DATA2', 'HSPI MISO'], 'Занят картой microSD (DATA2). Strapping: должен быть низким при старте (иначе flash 1.8 В)', 'strapping'),
    gi(13, ['ADC2_4', 'Touch4', 'SD_DATA3', 'HSPI MOSI'], 'Занят картой microSD (DATA3)'),
    gi(15, ['ADC2_3', 'Touch3', 'SD_CMD', 'HSPI SS'], 'Занят картой microSD (CMD). Strapping', 'strapping'),
    gi(14, ['ADC2_6', 'Touch6', 'SD_CLK', 'HSPI SCK'], 'Занят картой microSD (CLK)'),
    gi(2, ['ADC2_2', 'Touch2', 'SD_DATA0'], 'Занят картой microSD (DATA0). Strapping', 'strapping'),
    gi(4, ['ADC2_0', 'Touch0', 'SD_DATA1', 'Flash lamp'], 'Занят картой microSD (DATA1) и светодиодом-вспышкой платы'),
    V33('Вывод 3.3V: вход питания 3.3 В.'), gi(16, ['RX2 (UART2)'], 'Подключён к PSRAM на модулях с PSRAM — по документу выведен как IO16 (HS1_DATA4, U2RXD)'),
    gi(0, ['ADC2_1', 'Touch1', 'CLK_OUT1', 'BOOT button'], 'Strapping: LOW при старте = режим загрузки. Одновременно XCLK камеры', 'strapping'),
    pw('VCC', 'power', 'Выход 3.3 В (по документу Ai-Thinker «Power output 3.3V»).'),
    { ...gi(3, ['RX0 (Serial)', 'CLK_OUT2'], 'U0R — UART0 RX'), label: 'U0R' }, { ...gi(1, ['TX0 (Serial)', 'CLK_OUT3'], 'U0T — UART0 TX', 'warning'), label: 'U0T' }
  ],
  electrical: ELEC_3V3('См. даташит ESP32.', '5 В на вывод 5V (по документу Ai-Thinker); можно 3.3 В на вывод 3.3V'),
  notes: [
    'Порядок выводов — рисунок «Pinout» из документа «ESP32-Cam Datasheet» AI-Thinker (копия на cdn.shopify.com/s/files/1/1509/1638/files/ESP32-Cam_datasheet.pdf): слева сверху вниз 5V, GND, IO12, IO13, IO15, IO14, IO2, IO4; справа 3.3V, IO16, IO0, GND, VCC, U0R, U0T, GND. Размер 27 × 40.5 × 4.5 мм — по таблице спецификации.',
    'Внутренние соединения камеры (по таблице документа): D0–D7 = GPIO5, 18, 19, 21, 36, 39, 34, 35; XCLK = GPIO0; PCLK = 22; VSYNC = 25; HREF = 23; SDA = 26; SCL = 27; PWDN = 32. Карта microSD: CLK 14, CMD 15, DATA0 2, DATA1 4 (и светодиод-вспышка), DATA2 12, DATA3 13. Эти линии на гребёнки не выведены, кроме показанных; GPIO12–15, 2, 4 заняты microSD, если карта используется.',
    'Нет USB: для прошивки нужен переходник USB-UART на U0R/U0T и перемычка IO0 на GND на время загрузки. Не подтверждено: сторона платы (камеры/SD) и положение деталей на рендере — приблизительные; название «IO16» у документа обозначает GPIO16, который на модулях с PSRAM может быть занят.'
  ],
  specs: [['Размер', '27 × 40.5 мм'], ['Flash/PSRAM', '4 МБ / 4 МБ'], ['Камера', 'OV2640']]
}

export const moreBoards2: BoardEntry[] = [featherS3, featherRp, featherM0, lolinS2, lolinS3, lolinC3, tDisplay, heltecV3, esp01, cam]

export const moreSources2: Record<string, string[]> = {
  'feather-esp32s3': ['https://github.com/adafruit/Adafruit-Feather-ESP32-S3-PCB', 'https://learn.adafruit.com/adafruit-esp32-s3-feather/pinouts'],
  'feather-rp2040': ['https://github.com/adafruit/Adafruit-Feather-RP2040-PCB', 'https://learn.adafruit.com/adafruit-feather-rp2040-pico/pinouts', 'https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf'],
  'feather-m0-express': ['https://github.com/adafruit/Adafruit-Feather-M0-Express-PCB', 'https://learn.adafruit.com/adafruit-feather-m0-basic-proto/pinouts'],
  'lolin-s2-mini': ['https://www.wemos.cc/en/latest/s2/s2_mini.html', 'https://github.com/espressif/arduino-esp32/blob/master/variants/lolin_s2_mini/pins_arduino.h'],
  'lolin-s3-mini': ['https://www.wemos.cc/en/latest/s3/s3_mini.html', 'https://github.com/espressif/arduino-esp32/blob/master/variants/lolin_s3_mini/pins_arduino.h'],
  'lolin-c3-mini': ['https://www.wemos.cc/en/latest/c3/c3_mini.html', 'https://github.com/espressif/arduino-esp32/blob/master/variants/lolin_c3_mini/pins_arduino.h'],
  'ttgo-t-display': ['https://github.com/Xinyuan-LilyGO/TTGO-T-Display', 'https://raw.githubusercontent.com/Xinyuan-LilyGO/TTGO-T-Display/master/image/pinmap.jpg'],
  'heltec-lora32-v3': ['https://resource.heltec.cn/download/WiFi_LoRa_32_V3', 'https://docs.heltec.org/en/node/esp32/wifi_lora_32/index.html'],
  'esp-01s': ['https://static.chipdip.ru/lib/088/DOC013088932.pdf', 'https://home-assistant-guide.com/wp-content/uploads/2021/04/ESP-01_ESP-07_ESP-12_Series_User_Manual_V1.3.pdf'],
  'esp32-cam': ['https://cdn.shopify.com/s/files/1/1509/1638/files/ESP32-Cam_datasheet.pdf']
}
