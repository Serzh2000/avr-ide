// Платы третьей волны: Arduino Uno R4, Nano RP2040 Connect, MKR WiFi 1010, Seeed XIAO nRF52840 / ESP32C6, Adafruit ItsyBitsy RP2040 и QT Py RP2040.
// Данные — только из первоисточников, прочитанных при добавлении (официальные схемы распиновки производителей), см. moreSources4 и notes каждой платы.
import type { BoardEntry, PinInfo } from '../types'
import { gp as rpGp } from './boardsMcu'

const pw = (label: string, kind: NonNullable<PinInfo['kind']>, notes: string): PinInfo => ({ label, gpio: null, functions: [], notes, kind })
const GND = (): PinInfo => pw('GND', 'gnd', 'Земля (общий провод).')
const V33 = (n = 'Выход 3.3 В.'): PinInfo => pw('3V3', 'power', n)
const dpin = (n: number, port: string, functions: string[] = [], notes = ''): PinInfo =>
  ({ label: `D${n}`, gpio: n, functions: ['GPIO', ...functions], notes: `Порт ${port}${notes ? '. ' + notes : ''}` })
const apin = (a: number, n: number, port: string, functions: string[] = [], notes = ''): PinInfo =>
  ({ label: `A${a}`, gpio: n, functions: [`ADC${a}`, ...functions, 'GPIO'], notes: `Порт ${port} (D${n})${notes ? '. ' + notes : ''}` })
const gi = (n: number, functions: string[], notes?: string, special?: PinInfo['special'], label = `GPIO${n}`): PinInfo =>
  ({ label, gpio: n, functions, notes, special })
const ELEC_3V3 = (cur: string, supply: string) => ({ logic: 'Логика 3.3 В; пины не 5V-tolerant.', current: cur, supply })
const PIN_PDF = 'Порядок выводов и функции — официальная схема распиновки Arduino (PDF, CC BY-SA 4.0).'
const UNO_FORM = 'Формат Uno: сверху SCL, SDA, AREF, GND, D13…D0, внизу BOOT, IOREF, RESET, 3V3, 5V, GND, GND, VIN и A0–A5. Габариты и разъёмы приняты по формату Uno (68.6 × 53.3 мм) — на странице Arduino не проверялись; положение деталей на рендере приблизительное.'

