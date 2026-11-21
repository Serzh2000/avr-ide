// Платы пятой волны (продолжение): Adafruit Metro M4 Express (формат Uno).
// Порядок выводов и функции — из официальной схемы распиновки Adafruit (PDF «Adafruit Metro M4 Express Pinout», репозиторий Adafruit-Metro-M4-PCB, открыта как изображение).
import type { BoardEntry, PinInfo } from '../types'

const pw = (label: string, kind: NonNullable<PinInfo['kind']>, notes: string): PinInfo => ({ label, gpio: null, functions: [], notes, kind })
const GND = (): PinInfo => pw('GND', 'gnd', 'Земля (общий провод).')
const dp = (n: number, port: string, sercom: string, notes = ''): PinInfo =>
  ({ label: `D${n}`, gpio: n, functions: ['GPIO', ...sercom.split(' / ').filter(Boolean)], notes: `Порт ${port}${notes ? '. ' + notes : ''}` })
const ap = (a: number, port: string, extra: string[], notes = ''): PinInfo =>
  ({ label: `A${a}`, gpio: 14 + a, functions: [`ADC (A${a})`, ...extra, 'GPIO'], notes: `Порт ${port} (D${14 + a})${notes ? '. ' + notes : ''}` })

const metroM4: BoardEntry = {
  id: 'metro-m4-express', name: 'Adafruit Metro M4 Express', mcu: 'ATSAMD51 (Cortex-M4F)', platform: 'samd', numLabel: 'Пин Arduino №',
  pins: [
    { label: 'SCL', gpio: 21, functions: ['I2C SCL (SERCOM5.1)', 'ADC (A7)'], notes: 'Порт PB03; Arduino-номер 21 (A7). Это линия I2C на разъёме у AREF.' },
    { label: 'SDA', gpio: 20, functions: ['I2C SDA (SERCOM5.0)', 'ADC (A6)'], notes: 'Порт PB02; Arduino-номер 20 (A6). Это линия I2C на разъёме у AREF.' },
    pw('AREF', 'ref', 'Опорное напряжение АЦП (вход).'), pw('GND', 'gnd', 'Земля (общий провод). На плате несколько контактов GND: у AREF и два на колодке питания.'),
    dp(13, 'PA16', 'SERCOM1.0 / SERCOM3.1', 'LED_BUILTIN; PWM (TC2/TCC1/TCC0)'), dp(12, 'PA17', 'SERCOM1.1 / SERCOM3.0', 'PWM'),
    dp(11, 'PA19', 'SERCOM1.3 / SERCOM3.3', 'PWM'), dp(10, 'PA18', 'SERCOM1.2 / SERCOM3.2', 'PWM'),
    dp(9, 'PA20', 'SERCOM5.2 / SERCOM3.2', 'PWM'), dp(8, 'PA21', 'SERCOM5.3 / SERCOM3.3', 'PWM'),
    dp(7, 'PB12', 'SERCOM4.0', 'PWM'), dp(6, 'PB15', 'SERCOM4.3', 'PWM'), dp(5, 'PB14', 'SERCOM4.2', 'PWM'), dp(4, 'PB13', 'SERCOM4.1', 'PWM'),
    dp(3, 'PB16', 'SERCOM5.0', 'PWM'), dp(2, 'PB17', 'SERCOM5.1', 'PWM'),
    { label: 'D1', gpio: 1, functions: ['GPIO', 'TX (Serial1, SERCOM3.0)', 'SERCOM5.1'], notes: 'Порт PA22; D1/TX. PWM' },
    { label: 'D0', gpio: 0, functions: ['GPIO', 'RX (Serial1, SERCOM3.1)', 'SERCOM5.0'], notes: 'Порт PA23; D0/RX. PWM' },
    pw('NC', 'nc', 'Первый контакт колодки питания (на схеме Adafruit без подписи, как NC у Uno).'),
    pw('IOREF', 'ref', 'Опорное напряжение логики платы (3.3 В) для шилдов.'), pw('RESET', 'reset', 'Сброс (RST): низкий уровень — перезапуск.'),
    pw('3V3', 'power', 'Выход 3.3 В.'), pw('5V', 'power', 'Шина 5 В (выход от USB/стабилизатора).'),
    pw('VIN', 'power', 'Вход внешнего питания (гнездо DC / VIN).'),
    ap(0, 'PA02', ['DAC0 (VOUT0)']), ap(1, 'PA05', ['DAC1 (VOUT1)', 'SERCOM0.1']), ap(2, 'PA06', ['VREFC', 'SERCOM0.2']), ap(3, 'PA04', ['VREFB', 'SERCOM0.0']),
    ap(4, 'PB08', ['SERCOM4.0']), ap(5, 'PB09', ['SERCOM4.1'])
  ],
  electrical: { logic: 'Логика 3.3 В (все GPIO 3.3 В, если не указано иное — по схеме Adafruit).', current: 'См. даташит ATSAMD51.', supply: 'USB (микро-USB), гнездо DC (VIN)' },
  specs: [['МК', 'Microchip SAMD51 (Cortex-M4F, 120 МГц, до 1 МБ Flash, 192/256 КБ SRAM — по схеме Adafruit)'], ['Формат', 'Uno'], ['Светодиоды', 'On, TX, RX, L (D13); NeoPixel на D40 (PB22)']],
  notes: [
    'Порядок и названия выводов — по схеме распиновки Adafruit (Arduino-названия D0–D13, A0–A5, SDA/SCL, а также питание IOREF/RST/3.3V/5V/GND/GND/VIN); соответствие портов SAMD51 и SERCOM (первый/альтернативный) — с неё же. Таймеры (TC/TCC) в таблице не расшифрованы — их набор смотрите на схеме Adafruit.',
    'Не показано на схеме платы: ICSP-колодка (MISO PA14 = D24, SCK PA13 = D25, MOSI PA12 = D26, RESET, 5V, GND), светодиод NeoPixel (D40, PB22), SWD-колодка, DC-гнездо. SDA/SCL на схеме выведены отдельно у AREF (они же A6/A7, PB02/PB03).',
    'Не подтверждено: габариты (приняты по формату Uno 68.6 × 53.3 мм — по схеме Adafruit разъёмы повторяют Uno) и положение деталей на рендере (приблизительное: микро-USB, гнездо DC, кнопка RESET, SAMD51). Точный номер варианта кристалла (J19/J20) на схеме не указан.'
  ]
}

