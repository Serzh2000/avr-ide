// Генератор C++ обвязки ESP: ESPAsyncWebServer + WebSocket /ws, страница из PROGMEM (raw-строка).
//
// Решение «PROGMEM raw-строка, без gzip, без LittleFS»:
//  + один файл, нет шага загрузки файловой системы (LittleFS data upload), нет зависимости от схемы разделов;
//  + страница версионируется вместе со скетчем и не рассинхронизируется с WebSocket-протоколом;
//  - без сжатия: страница занимает во флеше свой размер и отдаётся по сети как есть (для ESP8266 держите её компактной).
// gzip и LittleFS — возможное расширение (TODO): gzip требует сжатия на стороне IDE (zlib в main-процессе),
// LittleFS — отдельного шага загрузки. См. data/webdesign/API_NOTES.md.
import { cppString, fmt, identProblem, intLiteral, num, rawDelimiter } from './escape'
import { bindingFlags } from './js'
import { blockVarRefs } from './refs'
import { usedTypes } from './html'
import { generateSite } from './site'
import { pinKey, walk } from './factory'
import { pinLiteral, pwmMax } from './pins'
import { WEB_TCP_LIBRARIES } from './targets'
import { GENERATOR_VERSION } from './types'
import type { SiteOutput, VarType, WdProject, WdVariable } from './types'

export interface CppOutput {
  /** web_generated.h — полная обвязка. */
  header: string
  /** Пример скетча, подключающего обвязку. */
  sketch: string
}

interface VarUse {
  v: WdVariable
  toUi: boolean
  fromUi: boolean
}
interface PinUse {
  pin: number
  mode: 'digital' | 'analog'
  invert: boolean
  pull: boolean
  toPin: boolean
  fromPin: boolean
}

export function collectUses(p: WdProject): { vars: VarUse[]; pins: PinUse[] } {
  const vmap = new Map<string, VarUse>()
  const pmap = new Map<number, PinUse>()
  walk(p.blocks, (b) => {
    for (const r of blockVarRefs(b)) {
      const v = p.variables.find((x) => x.name === r.name)
      if (!v) continue
      const u = vmap.get(v.name) ?? { v, toUi: false, fromUi: false }
      u.toUi = u.toUi || r.toUi
      u.fromUi = u.fromUi || r.fromUi
      vmap.set(v.name, u)
    }
    const bd = b.binding
    const f = bindingFlags(bd)
    if (bd.kind === 'pin') {
      const u = pmap.get(bd.pin) ?? {
        pin: bd.pin, mode: bd.mode, invert: !!bd.invert, pull: bd.pull === 'up', toPin: false, fromPin: false
      }
      u.toPin = u.toPin || f.in
      u.fromPin = u.fromPin || f.out
      pmap.set(bd.pin, u)
    }
  })
  // переменные объявляем все (даже без привязки) в порядке проекта
  const vars: VarUse[] = p.variables.map((v) => vmap.get(v.name) ?? { v, toUi: false, fromUi: false })
  return { vars, pins: [...pmap.values()].sort((a, b) => a.pin - b.pin) }
}

export function initLiteral(v: WdVariable): string {
  const s = v.init.trim()
  switch (v.type as VarType) {
    case 'bool':
      return s === 'true' ? 'true' : 'false'
    case 'int':
      return /^-?\d+$/.test(s) ? s : '0'
    case 'float': {
      const n = Number(s)
      if (s === '' || !Number.isFinite(n)) return '0.0f'
      const t = fmt(n)
      return (t.includes('.') ? t : t + '.0') + 'f'
    }
    default:
      return cppString(v.init)
  }
}

const cppType = (t: VarType): string => (t === 'String' ? 'String' : t)