// ---------- Arduino Uno R4 Minima / WiFi ----------
const unoR4Common = (wifi: boolean): PinInfo[] => {
  const m = wifi
    ? { 13: ['P102', 'RSPCKA'], 12: ['P410', 'CIPOA'], 11: ['P411', 'COPIA'], 10: ['P103', 'SSLA0'], 9: ['P303', ''], 8: ['P304', ''], 7: ['P112', ''], 6: ['P111', ''], 5: ['P107', ''], 4: ['P106', ''], 3: ['P105', ''], 2: ['P104', ''] }
    : { 13: ['P111', 'RSPCKB'], 12: ['P110', 'CIPOB'], 11: ['P109', 'COPIB'], 10: ['P112', 'SSLB0'], 9: ['P303', ''], 8: ['P304', ''], 7: ['P107', ''], 6: ['P106', ''], 5: ['P102', ''], 4: ['P103', ''], 3: ['P104', ''], 2: ['P105', ''] }
  const pwm = new Set([11, 10, 9, 6, 5, 3])
  const spi: Record<number, string> = { 13: 'SPI SCK', 12: 'SPI MISO (CIPO)', 11: 'SPI MOSI (COPI)', 10: 'SPI SS' }
  const out: PinInfo[] = [
    { label: 'SCL', gpio: null, functions: ['I2C SCL (IIC_SCL1)'], notes: `Порт P100; это те же линии, что A5 и D19 (на плате выведены отдельно у AREF); одновременно используется только одна периферия` },
    { label: 'SDA', gpio: null, functions: ['I2C SDA (IIC_SDA1)'], notes: `Порт P101; это те же линии, что A4 и D18` },
    pw('AREF', 'ref', 'Опорное напряжение АЦП.'), GND()
  ]
  for (let n = 13; n >= 2; n--) {
    const [port] = m[n as keyof typeof m]
    out.push(dpin(n, port, [...(pwm.has(n) ? ['PWM'] : []), ...(spi[n] ? [spi[n]] : []), ...(n === 13 ? ['LED_BUILTIN'] : [])]))
  }
  out.push(
    dpin(1, 'P302', ['TX (Serial1, SCI_TXD2)'], 'D1/TX'), dpin(0, 'P301', ['RX (Serial1, SCI_RXD2)'], 'D0/RX'),
    pw('BOOT', 'reset', 'Служебный вывод BOOT (первый на колодке питания, на месте NC у Uno) — по схеме Arduino; назначение подробно не описано.'),
    pw('IOREF', 'ref', 'Напряжение логики платы — шилды по нему выбирают уровни (по схеме Arduino рядом с RESET).'),
    pw('RESET', 'reset', 'Сброс.'), pw('3V3', 'power', 'Выход 3.3 В.'), pw('5V', 'power', 'Выход 5 В (USB/стабилизатор); на схеме Arduino помечен как выход.'),
    pw('VIN', 'power', 'Вход внешнего питания (по схеме Arduino).'),
    apin(0, 14, 'P014', wifi ? ['DAC0'] : []), apin(1, 15, 'P000'), apin(2, 16, 'P001'), apin(3, 17, 'P002'),
    apin(4, 18, 'P101', ['I2C SDA'], 'Те же линии, что SDA'), apin(5, 19, 'P100', ['I2C SCL'], 'Те же линии, что SCL')
  )
  const gnd = out.find((p) => p.label === 'GND')
  void gnd
  return out
}
const unoR4Minima: BoardEntry = {
  id: 'uno-r4-minima', name: 'Arduino Uno R4 Minima', mcu: 'R7FA4M1AB3CFM', platform: 'renesas', numLabel: 'Пин Arduino №',
  pins: unoR4Common(false),
  electrical: { logic: 'Не указана в схеме распиновки (см. документацию Uno R4).', current: 'Схема Arduino: не более 8 мА с вывода и 60 мА суммарно.', supply: 'USB-C или гнездо DC (VIN)' },
  notes: [
    PIN_PDF + ' ШИМ (тильда на схеме): D3, D5, D6, D9, D10, D11. I2C: SDA — A4/D18, SCL — A5/D19; SPI: SCK D13 (RSPCKB), CIPO D12, COPI D11, SS D10; UART: TX D1, RX D0. Светодиоды: LED_BUILTIN P111 (D13), TX P012, RX P013 — на колодки не выведены.',
    'Не подтверждено: логический уровень выводов — в схеме Arduino указаны только максимальные токи (8 мА на вывод, 60 мА суммарно); сверьте с документацией Uno R4.',
    UNO_FORM
  ],
  specs: [['МК', 'Renesas RA4M1 (Cortex-M4)'], ['Формат', 'Uno']]
}
const unoR4Wifi: BoardEntry = {
  id: 'uno-r4-wifi', name: 'Arduino Uno R4 WiFi', mcu: 'R7FA4M1AB3CFM + ESP32-S3', platform: 'renesas', numLabel: 'Пин Arduino №',
  pins: unoR4Common(true),
  electrical: { logic: 'Для штатных колодок в схеме не указана (см. документацию Uno R4 WiFi); шестиконтактная колодка ESP — 3.3 В, не 5 В.', current: 'В схеме Arduino для этой платы ток вывода не указан — см. документацию.', supply: 'USB-C или гнездо DC (VIN)' },
  notes: [
    PIN_PDF + ' ШИМ (тильда на схеме): D3, D5, D6, D9, D10, D11. A0 — также ЦАП (DA0). SPI: SCK D13 (RSPCKA), CIPO D12, COPI D11, SS D10. LED_BUILTIN P102 (= D13).',
    'Не выведено на колодки Uno и не показано: шестиконтактная колодка ESP32-S3 (GPIO42, GPIO41, GPIO43/TXD0, GPIO0/DOWNLOAD, GPIO44/RXD0, GND — 3.3 В, не 5 В), разъём Qwiic (IIC0_SCL P400, IIC0_SDA P401, только 3.3 В), питание батареи RTC (VRTC), светодиодная матрица 12×8, светодиоды TX P109 / RX GPIO43.',
    'Не подтверждено: логический уровень штатных выводов и габариты.',
    UNO_FORM
  ],
  specs: [['МК', 'Renesas RA4M1 (Cortex-M4)'], ['Радио', 'ESP32-S3-MINI-1 (Wi-Fi/BLE)'], ['Формат', 'Uno']]
}

