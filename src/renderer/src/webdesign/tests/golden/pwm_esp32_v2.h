// web_generated.h — сгенерировано «Веб-конструктором» (генератор v1). Не редактируйте вручную:
// файл перезаписывается при экспорте. Заголовок страницы: ESP — панель управления
// Нужны библиотеки: ESPAsyncWebServer + AsyncTCP (см. data/webdesign/API_NOTES.md).
#pragma once
#include <Arduino.h>
#if defined(ESP32)
  #include <WiFi.h>
  #include <AsyncTCP.h>
#else
  #include <ESP8266WiFi.h>
  #include <ESPAsyncTCP.h>
#endif
#include <ESPAsyncWebServer.h>

#define WD_PORT 80
#define WD_WS_PATH "/ws"
#define WD_UPDATE_MS 200UL
#define WD_ANALOG_DEADBAND 2
static const char WD_SSID[] = "";
static const char WD_PASS[] = "";
static const char WD_AP_SSID[] = "ESP-Web";
static const char WD_AP_PASS[] = "";
static const char WD_HOSTNAME[] = "esp-web";

// Страница целиком (HTML+CSS+JS) лежит во флеше.
static const char WD_PAGE[] PROGMEM = R"WDPAGE(<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>ESP — панель управления</title>
<style>
:root{--wd-bg:#f4f6fb;--wd-surface:#ffffff;--wd-text:#1b2233;--wd-muted:#6b7488;--wd-primary:#4f6df5;--wd-accent:#8b5cf6;--wd-success:#16a34a;--wd-warning:#d97706;--wd-danger:#dc2626;--wd-border:#e2e6f0;--wd-shadow-sm:0 1px 2px rgba(16,24,40,.06),0 1px 3px rgba(16,24,40,.10);--wd-shadow-md:0 4px 8px -2px rgba(16,24,40,.10),0 2px 4px -2px rgba(16,24,40,.06);--wd-shadow-lg:0 16px 32px -8px rgba(16,24,40,.18),0 6px 12px -6px rgba(16,24,40,.10);color-scheme:light;--wd-font:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;--wd-base:16px;--wd-radius:12px;--wd-max:1100px}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--wd-bg:#0f1320;--wd-surface:#181e30;--wd-text:#e8ecf8;--wd-muted:#8f98b3;--wd-primary:#7b93ff;--wd-accent:#a78bfa;--wd-success:#34d399;--wd-warning:#fbbf24;--wd-danger:#f87171;--wd-border:#2a3350;--wd-shadow-sm:0 1px 2px rgba(0,0,0,.4);--wd-shadow-md:0 4px 10px -2px rgba(0,0,0,.5);--wd-shadow-lg:0 18px 36px -8px rgba(0,0,0,.65);color-scheme:dark}}
:root[data-theme="dark"]{--wd-bg:#0f1320;--wd-surface:#181e30;--wd-text:#e8ecf8;--wd-muted:#8f98b3;--wd-primary:#7b93ff;--wd-accent:#a78bfa;--wd-success:#34d399;--wd-warning:#fbbf24;--wd-danger:#f87171;--wd-border:#2a3350;--wd-shadow-sm:0 1px 2px rgba(0,0,0,.4);--wd-shadow-md:0 4px 10px -2px rgba(0,0,0,.5);--wd-shadow-lg:0 18px 36px -8px rgba(0,0,0,.65);color-scheme:dark}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
[hidden]{display:none!important}
body{margin:0;min-height:100vh;background:var(--wd-bg);color:var(--wd-text);font-family:var(--wd-font);font-size:var(--wd-base);line-height:1.55;-webkit-font-smoothing:antialiased}
h1,h2,h3,h4,p{margin:0}
h1{font-size:2.2em;line-height:1.15;letter-spacing:-.02em}
h2{font-size:1.65em;line-height:1.2;letter-spacing:-.01em}
h3{font-size:1.25em;line-height:1.3}
h4{font-size:1.05em;line-height:1.35}
.wd-section{width:100%;padding:32px 20px}
.wd-inner{max-width:var(--wd-max);margin:0 auto;display:flex;flex-direction:column;gap:16px}
.wd-grid{display:grid;gap:16px;grid-template-columns:repeat(3,minmax(0,1fr))}
.wd-flex{display:flex;gap:12px}
.wd-card{display:flex;flex-direction:column;gap:12px;min-width:0}
.wd-card-title{display:flex;align-items:center;gap:8px;font-weight:600;font-size:1.05em}
.wd-muted{color:var(--wd-muted)}
.wd-label{color:var(--wd-muted);font-size:.9em}
.wd-btn{appearance:none;border:0;cursor:pointer;font:inherit;font-weight:600;padding:.7em 1.3em;border-radius:var(--wd-radius);background:var(--wd-primary);color:#fff;transition:transform .15s,box-shadow .15s,filter .15s;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none}
.wd-btn:hover{filter:brightness(1.08)}
.wd-btn:active,.wd-btn[data-down="1"]{transform:translateY(1px) scale(.98);filter:brightness(.95)}
.wd-btn:focus-visible,.wd-input:focus-visible{outline:2px solid var(--wd-accent);outline-offset:2px}
.wd-field{display:flex;flex-direction:column;gap:8px}
.wd-field-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:.9em;color:var(--wd-muted)}
.wd-field-head output{color:var(--wd-text);font-weight:600;font-variant-numeric:tabular-nums}
.wd-range{-webkit-appearance:none;appearance:none;width:100%;height:8px;margin:6px 0;border-radius:4px;outline:none;background:linear-gradient(to right,var(--wd-primary) var(--wd-fill,0%),var(--wd-border) var(--wd-fill,0%))}
.wd-range::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:#fff;border:3px solid var(--wd-primary);box-shadow:0 1px 4px rgba(0,0,0,.3);cursor:grab}
.wd-range::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:#fff;border:3px solid var(--wd-primary);box-shadow:0 1px 4px rgba(0,0,0,.3);cursor:grab}
.wd-range:focus-visible{outline:2px solid var(--wd-accent);outline-offset:4px}
.wd-input{width:100%;font:inherit;color:var(--wd-text);background:var(--wd-bg);border:1px solid var(--wd-border);border-radius:calc(var(--wd-radius) * .7);padding:.6em .8em}
.wd-gauge{text-align:center}
.wd-gauge svg{width:100%;max-width:240px;display:block;margin:0 auto}
.wd-g-bg,.wd-g-fg{fill:none;stroke-width:10;stroke-linecap:round}
.wd-g-bg{stroke:var(--wd-border)}
.wd-g-fg{stroke:var(--wd-primary);stroke-dasharray:100;stroke-dashoffset:100;transition:stroke-dashoffset .6s ease}
.wd-g-text{fill:var(--wd-text);font-size:19px;font-weight:700;font-variant-numeric:tabular-nums}
.wd-icon{display:inline-block;vertical-align:middle;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.wd-tools{position:fixed;top:12px;right:12px;display:flex;gap:8px;align-items:center;z-index:50}
.wd-tbtn{appearance:none;cursor:pointer;width:38px;height:38px;border-radius:50%;border:1px solid var(--wd-border);background:var(--wd-surface);color:var(--wd-text);display:grid;place-items:center;box-shadow:var(--wd-shadow-sm)}
.wd-tbtn:hover{border-color:var(--wd-primary)}
.wd-tbtn:focus-visible{outline:2px solid var(--wd-accent);outline-offset:2px}
.wd-status{display:flex;align-items:center;gap:8px;padding:0 12px;height:38px;border-radius:19px;border:1px solid var(--wd-border);background:var(--wd-surface);font-size:.8em;color:var(--wd-muted);box-shadow:var(--wd-shadow-sm)}
.wd-status i{width:9px;height:9px;border-radius:50%;background:var(--wd-danger)}
.wd-status[data-state="online"] i{background:var(--wd-success)}
.wd-status[data-state="connecting"] i{background:var(--wd-warning)}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
.b-main{padding:32px}
@media (max-width:900px){.wd-section{padding:26px 16px}h1{font-size:1.9em}}
@media (max-width:600px){.wd-section{padding:20px 14px}h1{font-size:1.6em}h2{font-size:1.4em}.wd-status span{display:none}.wd-status{padding:0 12px}.wd-has-tools .wd-nav-in{padding-right:100px}}
</style>
</head>
<body class="wd-has-tools">
<div class="wd-tools"><div class="wd-status" data-state="connecting" id="wd-status" role="status"><i></i><span>Подключение…</span></div><button type="button" class="wd-tbtn" id="wd-theme-toggle" aria-label="Сменить тему"><svg class="wd-icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/></svg></button></div>
<main>
<section class="wd-section b-main" id="b_main"><div class="wd-inner"><h1 class="wd-heading b-title" id="b_title"><span data-r="v">Моё устройство</span></h1><label class="wd-field b-dim" id="b_dim"><span class="wd-field-head"><span>Значение</span><output data-r="v"></output></span><input class="wd-range" data-r="i" type="range" min="0" max="255" step="1" value="0"></label><div class="wd-gauge b-adc" id="b_adc"><svg viewBox="0 0 120 80" role="img" aria-label="Значение"><path class="wd-g-bg" pathLength="100" d="M10 65A50 50 0 0 1 110 65"/><path class="wd-g-fg" data-r="fg" pathLength="100" d="M10 65A50 50 0 0 1 110 65"/><text class="wd-g-text" data-r="v" x="60" y="62" text-anchor="middle">--</text></svg><div class="wd-label">Значение</div></div></div></section>
</main>
<script>
(function () {
  'use strict';
  var CFG = {"ws":"/ws","rc":5000,"tx":{"online":"Онлайн","offline":"Нет связи","connecting":"Подключение…","on":"Вкл","off":"Выкл","needSsid":"Введите имя сети","sent":"Отправлено на устройство","noconn":"Нет связи с устройством","otaNoFile":"Выберите файл","otaOk":"Загружено, устройство перезапускается","otaErr":"Ошибка загрузки"},"pg":["main"],"b":[{"i":"b_dim","t":"slider","k":"gpio5","in":1,"out":0,"min":0,"max":255},{"i":"b_adc","t":"gauge","k":"gpio32","in":0,"out":1,"d":0,"min":0,"max":100}]};
  var tx = CFG.tx;
  var root = document.documentElement;
  var q = function (s, r) { return (r || document).querySelector(s); };

  /* ---------- тема ---------- */
  var charts = [];
  function redraw() { for (var i = 0; i < charts.length; i++) charts[i](); }
  function sysDark() { try { return window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return false; } }
  function curTheme() { return root.getAttribute('data-theme') || (sysDark() ? 'dark' : 'light'); }
  function setTheme(m) {
    root.setAttribute('data-theme', m);
    try { localStorage.setItem('wd-theme', m); } catch (e) {}
    redraw();
  }
  try { var sv = localStorage.getItem('wd-theme'); if (sv === 'light' || sv === 'dark') root.setAttribute('data-theme', sv); } catch (e) {}
  var tb = document.getElementById('wd-theme-toggle');
  if (tb) tb.addEventListener('click', function () { setTheme(curTheme() === 'dark' ? 'light' : 'dark'); });
  document.addEventListener('wd-redraw', redraw);
  try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw); } catch (e) {}

  /* ---------- утилиты ---------- */
  function fmtv(v, d) {
    if (typeof v === 'number' && isFinite(v)) return d != null ? v.toFixed(d) : String(v);
    if (typeof v === 'boolean') return v ? tx.on : tx.off;
    return v == null ? '--' : String(v);
  }
  function truthy(v) { return v === true || v === 'true' || v === '1' || (typeof v === 'number' && v !== 0); }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function cv(c, v) { return c.num ? Number(v) : v; }
  function throttle(fn, ms) {
    var last = 0, tm = 0, pend;
    return function (v) {
      var now = Date.now();
      clearTimeout(tm);
      if (now - last >= ms) { last = now; fn(v); }
      else { pend = v; tm = setTimeout(function () { last = Date.now(); fn(pend); }, ms - (now - last)); }
    };
  }

  /* ---------- WebSocket ---------- */
  var H = Object.create(null);
  function on(k, fn) { if (!k) return; (H[k] = H[k] || []).push(fn); }
  function emit(k, v, st) { var l = H[k]; if (l) for (var i = 0; i < l.length; i++) l[i](v, st); }
  var ws = null, isOpen = false, delay = 500;
  function setStatus(s) {
    var el = document.getElementById('wd-status');
    if (!el) return;
    el.setAttribute('data-state', s);
    var sp = q('span', el);
    if (sp) sp.textContent = tx[s];
  }
  function send(k, v) {
    if (!k || !ws || !isOpen) return false;
    try { ws.send(JSON.stringify({ t: 'set', k: k, v: v })); return true; } catch (e) { return false; }
  }
  function retry() { setTimeout(connect, delay); delay = Math.min(delay * 2, CFG.rc); }
  function connect() {
    setStatus('connecting');
    try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + CFG.ws); }
    catch (e) { setStatus('offline'); retry(); return; }
    ws.onopen = function () { isOpen = true; delay = 500; setStatus('online'); };
    ws.onclose = function () { isOpen = false; setStatus('offline'); retry(); };
    ws.onerror = function () { try { ws.close(); } catch (e) {} };
    ws.onmessage = function (ev) {
      var m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (!m || typeof m !== 'object') return;
      if (m.t === 'state' && m.v && typeof m.v === 'object') {
        for (var k in m.v) if (Object.prototype.hasOwnProperty.call(m.v, k)) emit(k, m.v[k], true);
      } else if (m.t === 'set' && typeof m.k === 'string') emit(m.k, m.v, false);
    };
  }

  /* ---------- блоки ---------- */
  var INIT = {};

  INIT.heading = INIT.text = INIT.badge = INIT.sensor = function (c, el, r) {
    var v = r('v');
    if (c.out && v) on(c.k, function (x) { v.textContent = (c.p || '') + fmtv(x, c.d) + (c.s || ''); });
  };
  INIT.gauge = function (c, el, r) {
    var fg = r('fg'), v = r('v');
    if (c.out) on(c.k, function (x) {
      var n = Number(x);
      if (!isFinite(n)) return;
      fg.style.strokeDashoffset = String(100 - clamp01((n - c.min) / ((c.max - c.min) || 1)) * 100);
      v.textContent = fmtv(n, c.d) + (c.u ? ' ' + c.u : '');
    });
  };
  INIT.slider = function (c, el, r) {
    var i = r('i'), o = r('v'), active = false;
    function show() {
      var n = Number(i.value);
      i.style.setProperty('--wd-fill', (clamp01((n - c.min) / ((c.max - c.min) || 1)) * 100) + '%');
      o.textContent = (c.p || '') + fmtv(n, c.d) + (c.u ? ' ' + c.u : '');
    }
    var ts = throttle(function (v) { send(c.k, v); }, 70);
    i.addEventListener('input', function () { show(); if (c.in) ts(Number(i.value)); });
    ['pointerdown', 'keydown'].forEach(function (n) { i.addEventListener(n, function () { active = true; }); });
    ['pointerup', 'pointercancel', 'blur', 'keyup'].forEach(function (n) { i.addEventListener(n, function () { active = false; }); });
    if (c.out) on(c.k, function (x) { if (!active && isFinite(Number(x))) { i.value = String(x); show(); } });
    show();
  };
  for (var bi = 0; bi < CFG.b.length; bi++) {
    var c = CFG.b[bi];
    var el = document.getElementById(c.i);
    if (!el || !INIT[c.t]) continue;
    try { INIT[c.t](c, el, (function (root2) { return function (n) { return q('[data-r="' + n + '"]', root2); }; })(el)); }
    catch (err) { if (window.console) console.error('wd init ' + c.i, err); }
  }
  connect();
})();
</script>
</body>
</html>
)WDPAGE";
static const size_t WD_PAGE_LEN = sizeof(WD_PAGE) - 1;

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

