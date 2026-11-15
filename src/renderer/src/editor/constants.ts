// Ключевые слова, типы, константы Arduino/ESP, заголовочные файлы. Чистые данные.
import type { EditorPlatform } from './types'

export const KEYWORDS = [
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'return', 'goto',
  'const', 'static', 'volatile', 'extern', 'inline', 'constexpr', 'struct', 'class', 'enum', 'union', 'typedef',
  'sizeof', 'namespace', 'using', 'template', 'typename', 'public', 'private', 'protected', 'virtual', 'override',
  'new', 'delete', 'nullptr', 'true', 'false', 'auto', 'register', 'this', 'operator', 'try', 'catch', 'throw'
]

/** Ключевые слова, после которых «(» — не вызов функции. */
export const CONTROL_KEYWORDS = new Set(['if', 'while', 'for', 'switch', 'catch', 'return', 'sizeof', 'else', 'do', 'case', 'new', 'delete', 'defined', 'alignof'])

export const TYPES = [
  'void', 'bool', 'boolean', 'char', 'byte', 'word', 'short', 'int', 'long', 'float', 'double', 'unsigned', 'signed',
  'size_t', 'int8_t', 'int16_t', 'int32_t', 'int64_t', 'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t', 'String'
]

export interface ConstantInfo {
  name: string
  detail: string
  doc: string
  /** Только для этих платформ; без поля — для всех. */
  platforms?: EditorPlatform[]
}

const ESP32F: EditorPlatform[] = ['esp32', 'esp32s3', 'esp32c3']