// ---------- Arduino Nano RP2040 Connect ----------
const nr = (label: string, n: number | null, gpio: string, functions: string[] = [], notes = ''): PinInfo =>
  ({ label, gpio: n, functions: ['GPIO', ...functions], notes: `${gpio}${notes ? '. ' + notes : ''}` })
const nanoRp: BoardEntry = {
  id: 'nano-rp2040-connect', name: 'Arduino Nano RP2040 Connect', mcu: 'RP2040', platform: 'rp2040', numLabel: 'Пин Arduino №',
  pins: [
    nr('D13', 13, 'GPIO6', ['SPI SCK', 'LED_BUILTIN']), V33('Выход 3.3 В.'), pw('AREF', 'ref', 'Опорное напряжение АЦП (на схеме подписано PA03).'),
    nr('A0', 14, 'GPIO26', ['ADC0']), nr('A1', 15, 'GPIO27', ['ADC1']), nr('A2', 16, 'GPIO28', ['ADC2']), nr('A3', 17, 'GPIO29', ['ADC3']),
    nr('A4', 18, 'GPIO12', ['I2C SDA'], 'A4/SDA'), nr('A5', 19, 'GPIO13', ['I2C SCL'], 'A5/SCL'),
    nr('A6', 20, 'без номера GPIO в схеме', ['ADC'], 'Аналоговый вход A6 (D20) — номер GPIO RP2040 на схеме Arduino не указан'),
    nr('A7', 21, 'без номера GPIO в схеме', ['ADC'], 'Аналоговый вход A7 (D21) — номер GPIO RP2040 на схеме Arduino не указан'),
    pw('5V', 'power', 'Выход 5 В (USB) либо вход.'), pw('REC', 'reset', 'Вывод REC (QSPI_CSn): замыкание на землю при подаче питания переводит в режим восстановления загрузчика (по схеме Arduino).'),
    GND(), pw('VIN', 'power', 'Вход внешнего питания.'),
    nr('D12', 12, 'GPIO4', ['SPI MISO (CIPO)']), nr('D11', 11, 'GPIO7', ['SPI MOSI (COPI)']), nr('D10', 10, 'GPIO5'), nr('D9', 9, 'GPIO21'),
    nr('D8', 8, 'GPIO20'), nr('D7', 7, 'GPIO19'), nr('D6', 6, 'GPIO18'), nr('D5', 5, 'GPIO17'), nr('D4', 4, 'GPIO16'), nr('D3', 3, 'GPIO15'), nr('D2', 2, 'GPIO25'),
    pw('RST', 'reset', 'Сброс.'),
    nr('RX', 0, 'GPIO1', ['RX (Serial1)'], 'D0/RX'), nr('TX', 1, 'GPIO0', ['TX (Serial1)'], 'D1/TX')
  ],
  electrical: { logic: 'Логика 3.3 В; пины не 5V-tolerant.', current: 'Схема Arduino: суммарно не более 50 мА для всех GPIO и QSPI; максимальное напряжение питания ввода-вывода 3.63 В, на входе GPIO — 3.3 В.', supply: 'Micro-USB или VIN' },
  notes: [
    PIN_PDF + ' Номера GPIO у каждого вывода — в заметках; колонка «Пин Arduino №» — D-номера схемы (A0 = D14 … A7 = D21). Радиомодуль u-blox NINA-W102 (Wi-Fi/BLE) и IMU/микрофон подключены внутри платы.',
    'Не подтверждено: на схеме A6/A7 без номеров GPIO RP2040; AREF подписан PA03 (имя порта другого семейства МК) — назначение не уточнено в источнике.',
    'Форм-фактор Nano: 45 × 18 мм, два ряда по 15 выводов, шаг 2.54 мм, ряды через 15.24 мм. Положение первого вывода вдоль платы и тип USB на рендере приблизительные.'
  ],
  specs: [['МК', 'RP2040 (Cortex-M0+)'], ['Радио', 'u-blox NINA-W102']]
}

