// Платы четвёртой волны, часть 2: NodeMCU-32S, ESP8684-DevKitM-1, ESP32-H2-DevKitM-1, Arduino Nano Matter.
import type { BoardEntry, PinInfo } from '../types'
import { gp as rpGp } from './boardsMcu'

const pw = (label: string, kind: NonNullable<PinInfo['kind']>, notes: string): PinInfo => ({ label, gpio: null, functions: [], notes, kind })
const GND = (): PinInfo => pw('GND', 'gnd', 'Земля (общий провод).')
const gi = (n: number, functions: string[], notes?: string, special?: PinInfo['special'], label = `GPIO${n}`): PinInfo =>
  ({ label, gpio: n, functions, notes, special })
const ELEC_3V3 = (cur: string, supply: string) => ({ logic: 'Логика 3.3 В; пины не 5V-tolerant.', current: cur, supply })
const ESP_DIM = 'Не подтверждено: габариты платы — в руководстве Espressif только отдельный PDF/DXF; на схеме они условные. Положение деталей на рендере приблизительное.'
const FL = 'GPIO6–11 заняты SPI flash — не использовать'

// ---------- NodeMCU-32S (Ai-Thinker NodeMCU-32, спецификация V1.3) ----------
const nodemcu32: BoardEntry = {
  id: 'nodemcu-32s', name: 'NodeMCU-32S (Ai-Thinker NodeMCU-32)', mcu: 'ESP32', platform: 'esp32',
  pins: [
    pw('3V3', 'power', 'Питание 3.3 В (вход/выход).'), pw('EN', 'reset', 'Разрешение модуля (CHIP_PU), активный высокий уровень.'),
    gi(36, ['ADC1_0 (SVP)', 'RTC_GPIO0'], 'Только вход', 'input-only'), gi(39, ['ADC1_3 (SVN)', 'RTC_GPIO3'], 'Только вход', 'input-only'),
    gi(34, ['ADC1_6', 'RTC_GPIO4'], 'Только вход', 'input-only'), gi(35, ['ADC1_7', 'RTC_GPIO5'], 'Только вход', 'input-only'),
    gi(32, ['ADC1_4', 'Touch9', 'XTAL_32K_P']), gi(33, ['ADC1_5', 'Touch8', 'XTAL_32K_N']),
    gi(25, ['DAC1', 'ADC2_8']), gi(26, ['DAC2', 'ADC2_9']), gi(27, ['ADC2_7', 'Touch7']),
    gi(14, ['ADC2_6', 'Touch6', 'HSPI SCK', 'JTAG MTMS']), gi(12, ['ADC2_5', 'Touch5', 'HSPI MISO', 'JTAG MTDI'], 'Strapping: HIGH при старте задаёт 1.8 В flash — может не стартовать', 'strapping'),
    GND(), gi(13, ['ADC2_4', 'Touch4', 'HSPI MOSI', 'JTAG MTCK']),
    gi(9, ['flash (SD2)'], FL, 'flash'), gi(10, ['flash (SD3)'], FL, 'flash'), gi(11, ['flash (CMD)'], FL, 'flash'), pw('5V', 'power', 'Вход питания 5 В (Micro-USB или вывод).'),
    gi(6, ['flash (CLK)'], FL, 'flash'), gi(7, ['flash (SD0)'], FL, 'flash'), gi(8, ['flash (SD1)'], FL, 'flash'),
    gi(15, ['ADC2_3', 'Touch3', 'HSPI CS', 'JTAG MTDO'], 'Strapping', 'strapping'), gi(2, ['ADC2_2', 'Touch2'], 'Strapping', 'strapping'),
    gi(0, ['ADC2_1', 'Touch1', 'BOOT button'], 'Strapping: LOW при старте = режим загрузки (по схеме на плате кнопка IO0)', 'strapping'),
    gi(4, ['ADC2_0', 'Touch0']), gi(16, ['RX2 (UART2)']), gi(17, ['TX2 (UART2)']), gi(5, ['VSPI SS'], 'Strapping', 'strapping'),
    gi(18, ['VSPI SCK']), gi(19, ['VSPI MISO']), gi(21, ['VSPI HD', 'I2C SDA (по умолчанию в ядре)']),
    { ...gi(3, ['RX0 (Serial)', 'CLK_OUT2'], 'USB-Serial', 'warning'), label: 'GPIO3' }, { ...gi(1, ['TX0 (Serial)', 'CLK_OUT3'], 'USB-Serial', 'warning'), label: 'GPIO1' },
    gi(22, ['VSPI WP', 'U0RTS', 'I2C SCL (по умолчанию в ядре)']), gi(23, ['VSPI MOSI'])
  ],
  electrical: ELEC_3V3('См. даташит ESP32.', 'Micro-USB 4.75–5.25 В или вывод 5V; на 3V3 — 3.0–3.6 В, ток не менее 500 мА (по спецификации Ai-Thinker)'),
  notes: [
    'Порядок выводов и функции — спецификация Ai-Thinker «NodeMCU-32 Specification V1.3» (копия https://cdn.zbotic.in/wp-content/uploads/2023/03/AI1670.pdf), рисунок «NodeMCU-32 Pin diagram» и таблица 2.2: слева сверху вниз 3.3V, EN, SVP, SVN, P34, P35, P32, P33, P25, P26, P27, P14, P12, GND, P13, SD2, SD3, CMD, 5V; справа GND, P23, P22, TX, RX, P21, GND, P19, P18, P5, P17, P16, P4, P0, P2, P15, SD1, SD0, CLK.',
    'DIP38, шаг 2.54 мм, Micro-USB, антенна на плате или IPEX — по спецификации. Размер в спецификации 25.4 × 48.3 мм ±0.2 соответствует сетке выводов (10 × 19 шагов), а не габаритам платы: габариты на схеме (≈ 56 × 28 мм) оценены по фото из спецификации — не подтверждено. В таблице спецификации для вывода P0 ошибочно указано GPIO4; на рисунке пинаута P0 = GPIO0 (ADC11, Touch1) — принято по рисунку.',
    'Локальные подписи P4, P5… = GPIO4, GPIO5…; SVP/SVN = GPIO36/GPIO39. I2C по умолчанию в ядре Arduino (SDA 21, SCL 22) указан по общему ядру ESP32, а не по спецификации. Положение деталей на рендере приблизительное.'
  ],
  specs: [['Сетка выводов', '25.4 × 48.3 мм'], ['Flash', '32 Мбит (по умолчанию)']]
}