export const CONSTANTS: ConstantInfo[] = [
  { name: 'HIGH', detail: 'константа = 1', doc: 'Высокий уровень пина (логическая 1).' },
  { name: 'LOW', detail: 'константа = 0', doc: 'Низкий уровень пина (логический 0).' },
  { name: 'INPUT', detail: 'режим пина', doc: 'Режим pinMode: вход без подтяжки.' },
  { name: 'OUTPUT', detail: 'режим пина', doc: 'Режим pinMode: выход.' },
  { name: 'INPUT_PULLUP', detail: 'режим пина', doc: 'Режим pinMode: вход с внутренней подтяжкой к питанию. Кнопка на землю читается как LOW при нажатии.' },
  { name: 'INPUT_PULLDOWN', detail: 'режим пина (ESP32)', doc: 'Вход с внутренней подтяжкой к земле.', platforms: ESP32F },
  { name: 'LED_BUILTIN', detail: 'номер пина', doc: 'Пин встроенного светодиода платы. На многих платах ESP8266 светодиод включается уровнем LOW.' },
  { name: 'PI', detail: 'число 3.1415…', doc: 'Число пи.' },
  { name: 'HALF_PI', detail: 'число', doc: 'Пи пополам.' },
  { name: 'TWO_PI', detail: 'число', doc: 'Два пи.' },
  { name: 'DEG_TO_RAD', detail: 'число', doc: 'Множитель перевода градусов в радианы.' },
  { name: 'RAD_TO_DEG', detail: 'число', doc: 'Множитель перевода радиан в градусы.' },
  { name: 'CHANGE', detail: 'режим прерывания', doc: 'attachInterrupt: любое изменение уровня.' },
  { name: 'RISING', detail: 'режим прерывания', doc: 'attachInterrupt: переход LOW → HIGH.' },
  { name: 'FALLING', detail: 'режим прерывания', doc: 'attachInterrupt: переход HIGH → LOW.' },
  { name: 'LSBFIRST', detail: 'порядок бит', doc: 'shiftOut/shiftIn: младший бит первым.' },
  { name: 'MSBFIRST', detail: 'порядок бит', doc: 'shiftOut/shiftIn: старший бит первым.' },
  { name: 'DEC', detail: 'формат вывода', doc: 'Serial.print(x, DEC) — десятичный.' },
  { name: 'HEX', detail: 'формат вывода', doc: 'Serial.print(x, HEX) — шестнадцатеричный.' },
  { name: 'OCT', detail: 'формат вывода', doc: 'Serial.print(x, OCT) — восьмеричный.' },
  { name: 'BIN', detail: 'формат вывода', doc: 'Serial.print(x, BIN) — двоичный.' },
  { name: 'SERIAL_8N1', detail: 'конфигурация UART', doc: '8 бит данных, без чётности, 1 стоп-бит (по умолчанию).' },
  { name: 'NULL', detail: 'нулевой указатель', doc: 'Нулевой указатель (в C++ лучше nullptr).' },
  { name: 'SDA', detail: 'номер пина', doc: 'Пин данных I2C платы по умолчанию.' },
  { name: 'SCL', detail: 'номер пина', doc: 'Пин тактирования I2C платы по умолчанию.' },
  { name: 'MOSI', detail: 'номер пина', doc: 'Пин MOSI шины SPI по умолчанию.' },
  { name: 'MISO', detail: 'номер пина', doc: 'Пин MISO шины SPI по умолчанию.' },
  { name: 'SCK', detail: 'номер пина', doc: 'Пин тактирования SPI по умолчанию.' },
  { name: 'SS', detail: 'номер пина', doc: 'Пин выбора ведомого SPI по умолчанию.' },
  { name: 'A0', detail: 'аналоговый пин', doc: 'Аналоговый вход A0 (на ESP8266 единственный ADC).' },
  { name: 'A1', detail: 'аналоговый пин', doc: 'Аналоговый вход A1.', platforms: ['avr', 'esp32', 'esp32s3', 'esp32c3'] },
  { name: 'A2', detail: 'аналоговый пин', doc: 'Аналоговый вход A2.', platforms: ['avr', 'esp32', 'esp32s3', 'esp32c3'] },
  { name: 'A3', detail: 'аналоговый пин', doc: 'Аналоговый вход A3.', platforms: ['avr', 'esp32', 'esp32s3', 'esp32c3'] },
  { name: 'A4', detail: 'аналоговый пин', doc: 'Аналоговый вход A4 (на Uno он же SDA).', platforms: ['avr', 'esp32', 'esp32s3', 'esp32c3'] },
  { name: 'A5', detail: 'аналоговый пин', doc: 'Аналоговый вход A5 (на Uno он же SCL).', platforms: ['avr', 'esp32', 'esp32s3', 'esp32c3'] },
  { name: 'A6', detail: 'аналоговый пин', doc: 'Аналоговый вход A6 (только вход, Nano/Mini).', platforms: ['avr'] },
  { name: 'A7', detail: 'аналоговый пин', doc: 'Аналоговый вход A7 (только вход, Nano/Mini).', platforms: ['avr'] },
  { name: 'WL_CONNECTED', detail: 'статус WiFi', doc: 'WiFi.status() == WL_CONNECTED — подключение установлено.', platforms: ['esp8266', ...ESP32F] },
  { name: 'WL_DISCONNECTED', detail: 'статус WiFi', doc: 'WiFi.status(): нет подключения.', platforms: ['esp8266', ...ESP32F] },
  { name: 'WL_NO_SSID_AVAIL', detail: 'статус WiFi', doc: 'WiFi.status(): сеть с таким именем не найдена.', platforms: ['esp8266', ...ESP32F] },
  { name: 'WL_CONNECT_FAILED', detail: 'статус WiFi', doc: 'WiFi.status(): не удалось подключиться (чаще всего неверный пароль).', platforms: ['esp8266', ...ESP32F] },
  { name: 'WIFI_STA', detail: 'режим WiFi', doc: 'WiFi.mode(WIFI_STA): клиент точки доступа.', platforms: ['esp8266', ...ESP32F] },
  { name: 'WIFI_AP', detail: 'режим WiFi', doc: 'WiFi.mode(WIFI_AP): собственная точка доступа.', platforms: ['esp8266', ...ESP32F] },
  { name: 'WIFI_AP_STA', detail: 'режим WiFi', doc: 'WiFi.mode(WIFI_AP_STA): клиент и точка доступа одновременно.', platforms: ['esp8266', ...ESP32F] },
  { name: 'WIFI_OFF', detail: 'режим WiFi', doc: 'WiFi.mode(WIFI_OFF): радио выключено.', platforms: ['esp8266', ...ESP32F] },
  { name: 'PROGMEM', detail: 'модификатор AVR', doc: 'Хранить данные во Flash, а не в ОЗУ (AVR).', platforms: ['avr'] },
  { name: 'IRAM_ATTR', detail: 'модификатор ESP', doc: 'Разместить функцию в IRAM — обязательно для обработчиков прерываний на ESP32 (на ESP8266 — ICACHE_RAM_ATTR).', platforms: ESP32F },
  { name: 'ICACHE_RAM_ATTR', detail: 'модификатор ESP8266', doc: 'Разместить функцию в IRAM — обязательно для обработчиков прерываний ESP8266.', platforms: ['esp8266'] }
]

