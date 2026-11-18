// Платы третьей волны, часть 2: Teensy 3.2 (PJRC) и Arduino Mini 05.
import type { BoardEntry, PinInfo } from '../types'
import { rp2040Boards, gp as rpGp } from './boardsMcu'

const pw = (label: string, kind: NonNullable<PinInfo['kind']>, notes: string): PinInfo => ({ label, gpio: null, functions: [], notes, kind })
const GND = (): PinInfo => pw('GND', 'gnd', 'Земля (общий провод).')
const dd = (n: number, functions: string[], notes?: string): PinInfo => ({ label: `D${n}`, gpio: n, functions: ['GPIO', ...functions], notes })

// ---------- Teensy 3.2 ----------
const teensy32: BoardEntry = {
  id: 'teensy-32', name: 'Teensy 3.2', mcu: 'MK20DX256', platform: 'teensy',
  pins: [
    pw('VIN', 'power', 'Вход 3.6–6.0 В (по карточке PJRC).'), pw('AGND', 'gnd', 'Аналоговая земля (подпись AGND на карточке).'), pw('3V3', 'power', 'Выход 3.3 В, до 250 мА (по карточке PJRC).'),
    dd(23, ['PWM', 'ADC9 (A9)', 'Touch'], 'Сенсорный'), dd(22, ['PWM', 'ADC8 (A8)', 'Touch']), dd(21, ['PWM', 'ADC7 (A7)', 'RX1 (альтернативный)', 'SPI CS (альтернативный)']),
    dd(20, ['PWM', 'ADC6 (A6)', 'SPI CS (альтернативный)']), dd(19, ['ADC5 (A5)', 'I2C SCL0', 'Touch']), dd(18, ['ADC4 (A4)', 'I2C SDA0', 'Touch']),
    dd(17, ['ADC3 (A3)', 'I2C SDA0 (альтернативный)', 'Touch']), dd(16, ['ADC2 (A2)', 'I2C SCL0 (альтернативный)', 'Touch']),
    dd(15, ['ADC1 (A1)', 'Touch', 'SPI CS (альтернативный)']), dd(14, ['ADC0 (A0)', 'SPI SCK (альтернативный)']), dd(13, ['SPI SCK', 'LED_BUILTIN']),
    dd(0, ['RX1', 'Touch']), dd(1, ['TX1', 'Touch']), dd(2, []), dd(3, ['PWM', 'CAN TX']), dd(4, ['PWM', 'CAN RX']), dd(5, ['PWM', 'TX1 (альтернативный)']),
    dd(6, ['PWM']), dd(7, ['RX3', 'SPI MOSI (альтернативный, DOUT)']), dd(8, ['TX3', 'SPI MISO (альтернативный, DIN)']), dd(9, ['PWM', 'RX2', 'SPI CS (альтернативный)']),
    dd(10, ['PWM', 'TX2', 'SPI CS']), dd(11, ['SPI MOSI (DOUT)']), dd(12, ['SPI MISO (DIN)']), GND()
  ],
  electrical: { logic: 'Логика 3.3 В (по карточке PJRC); допустимость 5 В на входах в карточке не указана.', current: 'Не подтверждено в этой сессии.', supply: 'Micro-USB 5 В или вывод VIN 3.6–6.0 В (по карточке PJRC)' },
  notes: [
    'Порядок выводов и функции — карточка распиновки PJRC (https://www.pjrc.com/teensy/card7a_rev3_web.pdf, прочитана увеличенно): верхний ряд от USB — VIN, AGND, 3.3V, 23…13; нижний — GND, 0…12. Серым на карточке показаны альтернативные функции (здесь с пометкой «альтернативный»). ШИМ: 3–6, 9, 10, 20–23 (по карточке; 25 и 32 — на нижних площадках, не показаны).',
    'Не показаны: площадки на нижней стороне и торце (A14/DAC, Program, GND, 3.3V, VBat и др.). Логика 3.3 В — по карточке PJRC; допустимость 5 В на входах в карточке не указана — «не подтверждено».',
    'Не подтверждено: габариты платы (на странице PJRC только рисунок; принято 1.4″ × 0.7″ = 35.56 × 17.78 мм); положение деталей на рендере приблизительное.'
  ],
  specs: [['МК', 'NXP MK20DX256 (Cortex-M4, 72 МГц)']]
}