const GND2 = (): PinInfo => pw('GND', 'gnd', 'Земля (общий провод). Контактов GND на плате три: два подряд на левом ряду и один на правом.')

// ---------- Adafruit KB2040 (RP2040, форм-фактор Pro Micro) ----------
const kp = (label: string, gpio: number, f: string[], notes = ''): PinInfo => ({ label, gpio, functions: ['GPIO', ...f], notes: `GPIO${gpio}${notes ? '. ' + notes : ''}` })
const kb2040: BoardEntry = {
  id: 'kb2040', name: 'Adafruit KB2040', mcu: 'RP2040', platform: 'rp2040', numLabel: 'Номер GPIO',
  pins: [
    { label: 'D+', gpio: null, functions: [], special: 'usb', notes: 'Контакт USB D+ на колодке (контактная площадка рядом с USB-C).' },
    kp('D0', 0, ['PWM0A', 'I2C0 SDA', 'UART0 TX', 'SPI0 RX']), kp('D1', 1, ['PWM0B', 'I2C0 SCL', 'UART0 RX', 'SPI0 CSn']), GND2(),
    kp('D2', 2, ['PWM1A', 'I2C1 SDA', 'UART0 CTS', 'SPI0 SCK']), kp('D3', 3, ['PWM1B', 'I2C1 SCL', 'UART0 RTS', 'SPI0 TX']),
    kp('D4', 4, ['PWM2A', 'I2C0 SDA', 'UART1 TX', 'SPI0 RX']), kp('D5', 5, ['PWM2B', 'I2C0 SCL', 'UART1 RX', 'SPI0 CSn']),
    kp('D6', 6, ['PWM3A', 'I2C1 SDA', 'UART1 CTS', 'SPI0 SCK']), kp('D7', 7, ['PWM3B', 'I2C1 SCL', 'UART1 RTS', 'SPI0 TX']),
    kp('D8', 8, ['PWM4A', 'I2C0 SDA', 'UART1 TX', 'SPI1 RX']), kp('D9', 9, ['PWM4B', 'I2C0 SCL', 'UART1 RX', 'SPI1 CSn']),
    { label: 'D-', gpio: null, functions: [], special: 'usb', notes: 'Контакт USB D− на колодке (контактная площадка рядом с USB-C).' },
    pw('RAW', 'power', 'Выход 5 В с USB (после диода-«ИЛИ»); сюда же можно подать внешние 5 В. Схема Adafruit: красная метка «Power».'),
    pw('RESET', 'reset', 'Сброс (вход): замыкание на землю перезапускает плату.'), pw('3V3', 'power', 'Выход стабилизатора 3.3 В.'),
    kp('A3', 29, ['ADC3', 'PWM6B', 'I2C0 SCL', 'UART1 RX', 'SPI1 CSn']), kp('A2', 28, ['ADC2', 'PWM6A', 'I2C0 SDA', 'UART1 TX', 'SPI1 RX']),
    kp('A1', 27, ['ADC1', 'PWM5B', 'I2C1 SCL', 'UART1 RTS', 'SPI1 TX']), kp('A0', 26, ['ADC0', 'PWM5A', 'I2C1 SDA', 'UART1 CTS', 'SPI1 SCK']),
    kp('SCK', 18, ['PWM1A', 'I2C1 SDA', 'UART0 CTS', 'SPI0 SCK']), kp('MISO', 20, ['PWM2A', 'I2C0 SDA', 'UART1 TX', 'SPI0 RX']),
    kp('MOSI', 19, ['PWM1B', 'I2C1 SCL', 'UART0 RTS', 'SPI0 TX']), kp('D10', 10, ['PWM5A', 'I2C1 SDA', 'UART1 CTS', 'SPI1 SCK'])
  ],
  electrical: { logic: 'Логика 3.3 В (все GPIO 3.3 В, если не указано иное — по схеме Adafruit).', current: 'См. даташит RP2040.', supply: 'USB-C (RAW 5 В) или RAW' },
  specs: [['МК', 'Raspberry Pi RP2040 (двухъядерный Cortex-M0+, до 133 МГц, 264 КБ SRAM; Flash — внешний QSPI)'], ['Форм-фактор', 'Pro Micro: 33.02 × 17.78 мм, 2 × 13 контактов (шаг 2.54 мм, ряды 15.24 мм)'], ['Встроенное', 'USB-C, NeoPixel (GPIO17), кнопка BOOT (GPIO11 «BUTTON»), STEMMA QT / Qwiic (SDA GPIO12, SCL GPIO13)']],
  notes: [
    'Порядок и названия выводов, номера GPIO и функции (PWM, I2C, UART, SPI) — по схеме распиновки Adafruit (PDF в репозитории Adafruit-KB2040-PCB, открыта как изображение). Габариты и положение рядов, USB-C, RP2040, Flash, стабилизатора, кнопок и разъёма STEMMA QT — из файла платы Adafruit Eagle (.brd) из того же репозитория.',
    'Не выведено на колодки: кнопка BUTTON (GPIO11), NeoPixel (GPIO17), STEMMA QT (SDA GPIO12, SCL GPIO13). Номера «D0…D10» — подписи Adafruit/CircuitPython; Arduino-номера выводов — номера GPIO. Контакты D+ и D− — тестовые площадки на краю USB, а не сигнальные выводы пользователя.',
    'Не подтверждено: кварц, NeoPixel и светодиод на рендере не показаны или приблизительные; положение остальных мелких деталей приблизительное.'
  ]
}