// ---------- Arduino MKR WiFi 1010 ----------
const mk = (label: string, n: number, port: string, functions: string[] = [], notes = ''): PinInfo =>
  ({ label, gpio: n, functions: ['GPIO', ...functions], notes: `Порт ${port}${notes ? '. ' + notes : ''}` })
const mkrWifi: BoardEntry = {
  id: 'mkr-wifi-1010', name: 'Arduino MKR WiFi 1010', mcu: 'SAMD21G18A', platform: 'samd', numLabel: 'Пин Arduino №',
  pins: [
    pw('AREF', 'ref', 'Опорное напряжение АЦП, порт PA03.'),
    mk('A0', 15, 'PA02', ['ADC0', 'DAC0'], 'D15, AIN0'), mk('A1', 16, 'PB02', ['ADC1'], 'D16, AIN10'), mk('A2', 17, 'PB03', ['ADC2'], 'D17, AIN11'),
    mk('A3', 18, 'PA04', ['ADC3', 'PWM'], 'D18, AIN4'), mk('A4', 19, 'PA05', ['ADC4', 'PWM'], 'D19, AIN5'), mk('A5', 20, 'PA06', ['ADC5'], 'D20, AIN6'), mk('A6', 21, 'PA07', ['ADC6'], 'D21, AIN7'),
    mk('D0', 0, 'PA22', ['PWM']), mk('D1', 1, 'PA23', ['PWM']), mk('D2', 2, 'PA10', ['PWM']), mk('D3', 3, 'PA11', ['PWM']), mk('D4', 4, 'PB10', ['PWM']), mk('D5', 5, 'PB11', ['PWM']),
    pw('5V', 'power', 'Выход 5 В (USB) либо вход.'), pw('VIN', 'power', 'Вход внешнего питания (по схеме Arduino).'), V33(), GND(), pw('RST', 'reset', 'Сброс.'),
    mk('D14', 14, 'PB22', ['TX (Serial1, SC5)'], 'D14/TX'), mk('D13', 13, 'PB23', ['RX (Serial1, SC5)'], 'D13/RX'),
    mk('D12', 12, 'PA09', ['PWM', 'I2C SCL (SC2)']), mk('D11', 11, 'PA08', ['I2C SDA (SC2)']),
    mk('D10', 10, 'PA19', ['PWM', 'SPI MISO (CIPO, SC1)']), mk('D9', 9, 'PA17', ['SPI SCK (SC1)']), mk('D8', 8, 'PA16', ['PWM', 'SPI MOSI (COPI, SC1)']),
    mk('D7', 7, 'PA21', ['PWM']), mk('D6', 6, 'PA20', ['PWM'])
  ],
  electrical: ELEC_3V3('Схема Arduino: не более 7 мА с вывода; 46 мА источник и 65 мА сток на группу выводов.', 'Micro-USB, VIN или аккумулятор Li-Po 3.7 В (JST)'),
  notes: [
    PIN_PDF + ' Левый ряд сверху вниз: AREF, A0–A6, D0–D5; правый: 5V, VIN, 3V3, GND, RESET, D14–D6. ШИМ (тильда на схеме): D0–D5, D6, D7, D8, D10, D12, A3 (D18), A4 (D19).',
    'Светодиод LED_BUILTIN на схеме показан отдельно от колодок. Не выведено в основные ряды: пятиконтактная колодка вверху справа (GND, PA08/SDA, PA09/SCL, PA21/WK, +5V) и разъём батареи Li-Po — по схеме Arduino.',
    'Радиомодуль u-blox NINA-W102 (Wi-Fi/BLE) и криптомикросхема подключены внутри платы. Размеры 61.5 × 25 мм и шаг 2.54 мм — по масштабу схемы Arduino (в документации не проверялись); ряды выводов через 0.8″ (20.32 мм).'
  ],
  specs: [['МК', 'SAMD21G18A (Cortex-M0+)'], ['Радио', 'u-blox NINA-W102']]
}

