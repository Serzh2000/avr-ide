// Платы четвёртой волны: ESP32-C3-DevKitC-02, ESP32-S3-DevKitM-1, Teensy LC, Adafruit ItsyBitsy M0 Express / nRF52840, Trinket M0.
// Данные — только из первоисточников, прочитанных при добавлении (руководства Espressif, карточка PJRC, PDF-пинауты Adafruit), см. moreSources6 и notes.
import type { BoardEntry, PinInfo } from '../types'

const pw = (label: string, kind: NonNullable<PinInfo['kind']>, notes: string): PinInfo => ({ label, gpio: null, functions: [], notes, kind })
const GND = (): PinInfo => pw('GND', 'gnd', 'Земля (общий провод).')
const V33 = (n = 'Выход 3.3 В.'): PinInfo => pw('3V3', 'power', n)
const gi = (n: number, functions: string[], notes?: string, special?: PinInfo['special'], label = `GPIO${n}`): PinInfo =>
  ({ label, gpio: n, functions, notes, special })
const ELEC_3V3 = (cur: string, supply: string) => ({ logic: 'Логика 3.3 В; пины не 5V-tolerant.', current: cur, supply })
const ESP_DIM = 'Не подтверждено: габариты платы — в руководстве Espressif только отдельный PDF/DXF; на схеме они условные. Положение деталей на рендере приблизительное.'

// ---------- ESP32-C3-DevKitC-02 ----------
const c3c02: BoardEntry = {
  id: 'esp32-c3-devkitc-02', name: 'ESP32-C3-DevKitC-02', mcu: 'ESP32-C3', platform: 'esp32c3',
  pins: [
    GND(), V33('Выход 3.3 В (два вывода J1).'), pw('RST', 'reset', 'CHIP_PU: высокий — чип включён, низкий — выключен.'),
    gi(4, ['ADC1_4', 'JTAG MTMS', 'SPI HD (FSPIHD)']), gi(5, ['ADC2_0', 'JTAG MTDI', 'SPI WP (FSPIWP)']),
    gi(6, ['JTAG MTCK', 'SPI SCK (FSPICLK)']), gi(7, ['JTAG MTDO', 'SPI MOSI (FSPID)']),
    gi(8, ['RGB LED'], 'Strapping; на этой плате управляет RGB-светодиодом (по документации Espressif).', 'strapping'),
    gi(9, ['BOOT button'], 'Strapping: LOW при старте = режим загрузки.', 'strapping'),
    pw('5V', 'power', 'Вход/выход 5 В (два вывода J1).'),
    gi(0, ['ADC1_0', 'XTAL_32K_P']), gi(1, ['ADC1_1', 'XTAL_32K_N']), gi(2, ['ADC1_2', 'SPI MISO (FSPIQ)'], 'Strapping', 'strapping'), gi(3, ['ADC1_3']),
    gi(10, ['SPI CS (FSPICS0)']),
    { ...gi(20, ['RX0 (UART0)']), label: 'RX' }, { ...gi(21, ['TX0 (UART0)']), label: 'TX' },
    gi(18, ['USB D-'], 'Нативный USB чипа.', 'usb'), gi(19, ['USB D+'], 'Нативный USB чипа.', 'usb')
  ],
  electrical: ELEC_3V3('См. даташит ESP32-C3.', '5 В через Micro-USB или вывод 5V'),
  notes: [
    'Порядок выводов — таблица Header Block руководства Espressif (J1 слева сверху вниз: G, 3V3, 3V3, RST, G, 4, 5, 6, 7, G, 8, 9, 5V, 5V, G; J3 справа: G, 0, 1, 2, 3, G, 10, G, RX, TX, G, 18, 19, G, G). Источник: https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32c3/esp32-c3-devkitc-02/user_guide.html',
    'Модуль ESP32-C3-WROOM-02 (4 МБ flash, антенна на плате) либо -02U; порт Micro-USB.',
    ESP_DIM
  ],
  specs: [['Модуль', 'ESP32-C3-WROOM-02'], ['Flash', '4 МБ']]
}

