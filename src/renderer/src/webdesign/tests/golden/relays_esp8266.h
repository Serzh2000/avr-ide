// web_generated.h — сгенерировано «Веб-конструктором» (генератор v1). Не редактируйте вручную:
// файл перезаписывается при экспорте. Заголовок страницы: Панель реле
// Нужны библиотеки: ESPAsyncWebServer + ESPAsyncTCP (см. data/webdesign/API_NOTES.md).
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
static const char WD_SSID[] = "net";
static const char WD_PASS[] = "password123";
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
<title>Панель реле</title>
<style>
:root{--wd-bg:#f5f6f8;--wd-surface:#ffffff;--wd-text:#1d2330;--wd-muted:#5f6776;--wd-primary:#4f46e5;--wd-accent:#0f766e;--wd-success:#15803d;--wd-warning:#b45309;--wd-danger:#b91c1c;--wd-border:#dfe2e8;--wd-shadow-sm:0 1px 2px rgba(16,24,40,.06),0 1px 3px rgba(16,24,40,.10);--wd-shadow-md:0 4px 8px -2px rgba(16,24,40,.10),0 2px 4px -2px rgba(16,24,40,.06);--wd-shadow-lg:0 16px 32px -8px rgba(16,24,40,.18),0 6px 12px -6px rgba(16,24,40,.10);color-scheme:light;--wd-font:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;--wd-base:16px;--wd-radius:10px;--wd-max:1100px}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--wd-bg:#12141a;--wd-surface:#1a1d25;--wd-text:#e6e8ee;--wd-muted:#98a0b0;--wd-primary:#8b93ff;--wd-accent:#5eead4;--wd-success:#4ade80;--wd-warning:#fbbf24;--wd-danger:#f87171;--wd-border:#2a2f3b;--wd-shadow-sm:0 1px 2px rgba(0,0,0,.4);--wd-shadow-md:0 4px 10px -2px rgba(0,0,0,.5);--wd-shadow-lg:0 18px 36px -8px rgba(0,0,0,.65);color-scheme:dark}}
:root[data-theme="dark"]{--wd-bg:#12141a;--wd-surface:#1a1d25;--wd-text:#e6e8ee;--wd-muted:#98a0b0;--wd-primary:#8b93ff;--wd-accent:#5eead4;--wd-success:#4ade80;--wd-warning:#fbbf24;--wd-danger:#f87171;--wd-border:#2a2f3b;--wd-shadow-sm:0 1px 2px rgba(0,0,0,.4);--wd-shadow-md:0 4px 10px -2px rgba(0,0,0,.5);--wd-shadow-lg:0 18px 36px -8px rgba(0,0,0,.65);color-scheme:dark}
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
.wd-switch{display:flex;align-items:center;gap:12px;cursor:pointer;user-select:none;position:relative}
.wd-switch input{position:absolute;opacity:0;width:1px;height:1px;margin:0}
.wd-track{width:50px;height:30px;border-radius:15px;background:var(--wd-border);position:relative;flex:none;transition:background .2s}
.wd-track::after{content:"";position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.35);transition:transform .22s cubic-bezier(.4,.2,.2,1)}
.wd-switch input:checked+.wd-track{background:var(--wd-primary)}
.wd-switch input:checked+.wd-track::after{transform:translateX(20px)}
.wd-switch input:focus-visible+.wd-track{outline:2px solid var(--wd-accent);outline-offset:2px}
.wd-sensor{display:flex;align-items:center;gap:14px}
.wd-sensor .wd-icon{flex:none;color:var(--wd-primary)}
.wd-sensor-val{font-size:2.1em;font-weight:700;line-height:1.1;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.wd-unit{font-size:.45em;font-weight:500;color:var(--wd-muted);margin-left:.3em;letter-spacing:0}
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
.b-hero>.wd-inner{gap:4px}
.b-hero{background:var(--wd-surface);color:var(--wd-text);padding:28px;border-radius:12px;border:1px solid var(--wd-border);text-align:left}
.b-hero_t{color:var(--wd-muted)}
.b-relays{padding:32px}
.b-relay_grid{gap:16px;grid-template-columns:repeat(2,minmax(0,1fr))}
.b-relay1{background:var(--wd-surface);padding:20px;border-radius:12px;border:1px solid var(--wd-border);box-shadow:var(--wd-shadow-none);transition:background-color 200ms,color 200ms,transform 200ms,box-shadow 200ms,opacity 200ms,filter 200ms;gap:12px}
.b-relay1:hover{box-shadow:var(--wd-shadow-sm)}
.b-relay1_row{gap:12px;flex-direction:row;flex-wrap:wrap;justify-content:space-between;align-items:center}
.b-relay1_ic{color:var(--wd-primary)}
.b-relay2{background:var(--wd-surface);padding:20px;border-radius:12px;border:1px solid var(--wd-border);box-shadow:var(--wd-shadow-none);transition:background-color 200ms,color 200ms,transform 200ms,box-shadow 200ms,opacity 200ms,filter 200ms;gap:12px}
.b-relay2:hover{box-shadow:var(--wd-shadow-sm)}
.b-relay2_row{gap:12px;flex-direction:row;flex-wrap:wrap;justify-content:space-between;align-items:center}
.b-relay2_ic{color:var(--wd-primary)}
.b-relay3{background:var(--wd-surface);padding:20px;border-radius:12px;border:1px solid var(--wd-border);box-shadow:var(--wd-shadow-none);transition:background-color 200ms,color 200ms,transform 200ms,box-shadow 200ms,opacity 200ms,filter 200ms;gap:12px}
.b-relay3:hover{box-shadow:var(--wd-shadow-sm)}
.b-relay3_row{gap:12px;flex-direction:row;flex-wrap:wrap;justify-content:space-between;align-items:center}
.b-relay3_ic{color:var(--wd-primary)}
.b-relay4{background:var(--wd-surface);padding:20px;border-radius:12px;border:1px solid var(--wd-border);box-shadow:var(--wd-shadow-none);transition:background-color 200ms,color 200ms,transform 200ms,box-shadow 200ms,opacity 200ms,filter 200ms;gap:12px}
.b-relay4:hover{box-shadow:var(--wd-shadow-sm)}
.b-relay4_row{gap:12px;flex-direction:row;flex-wrap:wrap;justify-content:space-between;align-items:center}
.b-relay4_ic{color:var(--wd-primary)}
.b-info{padding:24px}
.b-info_grid{gap:16px;grid-template-columns:repeat(2,minmax(0,1fr))}
.b-c_up{background:var(--wd-surface);padding:20px;border-radius:12px;border:1px solid var(--wd-border);box-shadow:var(--wd-shadow-none);gap:12px}
.b-c_rssi{background:var(--wd-surface);padding:20px;border-radius:12px;border:1px solid var(--wd-border);box-shadow:var(--wd-shadow-none);gap:12px}
@media (max-width:900px){.wd-section{padding:26px 16px}h1{font-size:1.9em}}
@media (max-width:600px){.wd-section{padding:20px 14px}h1{font-size:1.6em}h2{font-size:1.4em}.wd-status span{display:none}.wd-status{padding:0 12px}.wd-has-tools .wd-nav-in{padding-right:100px}}
@media (max-width:900px){.wd-has-tools main>.wd-section:first-child{padding-top:64px}}
@media (max-width:900px){.b-relay_grid{grid-template-columns:repeat(2,minmax(0,1fr))}.b-info_grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:600px){.b-hero{padding:20px}.b-relay_grid{grid-template-columns:minmax(0,1fr)}.b-info_grid{grid-template-columns:minmax(0,1fr)}}
</style>
</head>
<body class="wd-has-tools">
<div class="wd-tools"><div class="wd-status" data-state="connecting" id="wd-status" role="status"><i></i><span>Подключение…</span></div><button type="button" class="wd-tbtn" id="wd-theme-toggle" aria-label="Сменить тему"><svg class="wd-icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/></svg></button></div>
<main>
<section class="wd-section b-hero" id="b_hero"><div class="wd-inner"><h1 class="wd-heading b-hero_h" id="b_hero_h"><span data-r="v">Панель реле</span></h1><p class="wd-text b-hero_t" id="b_hero_t"><span data-r="v">Управляйте нагрузкой с любого устройства в вашей сети</span></p></div></section>
<section class="wd-section b-relays" id="b_relays"><div class="wd-inner"><div class="wd-grid b-relay_grid" id="b_relay_grid"><div class="wd-card b-relay1" id="b_relay1"><div class="wd-flex b-relay1_row" id="b_relay1_row"><svg id="b_relay1_ic" class="wd-icon b-relay1_ic" width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/></svg><label class="wd-switch b-relay1_sw" id="b_relay1_sw"><input type="checkbox" role="switch" data-r="i"><span class="wd-track"></span><span>Свет в комнате</span></label></div></div><div class="wd-card b-relay2" id="b_relay2"><div class="wd-flex b-relay2_row" id="b_relay2_row"><svg id="b_relay2_ic" class="wd-icon b-relay2_ic" width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM12 11C10 6 11 3 14 3c3 0 2 5-2 8zM13 12c5-2 8-1 8 2 0 3-5 2-8-2zM12 13c2 5 1 8-2 8-3 0-2-5 2-8zM11 12C6 14 3 13 3 10c0-3 5-2 8 2z"/></svg><label class="wd-switch b-relay2_sw" id="b_relay2_sw"><input type="checkbox" role="switch" data-r="i"><span class="wd-track"></span><span>Вентилятор</span></label></div></div><div class="wd-card b-relay3" id="b_relay3"><div class="wd-flex b-relay3_row" id="b_relay3_row"><svg id="b_relay3_ic" class="wd-icon b-relay3_ic" width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v9M6.4 6.6a8 8 0 1 0 11.2 0"/></svg><label class="wd-switch b-relay3_sw" id="b_relay3_sw"><input type="checkbox" role="switch" data-r="i"><span class="wd-track"></span><span>Розетка</span></label></div></div><div class="wd-card b-relay4" id="b_relay4"><div class="wd-flex b-relay4_row" id="b_relay4_row"><svg id="b_relay4_ic" class="wd-icon b-relay4_ic" width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg><label class="wd-switch b-relay4_sw" id="b_relay4_sw"><input type="checkbox" role="switch" data-r="i"><span class="wd-track"></span><span>Насос</span></label></div></div></div></div></section>
<section class="wd-section b-info" id="b_info"><div class="wd-inner"><div class="wd-grid b-info_grid" id="b_info_grid"><div class="wd-card b-c_up" id="b_c_up"><div class="wd-sensor b-up" id="b_up"><svg class="wd-icon" width="36" height="36" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14l4-4M3.5 18a9.5 9.5 0 1 1 17 0"/></svg><div><div class="wd-label">Аптайм</div><div class="wd-sensor-val"><span data-r="v">--</span><span class="wd-unit">с</span></div></div></div></div><div class="wd-card b-c_rssi" id="b_c_rssi"><div class="wd-sensor b-rssi_s" id="b_rssi_s"><svg class="wd-icon" width="36" height="36" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0M12 19.5h.01"/></svg><div><div class="wd-label">Сигнал WiFi</div><div class="wd-sensor-val"><span data-r="v">--</span><span class="wd-unit">дБм</span></div></div></div></div></div></div></section>
</main>
<script>
(function () {
  'use strict';
  var CFG = {"ws":"/ws","rc":5000,"tx":{"online":"Онлайн","offline":"Нет связи","connecting":"Подключение…","on":"Вкл","off":"Выкл","needSsid":"Введите имя сети","sent":"Отправлено на устройство","noconn":"Нет связи с устройством","otaNoFile":"Выберите файл","otaOk":"Загружено, устройство перезапускается","otaErr":"Ошибка загрузки"},"pg":["main"],"b":[{"i":"b_relay1_sw","t":"switch","k":"gpio5","in":1,"out":0},{"i":"b_relay2_sw","t":"switch","k":"gpio4","in":1,"out":0},{"i":"b_relay3_sw","t":"switch","k":"gpio14","in":1,"out":0},{"i":"b_relay4_sw","t":"switch","k":"gpio12","in":1,"out":0},{"i":"b_up","t":"sensor","k":"uptime","in":0,"out":1,"u":"с","d":0},{"i":"b_rssi_s","t":"sensor","k":"rssi","in":0,"out":1,"u":"дБм","d":0}]};
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
  INIT.switch = INIT.checkbox = function (c, el, r) {
    var i = r('i');
    i.addEventListener('change', function () { if (c.in) send(c.k, i.checked); });
    if (c.out) on(c.k, function (x) { i.checked = truthy(x); });
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
int uptime = 0;
int rssi = -60;

// ---- пины ----
static int wd_out_4 = -1;  // последнее значение, присланное страницей
WD_UNUSED static void wd_wr_4(const String& v) { bool l = wd_truthy(v); wd_out_4 = l ? 1 : 0; digitalWrite(4, (!l) ? HIGH : LOW); }
static int wd_out_5 = -1;  // последнее значение, присланное страницей
WD_UNUSED static void wd_wr_5(const String& v) { bool l = wd_truthy(v); wd_out_5 = l ? 1 : 0; digitalWrite(5, (!l) ? HIGH : LOW); }
static int wd_out_12 = -1;  // последнее значение, присланное страницей
WD_UNUSED static void wd_wr_12(const String& v) { bool l = wd_truthy(v); wd_out_12 = l ? 1 : 0; digitalWrite(12, (!l) ? HIGH : LOW); }
static int wd_out_14 = -1;  // последнее значение, присланное страницей
WD_UNUSED static void wd_wr_14(const String& v) { bool l = wd_truthy(v); wd_out_14 = l ? 1 : 0; digitalWrite(14, (!l) ? HIGH : LOW); }

// ---- состояние для страницы при подключении ----
static String wd_state() {
  String s = F("{\"t\":\"state\",\"v\":{\"_\":0");
  s += F(",\"uptime\":"); s += wd_json(uptime);
  s += F(",\"rssi\":"); s += wd_json(rssi);
  if (wd_out_4 >= 0) { s += F(",\"gpio4\":"); s += wd_json(wd_out_4 != 0); }
  if (wd_out_5 >= 0) { s += F(",\"gpio5\":"); s += wd_json(wd_out_5 != 0); }
  if (wd_out_12 >= 0) { s += F(",\"gpio12\":"); s += wd_json(wd_out_12 != 0); }
  if (wd_out_14 >= 0) { s += F(",\"gpio14\":"); s += wd_json(wd_out_14 != 0); }
  s += F("}}");
  return s;
}

// ---- применение значения от страницы ----
static void wd_apply(const String& key, const String& val) {
  if (key == "gpio4") { wd_wr_4(val); }
  else if (key == "gpio5") { wd_wr_5(val); }
  else if (key == "gpio12") { wd_wr_12(val); }
  else if (key == "gpio14") { wd_wr_14(val); }
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
static int wd_prev_uptime = 0;
static int wd_prev_rssi = -60;

void wdBegin() {
  pinMode(4, OUTPUT);
  pinMode(5, OUTPUT);
  pinMode(12, OUTPUT);
  pinMode(14, OUTPUT);
  // WiFi
  WiFi.mode(WIFI_STA);
  WiFi.hostname(WD_HOSTNAME);
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
    request->send_P(200, "text/html", (const uint8_t*)WD_PAGE, WD_PAGE_LEN);
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
  if (uptime != wd_prev_uptime) { wd_prev_uptime = uptime; wd_send("uptime", uptime); }
  if (rssi != wd_prev_rssi) { wd_prev_rssi = rssi; wd_send("rssi", rssi); }
}