// ---------- Seeed XIAO nRF52840 ----------
const XIAO_FORM = 'Размер 21 × 17.8 мм (Seeed). Выводы — зубчатые площадки по краю платы, шаг 2.54 мм; USB-C сверху. Порядок: слева D0–D6, справа 5V, GND, 3V3, D10–D7 (официальная схема распиновки Seeed). Контактные площадки на обратной стороне на схему не включены; положение деталей на рендере приблизительное.'
const xiaoPower = (): PinInfo[] => [pw('5V', 'power', 'Вывод VBUS: 5 В от USB; как вход питания — только через диод (Seeed).'), GND(), V33('Выход 3.3 В стабилизатора платы.')]
const xn = (d: number, port: string, functions: string[] = [], notes = ''): PinInfo =>
  ({ label: `D${d}`, gpio: d, functions: ['GPIO', ...functions], notes: `Порт ${port}${notes ? '. ' + notes : ''}` })
const xiaoNrf: BoardEntry = {
  id: 'xiao-nrf52840', name: 'Seeed XIAO nRF52840', mcu: 'nRF52840', platform: 'nrf52', numLabel: 'Пин Arduino №',
  pins: [
    xn(0, 'P0.02', ['ADC0 (A0)']), xn(1, 'P0.03', ['ADC1 (A1)']), xn(2, 'P0.28', ['ADC2 (A2)'], 'AIN4'), xn(3, 'P0.29', ['ADC3 (A3)'], 'AIN5'),
    xn(4, 'P0.04', ['ADC4 (A4)', 'I2C SDA'], 'AIN2'), xn(5, 'P0.05', ['ADC5 (A5)', 'I2C SCL'], 'AIN3'),
    xn(6, 'P1.11', ['UART TX']), xn(7, 'P1.12', ['UART RX']), xn(8, 'P1.13', ['SPI SCK']), xn(9, 'P1.14', ['SPI MISO']), xn(10, 'P1.15', ['SPI MOSI']),
    ...xiaoPower()
  ],
  electrical: ELEC_3V3('См. даташит nRF52840.', 'USB-C или вывод 5V'),
  notes: [
    'Соответствие D0–D10 и портов — таблица и схема распиновки на wiki.seeedstudio.com/XIAO_BLE. Нумерация D в ядре Arduino зависит от пакета платы (на схеме Seeed показано «Mbed / не-Mbed», например D6 = 7 / 6): здесь указан номер D из таблицы Seeed.',
    'Внутри платы: RGB-светодиод (P0.26 красный, P0.30 зелёный, P0.06 синий), светодиод зарядки P0.17, кнопка RESET (P0.18) — на гребёнку не выведены. Плюс контактные площадки NFC и батареи на обратной стороне; варианты Sense/Plus — другие модели, не включены.',
    XIAO_FORM
  ],
  specs: [['МК', 'Nordic nRF52840 (Cortex-M4F)'], ['Размер', '21 × 17.8 мм']]
}