// ---- переменные страницы (меняйте их в своём коде) ----

// ---- пины ----
static int wd_out_5 = -1;  // последнее значение, присланное страницей
WD_UNUSED static void wd_wr_5(const String& v) { int duty = constrain((int)v.toFloat(), 0, 255); wd_out_5 = duty; ledcWrite(0, duty); }
WD_UNUSED static int wd_rd_32() { return analogRead(32); }

// ---- состояние для страницы при подключении ----
static String wd_state() {
  String s = F("{\"t\":\"state\",\"v\":{\"_\":0");
  s += F(",\"gpio32\":"); s += wd_json(wd_rd_32());
  if (wd_out_5 >= 0) { s += F(",\"gpio5\":"); s += wd_json(wd_out_5); }
  s += F("}}");
  return s;
}

// ---- применение значения от страницы ----
static void wd_apply(const String& key, const String& val) {
  if (key == "gpio5") { wd_wr_5(val); }
}

static void wd_onEvent(AsyncWebSocket* server, AsyncWebSocketClient* client, AwsEventType type, void* arg, uint8_t* data, size_t len) {
  (void)server;
  if (type == WS_EVT_CONNECT) {
    client->text(wd_state());
  } else if (type == WS_EVT_DATA) {
    AwsFrameInfo* info = (AwsFrameInfo*)arg;
    // принимаем только цельные сообщения одним кадром и ограниченного размера
    if (info->final && info->index == 0 && info->len == len && len <= 512) {
      String m;
      m.reserve(len);
      for (size_t i = 0; i < len; i++) m += (char)data[i];
      String key, val;
      if (wd_parse(m, key, val)) wd_apply(key, val);
    }
  }
}

