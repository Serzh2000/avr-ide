// Сниппеты для Arduino/ESP. Синтаксис тела — как в Monaco/VS Code ($1, ${1:текст}, $0).
import type { EditorPlatform } from './types'

export interface SnippetDef {
  /** Префикс, по которому сниппет находится в автодополнении. */
  prefix: string
  title: string
  description: string
  body: string
  platforms?: EditorPlatform[]
}

const ESP32F: EditorPlatform[] = ['esp32', 'esp32s3', 'esp32c3']

const t = (lines: string[]): string => lines.join('\n')

export const SNIPPETS: SnippetDef[] = [
  {
    prefix: 'sketch',
    title: 'Пустой скетч',
    description: 'setup() и loop()',
    body: t(['void setup() {', '\t$1', '}', '', 'void loop() {', '\t$0', '}', ''])
  },
  {
    prefix: 'blink',
    title: 'Мигание светодиодом без delay',
    description: 'Встроенный светодиод на millis()',
    body: t([
      'const unsigned long ${1:BLINK_MS} = ${2:500};',
      'unsigned long lastToggle = 0;',
      'bool ledOn = false;',
      '',
      'void setup() {',
      '\tpinMode(LED_BUILTIN, OUTPUT);',
      '}',
      '',
      'void loop() {',
      '\tif (millis() - lastToggle >= ${1:BLINK_MS}) {',
      '\t\tlastToggle = millis();',
      '\t\tledOn = !ledOn;',
      '\t\tdigitalWrite(LED_BUILTIN, ledOn ? HIGH : LOW);',
      '\t}',
      '}',
      ''
    ])
  },
  {
    prefix: 'millis',
    title: 'Таймер на millis() вместо delay()',
    description: 'Периодическое действие в loop()',
    body: t(['static unsigned long ${1:lastMs} = 0;', 'if (millis() - ${1:lastMs} >= ${2:1000}UL) {', '\t${1:lastMs} = millis();', '\t$0', '}'])
  },
  {
    prefix: 'timer',
    title: 'Таймер на millis() (синоним millis)',
    description: 'Периодическое действие в loop()',
    body: t(['static unsigned long ${1:lastMs} = 0;', 'if (millis() - ${1:lastMs} >= ${2:1000}UL) {', '\t${1:lastMs} = millis();', '\t$0', '}'])
  },
  {
    prefix: 'serial',
    title: 'Serial: начало и печать',
    description: 'Serial.begin в setup, вывод значения',
    body: t(['Serial.begin(${1:115200});', 'Serial.println(${2:"Старт"});'])
  },
  {
    prefix: 'serialprint',
    title: 'Serial: печать «имя = значение»',
    description: 'Отладочный вывод переменной',
    body: t(['Serial.print("${1:value} = ");', 'Serial.println(${1:value});'])
  },
  {
    prefix: 'sensor',
    title: 'Чтение аналогового датчика',
    description: 'analogRead + пересчёт map()',
    body: t([
      'int raw = analogRead(${1:A0});',
      'int percent = map(raw, ${2:0}, ${3:1023}, 0, 100);',
      'Serial.print("raw=");',
      'Serial.print(raw);',
      'Serial.print(" percent=");',
      'Serial.println(percent);'
    ])
  },
  {
    prefix: 'button',
    title: 'Кнопка с антидребезгом',
    description: 'INPUT_PULLUP, антидребезг на millis()',
    body: t([
      'const uint8_t BTN_PIN = ${1:4};',
      'bool btnState = HIGH;',
      'unsigned long btnChangedAt = 0;',
      '',
      'void setup() {',
      '\tpinMode(BTN_PIN, INPUT_PULLUP);',
      '}',
      '',
      'void loop() {',
      '\tbool now = digitalRead(BTN_PIN);',
      '\tif (now != btnState && millis() - btnChangedAt > 30) {',
      '\t\tbtnChangedAt = millis();',
      '\t\tbtnState = now;',
      '\t\tif (btnState == LOW) {',
      '\t\t\t$0// кнопка нажата',
      '\t\t}',
      '\t}',
      '}',
      ''
    ])
  },
  {
    prefix: 'pwm',
    title: 'ШИМ на пине',
    description: 'analogWrite (AVR/ESP8266)',
    platforms: ['avr', 'esp8266'],
    body: t(['pinMode(${1:9}, OUTPUT);', 'analogWrite(${1:9}, ${2:128}); // 0..255 (ESP8266: 0..1023)'])
  },
  {
    prefix: 'pwm',
    title: 'ШИМ на пине (LEDC)',
    description: 'ledcAttach/ledcWrite, ядро ESP32 3.x',
    platforms: ESP32F,
    body: t(['// ядро ESP32 3.x: ledcAttach(пин, частота, разрядность)', 'ledcAttach(${1:4}, ${2:5000}, ${3:8});', 'ledcWrite(${1:4}, ${4:128}); // 0..255 при 8 бит'])
  },
  {
    prefix: 'wifi',
    title: 'Подключение к WiFi (ESP32)',
    description: 'WiFi.begin и ожидание подключения',
    platforms: ESP32F,
    body: t([
      '#include <WiFi.h>',
      '',
      'const char* WIFI_SSID = "${1:ssid}";',
      'const char* WIFI_PASS = "${2:password}";',
      '',
      'void connectWiFi() {',
      '\tWiFi.mode(WIFI_STA);',
      '\tWiFi.begin(WIFI_SSID, WIFI_PASS);',
      '\tunsigned long started = millis();',
      '\twhile (WiFi.status() != WL_CONNECTED && millis() - started < 15000) {',
      '\t\tdelay(250);',
      '\t\tSerial.print(".");',
      '\t}',
      '\tif (WiFi.status() == WL_CONNECTED) {',
      '\t\tSerial.println(WiFi.localIP());',
      '\t} else {',
      '\t\tSerial.println("WiFi: не удалось подключиться");',
      '\t}',
      '}',
      ''
    ])
  },
  {
    prefix: 'wifi',
    title: 'Подключение к WiFi (ESP8266)',
    description: 'WiFi.begin и ожидание подключения',
    platforms: ['esp8266'],
    body: t([
      '#include <ESP8266WiFi.h>',
      '',
      'const char* WIFI_SSID = "${1:ssid}";',
      'const char* WIFI_PASS = "${2:password}";',
      '',
      'void connectWiFi() {',
      '\tWiFi.mode(WIFI_STA);',
      '\tWiFi.begin(WIFI_SSID, WIFI_PASS);',
      '\tunsigned long started = millis();',
      '\twhile (WiFi.status() != WL_CONNECTED && millis() - started < 15000) {',
      '\t\tdelay(250);',
      '\t\tSerial.print(".");',
      '\t}',
      '\tif (WiFi.status() == WL_CONNECTED) {',
      '\t\tSerial.println(WiFi.localIP());',
      '\t} else {',
      '\t\tSerial.println("WiFi: не удалось подключиться");',
      '\t}',
      '}',
      ''
    ])
  },
  {
    prefix: 'webserver',
    title: 'Веб-сервер (ESP32)',
    description: 'WebServer с одной страницей',
    platforms: ESP32F,
    body: t([
      '#include <WiFi.h>',
      '#include <WebServer.h>',
      '',
      'WebServer server(80);',
      '',
      'void handleRoot() {',
      '\tserver.send(200, "text/html; charset=utf-8", "<h1>${1:Привет}</h1>");',
      '}',
      '',
      '// в setup() после подключения к WiFi:',
      '//   server.on("/", handleRoot);',
      '//   server.begin();',
      '// в loop():',
      '//   server.handleClient();',
      ''
    ])
  },
  {
    prefix: 'webserver',
    title: 'Веб-сервер (ESP8266)',
    description: 'ESP8266WebServer с одной страницей',
    platforms: ['esp8266'],
    body: t([
      '#include <ESP8266WiFi.h>',
      '#include <ESP8266WebServer.h>',
      '',
      'ESP8266WebServer server(80);',
      '',
      'void handleRoot() {',
      '\tserver.send(200, "text/html; charset=utf-8", "<h1>${1:Привет}</h1>");',
      '}',
      '',
      '// в setup() после подключения к WiFi:',
      '//   server.on("/", handleRoot);',
      '//   server.begin();',
      '// в loop():',
      '//   server.handleClient();',
      ''
    ])
  },
  {
    prefix: 'espui',
    title: 'Заготовка ESPUI',
    description: 'Точка доступа, кнопка и слайдер',
    platforms: ['esp8266', ...ESP32F],
    body: t([
      '#include <ESPUI.h>',
      '',
      'void buttonCallback(Control* sender, int type) {',
      '\tif (type == B_DOWN) {',
      '\t\t$0// кнопка нажата',
      '\t}',
      '}',
      '',
      'void sliderCallback(Control* sender, int type) {',
      '\tint value = sender->value.toInt();',
      '\tSerial.println(value);',
      '}',
      '',
      '// в setup() после запуска WiFi:',
      '//   ESPUI.button("${1:Кнопка}", &buttonCallback, ControlColor::Alizarin, "Нажми");',
      '//   ESPUI.slider("Слайдер", &sliderCallback, ControlColor::Wetasphalt, 50, 0, 100);',
      '//   ESPUI.begin("${2:Панель управления}");',
      ''
    ])
  },
  {
    prefix: 'interrupt',
    title: 'Прерывание по пину',
    description: 'attachInterrupt и обработчик (AVR)',
    platforms: ['avr'],
    body: t([
      'volatile bool ${1:flag} = false;',
      '',
      'void onInterrupt() {',
      '\t${1:flag} = true;',
      '}',
      '',
      '// в setup():',
      '//   pinMode(${2:2}, INPUT_PULLUP);',
      '//   attachInterrupt(digitalPinToInterrupt(${2:2}), onInterrupt, ${3:FALLING});',
      ''
    ])
  },
  {
    prefix: 'interrupt',
    title: 'Прерывание по пину (ESP)',
    description: 'attachInterrupt с IRAM_ATTR',
    platforms: ['esp8266', ...ESP32F],
    body: t([
      'volatile bool ${1:flag} = false;',
      '',
      '// на ESP8266 вместо IRAM_ATTR используйте ICACHE_RAM_ATTR',
      'void IRAM_ATTR onInterrupt() {',
      '\t${1:flag} = true;',
      '}',
      '',
      '// в setup():',
      '//   pinMode(${2:4}, INPUT_PULLUP);',
      '//   attachInterrupt(digitalPinToInterrupt(${2:4}), onInterrupt, ${3:FALLING});',
      ''
    ])
  },
  {
    prefix: 'eeprom',
    title: 'EEPROM: чтение и запись',
    description: 'EEPROM.get/put (на ESP нужны begin и commit)',
    body: t([
      '#include <EEPROM.h>',
      '',
      'struct Settings {',
      '\tint ${1:value};',
      '};',
      'Settings settings;',
      '',
      '// ESP: в setup() EEPROM.begin(512); после записи EEPROM.commit();',
      '// чтение:  EEPROM.get(0, settings);',
      '// запись:  EEPROM.put(0, settings);',
      ''
    ])
  },
  {
    prefix: 'preferences',
    title: 'Preferences: хранение настроек (ESP32)',
    description: 'Сохранение и чтение значения в NVS',
    platforms: ESP32F,
    body: t([
      '#include <Preferences.h>',
      '',
      'Preferences prefs;',
      '',
      '// запись:',
      'prefs.begin("${1:app}", false);',
      'prefs.putInt("${2:key}", ${3:42});',
      'prefs.end();',
      '',
      '// чтение:',
      'prefs.begin("${1:app}", true);',
      'int saved = prefs.getInt("${2:key}", 0);',
      'prefs.end();'
    ])
  },
  {
    prefix: 'servo',
    title: 'Сервопривод',
    description: 'Servo: подключение и поворот',
    body: t(['#include <Servo.h>', '', 'Servo servo;', '', '// в setup(): servo.attach(${1:9});', '// поворот:    servo.write(${2:90}); // 0..180', ''])
  },
  {
    prefix: 'for',
    title: 'Цикл for',
    description: 'for (int i = 0; i < n; i++)',
    body: t(['for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {', '\t$0', '}'])
  },
  {
    prefix: 'ifelse',
    title: 'if / else',
    description: 'Условие с веткой else',
    body: t(['if (${1:cond}) {', '\t$2', '} else {', '\t$0', '}'])
  },
  {
    prefix: 'switch',
    title: 'switch',
    description: 'Оператор выбора',
    body: t(['switch (${1:value}) {', '\tcase ${2:0}:', '\t\t$0', '\t\tbreak;', '\tdefault:', '\t\tbreak;', '}'])
  },
  {
    prefix: 'define',
    title: '#define',
    description: 'Макрос-константа',
    body: '#define ${1:NAME} ${2:value}'
  },
  {
    prefix: 'ifdef',
    title: '#ifdef платформы',
    description: 'Код для конкретной платформы',
    body: t(['#if defined(ESP32)', '\t$1', '#elif defined(ESP8266)', '\t$2', '#else', '\t$0', '#endif'])
  }
]
