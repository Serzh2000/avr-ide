import type { BoardEntry, PinInfo } from '../types'

const d = (n: number, functions: string[], notes?: string, special?: PinInfo['special']): PinInfo =>
  ({ label: `D${n}`, gpio: n, functions: ['GPIO', ...functions], notes, special })
const g = (n: number, functions: string[], notes?: string, special?: PinInfo['special']): PinInfo =>
  ({ label: `GPIO${n}`, gpio: n, functions, notes, special })

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

export const boards: BoardEntry[] = [
  {
    id: 'uno', name: 'Arduino Uno', mcu: 'ATmega328P', platform: 'avr',
    pins: unoPins(),
    notes: [
      'Логика 5 В, ток с пина: рекомендуется ≤ 20 мА, абсолютный максимум 40 мА. Источник: https://store.arduino.cc/products/arduino-uno-rev3',
      'ШИМ (~): 3, 5, 6, 9, 10, 11. Частота: ~490 Гц; на 5 и 6 — ~980 Гц.',
      'I2C: A4 (SDA), A5 (SCL). SPI: SS 10, MOSI 11, MISO 12, SCK 13. LED_BUILTIN = 13. Источник: https://github.com/arduino/ArduinoCore-avr/blob/master/variants/standard/pins_arduino.h ; https://www.arduino.cc/reference/en/language/functions/analog-io/analogwrite/',
      'Внешние прерывания: только D2 (INT0) и D3 (INT1).',
      'ОЗУ 2 КБ, flash 32 КБ (0.5 КБ занимает загрузчик), EEPROM 1 КБ.'
    ]
  },
  {
    id: 'nano', name: 'Arduino Nano', mcu: 'ATmega328P', platform: 'avr',
    pins: [
      ...unoPins(),
      { label: 'A6', gpio: 20, functions: ['ADC6'], notes: 'Только аналоговый вход, цифрового режима нет', special: 'input-only' },
      { label: 'A7', gpio: 21, functions: ['ADC7'], notes: 'Только аналоговый вход, цифрового режима нет', special: 'input-only' }
    ],
    notes: [
      'Распиновка совпадает с Uno, плюс A6 и A7 (только analogRead).',
      'У клонов на CH340 — свой драйвер; старые Nano используют «Old Bootloader» (меню платы).'
    ]
  },
  {
    id: 'mega', name: 'Arduino Mega 2560', mcu: 'ATmega2560', platform: 'avr',
    pins: megaPins(),
    notes: [
      'ШИМ: 2..13 и 44..46.',
      'Аппаратные UART: Serial (0/1), Serial1 (19/18), Serial2 (17/16), Serial3 (15/14).',
      'Внешние прерывания: 2, 3, 18, 19, 20, 21.',
      'I2C: SDA — 20, SCL — 21. SPI: MISO 50, MOSI 51, SCK 52, SS 53.',
      'ОЗУ 8 КБ, flash 256 КБ, EEPROM 4 КБ. LED_BUILTIN = 13. Источник: https://github.com/arduino/ArduinoCore-avr/blob/master/variants/mega/pins_arduino.h',
      'Аналоговых входов 16: A0–A15 = пины 54–69.'
    ]
  },
  {
    id: 'nodemcu-v2', name: 'NodeMCU v2 (ESP-12E)', mcu: 'ESP8266', platform: 'esp8266',
    pins: [
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
      { label: 'A0', gpio: null, functions: ['ADC (единственный)'], notes: 'На NodeMCU стоит делитель — вход до ~3.3 В; у голого чипа 0..1 В', special: 'input-only' }
    ],
    notes: [
      'Логика 3.3 В, пины не 5V-tolerant.',
      'Соответствие D-меток GPIO задано константами D0..D8 в ядре; на других платах (Wemos D1 mini) метки совпадают, но проверьте свою плату.',
      'Для «безопасных» пинов общего назначения см. D1, D2, D5, D6, D7.'
    ]
  },
  {
    id: 'esp32-devkit', name: 'ESP32 DevKit (ESP32-WROOM-32)', mcu: 'ESP32', platform: 'esp32',
    pins: [
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
    ],
    notes: [
      'Логика 3.3 В, пины не 5V-tolerant.',
      'ADC2 (0, 2, 4, 12–15, 25–27) не работает при включённом WiFi — для аналоговых входов используйте GPIO32–39.',
      'Расположение пинов и состав выведенных GPIO зависят от конкретной платы (30 или 38 pin) — сверяйтесь со своей.',
      'Пины по умолчанию (variants/esp32/pins_arduino.h): I2C SDA 21 / SCL 22; SPI (VSPI) SS 5, MOSI 23, MISO 19, SCK 18; Serial — GPIO1/3. Serial2: в ядре 2.x RX16/TX17, в 3.x RX4/TX25 (HardwareSerial.h); пины всегда можно задать в begin(). Источник: https://github.com/espressif/arduino-esp32/blob/master/variants/esp32/pins_arduino.h',
      'Встроенный светодиод на GPIO2 есть не у всех плат: в общем варианте esp32 LED_BUILTIN не определён.'
    ]
  },
  {
    id: 'esp32-s3', name: 'ESP32-S3 DevKitC-1', mcu: 'ESP32-S3', platform: 'esp32s3',
    pins: [
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
    ],
    notes: [
      'Логика 3.3 В. Каналов ADC: ADC1 — GPIO1–10, ADC2 — GPIO11–20 (ADC2 конфликтует с WiFi).',
      'GPIO26–32 заняты SPI flash/PSRAM — не использовать (в списке не показаны намеренно).',
      'Есть сенсорные пины (GPIO1–14), нет ЦАП.',
      'Пины по умолчанию (variants/esp32s3): I2C SDA 8 / SCL 9; SPI SS 10, MOSI 11, SCK 12, MISO 13; Serial1 RX15/TX16. Сенсорные T1..T14 = GPIO1..14. Источник: https://github.com/espressif/arduino-esp32/blob/master/variants/esp32s3/pins_arduino.h',
      'Strapping: GPIO0, 3, 45, 46. GPIO19/20 — USB, GPIO39–42 — JTAG, GPIO43/44 — UART0. Octal flash/PSRAM занимают GPIO33–37 (на DevKitC-1 выведены 35–37). Источник: даташит ESP32-S3 https://documentation.espressif.com/esp32-s3_datasheet_en.pdf',
      'Два USB-порта: Serial через порт UART — «USB CDC On Boot: Disabled», через нативный USB — «Enabled» (иначе вывод Serial не виден). Источник: https://docs.espressif.com/projects/arduino-esp32/en/latest/troubleshooting.html',
      'Список пинов собран по документации DevKitC-1; на клонах расположение пинов может отличаться.'
    ]
  },
  {
    id: 'esp32-c3', name: 'ESP32-C3 DevKitM-1 / Supermini', mcu: 'ESP32-C3', platform: 'esp32c3',
    pins: [
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
    ],
    notes: [
      'Логика 3.3 В; одно RISC-V ядро.',
      'GPIO12–17 заняты SPI flash — не использовать (не показаны).',
      'Нет сенсорных пинов и ЦАП. ADC1 — GPIO0–4, ADC2 — GPIO5. LEDC: 6 каналов. Strapping: GPIO2, 8, 9. Источник: даташит ESP32-C3 https://documentation.espressif.com/esp32-c3_datasheet_en.pdf',
      'Пины по умолчанию в ядре (variants/esp32c3): I2C SDA 8 / SCL 9; SPI SCK 4, MISO 5, MOSI 6, SS 7; Serial (UART0) TX21 / RX20; Serial1 RX18/TX19 (совпадает с USB). Показанные у GPIO6/7/2/10 функции SPI — аппаратные FSPI-пины (IO MUX), а не значения по умолчанию в Arduino. Источник: https://github.com/espressif/arduino-esp32/blob/master/variants/esp32c3/pins_arduino.h',
      'Serial через нативный USB (GPIO18/19) на C3 работает при «USB CDC On Boot: Enabled»; иначе Serial — UART0 (GPIO20/21). Источник: https://docs.espressif.com/projects/arduino-esp32/en/latest/troubleshooting.html',
      'Светодиод и расположение пинов зависят от платы (DevKitM-1, Super Mini и т.д.) — сверяйтесь со схемой.'
    ]
  }
]