// ---- предыдущие значения для отправки только изменений ----
static int wd_prev_gpio32 = -1;

void wdBegin() {
  ledcSetup(0, 5000, 8);
  ledcAttachPin(5, 0);
  // WiFi
  WiFi.mode(WIFI_STA);
  WiFi.setHostname(WD_HOSTNAME);
  WiFi.begin(WD_SSID, WD_PASS);
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 15000UL) delay(250);
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.mode(WIFI_AP);
    WiFi.softAP(WD_AP_SSID);
  }
  Serial.print(F("[web] http://"));
  Serial.println(WiFi.getMode() == WIFI_AP ? WiFi.softAPIP() : WiFi.localIP());
  wd_ws.onEvent(wd_onEvent);
  wd_server.addHandler(&wd_ws);
  wd_server.on("/", HTTP_GET, [](AsyncWebServerRequest* request) {
    request->send(200, "text/html", (const uint8_t*)WD_PAGE, WD_PAGE_LEN);
  });
  wd_server.on("/favicon.ico", HTTP_GET, [](AsyncWebServerRequest* request) { request->send(204); });
  wd_server.onNotFound([](AsyncWebServerRequest* request) { request->send(404, "text/plain", "Not found"); });
  wd_server.begin();
}

void wdLoop() {
  wd_ws.cleanupClients();
  uint32_t now = millis();
  if (now - wd_lastPoll < WD_UPDATE_MS) return;
  wd_lastPoll = now;
  if (wd_ws.count() == 0) return;
  { int v = wd_rd_32(); if (wd_prev_gpio32 < 0 || abs(v - wd_prev_gpio32) >= WD_ANALOG_DEADBAND) { wd_prev_gpio32 = v; wd_send("gpio32", v); } }
}