// ---------- ESP8684-DevKitM-1 (ESP32-C2) ----------
const c2: BoardEntry = {
  id: 'esp8684-devkitm-1', name: 'ESP8684-DevKitM-1 (ESP32-C2)', mcu: 'ESP8684', platform: 'esp32c2',
  pins: [
    GND(), pw('3V3', 'power', 'Выход 3.3 В (два вывода J1).'),
    gi(2, ['ADC1_2', 'SPI MISO (FSPIQ)'], 'Strapping', 'strapping'), gi(3, ['ADC1_3']),
    pw('RST', 'reset', 'Сброс: высокий — чип включён, низкий — выключен.'),
    gi(0, ['ADC1_0', 'LED red'], 'Красный светодиод платы (по документации Espressif).'), gi(1, ['ADC1_1', 'LED green'], 'Зелёный светодиод платы.'),
    gi(10, ['SPI CS (FSPICS0)']), pw('5V', 'power', 'Вход/выход 5 В (два вывода J1).'),
    { ...gi(20, ['TX0 (UART0)']), label: 'TX' }, { ...gi(19, ['RX0 (UART0)']), label: 'RX' },
    gi(9, ['BOOT button'], 'Strapping', 'strapping'), gi(8, ['LED blue'], 'Strapping; синий светодиод платы.', 'strapping'),
    gi(7, ['SPI MOSI (FSPID)', 'JTAG MTDO']), gi(6, ['SPI SCK (FSPICLK)', 'JTAG MTCK']), gi(5, ['ADC2_0', 'SPI WP (FSPIWP)', 'JTAG MTDI']),
    gi(4, ['ADC1_4', 'SPI HD (FSPIHD)', 'JTAG MTMS']), gi(18, [])
  ],
  electrical: ELEC_3V3('См. даташит ESP8684.', '5 В через Micro-USB или вывод 5V'),
  notes: [
    'Порядок выводов — таблица Header Block руководства Espressif (J1 слева сверху вниз: G, 3V3, 3V3, 2, 3, G, RST, G, 0, 1, 10, G, 5V, 5V, G; J3 справа: G, TX, RX, G, 9, 8, G, 7, 6, 5, 4, G, 18, G, G). Источник: https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32c2/esp8684-devkitm-1/user_guide.html',
    'Модуль ESP8684-MINI-1 (PCB-антенна, flash 1/2/4 МБ; в заказных вариантах v1.1 — 4 МБ); порт Micro-USB. Светодиоды платы: GPIO0 красный, GPIO1 зелёный, GPIO8 синий (по руководству).',
    ESP_DIM
  ],
  specs: [['Модуль', 'ESP8684-MINI-1']]
}