/** Объекты-библиотеки, подсвечиваемые как классы. */
export const BUILTIN_OBJECTS = ['Serial', 'Serial1', 'Serial2', 'Serial3', 'Wire', 'SPI', 'WiFi', 'ESP', 'EEPROM', 'LittleFS', 'SPIFFS', 'Preferences', 'ESPUI']

/** Серийные порты-синонимы Serial для поиска членов. */
export const OBJECT_ALIASES: Record<string, string> = { Serial1: 'Serial', Serial2: 'Serial', Serial3: 'Serial', SerialUSB: 'Serial', Wire1: 'Wire' }

export interface HeaderInfo {
  name: string
  detail: string
  platforms?: EditorPlatform[]
}

export const HEADERS: HeaderInfo[] = [
  { name: 'Arduino.h', detail: 'ядро Arduino' },
  { name: 'Wire.h', detail: 'I2C' },
  { name: 'SPI.h', detail: 'SPI' },
  { name: 'EEPROM.h', detail: 'EEPROM' },
  { name: 'Servo.h', detail: 'сервоприводы' },
  { name: 'SoftwareSerial.h', detail: 'программный UART', platforms: ['avr', 'esp8266'] },
  { name: 'avr/pgmspace.h', detail: 'PROGMEM (AVR)', platforms: ['avr'] },
  { name: 'avr/interrupt.h', detail: 'прерывания AVR', platforms: ['avr'] },
  { name: 'avr/sleep.h', detail: 'режимы сна AVR', platforms: ['avr'] },
  { name: 'avr/wdt.h', detail: 'сторожевой таймер AVR', platforms: ['avr'] },
  { name: 'ESP8266WiFi.h', detail: 'WiFi ESP8266', platforms: ['esp8266'] },
  { name: 'ESP8266WebServer.h', detail: 'веб-сервер ESP8266', platforms: ['esp8266'] },
  { name: 'ESP8266mDNS.h', detail: 'mDNS ESP8266', platforms: ['esp8266'] },
  { name: 'ESP8266HTTPClient.h', detail: 'HTTP-клиент ESP8266', platforms: ['esp8266'] },
  { name: 'LittleFS.h', detail: 'файловая система LittleFS', platforms: ['esp8266', 'esp32', 'esp32s3', 'esp32c3'] },
  { name: 'WiFi.h', detail: 'WiFi', platforms: ['esp32', 'esp32s3', 'esp32c3', 'esp8266'] },
  { name: 'WebServer.h', detail: 'веб-сервер ESP32', platforms: ['esp32', 'esp32s3', 'esp32c3'] },
  { name: 'HTTPClient.h', detail: 'HTTP-клиент ESP32', platforms: ['esp32', 'esp32s3', 'esp32c3'] },
  { name: 'ESPmDNS.h', detail: 'mDNS ESP32', platforms: ['esp32', 'esp32s3', 'esp32c3'] },
  { name: 'Preferences.h', detail: 'хранение настроек (NVS)', platforms: ['esp32', 'esp32s3', 'esp32c3'] },
  { name: 'SPIFFS.h', detail: 'файловая система SPIFFS', platforms: ['esp32', 'esp32s3', 'esp32c3'] },
  { name: 'ESPUI.h', detail: 'веб-интерфейс ESPUI', platforms: ['esp8266', 'esp32', 'esp32s3', 'esp32c3'] },
  { name: 'DNSServer.h', detail: 'DNS-сервер', platforms: ['esp8266', 'esp32', 'esp32s3', 'esp32c3'] },
  { name: 'ArduinoJson.h', detail: 'JSON' },
  { name: 'Adafruit_Sensor.h', detail: 'датчики Adafruit' }
]