// ---------- Seeed XIAO ESP32C6 ----------
const xiaoC6: BoardEntry = {
  id: 'xiao-esp32c6', name: 'Seeed XIAO ESP32C6', mcu: 'ESP32-C6', platform: 'esp32c6',
  pins: [
    { ...gi(0, ['ADC1_0 (A0)', 'LP_GPIO0']), label: 'D0' }, { ...gi(1, ['ADC1_1 (A1)', 'LP_GPIO1']), label: 'D1' }, { ...gi(2, ['ADC1_2 (A2)', 'LP_GPIO2']), label: 'D2' },
    { ...gi(21, ['SDIO_DATA1']), label: 'D3' }, { ...gi(22, ['I2C SDA', 'SDIO_DATA2']), label: 'D4' }, { ...gi(23, ['I2C SCL', 'SDIO_DATA3']), label: 'D5' },
    { ...gi(16, ['UART TX (U0TXD)']), label: 'D6' }, { ...gi(17, ['UART RX (U0RXD)']), label: 'D7' },
    { ...gi(19, ['SPI SCK']), label: 'D8' }, { ...gi(20, ['SPI MISO']), label: 'D9' }, { ...gi(18, ['SPI MOSI']), label: 'D10' },
    ...xiaoPower()
  ],
  electrical: ELEC_3V3('См. даташит ESP32-C6.', 'USB-C или вывод 5V'),
  notes: [
    'Соответствие D0–D10 и GPIO — таблица и схема распиновки на wiki.seeedstudio.com. Не выведено на гребёнку: кнопка BOOT (GPIO9), пользовательский светодиод (GPIO15), RESET (CHIP_EN), светодиод зарядки; переключение антенны (RF logic): GPIO3 — низкий уровень включает, GPIO14 — низкий внутренняя / высокий внешняя антенна (по схеме Seeed).',
    XIAO_FORM
  ],
  specs: [['Размер', '21 × 17.8 мм']]
}

// ---------- Adafruit ItsyBitsy RP2040 ----------
const fr = (name: string, n: number, notes?: string): PinInfo => ({ ...rpGp(n, notes), label: name })
const itsyRp: BoardEntry = {
  id: 'itsybitsy-rp2040', name: 'Adafruit ItsyBitsy RP2040', mcu: 'RP2040', platform: 'rp2040',
  pins: [
    pw('RESET', 'reset', 'Сброс.'), V33('Выход 3.3 В (выведен на двух контактах).'), pw('VHI', 'power', 'Вывод VHI (подпись на плате «VHI») — по схеме Adafruit; назначение в схеме не расшифровано.'),
    fr('A0', 26, 'ADC0'), fr('A1', 27, 'ADC1'), fr('A2', 28, 'ADC2'), fr('A3', 29, 'ADC3'),
    fr('D24', 24), fr('D25', 25), fr('SCK', 18, 'SPI0 SCK по схеме Adafruit'), fr('MOSI', 19, 'SPI0 MOSI по схеме Adafruit'), fr('MISO', 20, 'SPI0 MISO по схеме Adafruit'), fr('D2', 12),
    pw('VBAT', 'power', 'Плюс аккумулятора (JST LiPo).'), GND(), pw('VBUS', 'power', 'Плюс USB (5 В).'),
    fr('D13', 11, 'Красный светодиод платы'), fr('D12', 10), fr('D11', 9), fr('D10', 8), fr('D9', 7), fr('D7', 6),
    fr('D5', 14, 'Только выход, уровень сдвинут до 5 В (для NeoPixel и т. п.) — по схеме Adafruit'),
    fr('SCL', 3, 'I2C1 SCL по схеме Adafruit'), fr('SDA', 2, 'I2C1 SDA по схеме Adafruit'), fr('TX', 0, 'UART0 TX по схеме Adafruit'), fr('RX', 1, 'UART0 RX по схеме Adafruit')
  ],
  electrical: ELEC_3V3('См. даташит RP2040.', 'USB-C, LiPo (JST) или VBAT/VBUS'),
  notes: [
    'Порядок выводов (USB-C сверху) и функции — официальная схема распиновки Adafruit (PDF в репозитории adafruit/Adafruit-ItsyBitsy-RP2040-PCB). Слева: RESET, 3.3V, 3.3V, VHI, A0–A3, D24, D25, SCK, MOSI, MISO, D2; справа: VBAT, GND, VBUS, D13, D12, D11, D10, D9, D7, D5, SCL, SDA, TX, RX.',
    'Не показано: нижние контактные площадки — D4 (GPIO4), D3 (GPIO5), EN, SWDIO, SWCLK; кнопка BUTTON (GPIO13), NeoPixel (GPIO17, питание GPIO16).',
    'Не подтверждено: габариты (36 × 18 мм) и ряды 12.7 мм — по масштабу схемы Adafruit; положение деталей на рендере приблизительное.'
  ],
  specs: [['МК', 'RP2040 (Cortex-M0+)']]
}