// ---------- Adafruit Metro ESP32-S3 (формат Uno, ESP32-S3) ----------
const mg = (label: string, n: number, f: string[], notes = ''): PinInfo => ({ label, gpio: n, functions: ['GPIO', ...f], notes: `GPIO${n}${notes ? '. ' + notes : ''}` })
const metroS3: BoardEntry = {
  id: 'metro-esp32-s3', name: 'Adafruit Metro ESP32-S3', mcu: 'ESP32-S3 (N16R8)', platform: 'esp32s3', numLabel: 'Номер GPIO',
  pins: [
    mg('SCL', 48, ['I2C SCL (Arduino-вывод SCL)', 'CLK_N_DIFF'], 'Тот же сигнал на разъёме STEMMA QT'), mg('SDA', 47, ['I2C SDA (Arduino-вывод SDA)', 'CLK_P_DIFF'], 'Тот же сигнал на разъёме STEMMA QT'),
    pw('AREF', 'power', 'На схеме Adafruit у этого контакта подпись «3.3V» (на плате — AREF): выход 3.3 В.'), pw('GND', 'gnd', 'Земля (общий провод). Несколько контактов GND: у AREF и два на колодке питания.'),
    mg('D13', 13, ['ADC2_CH2', 'FSPIQ', 'Touch T13', 'RTC']), mg('D12', 12, ['ADC2_CH1', 'FSPICLK', 'Touch T12', 'RTC']), mg('D11', 11, ['ADC2_CH0', 'FSPID', 'Touch T11', 'RTC']),
    mg('D10', 10, ['ADC1_CH9', 'FSPICS0', 'Touch T10', 'RTC']), mg('D9', 9, ['ADC1_CH8', 'FSPIHD', 'Touch T9', 'RTC']), mg('D8', 8, ['ADC1_CH7', 'Touch T8', 'RTC']),
    mg('D7', 7, ['ADC1_CH6', 'Touch T7', 'RTC']), mg('D6', 6, ['ADC1_CH5', 'Touch T6', 'RTC']), mg('D5', 5, ['ADC1_CH4', 'Touch T5', 'RTC']), mg('D4', 4, ['ADC1_CH3', 'Touch T4', 'RTC']),
    mg('D3', 3, ['ADC1_CH2', 'Touch T3', 'RTC']), mg('D2', 2, ['ADC1_CH1', 'Touch T2', 'RTC']),
    mg('D1', 40, ['TX (Serial1)', 'MTDO'], 'Подпись Adafruit TX/D1'), mg('D0', 41, ['RX (Serial1)', 'MTDI'], 'Подпись Adafruit RX/D0'),
    pw('NC', 'nc', 'Первый контакт колодки питания (8-контактная колодка по файлу платы Adafruit; на схеме без подписи).'),
    pw('IOREF', 'ref', 'Опорное напряжение логики платы (3.3 В).'), pw('RESET', 'reset', 'Сброс.'), pw('3V3', 'power', 'Выход 3.3 В.'),
    pw('VHIGH', 'power', 'Шина VHIGH (на схеме Adafruit — красная метка «Power»): аналог 5 В Uno.'), pw('VIN', 'power', 'Вход внешнего питания 6–12 В (гнездо DC / VIN).'),
    mg('A0', 14, ['ADC2_CH3', 'FSPIWP', 'Touch T14', 'RTC']), mg('A1', 15, ['ADC2_CH4', 'XTAL_32K_P', 'UART0 RTS', 'RTC']), mg('A2', 16, ['ADC2_CH5', 'XTAL_32K_N', 'UART0 CTS', 'RTC']),
    mg('A3', 17, ['ADC2_CH6', 'UART1 TX', 'RTC']), mg('A4', 18, ['ADC2_CH7', 'UART1 RX', 'RTC']), mg('A5', 1, ['ADC1_CH0', 'Touch T1', 'RTC'])
  ],
  electrical: { logic: 'Логика 3.3 В.', current: 'См. даташит ESP32-S3.', supply: 'USB-C, гнездо DC 6–12 В или аккумулятор LiPo (JST)' },
  specs: [['МК', 'ESP32-S3 (двухъядерный Xtensa LX7, Wi-Fi + BLE), модуль N16R8 (16 МБ Flash, 8 МБ PSRAM)'], ['Формат', 'Uno: 68.58 × 53.34 мм'], ['Встроенное', 'NeoPixel (GPIO46), microSD (SD_CS GPIO45), STEMMA QT, JTAG, разъём LiPo']],
  notes: [
    'Порядок и названия выводов, номера GPIO, АЦП-каналы, сенсорные входы и функции — по схеме распиновки Adafruit (PDF в репозитории Adafruit-Metro-ESP32-S3-PCB, открыта как изображение). Габариты (68.58 × 53.34 мм) и 8-контактная колодка питания — из файла платы Adafruit (.brd) из того же репозитория.',
    'Не выведено на колодки Uno: NeoPixel (GPIO46), microSD (MISO GPIO21, MOSI GPIO42, SCK GPIO39, SD_CS GPIO45; те же сигналы выведены и на отдельную колодку ICSP), отладочные DEBUG_RX GPIO44 / DEBUG_TX GPIO43, разъём STEMMA QT (SCL GPIO48, SDA GPIO47), JTAG.',
    'Не подтверждено: положение деталей на рендере приблизительное (USB-C, гнездо DC, модуль, кнопки); название колодки «VHIGH» принято по схеме Adafruit, электрические пределы (до 5 В) в схеме не расписаны.'
  ]
}