// ---------- ESP32-S3-DevKitM-1 ----------
const s3m: BoardEntry = {
  id: 'esp32-s3-devkitm-1', name: 'ESP32-S3-DevKitM-1', mcu: 'ESP32-S3', platform: 'esp32s3',
  pins: [
    V33(), gi(0, ['RTC_GPIO0', 'BOOT button'], 'Strapping: LOW при старте = режим загрузки', 'strapping'),
    gi(1, ['ADC1_0', 'Touch1']), gi(2, ['ADC1_1', 'Touch2']), gi(3, ['ADC1_2', 'Touch3'], 'Strapping (JTAG source)', 'strapping'), gi(4, ['ADC1_3', 'Touch4']),
    gi(5, ['ADC1_4', 'Touch5']), gi(6, ['ADC1_5', 'Touch6']), gi(7, ['ADC1_6', 'Touch7']), gi(8, ['ADC1_7', 'Touch8']), gi(9, ['ADC1_8', 'Touch9', 'SPI HD (FSPIHD)']),
    gi(10, ['ADC1_9', 'Touch10', 'SPI CS (FSPICS0)']), gi(11, ['ADC2_0', 'Touch11', 'SPI MOSI (FSPID)']), gi(12, ['ADC2_1', 'Touch12', 'SPI SCK (FSPICLK)']),
    gi(13, ['ADC2_2', 'Touch13', 'SPI MISO (FSPIQ)']), gi(14, ['ADC2_3', 'Touch14', 'SPI WP (FSPIWP)']), gi(15, ['ADC2_4', 'U0RTS']), gi(16, ['ADC2_5', 'U0CTS']),
    gi(17, ['ADC2_6', 'U1TXD']), gi(18, ['ADC2_7', 'U1RXD', 'CLK_OUT3']),
    pw('5V', 'power', 'Вход/выход 5 В.'), GND(), pw('RST', 'reset', 'EN: сброс.'),
    gi(46, [], 'Strapping', 'strapping'), gi(45, [], 'Strapping', 'strapping'),
    { ...gi(44, ['RX0 (UART0)', 'CLK_OUT2']), label: 'RX' }, { ...gi(43, ['TX0 (UART0)', 'CLK_OUT1']), label: 'TX' },
    gi(42, ['JTAG MTMS']), gi(41, ['JTAG MTDI', 'CLK_OUT1']), gi(40, ['JTAG MTDO', 'CLK_OUT2']), gi(39, ['JTAG MTCK', 'CLK_OUT3']),
    gi(38, ['SPI WP (FSPIWP)']), gi(37, ['SPIDQS', 'SPI MISO (FSPIQ)']), gi(36, ['SPI SCK (FSPICLK)']), gi(35, ['SPI MOSI (FSPID)']), gi(34, ['SPI CS (FSPICS0)']), gi(33, ['SPI HD (FSPIHD)']),
    gi(26, ['SPICS1']), gi(21, ['RTC_GPIO21']), gi(20, ['ADC2_9', 'U1CTS', 'USB D+'], 'Нативный USB (D+).', 'usb'), gi(19, ['ADC2_8', 'U1RTS', 'USB D-'], 'Нативный USB (D−).', 'usb'),
    gi(48, ['RGB LED'], 'Светодиод RGB платы (по документации Espressif).'), gi(47, [])
  ],
  electrical: ELEC_3V3('См. даташит ESP32-S3.', '5 В через Micro-USB или вывод 5V'),
  notes: [
    'Порядок выводов — таблица Header Block руководства Espressif (J1 слева сверху вниз: 3V3, IO0–IO18, 5V, G; J3 справа: G, RST, IO46, IO45, RX, TX, IO42…IO33, IO26, IO21, IO20, IO19, IO48, IO47). Источник: https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitm-1/user_guide.html',
    'Модуль ESP32-S3-MINI-1 (ESP32-S3FN8, 8 МБ flash) либо MINI-1U; UART-порт — Micro-USB, тип разъёма нативного USB в руководстве не указан (на рендере показан второй Micro-USB).',
    ESP_DIM
  ],
  specs: [['Модуль', 'ESP32-S3-MINI-1'], ['Flash', '8 МБ']]
}