// ---------- ESP32-H2-DevKitM-1 ----------
const h2: BoardEntry = {
  id: 'esp32-h2-devkitm-1', name: 'ESP32-H2-DevKitM-1', mcu: 'ESP32-H2', platform: 'esp32h2',
  pins: [
    pw('3V3', 'power', 'Выход 3.3 В.'), pw('RST', 'reset', 'Разрешение чипа (высокий — включён); подтянут внутри платы.'),
    gi(0, ['SPI MISO (FSPIQ)']), gi(1, ['ADC1_0', 'SPI CS (FSPICS0)']), gi(2, ['ADC1_1', 'SPI WP (FSPIWP)', 'JTAG MTMS']), gi(3, ['ADC1_2', 'SPI HD (FSPIHD)', 'JTAG MTDO']),
    gi(13, ['XTAL_32K_P'], 'Недоступен, если подключён к кварцу 32.768 кГц модуля'), gi(14, ['XTAL_32K_N'], 'Недоступен, если подключён к кварцу 32.768 кГц модуля'),
    gi(4, ['ADC1_3', 'SPI SCK (FSPICLK)', 'JTAG MTCK']), gi(5, ['ADC1_4', 'SPI MOSI (FSPID)', 'JTAG MTDI']),
    pw('NC', 'nc', 'Не подключён.'), pw('VBAT', 'power', 'Питание 3.3 В либо аккумулятор.'), GND(), pw('5V', 'power', 'Вход/выход 5 В.'),
    { ...gi(24, ['TX0 (UART0)', 'SPI CS2 (FSPICS2)']), label: 'TX' }, { ...gi(23, ['RX0 (UART0)', 'SPI CS1 (FSPICS1)']), label: 'RX' },
    gi(10, ['ZCD0']), gi(11, ['ZCD1']), gi(25, ['SPI CS3 (FSPICS3)']), gi(12, []), gi(8, ['LOG', 'RGB LED'], 'Управляет RGB-светодиодом платы (LOG); strapping', 'strapping'), gi(22, []),
    gi(9, ['BOOT button'], 'Strapping: LOW при старте = режим загрузки', 'strapping'),
    gi(27, ['USB D+'], 'Нативный USB чипа.', 'usb'), gi(26, ['USB D-'], 'Нативный USB чипа.', 'usb')
  ],
  electrical: ELEC_3V3('См. даташит ESP32-H2.', '5 В через USB-C или вывод 5V'),
  notes: [
    'Порядок выводов — таблица Header Block руководства Espressif (J1 слева сверху вниз: 3V3, RST, 0, 1, 2, 3, 13/N, 14/N, 4, 5, NC, VBAT, G, 5V, G; J3 справа: G, TX, RX, 10, 11, 25, 12, 8, 22, G, 9, G, 27, 26, G). Источник: https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32h2/esp32-h2-devkitm-1/user_guide.html',
    'Модуль ESP32-H2-MINI-1 (Bluetooth 5 LE, Thread, Zigbee, Matter); два USB-C: нативный USB чипа (GPIO26/27) и USB-UART мост (питание, прошивка, консоль).',
    ESP_DIM
  ],
  specs: [['Модуль', 'ESP32-H2-MINI-1']]
}