// ---------- Arduino Mini 05 ----------
const mini: BoardEntry = {
  id: 'arduino-mini', name: 'Arduino Mini 05', mcu: 'ATmega328', platform: 'avr',
  pins: [
    { label: 'D1', gpio: 1, functions: ['GPIO', 'TX (Serial)'], notes: 'Подпись TX; занят при загрузке через USB-Serial адаптер', special: 'warning' },
    { label: 'D0', gpio: 0, functions: ['GPIO', 'RX (Serial)'], notes: 'Подпись RX', special: 'warning' },
    GND(), pw('NC', 'nc', 'Не подключён (подпись «n.c.» на схеме).'),
    dd(2, ['INT0']), dd(3, ['INT1', 'PWM']), dd(4, []), dd(5, ['PWM']), dd(6, ['PWM']), dd(7, []), dd(8, []), dd(9, ['PWM']),
    pw('9V', 'power', 'Вход питания (на схеме «+9V»): не подавать более 9 В и не путать полярность (предупреждение страницы Arduino).'),
    pw('RST', 'reset', 'Сброс.'), pw('5V', 'power', 'Выход 5 В либо вход стабилизированных 5 В.'),
    { label: 'A3', gpio: 17, functions: ['ADC3', 'GPIO'], notes: 'Подпись AD3' }, { label: 'A2', gpio: 16, functions: ['ADC2', 'GPIO'], notes: 'Подпись AD2' },
    { label: 'A1', gpio: 15, functions: ['ADC1', 'GPIO'], notes: 'Подпись AD1' }, { label: 'A0', gpio: 14, functions: ['ADC0', 'GPIO'], notes: 'Подпись AD0' },
    dd(13, ['SPI SCK', 'LED_BUILTIN']), dd(12, ['SPI MISO']), dd(11, ['PWM', 'SPI MOSI']), dd(10, ['PWM', 'SPI SS'])
  ],
  electrical: { logic: 'На странице Arduino не указана (кварц 16 МГц; для ATmega328 при питании 5 В — типично 5 В).', current: 'Даташит ATmega328: рекомендуется ≤ 20 мА, максимум 40 мА с вывода.', supply: 'Вывод +9V (не более 9 В) или 5V' },
  notes: [
    'Порядок выводов — официальный рисунок Arduino Mini (https://docs.arduino.cc/retired/boards/arduino-mini-05/, снято из веб-архива): слева сверху вниз TX, RX, GND, n.c., 2…9; справа +9V, GND, RESET, +5V, AD3…AD0, 13…10. Страница: 14 цифровых выводов (6 с ШИМ), 8 аналоговых входов, кварц 16 МГц.',
    'Не показаны: шестиконтактная программирующая колодка вверху (подписи TX, RX, +5V, GND и ещё один вывод, подписанный на рисунке «IO7» — назначение не подтверждено) и контактные площадки AD4–AD7, +5V, GND внизу. Какие выводы с ШИМ — по стандартной раскладке ATmega328 (D3, D5, D6, D9, D10, D11), на странице перечислены только «6».',
    'Нет USB: для загрузки нужен USB-Serial переходник. Не подтверждено: габариты платы (по масштабу рисунка ≈ 19 × 32 мм) и положение деталей на рендере.'
  ],
  specs: [['МК', 'ATmega328 (16 МГц)']]
}

// ---------- Raspberry Pi Pico 2 W: выводы те же, что у Pico 2 (datasheet Pico 2 W, разд. 2.1) ----------
const pico2 = rp2040Boards.find((b) => b.id === 'rpi-pico-2')!
const pico2w: BoardEntry = {
  ...pico2,
  id: 'rpi-pico-2-w', name: 'Raspberry Pi Pico 2 W (RP2350 + CYW43439)',
  notes: [
    'Основные 40 выводов — те же, что у Pico 2 (даташит Pico 2 W, разд. 2.1: https://datasheets.raspberrypi.com/picow/pico-2-w-datasheet.pdf). Плата 51 × 21 × 1 мм, micro-USB выступает над верхним краем, антенна на нижнем.',
    'Внутренние функции GPIO по даташиту: GPIO29 — SPI CLK беспроводного модуля / АЦП VSYS/3, GPIO25 — CS модуля, GPIO24 — данные/IRQ, GPIO23 — включение питания модуля; на гребёнки они не выведены. Светодиод платы подключён к WL_GPIO0 модуля CYW43439 (не к GPIO RP2350): в скетче через LED_BUILTIN ядра. WL_GPIO1 управляет режимом экономии SMPS, WL_GPIO2 — датчик VBUS.',
    'Контрольные точки TP1–TP6 (USB DM/DP, BOOTSEL и др.) на схему не включены. Положение деталей на рендере приблизительное (рисунок плат Pico — по габаритам даташита).'
  ],
  source: undefined
}

// ---------- Waveshare RP2040-Zero ----------
const WS_FORM = 'Размер 18 × 23.5 мм, зубчатые площадки по краю с шагом 2.54 мм, первый вывод на 1.59 мм от верхнего края — по чертежу производителя (wiki.waveshare.com). USB-C сверху; положение деталей на рендере приблизительное.'
const wsRp: BoardEntry = {
  id: 'waveshare-rp2040-zero', name: 'Waveshare RP2040-Zero', mcu: 'RP2040', platform: 'rp2040',
  pins: [
    pw('5V', 'power', 'Вход/выход 5 В (VBUS/VSYS).'), GND(), pw('3V3', 'power', 'Выход 3.3 В (вывод 3V3).'),
    rpGp(29, 'ADC3'), rpGp(28, 'ADC2'), rpGp(27, 'ADC1'), rpGp(26, 'ADC0'), rpGp(15), rpGp(14),
    ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => rpGp(n)), ...[13, 12, 11, 10, 9].map((n) => rpGp(n))
  ],
  electrical: { logic: 'Логика 3.3 В; пины не 5V-tolerant.', current: 'См. даташит RP2040.', supply: 'USB-C или вывод 5V' },
  notes: [
    'Порядок выводов и имена — картинка пинаута https://www.waveshare.com/wiki/RP2040-Zero (слева сверху вниз 5V, GND, 3V3, GP29, GP28, GP27, GP26, GP15, GP14; справа GP0–GP8; снизу слева направо GP13, GP12, GP11, GP10, GP9). Функции в колонке — все возможные для GPIO (таблица функций RP2040).',
    'Не показано: контактные площадки на обратной стороне (GP16–GP25 и GND; GP16 подключён к RGB-светодиоду WS2812, вывод DIN) и кнопки BOOT и RESET — по схеме производителя.',
    WS_FORM
  ],
  specs: [['Размер', '18 × 23.5 мм']]
}

