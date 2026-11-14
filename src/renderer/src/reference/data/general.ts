import type { FuncEntry, PlatformId } from '../types'

const ALL: PlatformId[] = ['avr', 'esp8266', 'esp32', 'esp32s3', 'esp32c3']

/** Общий Arduino API (доступен на всех платформах, если не указано иное). */
export const general: FuncEntry[] = [
  {
    name: 'pinMode', category: 'Цифровой ввод-вывод',
    signature: 'void pinMode(uint8_t pin, uint8_t mode)',
    description: 'Настраивает пин как вход или выход.',
    params: [
      { name: 'pin', type: 'uint8_t', desc: 'Номер пина (в терминах Arduino, не физической ножки)' },
      { name: 'mode', type: 'uint8_t', desc: 'INPUT, OUTPUT, INPUT_PULLUP (на ESP также INPUT_PULLDOWN на части пинов)' }
    ],
    returns: 'ничего',
    example: 'pinMode(LED_BUILTIN, OUTPUT);\npinMode(2, INPUT_PULLUP);',
    platforms: ALL,
    notes: ['На ESP8266 подтяжка к земле есть только у GPIO16 (режим INPUT_PULLDOWN_16). Источник: https://arduino-esp8266.readthedocs.io/en/latest/reference.html и cores/esp8266/core_esp8266_wiring_digital.cpp. INPUT_PULLDOWN в ядре ESP32 в этой проверке не сверялся.'],
    warnings: ['На ESP8266 у GPIO16 нет обычного INPUT_PULLUP.']
  },
  {
    name: 'digitalWrite', category: 'Цифровой ввод-вывод',
    signature: 'void digitalWrite(uint8_t pin, uint8_t val)',
    description: 'Выставляет на выходе HIGH или LOW. На входе (AVR) включает/выключает подтяжку.',
    params: [
      { name: 'pin', type: 'uint8_t', desc: 'Номер пина' },
      { name: 'val', type: 'uint8_t', desc: 'HIGH или LOW' }
    ],
    returns: 'ничего',
    example: 'digitalWrite(13, HIGH);\ndelay(500);\ndigitalWrite(13, LOW);',
    platforms: ALL,
    notes: ['Встроенный светодиод на многих ESP8266/ESP32-платах включается уровнем LOW (инверсный).']
  },
  {
    name: 'digitalRead', category: 'Цифровой ввод-вывод',
    signature: 'int digitalRead(uint8_t pin)',
    description: 'Читает логический уровень пина.',
    params: [{ name: 'pin', type: 'uint8_t', desc: 'Номер пина' }],
    returns: 'HIGH (1) или LOW (0)',
    example: 'if (digitalRead(4) == LOW) { /* кнопка нажата при INPUT_PULLUP */ }',
    platforms: ALL
  },
  {
    name: 'analogRead', category: 'Аналоговый ввод-вывод',
    signature: 'int analogRead(uint8_t pin)',
    description: 'Читает значение АЦП.',
    params: [{ name: 'pin', type: 'uint8_t', desc: 'Аналоговый пин (A0.. или номер GPIO с АЦП)' }],
    returns: 'AVR: 0..1023 (10 бит). ESP8266: 0..1023 (один вход A0). ESP32: по умолчанию 0..4095 (12 бит).',
    example: 'int v = analogRead(A0);\nfloat volts = v * 5.0 / 1023.0; // для Uno',
    platforms: ALL,
    warnings: [
      'ESP8266: только один АЦП-вход A0, диапазон входного напряжения у голого чипа 0..1 В (на NodeMCU/Wemos стоит делитель до ~3.3 В).',
      'ESP32: каналы ADC2 не работают, пока включён WiFi. Используйте пины ADC1.',
      'ESP32: АЦП нелинеен, у краёв диапазона точность низкая.'
    ]
  },
  {
    name: 'analogWrite', category: 'Аналоговый ввод-вывод',
    signature: 'void analogWrite(uint8_t pin, int value)',
    description: 'Выводит ШИМ-сигнал (не настоящий аналог).',
    params: [
      { name: 'pin', type: 'uint8_t', desc: 'Пин с поддержкой ШИМ' },
      { name: 'value', type: 'int', desc: 'AVR: 0..255. ESP8266: 0..255 по умолчанию в ядре 3.x (0..1023 в версиях до 3.0), меняется analogWriteRange(). ESP32: 0..255 (8 бит) по умолчанию, меняется analogWriteResolution().' }
    ],
    returns: 'ничего',
    example: 'analogWrite(9, 128); // ~50% на Uno',
    platforms: ALL,
    notes: [
      'AVR: ШИМ доступен только на пинах, помеченных «~» (Uno/Nano: 3, 5, 6, 9, 10, 11).',
      'ESP32: analogWrite есть в ядре, по умолчанию 8 бит и 1 кГц (analogWriteResolution/analogWriteFrequency); в ядре 3.x функции ledcSetup/ledcAttachPin заменены на ledcAttach. Источник: github.com/espressif/arduino-esp32, cores/esp32/esp32-hal-ledc.c (тег 2.0.17 и master). ESP8266: программный ШИМ на пинах 0..16. Источник: https://arduino-esp8266.readthedocs.io/en/latest/reference.html'
    ]
  },
  {
    name: 'analogReference', category: 'Аналоговый ввод-вывод',
    signature: 'void analogReference(uint8_t type)',
    description: 'Выбирает опорное напряжение АЦП.',
    params: [{ name: 'type', type: 'uint8_t', desc: 'DEFAULT, INTERNAL, EXTERNAL (набор зависит от платы; у Mega также INTERNAL1V1, INTERNAL2V56)' }],
    returns: 'ничего',
    example: 'analogReference(INTERNAL); // 1.1 В на ATmega328P',
    platforms: ['avr'],
    warnings: ['Не подавайте на AREF напряжение при активном внутреннем источнике — можно повредить чип.']
  },
  {
    name: 'delay', category: 'Время',
    signature: 'void delay(unsigned long ms)',
    description: 'Блокирующая пауза в миллисекундах.',
    params: [{ name: 'ms', type: 'unsigned long', desc: 'Время в мс' }],
    returns: 'ничего',
    example: 'delay(1000);',
    platforms: ALL,
    warnings: [
      'Блокирует loop(). Для параллельных задач используйте millis().',
      'ESP8266: delay() отдаёт управление системе (yield), а тяжёлый цикл без delay/yield может вызвать сброс по watchdog.'
    ]
  },
  {
    name: 'delayMicroseconds', category: 'Время',
    signature: 'void delayMicroseconds(unsigned int us)',
    description: 'Блокирующая пауза в микросекундах.',
    params: [{ name: 'us', type: 'unsigned int', desc: 'Время в мкс' }],
    returns: 'ничего',
    example: 'delayMicroseconds(10);',
    platforms: ALL,
    notes: ['На AVR для значений более ~16383 мкс точность не гарантируется — используйте delay().']
  },
  {
    name: 'millis', category: 'Время',
    signature: 'unsigned long millis()',
    description: 'Миллисекунды с момента старта программы.',
    params: [],
    returns: 'unsigned long (на AVR переполняется примерно через 49.7 суток)',
    example: 'static unsigned long t = 0;\nif (millis() - t >= 1000) { t = millis(); /* раз в секунду */ }',
    platforms: ALL,
    notes: ['Сравнивайте разницей (millis() - t >= period) — так переполнение обрабатывается корректно.']
  },
  {
    name: 'micros', category: 'Время',
    signature: 'unsigned long micros()',
    description: 'Микросекунды с момента старта программы.',
    params: [],
    returns: 'unsigned long (на AVR переполнение ~70 минут, разрешение 4 мкс при 16 МГц)',
    example: 'unsigned long t0 = micros();\n/* ... */\nunsigned long dt = micros() - t0;',
    platforms: ALL
  },
  {
    name: 'Serial.begin', category: 'Serial',
    signature: 'void Serial.begin(unsigned long baud)',
    description: 'Инициализирует последовательный порт.',
    params: [{ name: 'baud', type: 'unsigned long', desc: 'Скорость, например 9600 или 115200' }],
    returns: 'ничего',
    example: 'void setup() { Serial.begin(115200); }',
    platforms: ALL,
    notes: [
      'ESP8266/ESP32 обычно используют 115200 (загрузчик ESP8266 печатает на 74880).',
      'На ESP32-S3/C3 с USB-CDC на борту «Serial» может идти через USB — нужна опция «USB CDC On Boot» (не подтверждено источниками в этой проверке — проверить в настройках платы).'
    ],
    aliases: ['Serial']
  },
  {
    name: 'Serial.print', category: 'Serial',
    signature: 'size_t Serial.print(val [, format])',
    description: 'Печатает значение в порт без перевода строки.',
    params: [
      { name: 'val', type: 'любой', desc: 'Строка, число, символ' },
      { name: 'format', type: 'int', desc: 'DEC, HEX, OCT, BIN, либо число знаков для float' }
    ],
    returns: 'Количество записанных байт',
    example: 'Serial.print("T=");\nSerial.print(23.456, 1); // 23.5\nSerial.print(255, HEX);',
    platforms: ALL
  },
  {
    name: 'Serial.println', category: 'Serial',
    signature: 'size_t Serial.println(val [, format])',
    description: 'Как print(), но добавляет \\r\\n.',
    params: [
      { name: 'val', type: 'любой', desc: 'Значение' },
      { name: 'format', type: 'int', desc: 'DEC/HEX/OCT/BIN или число знаков' }
    ],
    returns: 'Количество записанных байт',
    example: 'Serial.println("Hello");',
    platforms: ALL
  },
  {
    name: 'Serial.available', category: 'Serial',
    signature: 'int Serial.available()',
    description: 'Число байт, доступных для чтения.',
    params: [],
    returns: 'int',
    example: 'while (Serial.available() > 0) { char c = Serial.read(); }',
    platforms: ALL
  },
  {
    name: 'Serial.read', category: 'Serial',
    signature: 'int Serial.read()',
    description: 'Читает один байт из входного буфера.',
    params: [],
    returns: 'Байт (0..255) либо -1, если данных нет',
    example: 'int b = Serial.read();',
    platforms: ALL
  },
  {
    name: 'Serial.write', category: 'Serial',
    signature: 'size_t Serial.write(val | str | buf, len)',
    description: 'Пишет «сырые» байты.',
    params: [{ name: 'val', type: 'byte / char* / buf', desc: 'Байт, строка или буфер' }],
    returns: 'Количество записанных байт',
    example: 'Serial.write(0x41); // "A"',
    platforms: ALL
  },
  {
    name: 'Serial.readStringUntil', category: 'Serial',
    signature: 'String Serial.readStringUntil(char terminator)',
    description: 'Читает строку до символа-терминатора или таймаута (по умолчанию 1 с, см. setTimeout).',
    params: [{ name: 'terminator', type: 'char', desc: "Символ конца, например '\\n'" }],
    returns: 'String (без терминатора)',
    example: "String line = Serial.readStringUntil('\\n');",
    platforms: ALL
  },
  {
    name: 'Serial.parseInt', category: 'Serial',
    signature: 'long Serial.parseInt()',
    description: 'Читает целое число из потока, пропуская нецифровые символы.',
    params: [],
    returns: 'long; 0 при таймауте',
    example: 'int n = Serial.parseInt();',
    platforms: ALL
  },
  {
    name: 'Serial.flush', category: 'Serial',
    signature: 'void Serial.flush()',
    description: 'Ожидает окончания отправки исходящих данных.',
    params: [],
    returns: 'ничего',
    example: 'Serial.flush();',
    platforms: ALL,
    notes: ['В современных ядрах flush() не очищает входной буфер.']
  },
  {
    name: 'attachInterrupt', category: 'Прерывания',
    signature: 'void attachInterrupt(uint8_t interrupt, void (*isr)(), int mode)',
    description: 'Подключает обработчик внешнего прерывания.',
    params: [
      { name: 'interrupt', type: 'uint8_t', desc: 'Используйте digitalPinToInterrupt(pin)' },
      { name: 'isr', type: 'функция', desc: 'Обработчик без параметров и без возврата значения' },
      { name: 'mode', type: 'int', desc: 'RISING, FALLING, CHANGE, LOW (AVR; HIGH — не везде)' }
    ],
    returns: 'ничего',
    example: 'volatile bool flag = false;\nvoid onPress() { flag = true; }\nvoid setup() {\n  pinMode(2, INPUT_PULLUP);\n  attachInterrupt(digitalPinToInterrupt(2), onPress, FALLING);\n}',
    platforms: ALL,
    warnings: [
      'Uno/Nano: прерывания только на пинах 2 и 3.',
      'В ISR не используйте delay(), Serial.print и тяжёлые операции; переменные, общие с loop(), — volatile.',
      'ESP8266/ESP32: функцию-обработчик помечайте IRAM_ATTR. На ESP8266 старое имя ICACHE_RAM_ATTR — устаревший псевдоним IRAM_ATTR (даёт предупреждение компилятора). Источник: https://arduino-esp8266.readthedocs.io/en/latest/reference.html и tools/sdk/include/c_types.h (github.com/esp8266/Arduino).',
      'ESP8266: прерывание нельзя подключить к GPIO16.'
    ]
  },
  {
    name: 'detachInterrupt', category: 'Прерывания',
    signature: 'void detachInterrupt(uint8_t interrupt)',
    description: 'Отключает прерывание.',
    params: [{ name: 'interrupt', type: 'uint8_t', desc: 'digitalPinToInterrupt(pin)' }],
    returns: 'ничего',
    example: 'detachInterrupt(digitalPinToInterrupt(2));',
    platforms: ALL
  },
  {
    name: 'digitalPinToInterrupt', category: 'Прерывания',
    signature: 'int digitalPinToInterrupt(uint8_t pin)',
    description: 'Преобразует номер пина в номер прерывания.',
    params: [{ name: 'pin', type: 'uint8_t', desc: 'Номер пина' }],
    returns: 'Номер прерывания или NOT_AN_INTERRUPT',
    example: 'attachInterrupt(digitalPinToInterrupt(3), isr, RISING);',
    platforms: ALL
  },
  {
    name: 'interrupts', category: 'Прерывания',
    signature: 'void interrupts()',
    description: 'Разрешает глобальные прерывания (аналог sei()).',
    params: [], returns: 'ничего', example: 'noInterrupts();\n/* критическая секция */\ninterrupts();',
    platforms: ALL
  },
  {
    name: 'noInterrupts', category: 'Прерывания',
    signature: 'void noInterrupts()',
    description: 'Запрещает глобальные прерывания (аналог cli()).',
    params: [], returns: 'ничего', example: 'noInterrupts();\nunsigned long c = counter;\ninterrupts();',
    platforms: ALL,
    notes: ['На ESP32 interrupts()/noInterrupts() сведены к portENABLE_INTERRUPTS()/portDISABLE_INTERRUPTS(); комментарий в ядре предупреждает о возможных срабатываниях watchdog. Для защиты данных между задачами и ISR предпочтительны критические секции FreeRTOS (portENTER_CRITICAL) — это рекомендация, а не требование ядра. Источник: github.com/espressif/arduino-esp32, cores/esp32/Arduino.h']
  },
  {
    name: 'map', category: 'Математика',
    signature: 'long map(long x, long in_min, long in_max, long out_min, long out_max)',
    description: 'Линейно переводит число из одного диапазона в другой (целочисленно).',
    params: [
      { name: 'x', type: 'long', desc: 'Значение' },
      { name: 'in_min/in_max', type: 'long', desc: 'Исходный диапазон' },
      { name: 'out_min/out_max', type: 'long', desc: 'Целевой диапазон' }
    ],
    returns: 'long',
    example: 'int duty = map(analogRead(A0), 0, 1023, 0, 255);',
    platforms: ALL,
    warnings: ['Не ограничивает результат — при необходимости оберните в constrain(). Дробная часть отбрасывается.']
  },
  {
    name: 'constrain', category: 'Математика',
    signature: 'constrain(x, a, b)',
    description: 'Ограничивает значение диапазоном [a, b].',
    params: [
      { name: 'x', type: 'число', desc: 'Значение' }, { name: 'a', type: 'число', desc: 'Минимум' }, { name: 'b', type: 'число', desc: 'Максимум' }
    ],
    returns: 'x, a или b',
    example: 'v = constrain(v, 0, 255);',
    platforms: ALL,
    warnings: ['Это макрос: не передавайте выражения с побочными эффектами (например, constrain(i++, 0, 9)).']
  },
  {
    name: 'min', category: 'Математика', signature: 'min(a, b)', description: 'Меньшее из двух значений.',
    params: [{ name: 'a', type: 'число', desc: 'Первое' }, { name: 'b', type: 'число', desc: 'Второе' }],
    returns: 'Меньшее', example: 'int m = min(a, b);', platforms: ALL,
    notes: ['На AVR min/max — макросы; на ESP32 и ESP8266 это шаблоны std::min/std::max (using в Arduino.h), поэтому типы аргументов должны совпадать: min(1, 2L) не скомпилируется — приводите типы явно. Источник: github.com/arduino/ArduinoCore-avr и esp8266/Arduino, espressif/arduino-esp32 (cores/*/Arduino.h)']
  },
  {
    name: 'max', category: 'Математика', signature: 'max(a, b)', description: 'Большее из двух значений.',
    params: [{ name: 'a', type: 'число', desc: 'Первое' }, { name: 'b', type: 'число', desc: 'Второе' }],
    returns: 'Большее', example: 'int m = max(a, b);', platforms: ALL
  },
  {
    name: 'abs', category: 'Математика', signature: 'abs(x)', description: 'Модуль числа.',
    params: [{ name: 'x', type: 'число', desc: 'Значение' }], returns: '|x|', example: 'int d = abs(a - b);', platforms: ALL,
    warnings: ['На AVR — макрос: не передавайте выражения с побочными эффектами (на ESP32 используется std::abs).']
  },
  {
    name: 'pow', category: 'Математика', signature: 'double pow(double base, double exp)', description: 'Возведение в степень.',
    params: [{ name: 'base', type: 'double', desc: 'Основание' }, { name: 'exp', type: 'double', desc: 'Показатель' }],
    returns: 'double', example: 'float s = pow(2, 10);', platforms: ALL
  },
  {
    name: 'sqrt', category: 'Математика', signature: 'double sqrt(double x)', description: 'Квадратный корень.',
    params: [{ name: 'x', type: 'double', desc: 'Число ≥ 0' }], returns: 'double', example: 'float r = sqrt(16.0);', platforms: ALL
  },
  {
    name: 'sq', category: 'Математика', signature: 'sq(x)', description: 'Квадрат числа.',
    params: [{ name: 'x', type: 'число', desc: 'Значение' }], returns: 'x*x', example: 'int a = sq(5);', platforms: ALL
  },
  {
    name: 'tone', category: 'Звук',
    signature: 'void tone(uint8_t pin, unsigned int frequency [, unsigned long duration])',
    description: 'Генерирует меандр заданной частоты (пищалка).',
    params: [
      { name: 'pin', type: 'uint8_t', desc: 'Пин' }, { name: 'frequency', type: 'unsigned int', desc: 'Гц' },
      { name: 'duration', type: 'unsigned long', desc: 'Длительность в мс (необязательно)' }
    ],
    returns: 'ничего', example: 'tone(8, 440, 500);', platforms: ALL,
    warnings: [
      'AVR: tone() использует таймер и нарушает ШИМ на пинах 3 и 11 (Uno).'
    ],
    notes: ['ESP32: tone()/noTone() реализованы в ядре (cores/esp32/Tone.cpp, есть в 2.0.17 и master; в 2.0.0 файл пуст). Источник: github.com/espressif/arduino-esp32. Таймер Timer2 для tone() на ATmega328P/2560 — github.com/arduino/ArduinoCore-avr, Tone.cpp.']
  },
  {
    name: 'noTone', category: 'Звук', signature: 'void noTone(uint8_t pin)', description: 'Останавливает tone().',
    params: [{ name: 'pin', type: 'uint8_t', desc: 'Пин' }], returns: 'ничего', example: 'noTone(8);', platforms: ALL
  },
  {
    name: 'random', category: 'Случайные числа',
    signature: 'long random(long max) / long random(long min, long max)',
    description: 'Псевдослучайное число в диапазоне [min, max).',
    params: [{ name: 'min', type: 'long', desc: 'Нижняя граница (включительно, по умолчанию 0)' }, { name: 'max', type: 'long', desc: 'Верхняя (не включая)' }],
    returns: 'long', example: 'int r = random(1, 7); // кубик 1..6', platforms: ALL,
    notes: ['random(max) даёт [0, max), random(min, max) — [min, max). На ESP32 по умолчанию используется аппаратный ГСЧ; вызов randomSeed() с ненулевым seed переключает на программный rand() (seed 0 игнорируется). Источник: github.com/espressif/arduino-esp32, cores/esp32/WMath.cpp']
  },
  {
    name: 'randomSeed', category: 'Случайные числа', signature: 'void randomSeed(unsigned long seed)',
    description: 'Задаёт начальное значение генератора.',
    params: [{ name: 'seed', type: 'unsigned long', desc: 'Начальное значение' }], returns: 'ничего',
    example: 'randomSeed(analogRead(A0)); // A0 — не подключён', platforms: ALL
  },
  {
    name: 'pulseIn', category: 'Цифровой ввод-вывод',
    signature: 'unsigned long pulseIn(uint8_t pin, uint8_t state [, unsigned long timeout_us])',
    description: 'Измеряет длительность импульса.',
    params: [
      { name: 'pin', type: 'uint8_t', desc: 'Пин' }, { name: 'state', type: 'uint8_t', desc: 'HIGH или LOW' },
      { name: 'timeout_us', type: 'unsigned long', desc: 'Таймаут, мкс (по умолчанию 1 000 000)' }
    ],
    returns: 'Длительность в мкс; 0 при таймауте', example: 'long us = pulseIn(7, HIGH, 30000);', platforms: ALL
  },
  {
    name: 'shiftOut', category: 'Цифровой ввод-вывод',
    signature: 'void shiftOut(uint8_t dataPin, uint8_t clockPin, uint8_t bitOrder, uint8_t val)',
    description: 'Побитовая передача байта (для сдвиговых регистров 74HC595).',
    params: [
      { name: 'dataPin', type: 'uint8_t', desc: 'Пин данных' }, { name: 'clockPin', type: 'uint8_t', desc: 'Пин тактов' },
      { name: 'bitOrder', type: 'uint8_t', desc: 'MSBFIRST или LSBFIRST' }, { name: 'val', type: 'uint8_t', desc: 'Байт' }
    ],
    returns: 'ничего', example: 'digitalWrite(latch, LOW);\nshiftOut(data, clk, MSBFIRST, 0xAA);\ndigitalWrite(latch, HIGH);', platforms: ALL
  },
  {
    name: 'shiftIn', category: 'Цифровой ввод-вывод',
    signature: 'uint8_t shiftIn(uint8_t dataPin, uint8_t clockPin, uint8_t bitOrder)',
    description: 'Побитовое чтение байта.',
    params: [
      { name: 'dataPin', type: 'uint8_t', desc: 'Пин данных' }, { name: 'clockPin', type: 'uint8_t', desc: 'Пин тактов' },
      { name: 'bitOrder', type: 'uint8_t', desc: 'MSBFIRST или LSBFIRST' }
    ],
    returns: 'Прочитанный байт', example: 'byte b = shiftIn(data, clk, MSBFIRST);', platforms: ALL
  },
  {
    name: 'bitRead', category: 'Биты и байты', signature: 'bitRead(x, n)', description: 'Читает бит n числа x (0 — младший).',
    params: [{ name: 'x', type: 'число', desc: 'Число' }, { name: 'n', type: 'int', desc: 'Номер бита' }], returns: '0 или 1',
    example: 'int b = bitRead(x, 3);', platforms: ALL
  },
  {
    name: 'bitWrite', category: 'Биты и байты', signature: 'bitWrite(x, n, b)', description: 'Записывает бит n в число x.',
    params: [{ name: 'x', type: 'число', desc: 'Переменная' }, { name: 'n', type: 'int', desc: 'Номер бита' }, { name: 'b', type: 'int', desc: '0 или 1' }],
    returns: 'ничего', example: 'bitWrite(x, 0, 1);', platforms: ALL
  },
  {
    name: 'bitSet', category: 'Биты и байты', signature: 'bitSet(x, n)', description: 'Устанавливает бит n в 1.',
    params: [{ name: 'x', type: 'число', desc: 'Переменная' }, { name: 'n', type: 'int', desc: 'Номер бита' }], returns: 'ничего',
    example: 'bitSet(x, 2);', platforms: ALL
  },
  {
    name: 'bitClear', category: 'Биты и байты', signature: 'bitClear(x, n)', description: 'Сбрасывает бит n в 0.',
    params: [{ name: 'x', type: 'число', desc: 'Переменная' }, { name: 'n', type: 'int', desc: 'Номер бита' }], returns: 'ничего',
    example: 'bitClear(x, 2);', platforms: ALL
  },
  {
    name: 'lowByte', category: 'Биты и байты', signature: 'lowByte(x)', description: 'Младший байт числа.',
    params: [{ name: 'x', type: 'число', desc: 'Значение' }], returns: 'byte', example: 'byte lo = lowByte(1234);', platforms: ALL
  },
  {
    name: 'highByte', category: 'Биты и байты', signature: 'highByte(x)', description: 'Старший байт числа (из 16 бит).',
    params: [{ name: 'x', type: 'число', desc: 'Значение' }], returns: 'byte', example: 'byte hi = highByte(1234);', platforms: ALL
  },
  {
    name: 'Wire.begin', category: 'I2C',
    signature: 'void Wire.begin() / Wire.begin(uint8_t address) / (ESP) Wire.begin(int sda, int scl)',
    description: 'Инициализирует шину I2C (#include <Wire.h>).',
    params: [{ name: 'sda, scl', type: 'int', desc: 'Только ESP: пины шины (на ESP8266/ESP32 можно выбрать другие подходящие пины)' }],
    returns: 'AVR/ESP8266: ничего (void). ESP32: bool (true при успешной инициализации шины)',
    example: '#include <Wire.h>\nvoid setup() { Wire.begin(); }',
    platforms: ALL,
    notes: ['Пины I2C по умолчанию: Uno/Nano A4 (SDA) и A5 (SCL); ESP8266 (NodeMCU) GPIO4 (SDA) и GPIO5 (SCL); ESP32 GPIO21 и GPIO22. Для S3/C3 в стандартных вариантах ядра GPIO8 (SDA) и GPIO9 (SCL), но зависит от платы. Источник: pins_arduino.h в github.com/arduino/ArduinoCore-avr, esp8266/Arduino, espressif/arduino-esp32; Wire.h ESP8266 (begin(int sda, int scl) — void) и ESP32 (bool).']
  }
]