// ---------- Arduino Nano Matter (Silicon Labs MGM240S) ----------
const nm = (label: string, n: number, functions: string[] = [], notes = ''): PinInfo => ({ label, gpio: n, functions: [...functions, 'PWM', 'GPIO'], notes })
const nanoMatter: BoardEntry = {
  id: 'nano-matter', name: 'Arduino Nano Matter', mcu: 'MGM240S (EFR32MG24)', platform: 'silabs', numLabel: 'Пин Arduino №',
  pins: [
    nm('D13', 13, ['SPI SCK']), pw('3V3', 'power', 'Выход 3.3 В.'), pw('AREF', 'ref', 'Опорное напряжение АЦП.'),
    nm('A0', 14, ['ADC0', 'DAC0']), nm('A1', 15, ['ADC1', 'DAC2']), nm('A2', 16, ['ADC2']), nm('A3', 17, ['ADC3']),
    nm('A4', 18, ['ADC4', 'I2C SDA (I2C0)']), nm('A5', 19, ['ADC5', 'I2C SCL (I2C0)']), nm('A6', 20, ['ADC6', 'DAC1']), nm('A7', 21, ['ADC7', 'DAC3']),
    pw('5V', 'power', 'Выход 5 В при питании от USB (по схеме Arduino).'), pw('NC', 'nc', 'Не подключён.'), GND(), pw('VIN', 'power', 'Вход внешнего питания, не более 21 В (по схеме Arduino).'),
    nm('D12', 12, ['SPI MISO']), nm('D11', 11, ['SPI MOSI']), nm('D10', 10, ['SPI SS']), nm('D9', 9), nm('D8', 8), nm('D7', 7), nm('D6', 6),
    nm('D5', 5, ['I2C SCL (I2C1)']), nm('D4', 4, ['I2C SDA (I2C1)']), nm('D3', 3, ['SPI SS (SPI1)']), nm('D2', 2, ['SPI SCK (SPI1)']),
    pw('RST', 'reset', 'Сброс.'),
    nm('D1', 1, ['UART RX (PIN_SERIAL_RX1)', 'SPI MISO (SPI1)'], 'На схеме Arduino D1 подписан PIN_SERIAL_RX1'), nm('D0', 0, ['UART TX (PIN_SERIAL_TX1)', 'SPI MOSI (SPI1)'], 'На схеме Arduino D0 подписан PIN_SERIAL_TX1')
  ],
  electrical: ELEC_3V3('Не указан в схеме распиновки — см. документацию Nano Matter.', 'USB-C или VIN (не более 21 В)'),
  notes: [
    'Порядок выводов и функции — официальная схема распиновки Arduino Nano Matter (ABX00112, PDF, CC BY-SA 4.0): слева D13, 3V3, AREF, A0–A7, 5V, NC, GND, VIN; справа D12…D2, GND, RST, D1, D0. Все цифровые и аналоговые выводы отмечены тильдой (ШИМ).',
    'Внутри платы: RGB-светодиод (LEDR/LEDG/LEDB), кнопка пользователя BTN_BUILTIN, кнопка Reset, светодиод питания. Обратите внимание: на схеме UART подписан D1 = PIN_SERIAL_RX1, D0 = PIN_SERIAL_TX1 (в отличие от Nano: D0 = RX).',
    'Форм-фактор Nano: 45 × 18 мм, два ряда по 15 выводов, шаг 2.54 мм, ряды через 15.24 мм. Положение первого вывода вдоль платы и деталей на рендере приблизительное.'
  ],
  specs: [['МК', 'Silicon Labs MGM240S (EFR32MG24, Cortex-M33)'], ['Протоколы', 'Matter, Thread, Bluetooth LE']]
}

