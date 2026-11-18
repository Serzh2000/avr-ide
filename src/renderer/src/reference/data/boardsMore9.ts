// Платы пятой волны, часть 2: LILYGO T-Display-S3 и Heltec Wireless Stick Lite V3 (ESP32-S3).
import type { BoardEntry, PinInfo } from '../types'

const pw = (label: string, kind: NonNullable<PinInfo['kind']>, notes: string): PinInfo => ({ label, gpio: null, functions: [], notes, kind })
const GND = (): PinInfo => pw('GND', 'gnd', 'Земля (общий провод).')
const gi = (n: number, functions: string[], notes?: string, special?: PinInfo['special'], label = `GPIO${n}`): PinInfo =>
  ({ label, gpio: n, functions, notes, special })
const ELEC_3V3 = (cur: string, supply: string) => ({ logic: 'Логика 3.3 В; пины не 5V-tolerant.', current: cur, supply })
const DIM = 'Не подтверждено: габариты платы — оценка по масштабу рисунка производителя; положение выводов вдоль платы и деталей на рендере приблизительные.'

// ---------- LILYGO T-Display-S3 ----------
const tds3: BoardEntry = {
  id: 'tdisplay-s3', name: 'LILYGO T-Display-S3', mcu: 'ESP32-S3', platform: 'esp32s3',
  pins: [
    pw('3V3', 'power', 'Питание 3.3 В (два вывода; на схеме производителя «3V»).'),
    gi(1, ['ADC1_0', 'Touch1']), gi(2, ['ADC1_1', 'Touch2']), gi(3, ['ADC1_2', 'Touch3'], 'Strapping (JTAG)', 'strapping'),
    gi(10, ['ADC1_9', 'Touch10', 'SPI CS']), gi(11, ['ADC2_0', 'Touch11', 'SPI MOSI']), gi(12, ['ADC2_1', 'Touch12', 'SPI SCK']), gi(13, ['ADC2_2', 'Touch13', 'SPI MISO']),
    pw('NC', 'nc', 'Не подключён.'), GND(), pw('5V', 'power', 'Вход/выход 5 В.'),
    gi(43, ['CLK_OUT1', 'TX0 (UART0)']), gi(44, ['CLK_OUT2', 'RX0 (UART0)']), gi(18, ['ADC2_7', 'UART1 RX (U1RXD)']), gi(17, ['ADC2_6', 'UART1 TX (U1TXD)']),
    gi(21, []), gi(16, ['ADC2_5'])
  ],
  electrical: ELEC_3V3('См. даташит ESP32-S3.', 'USB-C 5 В или вывод 5V'),
  notes: [
    'Порядок выводов и функции — карта выводов производителя T-DISPLAY-S3.jpg (https://github.com/Xinyuan-LilyGO/T-Display-S3, каталог image): слева сверху вниз 3V, 1, 2, 3, 10, 11, 12, 13, NC, NC, GND, 5V; справа GND, GND, 43, 44, 18, 17, 21, 16, NC, GND, GND, 3V. USB-C снизу.',
    'Дисплей IPS 1.9″ ST7789, 170×320, 8-битная параллельная шина — внутри платы: LCD_D0–D7 = GPIO39, 40, 41, 42, 45, 46, 47, 48; WR 8, RD 9, DC 7, CS 6, RES 5, BL 38, питание дисплея 15; измерение батареи (LCD_BAT_VOLT) GPIO4; кнопки: Boot (GPIO0) и IO14 — на гребёнки не выведены. Модуль ESP32-S3R8 (8 МБ PSRAM).',
    DIM
  ],
  specs: [['Модуль', 'ESP32-S3R8'], ['Дисплей', 'IPS 1.9″ ST7789 170×320']]
}