// ---------- Teensy LC (PJRC) ----------
const dd = (n: number, functions: string[], notes?: string): PinInfo => ({ label: `D${n}`, gpio: n, functions: ['GPIO', ...functions], notes })
const teensyLc: BoardEntry = {
  id: 'teensy-lc', name: 'Teensy LC', mcu: 'MKL26Z64', platform: 'teensy',
  pins: [
    pw('VIN', 'power', 'Вход питания (по карточке PJRC).'), GND(), pw('3V3', 'power', 'Выход 3.3 В, до 100 мА (по карточке PJRC).'),
    dd(23, ['PWM', 'ADC9 (A9)', 'Touch', 'I2C SDA1']), dd(22, ['PWM', 'ADC8 (A8)', 'Touch', 'I2C SCL1']), dd(21, ['ADC7 (A7)', 'RX1 (альтернативный)', 'SPI MOSI1 (альтернативный)']),
    dd(20, ['PWM', 'ADC6 (A6)', 'TX3 (альтернативный)', 'SPI SCK1']), dd(19, ['ADC5 (A5)', 'Touch', 'I2C SCL0']), dd(18, ['ADC4 (A4)', 'Touch', 'I2C SDA0']),
    dd(17, ['PWM', 'ADC3 (A3)', 'Touch', 'I2C SDA0 (альтернативный)']), dd(16, ['PWM', 'ADC2 (A2)', 'Touch', 'I2C SCL0 (альтернативный)']), dd(15, ['ADC1 (A1)', 'Touch']),
    dd(14, ['ADC0 (A0)', 'SPI SCK0 (альтернативный)']), dd(13, ['SPI SCK0', 'LED_BUILTIN']),
    dd(0, ['RX1', 'Touch', 'SPI MOSI1']), dd(1, ['TX1', 'Touch', 'SPI MISO1']), dd(2, []), dd(3, ['PWM', 'Touch', 'RX1 (альтернативный)']), dd(4, ['PWM', 'Touch', 'TX1 (альтернативный)']),
    dd(5, ['TX1 (альтернативный)', 'SPI MISO1 (альтернативный)']), dd(6, ['PWM', 'RX3 (альтернативный)', 'SPI CS1']), dd(7, ['RX3', 'SPI MOSI0 (альтернативный)']),
    dd(8, ['TX3', 'SPI MISO0 (альтернативный)']), dd(9, ['PWM', 'RX2']), dd(10, ['PWM', 'TX2', 'SPI CS0']), dd(11, ['SPI MOSI0']), dd(12, ['SPI MISO0'])
  ],
  electrical: { logic: 'Логика 3.3 В (по карточке PJRC); допустимость 5 В на входах в карточке не указана.', current: 'Не подтверждено в этой сессии.', supply: 'Micro-USB 5 В или вывод VIN (по карточке PJRC)' },
  notes: [
    'Порядок выводов и функции — карточка распиновки PJRC (https://www.pjrc.com/teensy/card6a_rev4_web.pdf, прочитана увеличенно): верхний ряд от USB — VIN, GND, 3.3V, 23…13; нижний — GND, 0…12. Серым на карточке показаны альтернативные функции (здесь с пометкой «альтернативный»). ШИМ: 3, 4, 6, 9, 10, 16, 17, 20, 22, 23.',
    'Не показаны: площадки на нижней стороне и торце (26/A12/DAC, Program, GND, 3.3V и др.). Не подтверждено: диапазон VIN (на карточке виден только заголовок), габариты платы (принято 1.4″ × 0.7″ = 35.56 × 17.78 мм); положение деталей на рендере приблизительное.'
  ],
  specs: [['МК', 'NXP MKL26Z64 (Cortex-M0+, 48 МГц)']]
}

// ---------- Adafruit ItsyBitsy M0 Express ----------
const ITSY_DIM = 'Не подтверждено: габариты (36 × 18 мм) и ряды 12.7 мм — по масштабу схемы Adafruit; положение деталей на рендере приблизительное. Нижние контактные площадки (D4, D3, EN, SWDIO, SWCLK, APA102) на схему не включены.'
const im = (name: string, n: number, port: string, functions: string[] = [], notes = ''): PinInfo =>
  ({ label: name, gpio: n, functions, notes: `Порт ${port}${notes ? '. ' + notes : ''}` })
