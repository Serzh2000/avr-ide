(function () {
  'use strict';
  var CFG = {"ws":"/ws","rc":5000,"tx":{"online":"Онлайн","offline":"Нет связи","connecting":"Подключение…","on":"Вкл","off":"Выкл","needSsid":"Введите имя сети","sent":"Отправлено на устройство","noconn":"Нет связи с устройством","otaNoFile":"Выберите файл","otaOk":"Загружено, устройство перезапускается","otaErr":"Ошибка загрузки"},"pg":["main"],"b":[{"i":"b_sc_m","t":"button","k":"scene","in":1,"out":0,"act":"send","val":"morning"},{"i":"b_sc_d","t":"button","k":"scene","in":1,"out":0,"act":"send","val":"day"},{"i":"b_sc_e","t":"button","k":"scene","in":1,"out":0,"act":"send","val":"evening"},{"i":"b_sc_n","t":"button","k":"scene","in":1,"out":0,"act":"send","val":"movie"},{"i":"b_room1_sl","t":"slider","k":"gpio16","in":1,"out":0,"min":0,"max":255},{"i":"b_room2_sl","t":"slider","k":"gpio17","in":1,"out":0,"min":0,"max":255},{"i":"b_room3_sl","t":"slider","k":"gpio18","in":1,"out":0,"min":0,"max":255},{"i":"b_rd_cct","t":"radio","k":"cct","in":1,"out":1},{"i":"b_col","t":"color","k":"accent_color","in":1,"out":1},{"i":"b_sw_night","t":"switch","k":"night","in":1,"out":1},{"i":"b_sw_hall","t":"switch","k":"gpio19","in":1,"out":0},{"i":"b_clk","t":"clock","cm":"browser","sec":0,"h12":0,"date":1}]};
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
  INIT.button = function (c, el) {
    if (!c.in) return;
    if (c.act === 'send') { el.addEventListener('click', function () { send(c.k, c.val); }); return; }
    var down = false;
    function dn() { if (down) return; down = true; el.setAttribute('data-down', '1'); send(c.k, true); }
    function up() { if (!down) return; down = false; el.removeAttribute('data-down'); send(c.k, false); }
    el.addEventListener('pointerdown', function (e) { try { el.setPointerCapture(e.pointerId); } catch (x) {} dn(); });
    ['pointerup', 'pointercancel', 'lostpointercapture', 'blur'].forEach(function (n) { el.addEventListener(n, up); });
    el.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); dn(); } });
    el.addEventListener('keyup', up);
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) up(); });
  };
  INIT.switch = INIT.checkbox = function (c, el, r) {
    var i = r('i');
    i.addEventListener('change', function () { if (c.in) send(c.k, i.checked); });
    if (c.out) on(c.k, function (x) { i.checked = truthy(x); });
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
  INIT.color = function (c, el, r) {
    var i = r('i'), ts = throttle(function (v) { send(c.k, v); }, 80);
    i.addEventListener('input', function () { if (c.in) ts(i.value); });
    if (c.out) on(c.k, function (x) { if (/^#[0-9a-fA-F]{6}$/.test(String(x))) i.value = String(x); });
  };
  INIT.radio = function (c, el) {
    var ins = el.querySelectorAll('input');
    Array.prototype.forEach.call(ins, function (i) {
      i.addEventListener('change', function () { if (i.checked && c.in) send(c.k, cv(c, i.value)); });
    });
    if (c.out) on(c.k, function (x) { Array.prototype.forEach.call(ins, function (i) { i.checked = String(x) === i.value; }); });
  };
  INIT.clock = function (c, el, r) {
    var t = r('t'), d = r('d');
    function p2(n) { return n < 10 ? '0' + n : '' + n; }
    if (c.cm === 'uptime') {
      on(c.k, function (x) {
        var s = Math.max(0, Math.floor(Number(x) || 0)), dd = Math.floor(s / 86400);
        s %= 86400;
        t.textContent = (dd ? dd + 'd ' : '') + p2(Math.floor(s / 3600)) + ':' + p2(Math.floor(s % 3600 / 60)) + (c.sec ? ':' + p2(s % 60) : '');
      });
      return;
    }
    function tick() {
      var n = new Date(), h = n.getHours(), suf = '';
      if (c.h12) { suf = h >= 12 ? ' PM' : ' AM'; h = h % 12 || 12; }
      t.textContent = p2(h) + ':' + p2(n.getMinutes()) + (c.sec ? ':' + p2(n.getSeconds()) : '') + suf;
      if (c.date && d) d.textContent = n.toLocaleDateString();
    }
    tick(); setInterval(tick, 1000);
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