// ---------- Waveshare ESP32-S3-Zero ----------
const wg = (n: number, f: string[], notes?: string, sp?: PinInfo['special']): PinInfo => ({ label: `GPIO${n}`, gpio: n, functions: f, notes, special: sp })
const wsS3: BoardEntry = {
  id: 'waveshare-esp32-s3-zero', name: 'Waveshare ESP32-S3-Zero', mcu: 'ESP32-S3', platform: 'esp32s3',
  pins: [
    pw('5V', 'power', 'Вход 5 В (по странице Waveshare — диапазон 3.7–6 В на отверстиях 5V).'), GND(), pw('3V3', 'power', 'Выход 3.3 В (на схеме 3V3(OUT)).'),
    wg(1, ['ADC1_0', 'Touch1']), wg(2, ['ADC1_1', 'Touch2']), wg(3, ['ADC1_2', 'Touch3'], 'Strapping', 'strapping'), wg(4, ['ADC1_3', 'Touch4']), wg(5, ['ADC1_4', 'Touch5']), wg(6, ['ADC1_5', 'Touch6']),
    { label: 'TX', gpio: 43, functions: ['TX0 (UART0)'], notes: 'GPIO43' }, { label: 'RX', gpio: 44, functions: ['RX0 (UART0)'], notes: 'GPIO44' },
    wg(13, ['ADC2_2', 'Touch13']), wg(12, ['ADC2_1', 'Touch12']), wg(11, ['ADC2_0', 'Touch11']), wg(10, ['ADC1_9', 'Touch10']), wg(9, ['ADC1_8', 'Touch9']), wg(8, ['ADC1_7', 'Touch8']), wg(7, ['ADC1_6', 'Touch7'])
  ],
  electrical: { logic: 'Логика 3.3 В; пины не 5V-tolerant.', current: 'См. даташит ESP32-S3.', supply: 'USB-C или вывод 5V (3.7–6 В по странице Waveshare)' },
  notes: [
    'Порядок выводов и имена — картинка пинаута https://www.waveshare.com/wiki/ESP32-S3-Zero (слева сверху вниз 5V, GND, 3V3, GP1–GP6; справа TX, RX, GP13…GP7). Подписи TX/RX — UART0 (GPIO43/44). ADC/Touch у GPIO — по таблице ESP32-S3 (на картинке Waveshare показаны возможности ADC/I2C/SPI/I2S/PWM).',
    'Не показано: контактные площадки GP14–GP16 (круглые, шаг около 1.5 мм) и GP17, GP18, GP38–GP42, GP45 на обратной стороне; светодиод WS2812 — GPIO21, кнопка BOOT — GPIO0. GPIO33–GPIO37 не выведены (заняты octal PSRAM) — по странице Waveshare.',
    WS_FORM
  ],
  specs: [['Размер', '18 × 23.5 мм']]
}

export const moreBoards5: BoardEntry[] = [teensy32, mini, pico2w, wsRp, wsS3]

export const moreSources5: Record<string, string[]> = {
  'teensy-32': ['https://www.pjrc.com/teensy/pinout.html', 'https://www.pjrc.com/teensy/card7a_rev3_web.pdf'],
  'rpi-pico-2-w': ['https://datasheets.raspberrypi.com/picow/pico-2-w-datasheet.pdf', 'https://datasheets.raspberrypi.com/rp2350/rp2350-datasheet.pdf'],
  'waveshare-rp2040-zero': ['https://www.waveshare.com/wiki/RP2040-Zero', 'https://www.waveshare.com/w/upload/thumb/1/1f/900px-RP2040-Zero-details-7.jpg/800px-900px-RP2040-Zero-details-7.jpg'],
  'waveshare-esp32-s3-zero': ['https://www.waveshare.com/wiki/ESP32-S3-Zero', 'https://www.waveshare.com/w/upload/thumb/8/87/ESP32-S3-Zero-details-inter.jpg/600px-ESP32-S3-Zero-details-inter.jpg'],
  'arduino-mini': ['https://docs.arduino.cc/retired/boards/arduino-mini-05/', 'https://docs.arduino.cc/static/d6102dbba18088c5985c5d0508c420e2/cd13f/arduino_mini_pinout.png']
}