const itsyM0: BoardEntry = {
  id: 'itsybitsy-m0-express', name: 'Adafruit ItsyBitsy M0 Express', mcu: 'SAMD21G18', platform: 'samd', numLabel: 'Пин Arduino №',
  pins: [
    pw('RESET', 'reset', 'Сброс.'), V33(), pw('AREF', 'ref', 'Опорное напряжение АЦП (порт PA03).'), pw('VHI', 'power', 'Вывод VHI (подпись на плате «VHI») — по схеме Adafruit; назначение в схеме не расшифровано.'),
    im('A0', 14, 'PA02', ['ADC0', 'DAC0']), im('A1', 15, 'PB08', ['ADC1']), im('A2', 16, 'PB09', ['ADC2']), im('A3', 17, 'PA04', ['ADC3']), im('A4', 18, 'PA05', ['ADC4']), im('A5', 19, 'PB02', ['ADC5']),
    im('SCK', 30, 'PB11', ['SPI SCK']), im('MOSI', 29, 'PB10', ['SPI MOSI']), im('MISO', 28, 'PA12', ['SPI MISO']), im('D2', 2, 'PA14'),
    pw('VBAT', 'power', 'Плюс аккумулятора (JST LiPo).'), GND(), pw('VBUS', 'power', 'Плюс USB (5 В).'),
    im('D13', 13, 'PA17', ['LED_BUILTIN']), im('D12', 12, 'PA19'), im('D11', 11, 'PA16'), im('D10', 10, 'PA18'), im('D9', 9, 'PA07', ['ADC (A7)']), im('D7', 7, 'PA21'), im('D5', 5, 'PA15'),
    im('SCL', 27, 'PA23', ['I2C SCL']), im('SDA', 26, 'PA22', ['I2C SDA']), im('D1', 1, 'PA10', ['TX (Serial1)', 'ADC (A7)']), im('D0', 0, 'PA11', ['RX (Serial1)', 'ADC (A6)'])
  ],
  electrical: ELEC_3V3('См. даташит SAMD21.', 'Micro-USB, LiPo (JST) или VBAT/VBUS'),
  notes: [
    'Порядок выводов (micro-USB сверху) и порты — официальная схема распиновки Adafruit (PDF в репозитории adafruit/Adafruit-ItsyBitsy-M0-PCB). Слева: RESET, 3.3V, AREF, VHI, A0–A5, SCK, MOSI, MISO, D2; справа: VBAT, GND, VBUS, D13, D12, D11, D10, D9, D7, D5, SCL, SDA, D1, D0.',
    'Arduino-номера — из той же схемы (A0 = 14 … A5 = 19). Площадки внизу: D4 (4/A8, PA08), D3 (3/A9, PA09), светодиод APA102 (пины 41 и 40) — на схему не включены.',
    ITSY_DIM
  ],
  specs: [['МК', 'ATSAMD21G18 (Cortex-M0+)']]
}

// ---------- Adafruit ItsyBitsy nRF52840 ----------
const itsyNrf: BoardEntry = {
  id: 'itsybitsy-nrf52840', name: 'Adafruit ItsyBitsy nRF52840 Express', mcu: 'nRF52840', platform: 'nrf52', numLabel: 'Пин Arduino №',
  pins: [
    pw('RESET', 'reset', 'Сброс.'), V33(), pw('EN', 'reset', 'Разрешение стабилизатора 3.3 В.'), pw('VHI', 'power', 'Вывод VHI (подпись на плате «VHI») — по схеме Adafruit; назначение в схеме не расшифровано.'),
    im('A0', 14, 'P0.04', ['ADC0 (AIN2)']), im('A1', 15, 'P0.30', ['ADC1 (AIN6)']), im('A2', 16, 'P0.28', ['ADC2 (AIN4)']), im('A3', 17, 'P0.31', ['ADC3 (AIN7)']),
    im('A4', 18, 'P0.02', ['ADC4 (AIN0)']), im('A5', 19, 'P0.03', ['ADC5 (AIN1)']),
    im('SCK', 25, 'P0.13', ['SPI SCK']), im('MOSI', 24, 'P0.15', ['SPI MOSI']), im('MISO', 23, 'P0.20', ['SPI MISO']), im('D2', 2, 'P1.02'),
    pw('VBAT', 'power', 'Плюс аккумулятора (JST LiPo).'), GND(), pw('VBUS', 'power', 'Плюс USB (5 В).'),
    im('D13', 13, 'P0.12'), im('D12', 12, 'P0.11'), im('D11', 11, 'P0.26'), im('D10', 10, 'P0.05', ['ADC (AIN3)']), im('D9', 9, 'P0.07'), im('D7', 7, 'P1.08'), im('D5', 5, 'P0.27'),
    im('SCL', 22, 'P0.14', ['I2C SCL']), im('SDA', 21, 'P0.16', ['I2C SDA']), im('TX', 1, 'P0.24', ['TX (Serial1)']), im('RX', 0, 'P0.25', ['RX (Serial1)'])
  ],
  electrical: ELEC_3V3('См. даташит nRF52840; на схеме Adafruit пометка LS (низкоскоростные выводы) — выше 10 кГц могут влиять на радио.', 'USB, LiPo (JST) или VBAT/VBUS'),
  notes: [
    'Порядок выводов (USB сверху) и порты — официальная схема распиновки Adafruit (PDF в репозитории adafruit/Adafruit-ItsyBitsy-nRF52840-Express-PCB). Слева: RESET, 3.3V, EN, VHI, A0–A5, SCK, MOSI, MISO, D2; справа: VBAT, GND, VBUS, D13, D12, D11, D10, D9, D7, D5, SCL, SDA, TX, RX. Arduino-номера — по схеме.',
    'Не выведено на гребёнки: кнопка SWITCH (D4, P0.29), красный светодиод L (D3, P0.06), светодиод APA102 (MOSI — пин 8 / P0.08, SCK — пин 6 / P1.09). По схеме Adafruit выводы LS (низкоскоростные) могут влиять на радио при частотах выше 10 кГц; все GPIO — 3.3 В.',
    ITSY_DIM
  ],
  specs: [['МК', 'Nordic nRF52840 (Cortex-M4F, 64 МГц)']]
}