const HELPERS = String.raw`
#define WD_UNUSED __attribute__((unused))

static AsyncWebSocket wd_ws(WD_WS_PATH);
static AsyncWebServer wd_server(WD_PORT);
static uint32_t wd_lastPoll = 0;

// ---- JSON-кодирование значений ----
WD_UNUSED static String wd_json(bool v) { return String(v ? "true" : "false"); }
WD_UNUSED static String wd_json(int v) { return String(v); }
WD_UNUSED static String wd_json(long v) { return String(v); }
WD_UNUSED static String wd_json(float v) {
  if (isnan(v) || isinf(v)) return String("null");
  return String(v, 3);
}
WD_UNUSED static String wd_json(const String& s) {
  String o;
  o.reserve(s.length() + 2);
  o += '"';
  for (size_t i = 0; i < s.length(); i++) {
    char c = s[i];
    if (c == '"' || c == '\\') { o += '\\'; o += c; }
    else if (c == '\n') o += "\\n";
    else if (c == '\r') o += "\\r";
    else if (c == '\t') o += "\\t";
    else if ((uint8_t)c < 0x20) { char b[8]; snprintf(b, sizeof b, "\\u%04x", (unsigned)(uint8_t)c); o += b; }
    else o += c;
  }
  o += '"';
  return o;
}

// Отправить всем клиентам {"t":"set","k":key,"v":value}
template <typename T>
WD_UNUSED static void wd_send(const char* key, const T& v) {
  String m = F("{\"t\":\"set\",\"k\":\"");
  m += key;
  m += F("\",\"v\":");
  m += wd_json(v);
  m += '}';
  wd_ws.textAll(m);
}

// ---- разбор входящего {"t":"set","k":"имя","v":значение} (формат фиксирован страницей) ----
WD_UNUSED static bool wd_parse(const String& m, String& key, String& val) {
  int a = m.indexOf("\"k\":\"");
  if (a < 0) return false;
  a += 5;
  int b = m.indexOf('"', a);
  if (b < 0) return false;
  key = m.substring(a, b);
  int v = m.indexOf("\"v\":", b);
  if (v < 0) return false;
  v += 4;
  val = "";
  int n = (int)m.length();
  if (v < n && m[v] == '"') {
    v++;
    while (v < n && m[v] != '"') {
      char c = m[v];
      if (c == '\\' && v + 1 < n) {
        char e = m[++v];
        if (e == 'n') val += '\n';
        else if (e == 'r') val += '\r';
        else if (e == 't') val += '\t';
        else if (e == 'u' && v + 4 < n) {
          unsigned cp = (unsigned)strtoul(m.substring(v + 1, v + 5).c_str(), NULL, 16);
          v += 4;
          if (cp < 0x80) val += (char)cp;
          else if (cp < 0x800) { val += (char)(0xC0 | (cp >> 6)); val += (char)(0x80 | (cp & 0x3F)); }
          else { val += (char)(0xE0 | (cp >> 12)); val += (char)(0x80 | ((cp >> 6) & 0x3F)); val += (char)(0x80 | (cp & 0x3F)); }
        } else val += e;
      } else val += c;
      v++;
    }
  } else {
    while (v < n && m[v] != ',' && m[v] != '}') val += m[v++];
    val.trim();
  }
  return true;
}

WD_UNUSED static bool wd_truthy(const String& s) { return s == "true" || s.toFloat() != 0.0f; }
`

// Отправить строку в блок «Консоль логов», привязанный к String-переменной key (повторяющиеся строки не теряются).
// Подсказка для блока OTA: обработчик приёма прошивки НЕ генерируется (пишите сами). Схема взята из примера UploadFlash
// библиотеки ESP32Async/ESPAsyncWebServer (только ESP32; на ESP8266 пример отсутствует — TODO проверить Update.h для ESP8266).
const OTA_NOTE = `
// ---- OTA: на странице есть форма загрузки прошивки (POST multipart, поле "firmware"). Обработчик на стороне прошивки НЕ создаётся. ----
// Пример (по UploadFlash из ESP32Async/ESPAsyncWebServer, ESP32): в wd_server.on("/update", HTTP_POST, ответ, загрузка)
//   загрузка = [](AsyncWebServerRequest* r, String filename, size_t index, uint8_t* data, size_t len, bool final) {
//     if (!index) Update.begin(UPDATE_SIZE_UNKNOWN, U_FLASH);   // #include <Update.h>
//     Update.write(data, len);
//     if (final) Update.end(true);
//   }
// TODO: проверить на железе; перезагрузку (ESP.restart()) и защиту паролем добавьте сами.`

const LOG_HELPER = String.raw`
WD_UNUSED static void wdLog(const char* key, const String& line) { if (wd_ws.count()) wd_send(key, line); }
`