// ---------- Heltec Wireless Stick Lite V3 ----------
const wsl: BoardEntry = {
  id: 'heltec-ws-lite-v3', name: 'Heltec Wireless Stick Lite V3', mcu: 'ESP32-S3 + SX1262', platform: 'esp32s3',
  pins: [
    pw('Ve', 'power', 'Выход внешнего питания Ve (включается сигналом Vext_Ctrl, GPIO36).'), GND(),
    gi(12, ['ADC2_1', 'SPI CLK (FSPICLK)', 'FSPIIO6', 'SUBSPICLK']), gi(44, ['UART0 RX (U0RXD)', 'CP2102_TX'], 'U0RXD'), gi(43, ['UART0 TX (U0TXD)', 'CP2102_RX'], 'U0TXD'),
    gi(33, ['SPIIO4', 'FSPIHD', 'SUBSPIHD']), gi(34, ['SPIIO5', 'FSPICS0', 'SUBSPICS0']), gi(35, ['SPIIO6', 'FSPID', 'SUBSPID', 'LED_Write'], 'LED_Write по схеме Heltec'),
    gi(36, ['SPIIO7', 'FSPICLK', 'SUBSPICLK', 'Vext_Ctrl'], 'Vext_Ctrl — управление внешним питанием Ve (по схеме Heltec)'), gi(37, ['SPIDQS', 'FSPIQ', 'SUBSPIQ', 'ADC_Ctrl'], 'ADC_Ctrl по схеме Heltec'),
    gi(38, ['FSPIWP', 'SUBSPIWP']), gi(39, ['JTAG MTCK']), gi(40, ['JTAG MTDO']), gi(41, ['JTAG MTDI']), gi(42, ['JTAG MTMS']), gi(45, [], 'Strapping', 'strapping'), gi(46, [], 'Strapping', 'strapping'),
    gi(1, ['ADC1_0', 'Touch1', 'VBAT_Read'], 'Измерение батареи (VBAT_Read) по схеме Heltec'), gi(2, ['ADC1_1', 'Touch2']), gi(3, ['ADC1_2', 'Touch3'], 'Strapping', 'strapping'),
    pw('5V', 'power', 'Вход/выход 5 В.'), pw('3V3', 'power', 'Выход 3.3 В.'),
    gi(47, []), gi(48, []), gi(0, ['USER_SW', 'BOOT button'], 'Кнопка USER (подтянута); strapping', 'strapping'), gi(26, ['SPICS1']),
    gi(20, ['ADC2_9', 'UART1 CTS (U1CTS)', 'CLK_OUT1', 'USB D+'], 'Нативный USB', 'usb'), gi(18, ['ADC2_7', 'UART1 RX (U1RXD)', 'CLK_OUT3'], 'По карте Heltec: U1RXD, ADC2_CH7'),
    gi(21, []), gi(19, ['ADC2_8', 'UART1 RTS (U1RTS)', 'CLK_OUT2', 'USB D-'], 'Нативный USB', 'usb'), gi(17, ['ADC2_6', 'UART1 TX (U1TXD)']),
    gi(14, ['ADC2_3', 'Touch14', 'FSPIQS', 'SUBSPIWP']), pw('RST', 'reset', 'Сброс (RST_SW; кнопка RST подтянута).'),
    gi(16, ['ADC2_5', 'UART0 CTS (U0CTS)', '32K_XN']), gi(15, ['ADC2_4', 'UART0 RTS (U0RTS)', '32K_XP']),
    gi(7, ['ADC1_6', 'Touch7']), gi(6, ['ADC1_5', 'Touch6']), gi(5, ['ADC1_4', 'Touch5']), gi(4, ['ADC1_3', 'Touch4'])
  ],
  electrical: ELEC_3V3('См. даташит ESP32-S3.', 'USB-C 5 В или вывод 5V; разъём батареи на плате'),
  notes: [
    'Порядок выводов и функции — официальная карта HTIT-WSL_V3 Pin map производителя (https://resource.heltec.cn/download/Wireless_Stick_Lite_V3/HTIT-WSL_V3.png), прочитана изображением. Header J2 слева сверху вниз: Ve, GND, GPIO12, 44, 43, 33–42, 45, 46, 1, 2, 3; Header J3 справа: 5V, 3V3, GND, GPIO47, 48, 0, 26, 20, 18, 21, 19, 17, 14, RST, 16, 15, 7, 6, 5, 4. USB-C сверху.',
    'Радиомодуль LoRa SX1262 — внутри платы (подключение на карте Heltec Pinmap для V3 отдельно не показано для этой модели — не подтверждено). Различия между вариантами V3 и V3.2 по картам Heltec не сверялись.',
    DIM
  ],
  specs: [['Радио', 'LoRa SX1262'], ['МК', 'ESP32-S3FN8']]
}

export const moreBoards9: BoardEntry[] = [tds3, wsl]

export const moreSources9: Record<string, string[]> = {
  'tdisplay-s3': ['https://github.com/Xinyuan-LilyGO/T-Display-S3', 'https://raw.githubusercontent.com/Xinyuan-LilyGO/T-Display-S3/main/image/T-DISPLAY-S3.jpg'],
  'heltec-ws-lite-v3': ['https://resource.heltec.cn/download/Wireless_Stick_Lite_V3', 'https://resource.heltec.cn/download/Wireless_Stick_Lite_V3/HTIT-WSL_V3.png']
}