// ---------- Adafruit QT Py RP2040 ----------
const qtpy: BoardEntry = {
  id: 'qtpy-rp2040', name: 'Adafruit QT Py RP2040', mcu: 'RP2040', platform: 'rp2040',
  pins: [
    fr('A0', 29, 'ADC3'), fr('A1', 28, 'ADC2'), fr('A2', 27, 'ADC1'), fr('A3', 26, 'ADC0'), fr('SDA', 24), fr('SCL', 25), fr('TX', 20),
    pw('5V', 'power', 'Вывод 5 В (USB/внешний).'), GND(), V33('Выход 3.3 В.'),
    fr('MOSI', 3, 'SPI0 MOSI по схеме Adafruit'), fr('MISO', 4, 'SPI0 MISO по схеме Adafruit'), fr('SCK', 6, 'SPI0 SCK по схеме Adafruit'), fr('RX', 5)
  ],
  electrical: ELEC_3V3('См. даташит RP2040.', 'USB-C или вывод 5V'),
  notes: [
    'Порядок выводов (USB-C сверху) и функции — официальная схема распиновки Adafruit (PDF в репозитории adafruit/Adafruit-QT-Py-RP2040-PCB): слева A0–A3, SDA, SCL, TX; справа 5V, GND, 3.3V, MOSI, MISO, SCK, RX. Имена SDA/SCL/TX/RX на плате — не аппаратные: SDA = GPIO24, SCL = GPIO25, TX = GPIO20, RX = GPIO5.',
    'Не выведено на ряды: разъём STEMMA QT (SDA1 = GPIO22, SCL1 = GPIO23, 3.3 В), NeoPixel (GPIO12, питание GPIO11), кнопка BOOT (GPIO21).',
    'Не подтверждено: габариты платы (принят форм-фактор XIAO 21 × 17.8 мм) и положение выводов вдоль платы; деталей на рендере приблизительные.'
  ],
  specs: [['МК', 'RP2040 (Cortex-M0+)']]
}

export const moreBoards4: BoardEntry[] = [unoR4Minima, unoR4Wifi, nanoRp, mkrWifi, xiaoNrf, xiaoC6, itsyRp, qtpy]

export const moreSources4: Record<string, string[]> = {
  'uno-r4-minima': ['https://docs.arduino.cc/hardware/uno-r4-minima/', 'https://docs.arduino.cc/resources/pinouts/ABX00080-full-pinout.pdf'],
  'uno-r4-wifi': ['https://docs.arduino.cc/hardware/uno-r4-wifi/', 'https://docs.arduino.cc/resources/pinouts/ABX00087-full-pinout.pdf'],
  'nano-rp2040-connect': ['https://docs.arduino.cc/hardware/nano-rp2040-connect/', 'https://docs.arduino.cc/resources/pinouts/ABX00053-full-pinout.pdf'],
  'mkr-wifi-1010': ['https://docs.arduino.cc/hardware/mkr-wifi-1010/', 'https://docs.arduino.cc/resources/pinouts/ABX00023-full-pinout.pdf'],
  'xiao-nrf52840': ['https://wiki.seeedstudio.com/XIAO_BLE/', 'https://files.seeedstudio.com/wiki/XIAO-BLE/XIAO_nRF52840_front_pinout.png'],
  'xiao-esp32c6': ['https://wiki.seeedstudio.com/xiao_esp32c6_getting_started/', 'https://files.seeedstudio.com/wiki/SeeedStudio-XIAO-ESP32C6/img/XIAO_ESP32-C6_front_pinout.png'],
  'itsybitsy-rp2040': ['https://github.com/adafruit/Adafruit-ItsyBitsy-RP2040-PCB', 'https://www.adafruit.com/product/4888'],
  'qtpy-rp2040': ['https://github.com/adafruit/Adafruit-QT-Py-RP2040-PCB', 'https://www.adafruit.com/product/4900']
}