// ---------- WeAct Studio RP2040 (форм-фактор Pico, USB-C) ----------
const weact: BoardEntry = {
  id: 'weact-rp2040', name: 'WeAct Studio RP2040', mcu: 'RP2040', platform: 'rp2040',
  pins: [
    ...[0, 1].map((n) => rpGp(n)), GND(), ...[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((n) => rpGp(n)),
    pw('VBUS', 'power', 'Плюс USB (5 В).'), pw('VSYS', 'power', 'Основное питание платы (на схеме производителя выведено отдельным выводом).'), pw('3V3', 'power', 'Выход 3.3 В.'),
    rpGp(24), pw('ADC_VREF', 'ref', 'Опорное напряжение АЦП (подпись на схеме производителя).'),
    rpGp(29, 'ADC3'), rpGp(28, 'ADC2'), rpGp(27, 'ADC1'), rpGp(26, 'ADC0'), rpGp(22), rpGp(21), rpGp(20), rpGp(19), rpGp(18), rpGp(17), rpGp(16)
  ],
  electrical: ELEC_3V3('См. даташит RP2040.', 'USB-C или вывод VSYS/VBUS'),
  notes: [
    'Порядок выводов и функции — схема «PINout.PNG» производителя (https://github.com/WeActStudio/WeActStudio.RP2040CoreBoard, каталог HDK): слева сверху вниз GP0, GP1, GND, GP2–GP5, GND, GP6–GP9, GND, GP10–GP13, GND, GP14, GP15; справа VBUS, VSYS, GND, 3V3, GP24, ADC_VREF, GP29, GND, GP28, GP27, GP26, GP22, GND, GP21–GP18, GND, GP17, GP16. Функции в колонке — все возможные для GPIO (таблица функций RP2040).',
    'Отличия от Raspberry Pi Pico на этой схеме: нет вывода RUN и 3V3_EN, выведены GP24 и GP29; светодиод пользователя — GP25, кнопка KEY — GP23, светодиод питания (PWR) — на 3V3; кнопки BOOTSEL и NRST (RUN) — на плате; контактные площадки DEBUG (GND, SWDIO, SWCLK, 3V3) снизу — на схему не включены. Объём flash — 2/4/8/16 МБ в зависимости от варианта.',
    'Размер 53 × 21.52 мм — по чертежу производителя; расстояние между рядами выводов (≈ 17.7 мм) снято по масштабу рисунка (на чертеже указано 14.9 мм между краями площадок) — не подтверждено. Положение деталей на рендере приблизительное.'
  ],
  specs: [['МК', 'RP2040'], ['Размер', '53 × 21.52 мм']]
}

export const moreBoards7: BoardEntry[] = [nodemcu32, c2, h2, nanoMatter, weact]

export const moreSources7: Record<string, string[]> = {
  'nodemcu-32s': ['https://cdn.zbotic.in/wp-content/uploads/2023/03/AI1670.pdf', 'https://docs.ai-thinker.com/en/esp32/boards/nodemcu_32s'],
  'esp8684-devkitm-1': ['https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32c2/esp8684-devkitm-1/user_guide.html'],
  'esp32-h2-devkitm-1': ['https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32h2/esp32-h2-devkitm-1/user_guide.html'],
  'weact-rp2040': ['https://github.com/WeActStudio/WeActStudio.RP2040CoreBoard', 'https://raw.githubusercontent.com/WeActStudio/WeActStudio.RP2040CoreBoard/master/HDK/PINout.PNG'],
  'nano-matter': ['https://docs.arduino.cc/hardware/nano-matter/', 'https://docs.arduino.cc/resources/pinouts/ABX00112-full-pinout.pdf']
}
