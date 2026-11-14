import type { FuncEntry, PlatformId } from '../types'

const E32: PlatformId[] = ['esp32', 'esp32s3', 'esp32c3']

/** ESP32 / ESP32-S3 / ESP32-C3 (ядро arduino-esp32 2.x и 3.x). */
export const esp32: FuncEntry[] = [
  {
    name: 'WiFi.begin', category: 'WiFi',
    signature: 'wl_status_t WiFi.begin(const char* ssid, const char* pass)',
    description: 'Подключается к точке доступа. #include <WiFi.h> (не ESP8266WiFi.h).',
    params: [{ name: 'ssid', type: 'const char*', desc: 'Имя сети' }, { name: 'pass', type: 'const char*', desc: 'Пароль' }],
    returns: 'Статус подключения (проверяйте WiFi.status())',
    example: '#include <WiFi.h>\nWiFi.mode(WIFI_STA);\nWiFi.begin("ssid", "password");\nwhile (WiFi.status() != WL_CONNECTED) { delay(500); }\nSerial.println(WiFi.localIP());',
    platforms: E32,
    warnings: ['Только 2.4 ГГц. Пока работает WiFi, нельзя использовать АЦП ADC2.']
  },
  {
    name: 'WiFi.mode', category: 'WiFi', signature: 'bool WiFi.mode(wifi_mode_t mode)',
    description: 'Выбирает режим: WIFI_OFF, WIFI_STA, WIFI_AP, WIFI_AP_STA.',
    params: [{ name: 'mode', type: 'wifi_mode_t', desc: 'Режим' }], returns: 'true при успехе',
    example: 'WiFi.mode(WIFI_STA);', platforms: E32
  },
  {
    name: 'WiFi.softAP', category: 'WiFi', signature: 'bool WiFi.softAP(const char* ssid, const char* pass = nullptr)',
    description: 'Поднимает собственную точку доступа.',
    params: [{ name: 'ssid', type: 'const char*', desc: 'Имя сети' }, { name: 'pass', type: 'const char*', desc: 'Пароль, минимум 8 символов' }],
    returns: 'true при успехе', example: 'WiFi.softAP("MyESP32", "12345678");', platforms: E32
  },
  {
    name: 'ledcAttach', category: 'ШИМ (LEDC)',
    signature: 'bool ledcAttach(uint8_t pin, uint32_t freq, uint8_t resolution)',
    description: 'Ядро 3.x: подключает пин к ШИМ-каналу LEDC (канал выбирается автоматически) с частотой и разрядностью.',
    params: [
      { name: 'pin', type: 'uint8_t', desc: 'GPIO' }, { name: 'freq', type: 'uint32_t', desc: 'Частота, Гц' },
      { name: 'resolution', type: 'uint8_t', desc: 'Разрядность в битах: 1..14 (на классическом ESP32 — до 20); верхняя граница также ограничена выбранной частотой' }
    ],
    returns: 'true при успехе',
    example: '// ядро 3.x\nledcAttach(5, 5000, 8);\nledcWrite(5, 128); // по номеру ПИНА',
    platforms: E32,
    warnings: ['Только ядро arduino-esp32 3.x. В 2.x такой функции нет — используйте ledcSetup + ledcAttachPin.'],
    notes: ['В 3.x также есть ledcAttachChannel(pin, freq, res, channel) для явного выбора канала; если каналы делят таймер, частота и разрядность у них общие.', 'Источник: https://docs.espressif.com/projects/arduino-esp32/en/latest/api/ledc.html']
  },
  {
    name: 'ledcSetup', category: 'ШИМ (LEDC)',
    signature: 'uint32_t ledcSetup(uint8_t channel, uint32_t freq, uint8_t resolution)',
    description: 'Ядро 2.x: настраивает ШИМ-канал LEDC. Затем канал привязывается к пину через ledcAttachPin.',
    params: [
      { name: 'channel', type: 'uint8_t', desc: 'Номер канала: ESP32 — 0..15, ESP32-S3 — 0..7, ESP32-C3 — 0..5' },
      { name: 'freq', type: 'uint32_t', desc: 'Частота, Гц' }, { name: 'resolution', type: 'uint8_t', desc: 'Разрядность, бит' }
    ],
    returns: 'Фактическая частота',
    example: '// ядро 2.x\nledcSetup(0, 5000, 8);\nledcAttachPin(5, 0);\nledcWrite(0, 128); // по номеру КАНАЛА',
    platforms: E32,
    warnings: ['Удалено в ядре 3.x. При миграции: ledcSetup+ledcAttachPin → ledcAttach(pin, freq, res), а ledcWrite принимает уже пин, а не канал.'],
    notes: ['Число каналов LEDC: ESP32 — 16, ESP32-S3 — 8, ESP32-C3 — 6 (у C3 и S3 нет high-speed режима).', 'Источник: https://docs.espressif.com/projects/arduino-esp32/en/latest/migration_guides/2.x_to_3.0.html ; https://docs.espressif.com/projects/esp-idf/en/latest/esp32c3/api-reference/peripherals/ledc.html ; https://documentation.espressif.com/esp32-c3_datasheet_en.pdf']
  },
  {
    name: 'ledcAttachPin', category: 'ШИМ (LEDC)',
    signature: 'void ledcAttachPin(uint8_t pin, uint8_t channel)',
    description: 'Ядро 2.x: привязывает пин к каналу LEDC.',
    params: [{ name: 'pin', type: 'uint8_t', desc: 'GPIO' }, { name: 'channel', type: 'uint8_t', desc: 'Канал, настроенный через ledcSetup' }],
    returns: 'ничего', example: 'ledcAttachPin(5, 0);', platforms: E32,
    warnings: ['Только ядро 2.x; в 3.x заменено на ledcAttach.']
  },
  {
    name: 'ledcWrite', category: 'ШИМ (LEDC)',
    signature: '2.x: void ledcWrite(uint8_t channel, uint32_t duty)   3.x: bool ledcWrite(uint8_t pin, uint32_t duty)',
    description: 'Устанавливает скважность ШИМ. Различие API: в ядре 2.x первый аргумент — номер канала, в 3.x — номер пина.',
    params: [
      { name: 'channel / pin', type: 'uint8_t', desc: '2.x: канал LEDC; 3.x: номер GPIO' },
      { name: 'duty', type: 'uint32_t', desc: '0 .. (2^resolution − 1)' }
    ],
    returns: '2.x: ничего; 3.x: bool',
    example: '// 2.x: ledcWrite(0, 128);\n// 3.x: ledcWrite(5, 128);',
    platforms: E32,
    warnings: ['Код, написанный для 2.x, при сборке на 3.x либо не компилируется (ledcSetup), либо молча работает неверно: передаётся номер канала вместо пина. Проверьте версию ядра.']
  },
  {
    name: 'analogReadResolution', category: 'Аналоговый ввод-вывод', signature: 'void analogReadResolution(uint8_t bits)',
    description: 'Задаёт разрядность analogRead (по умолчанию 12 бит: 0..4095).',
    params: [{ name: 'bits', type: 'uint8_t', desc: 'Число бит (1..16)' }], returns: 'ничего',
    example: 'analogReadResolution(10); // совместимо с AVR', platforms: E32,
    notes: ['Аппаратно у ESP32 АЦП 9–12 бит; остальные значения получаются сдвигом результата.', 'Источник: https://docs.espressif.com/projects/arduino-esp32/en/latest/api/adc.html']
  },
  {
    name: 'analogReadMilliVolts', category: 'Аналоговый ввод-вывод', signature: 'uint32_t analogReadMilliVolts(uint8_t pin)',
    description: 'Читает АЦП и возвращает напряжение в мВ с учётом калибровки.',
    params: [{ name: 'pin', type: 'uint8_t', desc: 'Пин с АЦП' }], returns: 'мВ',
    example: 'uint32_t mv = analogReadMilliVolts(34);', platforms: E32,
    notes: ['Возвращает калиброванное значение в милливольтах, в отличие от analogRead (сырые отсчёты). Точность зависит от заводской калибровки чипа.', 'Источник: https://docs.espressif.com/projects/arduino-esp32/en/latest/api/adc.html']
  },
  {
    name: 'analogSetAttenuation', category: 'Аналоговый ввод-вывод', signature: 'void analogSetAttenuation(adc_attenuation_t attenuation)',
    description: 'Задаёт ослабление АЦП и тем самым диапазон входных напряжений.',
    params: [{ name: 'attenuation', type: 'adc_attenuation_t', desc: 'ADC_0db, ADC_2_5db, ADC_6db, ADC_11db (ADC_11db — до ~3.1 В на ESP32/S3, до ~2.5 В на C3)' }], returns: 'ничего',
    example: 'analogSetAttenuation(ADC_11db);', platforms: E32,
    notes: [
      'Измеряемые диапазоны, мВ (ESP32 / ESP32-S3 / ESP32-C3): 0db — 100–950 / 0–950 / 0–750; 2.5db — 100–1250 / 0–1250 / 0–1050; 6db — 150–1750 / 0–1750 / 0–1300; 11db — 150–3100 / 0–3100 / 0–2500.',
      'По умолчанию установлено 11 дБ. Для одного пина есть analogSetPinAttenuation.',
      'Источник: https://docs.espressif.com/projects/arduino-esp32/en/latest/api/adc.html ; даташиты ESP32-S3/C3, раздел ADC Characteristics'
    ]
  },
  {
    name: 'ADC2 и WiFi', category: 'Ограничения ESP32', signature: 'ADC1 vs ADC2',
    description: 'Блок ADC2 используется WiFi-драйвером: analogRead() на пинах ADC2 не работает (возвращает ошибку/0), пока включён WiFi.',
    params: [], returns: '—',
    example: '// ESP32 DevKit: используйте GPIO32..39 (ADC1) вместе с WiFi',
    platforms: E32,
    warnings: [
      'ESP32: ADC2 — GPIO 0, 2, 4, 12, 13, 14, 15, 25, 26, 27. ADC1 — GPIO 32..39.',
      'ESP32-S3: ADC1 — GPIO1..10, ADC2 — GPIO11..20.',
      'ESP32-C3: ADC1 — GPIO0..4, ADC2 — GPIO5; в даташите отмечено, что ADC2 на части ревизий чипа неработоспособен (см. Errata), в ESP-IDF режим oneshot для ADC2 на C3 по умолчанию отключён.'
    ],
    notes: ['Источник: ESP-IDF soc/*/include/soc/adc_channel.h (esp32, esp32s3, esp32c3) и даташиты ESP32-S3/C3 https://documentation.espressif.com/esp32-c3_datasheet_en.pdf']
  },
  {
    name: 'Strapping-пины ESP32', category: 'Ограничения ESP32', signature: 'GPIO0, 2, 5, 12, 15 (ESP32)',
    description: 'Пины, уровень которых на старте определяет режим загрузки; внешние цепи на них могут мешать запуску.', params: [], returns: '—',
    example: '// Избегайте тяжёлых подтяжек на этих пинах',
    platforms: ['esp32'],
    warnings: [
      'GPIO0: LOW при старте — режим загрузки прошивки.',
      'GPIO12 (MTDI): HIGH при старте задаёт напряжение flash 1.8 В — может не запускаться с модулями на 3.3 В.',
      'GPIO2, GPIO5, GPIO15 тоже strapping (влияют на режим/лог загрузки).',
      'GPIO6..11 — SPI flash, не использовать.',
      'GPIO34..39 — только вход, без внутренних подтяжек.'
    ],
    notes: [
      'S3: strapping GPIO0 (режим загрузки), GPIO3 (источник JTAG), GPIO45 (напряжение VDD_SPI), GPIO46 (режим загрузки/лог ROM). C3: strapping GPIO2, GPIO8, GPIO9 (GPIO9 LOW — режим прошивки).',
      'Источник: даташиты https://documentation.espressif.com/esp32_datasheet_en.pdf , esp32-s3_datasheet_en.pdf , esp32-c3_datasheet_en.pdf (раздел Boot Configurations)'
    ]
  },
  {
    name: 'Preferences', category: 'Хранение (Preferences)', signature: 'Preferences prefs; prefs.begin(const char* name, bool readOnly = false)',
    description: 'Хранилище «ключ-значение» во flash (NVS). #include <Preferences.h>. Основные методы: putInt/getInt, putUInt, putFloat, putBool, putString/getString, remove, clear, end.',
    params: [{ name: 'name', type: 'const char*', desc: 'Имя пространства (до 15 символов)' }, { name: 'readOnly', type: 'bool', desc: 'true — только чтение' }],
    returns: 'bool (begin)',
    example: '#include <Preferences.h>\nPreferences prefs;\nprefs.begin("app", false);\nint n = prefs.getInt("count", 0);\nprefs.putInt("count", n + 1);\nprefs.end();',
    platforms: E32,
    notes: ['Имя ключа — до 15 символов. Только ESP32-семейство; на ESP8266 используйте EEPROM/LittleFS.']
  },
  {
    name: 'xTaskCreate', category: 'FreeRTOS', signature: 'BaseType_t xTaskCreate(TaskFunction_t fn, const char* name, uint32_t stack, void* param, UBaseType_t prio, TaskHandle_t* handle)',
    description: 'Создаёт задачу FreeRTOS. Без привязки к ядру.',
    params: [
      { name: 'fn', type: 'void (*)(void*)', desc: 'Функция задачи (внутри — бесконечный цикл)' },
      { name: 'name', type: 'const char*', desc: 'Имя' }, { name: 'stack', type: 'uint32_t', desc: 'Размер стека в байтах (в ESP-IDF FreeRTOS — байты, а не слова, как в ванильном FreeRTOS)' },
      { name: 'param', type: 'void*', desc: 'Параметр' }, { name: 'prio', type: 'UBaseType_t', desc: 'Приоритет' },
      { name: 'handle', type: 'TaskHandle_t*', desc: 'Дескриптор или NULL' }
    ],
    returns: 'pdPASS при успехе',
    example: 'void blink(void*) { for (;;) { digitalWrite(2, !digitalRead(2)); vTaskDelay(pdMS_TO_TICKS(500)); } }\nvoid setup() { xTaskCreate(blink, "blink", 2048, NULL, 1, NULL); }',
    platforms: E32,
    notes: ['xTaskCreatePinnedToCore(fn, name, stack, param, prio, handle, core) — с привязкой к ядру (0/1). У ESP32-C3 одно ядро, там привязка смысла не имеет.', 'Источник: https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/system/freertos_idf.html'],
    warnings: ['Задача не должна завершаться return — вызывайте vTaskDelete(NULL).']
  },
  {
    name: 'vTaskDelay', category: 'FreeRTOS', signature: 'void vTaskDelay(TickType_t ticks)',
    description: 'Приостанавливает задачу на число тиков (используйте pdMS_TO_TICKS(мс)).',
    params: [{ name: 'ticks', type: 'TickType_t', desc: 'Тики; pdMS_TO_TICKS(100) = 100 мс' }], returns: 'ничего',
    example: 'vTaskDelay(pdMS_TO_TICKS(100));', platforms: E32
  },
  {
    name: 'touchRead', category: 'Сенсорные пины', signature: 'touch_value_t touchRead(uint8_t pin)',
    description: 'Читает значение ёмкостного сенсорного пина.',
    params: [{ name: 'pin', type: 'uint8_t', desc: 'Сенсорный GPIO' }], returns: 'Условное значение; на ESP32 при касании уменьшается, на ESP32-S3 увеличивается',
    example: 'int v = touchRead(4); // T0 на ESP32',
    platforms: ['esp32', 'esp32s3'],
    notes: [
      'ESP32: T0=GPIO4, T1=0, T2=2, T3=15, T4=13, T5=12, T6=14, T7=27, T8=33, T9=32.',
      'ESP32-S3: сенсорные GPIO1..14 (T1=GPIO1 … T14=GPIO14); значение при касании растёт (в отличие от ESP32, где падает) — поэтому условия порога инвертируются.',
      'ESP32-C3 не имеет сенсорных пинов.',
      'Источники: https://docs.espressif.com/projects/arduino-esp32/en/latest/api/touch.html ; pins_arduino.h вариантов esp32 и esp32s3 в github.com/espressif/arduino-esp32'
    ]
  },
  {
    name: 'dacWrite', category: 'Аналоговый ввод-вывод', signature: 'void dacWrite(uint8_t pin, uint8_t value)',
    description: 'Выводит напряжение на ЦАП (8 бит, 0..255 → 0..3.3 В).',
    params: [{ name: 'pin', type: 'uint8_t', desc: 'GPIO25 или GPIO26' }, { name: 'value', type: 'uint8_t', desc: '0..255' }], returns: 'ничего',
    example: 'dacWrite(25, 128);', platforms: ['esp32'],
    notes: ['ЦАП только у классического ESP32; у S3 и C3 ЦАПа нет.']
  },
  {
    name: 'ESP.restart', category: 'Система ESP', signature: 'void ESP.restart()',
    description: 'Программная перезагрузка.', params: [], returns: 'ничего', example: 'ESP.restart();', platforms: E32
  },
  {
    name: 'ESP.getFreeHeap', category: 'Система ESP', signature: 'uint32_t ESP.getFreeHeap()',
    description: 'Свободная куча в байтах.', params: [], returns: 'uint32_t',
    example: 'Serial.println(ESP.getFreeHeap());', platforms: E32
  },
  {
    name: 'esp_sleep_enable_timer_wakeup', category: 'Система ESP', signature: 'esp_err_t esp_sleep_enable_timer_wakeup(uint64_t time_in_us)',
    description: 'Настраивает пробуждение по таймеру; затем esp_deep_sleep_start() или esp_light_sleep_start().',
    params: [{ name: 'time_in_us', type: 'uint64_t', desc: 'Время в мкс' }], returns: 'ESP_OK при успехе',
    example: 'esp_sleep_enable_timer_wakeup(10ULL * 1000000ULL);\nesp_deep_sleep_start();', platforms: E32,
    warnings: ['После deep sleep скетч стартует заново; переменные теряются (кроме RTC_DATA_ATTR).']
  }
]