// ---------- Adafruit Metro M0 Express (SAMD21, формат Uno) ----------
const mdp = (n: number, port: string, f: string[], notes = ''): PinInfo => ({ label: `D${n}`, gpio: n, functions: ['GPIO', ...f], notes: `Порт ${port}${notes ? '. ' + notes : ''}` })
const map0 = (a: number, port: string, f: string[]): PinInfo => ({ label: `A${a}`, gpio: 14 + a, functions: [`ADC (A${a})`, ...f, 'GPIO'], notes: `Порт ${port} (D${14 + a})` })
const metroM0: BoardEntry = {
  id: 'metro-m0-express', name: 'Adafruit Metro M0 Express', mcu: 'ATSAMD21 (Cortex-M0+)', platform: 'samd', numLabel: 'Пин Arduino №',
  pins: [
    { label: 'SCL', gpio: 21, functions: ['I2C SCL (SERCOM3.1)', 'SERCOM5.1'], notes: 'Порт PA23; Arduino-номер 21. Линия I2C на разъёме у AREF.' },
    { label: 'SDA', gpio: 20, functions: ['I2C SDA (SERCOM3.0)', 'SERCOM5.0'], notes: 'Порт PA22; Arduino-номер 20. Линия I2C на разъёме у AREF.' },
    pw('AREF', 'ref', 'Опорное напряжение АЦП (вход).'), pw('GND', 'gnd', 'Земля (общий провод). На плате несколько контактов GND: у AREF и два на колодке питания.'),
    mdp(13, 'PA17', ['SERCOM1.1 / SERCOM3.1', 'PWM'], 'LED_BUILTIN'), mdp(12, 'PA19', ['SERCOM1.3 / SERCOM3.3', 'PWM', 'I2S SD0']), mdp(11, 'PA16', ['SERCOM1.0 / SERCOM3.0', 'PWM']),
    mdp(10, 'PA18', ['SERCOM1.2 / SERCOM3.2', 'PWM']), mdp(9, 'PA07', ['AIN7', 'Touch Y5', 'SERCOM0.3', 'PWM', 'I2S SD0'], 'Также A7 (D9/A7)'), mdp(8, 'PA06', ['AIN6', 'Touch Y4', 'SERCOM0.2', 'PWM'], 'Также A6 (D8/A6)'),
    mdp(7, 'PA21', ['SERCOM5.3 / SERCOM3.3', 'PWM', 'I2S FS']), mdp(6, 'PA20', ['SERCOM5.2 / SERCOM3.2', 'PWM', 'I2S SCK0']), mdp(5, 'PA15', ['SERCOM2.3 / SERCOM4.3', 'PWM']),
    mdp(4, 'PA08', ['NMI', 'AIN16', 'SERCOM0.0 / SERCOM2.0', 'PWM', 'I2S SD1']), mdp(3, 'PA09', ['AIN17', 'SERCOM0.1 / SERCOM2.1', 'PWM', 'I2S MCK0']), mdp(2, 'PA14', ['SERCOM2.2 / SERCOM4.2', 'PWM']),
    mdp(1, 'PA10', ['TX (Serial1)', 'AIN18', 'SERCOM0.2 / SERCOM2.2', 'PWM', 'I2S SCK0'], 'D1/TX'), mdp(0, 'PA11', ['RX (Serial1)', 'AIN19', 'SERCOM0.3 / SERCOM2.3', 'PWM', 'I2S FS'], 'D0/RX'),
    pw('NC', 'nc', 'Первый контакт колодки питания (на схеме Adafruit без подписи, как NC у Uno).'),
    pw('IOREF', 'ref', 'Опорное напряжение логики платы (3.3 В) для шилдов.'), pw('RESET', 'reset', 'Сброс (RST).'), pw('3V3', 'power', 'Выход 3.3 В.'),
    pw('5V', 'power', 'Шина 5 В (выход от USB/стабилизатора).'), pw('VIN', 'power', 'Вход внешнего питания (гнездо DC / VIN).'),
    map0(0, 'PA02', ['AIN0', 'DAC VOUT', 'Touch Y0']), map0(1, 'PB08', ['AIN2', 'Touch Y14', 'SERCOM4.0']), map0(2, 'PB09', ['AIN3', 'Touch Y15', 'SERCOM4.1']),
    map0(3, 'PA04', ['AIN4', 'VREFB', 'Touch Y2', 'SERCOM0.0']), map0(4, 'PA05', ['AIN5', 'Touch Y3', 'SERCOM0.1']), map0(5, 'PB02', ['AIN10', 'Touch Y8', 'SERCOM5.0'])
  ],
  electrical: { logic: 'Логика 3.3 В (все GPIO 3.3 В, если не указано иное — по схеме Adafruit).', current: 'См. даташит ATSAMD21.', supply: 'USB (микро-USB), гнездо DC (VIN)' },
  specs: [['МК', 'Microchip SAMD21 (Cortex-M0+, 48 МГц, 256 КБ Flash, 32 КБ SRAM — по схеме Adafruit)'], ['Формат', 'Uno'], ['Светодиоды', 'On, TX, RX, L (D13); NeoPixel на D40 (PA30)']],
  notes: [
    'Порядок и названия выводов, порты SAMD21, SERCOM (первый/альтернативный), АЦП-каналы и сенсорные входы — по схеме распиновки Adafruit (PDF в репозитории Adafruit-Metro-M0-Express-PCB, открыта как изображение). Таймеры (TC/TCC) не расшифрованы — см. схему Adafruit.',
    'Не показано на схеме платы: ICSP-колодка (MISO PA12 = D22, SCK PB11 = D24, MOSI PB10 = D23, RESET, 5V, GND), NeoPixel (D40, PA30), SWD-колодка, DC-гнездо.',
    'Не подтверждено: габариты (приняты по формату Uno 68.6 × 53.3 мм — разъёмы повторяют Uno) и положение деталей на рендере (приблизительное).'
  ]
}

export const moreBoards12: BoardEntry[] = [metroM4, metroM0, kb2040, metroS3]
export const moreSources12: Record<string, string[]> = {
  'metro-m4-express': ['https://github.com/adafruit/Adafruit-Metro-M4-PCB', 'https://www.adafruit.com/product/3382'],
  'metro-m0-express': ['https://github.com/adafruit/Adafruit-Metro-M0-Express-PCB', 'https://www.adafruit.com/product/3505'],
  kb2040: ['https://github.com/adafruit/Adafruit-KB2040-PCB', 'https://www.adafruit.com/product/5302'],
  'metro-esp32-s3': ['https://github.com/adafruit/Adafruit-Metro-ESP32-S3-PCB', 'https://www.adafruit.com/product/5500']
}