export function generateCpp(p: WdProject, site?: SiteOutput): CppOutput {
  const s = site ?? generateSite(p)
  const { vars, pins } = collectUses(p)
  const esp32 = p.platform === 'esp32'
  const pico = p.platform === 'pico-w'
  const d = p.device
  const L: string[] = []
  const push = (...x: string[]): void => {
    L.push(...x)
  }
  const delim = rawDelimiter(s.bundle)
  const title = p.page.title.replace(/[\r\n\\*/]/g, ' ')

  push(
    `// web_generated.h — сгенерировано «Веб-конструктором» (генератор v${GENERATOR_VERSION}). Не редактируйте вручную:`,
    `// файл перезаписывается при экспорте. Заголовок страницы: ${title}`,
    `// Нужны библиотеки: ESPAsyncWebServer + ${WEB_TCP_LIBRARIES[p.platform]} (см. data/webdesign/API_NOTES.md).`,
    '#pragma once',
    '#include <Arduino.h>',
    ...(pico ? [
      '#if !defined(ARDUINO_RASPBERRY_PI_PICO_W) && !defined(ARDUINO_RASPBERRY_PI_PICO_2W)',
      '  #error "web_generated.h: выберите Raspberry Pi Pico W / Pico 2 W (Arduino-Pico)"',
      '#endif',
      '#include <WiFi.h>',
      '#include <RPAsyncTCP.h>'
    ] : [
      '#if defined(ESP32)',
      '  #include <WiFi.h>',
      '  #include <AsyncTCP.h>',
      '#else',
      '  #include <ESP8266WiFi.h>',
      '  #include <ESPAsyncTCP.h>',
      '#endif'
    ]),
    '#include <ESPAsyncWebServer.h>',
    '',
    `#define WD_PORT ${intLiteral(num(d.port, 80, 1, 65535))}`,
    `#define WD_WS_PATH ${cppString(d.wsPath)}`,
    `#define WD_UPDATE_MS ${intLiteral(num(d.updateMs, 200, 20, 60000))}UL`,
    '#define WD_ANALOG_DEADBAND 2'
  )
  if (p.wifi.mode === 'sta') {
    push(`static const char WD_SSID[] = ${cppString(p.wifi.ssid)};`, `static const char WD_PASS[] = ${cppString(p.wifi.password)};`)
  }
  push(
    `static const char WD_AP_SSID[] = ${cppString(p.wifi.apSsid)};`,
    `static const char WD_AP_PASS[] = ${cppString(p.wifi.apPassword)};`,
    `static const char WD_HOSTNAME[] = ${cppString(p.wifi.hostname)};`,
    '',
    '// Страница целиком (HTML+CSS+JS) лежит во флеше.',
    `static const char WD_PAGE[] PROGMEM = R"${delim}(${s.bundle})${delim}";`,
    'static const size_t WD_PAGE_LEN = sizeof(WD_PAGE) - 1;',
    HELPERS.trimEnd(),
    ...(usedTypes(p).has('log') ? [LOG_HELPER.trim()] : []),
    ...(usedTypes(p).has('ota') ? OTA_NOTE.split('\n') : []),
    '',
    '// ---- переменные страницы (меняйте их в своём коде) ----'
  )
  for (const u of vars) if (!u.v.external) push(`${cppType(u.v.type)} ${u.v.name} = ${initLiteral(u.v)};`)

  // пины
  const analogOut = pins.filter((x) => x.toPin && x.mode === 'analog')
  const chan = new Map<number, number>()
  analogOut.forEach((x, i) => chan.set(x.pin, i))
  push('', '// ---- пины ----')
  for (const u of pins) {
    const role = u.fromPin ? (u.mode === 'analog' ? 'in-analog' : 'in-digital') : u.mode === 'analog' ? 'out-pwm' : 'out-digital'
    const lit = pinLiteral(p.platform, u.pin, role)
    if (u.fromPin) {
      if (u.mode === 'digital')
        push(`WD_UNUSED static bool wd_rd_${u.pin}() { return ${u.invert ? '!' : ''}(digitalRead(${lit}) == HIGH); }`)
      else push(`WD_UNUSED static int wd_rd_${u.pin}() { return analogRead(${lit}); }`)
    }
    if (u.toPin) {
      push(`static int wd_out_${u.pin} = -1;  // последнее значение, присланное страницей`)
      if (u.mode === 'digital') {
        push(`WD_UNUSED static void wd_wr_${u.pin}(const String& v) { bool l = wd_truthy(v); wd_out_${u.pin} = l ? 1 : 0; digitalWrite(${lit}, (${u.invert ? '!l' : 'l'}) ? HIGH : LOW); }`)
      } else {
        const max = pwmMax(p.platform, Math.round(num(d.pwmBits, 8, 1, 16)))
        const target = esp32 ? (d.ledcApi === 'v2' ? String(chan.get(u.pin)) : lit) : lit
        const write = esp32 ? `ledcWrite(${target}, duty)` : `analogWrite(${lit}, duty)`
        push(`WD_UNUSED static void wd_wr_${u.pin}(const String& v) { int duty = constrain((int)v.toFloat(), 0, ${max}); wd_out_${u.pin} = duty; ${write}; }`)
      }
    }
  }

  // состояние → страница
  const toUiVars = vars.filter((u) => u.toUi)
  const fromPins = pins.filter((u) => u.fromPin)
  const toPins = pins.filter((u) => u.toPin)
  push('', '// ---- состояние для страницы при подключении ----', 'static String wd_state() {', '  String s = F("{\\"t\\":\\"state\\",\\"v\\":{\\"_\\":0");')
  const parts: Array<{ key: string; expr: string }> = [
    ...vars.filter((u) => u.toUi || u.fromUi).map((u) => ({ key: u.v.name, expr: u.v.name })),
    ...fromPins.map((u) => ({ key: pinKey(u.pin), expr: `wd_rd_${u.pin}()` }))
  ]
  for (const x of parts) push(`  s += F(",\\"${x.key}\\":"); s += wd_json(${x.expr});`)
  for (const u of toPins)
    push(`  if (wd_out_${u.pin} >= 0) { s += F(",\\"${pinKey(u.pin)}\\":"); s += ${u.mode === 'digital' ? `wd_json(wd_out_${u.pin} != 0)` : `wd_json(wd_out_${u.pin})`}; }`)
  push('  s += F("}}");', '  return s;', '}')

  // страница → устройство
  const fromUiVars = vars.filter((u) => u.fromUi)
  push('', '// ---- применение значения от страницы ----', 'static void wd_apply(const String& key, const String& val) {')
  if (!fromUiVars.length && !toPins.length) push('  (void)key; (void)val;')
  let first = true
  const cond = (k: string): string => {
    const r = `${first ? '  if' : '  else if'} (key == "${k}")`
    first = false
    return r
  }
  for (const u of fromUiVars) {
    const n = u.v.name
    let rhs: string
    switch (u.v.type) {
      case 'bool': rhs = 'wd_truthy(val)'; break
      case 'int': rhs = '(int)val.toFloat()'; break
      case 'float': rhs = 'val.toFloat()'; break
      default: rhs = 'val'
    }
    push(`${cond(n)} { ${n} = ${rhs}; }`)
  }
  for (const u of toPins) push(`${cond(pinKey(u.pin))} { wd_wr_${u.pin}(val); }`)
  push('}')

  push(
    '',
    'static void wd_onEvent(AsyncWebSocket* server, AsyncWebSocketClient* client, AwsEventType type, void* arg, uint8_t* data, size_t len) {',
    '  (void)server;',
    '  if (type == WS_EVT_CONNECT) {',
    '    client->text(wd_state());',
    '  } else if (type == WS_EVT_DATA) {',
    '    AwsFrameInfo* info = (AwsFrameInfo*)arg;',
    '    // принимаем только цельные сообщения одним кадром и ограниченного размера',
    '    if (info->final && info->index == 0 && info->len == len && len <= 512) {',
    '      String m;',
    '      m.reserve(len);',
    '      for (size_t i = 0; i < len; i++) m += (char)data[i];',
    '      String key, val;',
    '      if (wd_parse(m, key, val)) wd_apply(key, val);',
    '    }',
    '  }',
    '}'
  )

  // слежение за изменениями
  push('', '// ---- предыдущие значения для отправки только изменений ----')
  for (const u of toUiVars) push(`static ${cppType(u.v.type)} wd_prev_${u.v.name} = ${initLiteral(u.v)};`)
  for (const u of fromPins) push(`static int wd_prev_gpio${u.pin} = -1;`)

  // begin
  push('', 'void wdBegin() {')
  for (const u of pins) {
    const role = u.fromPin ? (u.mode === 'analog' ? 'in-analog' : 'in-digital') : u.mode === 'analog' ? 'out-pwm' : 'out-digital'
    const lit = pinLiteral(p.platform, u.pin, role)
    if (u.toPin && u.mode === 'digital') push(`  pinMode(${lit}, OUTPUT);`)
    if (u.toPin && u.mode === 'analog') {
      if (esp32) {
        if (d.ledcApi === 'v2') {
          push(`  ledcSetup(${chan.get(u.pin)}, ${intLiteral(num(d.pwmFreq, 5000, 1, 80000))}, ${intLiteral(num(d.pwmBits, 8, 1, 16))});`, `  ledcAttachPin(${lit}, ${chan.get(u.pin)});`)
        } else push(`  ledcAttach(${lit}, ${intLiteral(num(d.pwmFreq, 5000, 1, 80000))}, ${intLiteral(num(d.pwmBits, 8, 1, 16))});`)
      } else push(`  pinMode(${lit}, OUTPUT);`)
    }
    if (u.fromPin && u.mode === 'digital') push(`  pinMode(${lit}, ${u.pull ? 'INPUT_PULLUP' : 'INPUT'});`)
  }
  push('  // WiFi')
  if (p.wifi.mode === 'sta') {
    push(
      '  WiFi.mode(WIFI_STA);',
      esp32 || pico ? '  WiFi.setHostname(WD_HOSTNAME);' : '  WiFi.hostname(WD_HOSTNAME);',
      pico ? '  if (WD_SSID[0]) WiFi.begin(WD_SSID, WD_PASS);' : '  WiFi.begin(WD_SSID, WD_PASS);',
      '  uint32_t t0 = millis();',
      pico ? '  while (WD_SSID[0] && WiFi.status() != WL_CONNECTED && millis() - t0 < 15000UL) delay(250);'
        : '  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 15000UL) delay(250);',
      '  if (WiFi.status() != WL_CONNECTED) {',
      '    WiFi.mode(WIFI_AP);',
      p.wifi.apPassword ? '    WiFi.softAP(WD_AP_SSID, WD_AP_PASS);' : '    WiFi.softAP(WD_AP_SSID);',
      '  }'
    )
  } else {
    push('  WiFi.mode(WIFI_AP);', p.wifi.apPassword ? '  WiFi.softAP(WD_AP_SSID, WD_AP_PASS);' : '  WiFi.softAP(WD_AP_SSID);')
  }
  if (d.serialLog)
    push(
      '  Serial.print(F("[web] http://"));',
      ...(pico ? [
        '  Serial.print(WiFi.getMode() == WIFI_AP ? WiFi.softAPIP() : WiFi.localIP());',
        '  if (WD_PORT != 80) { Serial.print(\':\'); Serial.print(WD_PORT); }',
        '  Serial.println();'
      ] : ['  Serial.println(WiFi.getMode() == WIFI_AP ? WiFi.softAPIP() : WiFi.localIP());'])
    )
  const send = !pico && d.serveApi === 'send_P' ? 'send_P' : 'send'
  push(
    '  wd_ws.onEvent(wd_onEvent);',
    '  wd_server.addHandler(&wd_ws);',
    '  wd_server.on("/", HTTP_GET, [](AsyncWebServerRequest* request) {',
    `    request->${send}(200, "text/html", (const uint8_t*)WD_PAGE, WD_PAGE_LEN);`,
    '  });',
    '  wd_server.on("/favicon.ico", HTTP_GET, [](AsyncWebServerRequest* request) { request->send(204); });',
    '  wd_server.onNotFound([](AsyncWebServerRequest* request) { request->send(404, "text/plain", "Not found"); });',
    '  wd_server.begin();',
    '}'
  )

  // loop
  push('', 'void wdLoop() {', '  wd_ws.cleanupClients();', '  uint32_t now = millis();', '  if (now - wd_lastPoll < WD_UPDATE_MS) return;', '  wd_lastPoll = now;', '  if (wd_ws.count() == 0) return;')
  for (const u of toUiVars) {
    const n = u.v.name
    push(`  if (${n} != wd_prev_${n}) { wd_prev_${n} = ${n}; wd_send("${n}", ${n}); }`)
  }
  for (const u of fromPins) {
    if (u.mode === 'digital')
      push(`  { int v = wd_rd_${u.pin}() ? 1 : 0; if (v != wd_prev_gpio${u.pin}) { wd_prev_gpio${u.pin} = v; wd_send("${pinKey(u.pin)}", (bool)v); } }`)
    else
      push(`  { int v = wd_rd_${u.pin}(); if (wd_prev_gpio${u.pin} < 0 || abs(v - wd_prev_gpio${u.pin}) >= WD_ANALOG_DEADBAND) { wd_prev_gpio${u.pin} = v; wd_send("${pinKey(u.pin)}", v); } }`)
  }
  push('}', '')

  const sketch = [
    '// Пример скетча. Переменные страницы объявлены в web_generated.h — обновляйте их в loop().',
    '#include "web_generated.h"',
    '',
    'void setup() {',
    '  Serial.begin(115200);',
    '  wdBegin();',
    '}',
    '',
    'void loop() {',
    '  wdLoop();',
    ...vars.filter((u) => u.toUi).map((u) => `  // ${u.v.name} = ...;  // значение уйдёт на страницу автоматически`),
    '}',
    ''
  ].join('\n')

  void identProblem
  return { header: L.join('\n'), sketch }
}
