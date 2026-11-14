import type { FuncEntry } from '../types'

/** ESP8266 (ядро esp8266/Arduino). */
export const esp8266: FuncEntry[] = [
  {
    name: 'WiFi.begin', category: 'WiFi',
    signature: 'wl_status_t WiFi.begin(const char* ssid, const char* pass)',
    description: 'Подключается к точке доступа (режим станции). #include <ESP8266WiFi.h>.',
    params: [{ name: 'ssid', type: 'const char*', desc: 'Имя сети' }, { name: 'pass', type: 'const char*', desc: 'Пароль' }],
    returns: 'Статус подключения (проверяйте WiFi.status())',
    example: '#include <ESP8266WiFi.h>\nWiFi.mode(WIFI_STA);\nWiFi.begin("ssid", "password");\nwhile (WiFi.status() != WL_CONNECTED) { delay(500); }\nSerial.println(WiFi.localIP());',
    platforms: ['esp8266'],
    notes: ['На ESP32 заголовок другой: <WiFi.h>.'],
    warnings: ['Только 2.4 ГГц.']
  },
  {
    name: 'WiFi.mode', category: 'WiFi',
    signature: 'bool WiFi.mode(WiFiMode_t mode)',
    description: 'Выбирает режим: WIFI_OFF, WIFI_STA, WIFI_AP, WIFI_AP_STA.',
    params: [{ name: 'mode', type: 'WiFiMode_t', desc: 'Режим работы' }], returns: 'true при успехе',
    example: 'WiFi.mode(WIFI_AP_STA);', platforms: ['esp8266']
  },
  {
    name: 'WiFi.softAP', category: 'WiFi',
    signature: 'bool WiFi.softAP(const char* ssid, const char* pass = nullptr)',
    description: 'Поднимает собственную точку доступа.',
    params: [{ name: 'ssid', type: 'const char*', desc: 'Имя сети' }, { name: 'pass', type: 'const char*', desc: 'Пароль: минимум 8 символов, либо nullptr для открытой сети' }],
    returns: 'true при успехе', example: 'WiFi.softAP("MyESP", "12345678");\nSerial.println(WiFi.softAPIP()); // обычно 192.168.4.1',
    platforms: ['esp8266']
  },
  {
    name: 'WiFi.status', category: 'WiFi', signature: 'wl_status_t WiFi.status()',
    description: 'Текущий статус подключения.', params: [], returns: 'WL_CONNECTED, WL_NO_SSID_AVAIL, WL_CONNECT_FAILED, WL_DISCONNECTED и др.',
    example: 'if (WiFi.status() == WL_CONNECTED) { }', platforms: ['esp8266']
  },
  {
    name: 'WiFi.localIP', category: 'WiFi', signature: 'IPAddress WiFi.localIP()',
    description: 'IP-адрес в режиме станции.', params: [], returns: 'IPAddress',
    example: 'Serial.println(WiFi.localIP());', platforms: ['esp8266']
  },
  {
    name: 'WiFi.disconnect', category: 'WiFi', signature: 'bool WiFi.disconnect(bool wifioff = false)',
    description: 'Отключается от точки доступа.', params: [{ name: 'wifioff', type: 'bool', desc: 'true — заодно выключить радио' }],
    returns: 'bool', example: 'WiFi.disconnect();', platforms: ['esp8266']
  },
  {
    name: 'LittleFS.begin', category: 'Файловая система', signature: 'bool LittleFS.begin()',
    description: 'Монтирует файловую систему LittleFS (#include <LittleFS.h>).',
    params: [], returns: 'true при успехе',
    example: '#include <LittleFS.h>\nif (!LittleFS.begin()) { Serial.println("FS mount failed"); }\nFile f = LittleFS.open("/a.txt", "r");',
    platforms: ['esp8266'],
    notes: ['Размер раздела FS выбирается в меню платы (Flash Size). SPIFFS в ядре ESP8266 объявлен устаревшим, рекомендуется LittleFS.'],
    warnings: ['Для загрузки файлов в FS нужен отдельный плагин/инструмент, обычная заливка скетча FS не трогает.']
  },
  {
    name: 'LittleFS.open', category: 'Файловая система', signature: 'File LittleFS.open(const char* path, const char* mode)',
    description: 'Открывает файл: "r", "w", "a" (и "r+", "w+", "a+").',
    params: [{ name: 'path', type: 'const char*', desc: 'Путь, начинается с /' }, { name: 'mode', type: 'const char*', desc: 'Режим' }],
    returns: 'File (проверяйте if (f))', example: 'File f = LittleFS.open("/log.txt", "a");\nf.println("hello");\nf.close();',
    platforms: ['esp8266']
  },
  {
    name: 'EEPROM.begin', category: 'EEPROM (эмуляция)', signature: 'void EEPROM.begin(size_t size)',
    description: 'ESP8266/ESP32: «EEPROM» эмулируется во flash; перед использованием вызвать begin(размер) (до 4096 байт), запись сохранять через EEPROM.commit().',
    params: [{ name: 'size', type: 'size_t', desc: 'Размер в байтах (≤ 4096)' }], returns: 'ничего',
    example: '#include <EEPROM.h>\nEEPROM.begin(64);\nEEPROM.write(0, 1);\nEEPROM.commit();', platforms: ['esp8266', 'esp32', 'esp32s3', 'esp32c3'],
    warnings: ['Без commit() данные не будут записаны во flash.'],
    notes: ['На ESP32 для новых проектов лучше Preferences.']
  },
  {
    name: 'ESP.restart', category: 'Система ESP', signature: 'void ESP.restart()',
    description: 'Программная перезагрузка.', params: [], returns: 'ничего', example: 'ESP.restart();', platforms: ['esp8266'],
    notes: ['На ESP8266 есть также ESP.reset() (жёсткий сброс, состояние периферии может не очищаться).']
  },
  {
    name: 'ESP.getFreeHeap', category: 'Система ESP', signature: 'uint32_t ESP.getFreeHeap()',
    description: 'Свободная куча в байтах.', params: [], returns: 'uint32_t',
    example: 'Serial.println(ESP.getFreeHeap());', platforms: ['esp8266'],
    notes: ['Полезно для поиска утечек памяти; методы ESP.getFreeHeap есть и на ESP32.']
  },
  {
    name: 'ESP.getChipId', category: 'Система ESP', signature: 'uint32_t ESP.getChipId()',
    description: 'Идентификатор чипа (часть MAC).', params: [], returns: 'uint32_t',
    example: 'String id = String(ESP.getChipId(), HEX);', platforms: ['esp8266'],
    notes: ['На ESP32 такого метода нет — используется MAC/ESP.getEfuseMac().']
  },
  {
    name: 'ESP.deepSleep', category: 'Система ESP', signature: 'void ESP.deepSleep(uint64_t microseconds)',
    description: 'Глубокий сон на заданное время; после пробуждения выполняется перезапуск скетча.',
    params: [{ name: 'microseconds', type: 'uint64_t', desc: 'Время сна в мкс' }], returns: 'ничего',
    example: 'ESP.deepSleep(10e6); // 10 секунд',
    platforms: ['esp8266'],
    warnings: ['Для пробуждения по таймеру нужно соединить GPIO16 (D0) с RST (через диод/резистор — по схеме вашей платы).']
  },
  {
    name: 'yield', category: 'Система ESP', signature: 'void yield()',
    description: 'Отдаёт управление системе ESP8266 (WiFi-стеку и watchdog).', params: [], returns: 'ничего',
    example: 'while (!ready) { yield(); }', platforms: ['esp8266'],
    warnings: ['Долгие циклы без delay()/yield() (более ~3 с) приводят к сбросу по watchdog.']
  },
  {
    name: 'analogWriteRange', category: 'Аналоговый ввод-вывод', signature: 'void analogWriteRange(uint32_t range)',
    description: 'Задаёт максимум для analogWrite (по умолчанию 1023).',
    params: [{ name: 'range', type: 'uint32_t', desc: 'Максимальное значение, например 255 для совместимости с AVR' }], returns: 'ничего',
    example: 'analogWriteRange(255);', platforms: ['esp8266'],
    notes: ['Частота ШИМ по умолчанию 1 кГц, меняется analogWriteFreq() (проверить допустимый диапазон).']
  },
  {
    name: 'ESP8266 ограничения GPIO', category: 'Ограничения ESP8266', signature: 'GPIO0, GPIO2, GPIO15, GPIO16, A0',
    description: 'Особенности пинов ESP8266.', params: [], returns: '—',
    example: '// Безопасные для общего использования на NodeMCU: D1(5), D2(4), D5(14), D6(12), D7(13)\n// Осторожно: D3(0), D4(2), D8(15), D0(16)',
    platforms: ['esp8266'],
    warnings: [
      'GPIO0: низкий уровень при старте включает режим загрузки (прошивка). Внешняя подтяжка к GND мешает запуску.',
      'GPIO2: должен быть HIGH при старте; к нему подключён встроенный светодиод (инверсный).',
      'GPIO15: должен быть LOW при старте (на платах есть подтяжка к GND); нагрузка к VCC мешает запуску.',
      'GPIO16: нет ШИМ/прерываний/I2C; служит для пробуждения из deep sleep.',
      'A0: единственный АЦП, диапазон 0..1 В на чипе (на NodeMCU — делитель до 3.3 В).',
      'GPIO6..11 связаны с flash-памятью — не использовать (GPIO9/10 иногда доступны в режиме DIO: проверить).'
    ]
  }
]