// ---------- Adafruit Trinket M0 ----------
const trinket: BoardEntry = {
  id: 'trinket-m0', name: 'Adafruit Trinket M0', mcu: 'SAMD21E18', platform: 'samd', numLabel: 'Пин Arduino №',
  pins: [
    pw('VBAT', 'power', 'Плюс аккумулятора (подпись VBAT).'), GND(),
    im('D4', 4, 'PA06', ['ADC (A4)'], 'AIN6'), im('D3', 3, 'PA07', ['ADC (A3)'], 'AIN7'), pw('RESET', 'reset', 'Сброс.'),
    pw('VBUS', 'power', 'Плюс USB (5 В).'),
    im('D0', 0, 'PA08', ['ADC (A2)'], 'AIN16'), im('D1', 1, 'PA02', ['ADC (A0)', 'DAC0'], 'AIN0; выход ЦАП (VOUT)'), im('D2', 2, 'PA09', ['ADC (A1)'], 'AIN17'),
    V33()
  ],
  electrical: ELEC_3V3('См. даташит SAMD21.', 'Micro-USB, VBUS или VBAT'),
  notes: [
    'Порядок выводов и порты — официальная схема распиновки Adafruit (PDF в репозитории adafruit/Adafruit-Trinket-M0-PCB): слева сверху вниз VBAT, GND, D4, D3, RESET; справа VBUS, D0, D1, D2, 3.3V. Имена на плате и Arduino-номера: D4 = 4/A4, D3 = 3/A3, D0 = 0/A2, D1 = 1/A0, D2 = 2/A1.',
    'Не выведено: красный светодиод D13 (пин 12, PA10) и светодиод APA102 (MOSI — пин 7 / PA00, SCK — пин 8 / PA01). Все GPIO — 3.3 В (по схеме Adafruit).',
    'Не подтверждено: габариты платы (по масштабу схемы ≈ 15 × 24.6 мм) и расстояние между рядами (принято 12.7 мм); положение деталей на рендере приблизительное.'
  ],
  specs: [['МК', 'ATSAMD21E18 (Cortex-M0+)']]
}

export const moreBoards6: BoardEntry[] = [c3c02, s3m, teensyLc, itsyM0, itsyNrf, trinket]

export const moreSources6: Record<string, string[]> = {
  'esp32-c3-devkitc-02': ['https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32c3/esp32-c3-devkitc-02/user_guide.html'],
  'esp32-s3-devkitm-1': ['https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitm-1/user_guide.html'],
  'teensy-lc': ['https://www.pjrc.com/teensy/pinout.html', 'https://www.pjrc.com/teensy/card6a_rev4_web.pdf'],
  'itsybitsy-m0-express': ['https://github.com/adafruit/Adafruit-ItsyBitsy-M0-PCB', 'https://www.adafruit.com/product/3727'],
  'itsybitsy-nrf52840': ['https://github.com/adafruit/Adafruit-ItsyBitsy-nRF52840-Express-PCB', 'https://www.adafruit.com/product/4481'],
  'trinket-m0': ['https://github.com/adafruit/Adafruit-Trinket-M0-PCB', 'https://www.adafruit.com/product/3500']
}
