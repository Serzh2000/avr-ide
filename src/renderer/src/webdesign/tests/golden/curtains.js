(function () {
  'use strict';
  var CFG = {"ws":"/ws","rc":5000,"tx":{"online":"Онлайн","offline":"Нет связи","connecting":"Подключение…","on":"Вкл","off":"Выкл","needSsid":"Введите имя сети","sent":"Отправлено на устройство","noconn":"Нет связи с устройством","otaNoFile":"Выберите файл","otaOk":"Загружено, устройство перезапускается","otaErr":"Ошибка загрузки"},"pg":["main"],"b":[{"i":"b_pr_pos","t":"progress","k":"curtain_pos","in":0,"out":1,"u":"%","d":0,"min":0,"max":100},{"i":"b_sl_pos","t":"slider","k":"curtain_target","in":1,"out":1,"u":"%","min":0,"max":100},{"i":"b_b_open","t":"button","k":"gpio25","in":1,"out":0,"act":"momentary"},{"i":"b_b_close","t":"button","k":"gpio26","in":1,"out":0,"act":"momentary"},{"i":"b_in_lo","t":"indicator","k":"gpio32","in":0,"out":1,"on":"сработал","off":"—"},{"i":"b_in_lc","t":"indicator","k":"gpio33","in":0,"out":1,"on":"сработал","off":"—"},{"i":"b_gate_bd","t":"badge","k":"gate_state","in":0,"out":1},{"i":"b_in_go","t":"indicator","k":"gate_open","in":0,"out":1,"on":"открыта","off":"закрыта"},{"i":"b_gb_o","t":"button","k":"gate_cmd","in":1,"out":0,"act":"send","val":"open"},{"i":"b_gb_s","t":"button","k":"gate_cmd","in":1,"out":0,"act":"send","val":"stop"},{"i":"b_gb_c","t":"button","k":"gate_cmd","in":1,"out":0,"act":"send","val":"close"},{"i":"b_cb_ac","t":"checkbox","k":"auto_close","in":1,"out":1},{"i":"b_in_am","t":"input","k":"auto_min","in":1,"out":1,"nt":1},{"i":"b_lg","t":"log","k":"gate_log","in":0,"out":1,"n":40}]};
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
  INIT.indicator = function (c, el, r) {
    var t = r('t');
    if (c.out) on(c.k, function (x) {
      var s = truthy(x);
      el.setAttribute('data-on', s ? '1' : '0');
      if (t) t.textContent = s ? c.on : c.off;
    });
  };
  INIT.progress = function (c, el, r) {
    var bar = r('bar'), v = r('v'), pb = r('pb');
    if (c.out) on(c.k, function (x) {
      var n = Number(x);
      if (!isFinite(n)) return;
      bar.style.width = (clamp01((n - c.min) / ((c.max - c.min) || 1)) * 100) + '%';
      v.textContent = fmtv(n, c.d) + (c.u ? ' ' + c.u : '');
      pb.setAttribute('aria-valuenow', String(n));
    });
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
  INIT.input = INIT.textarea = function (c, el, r) {
    var i = r('i');
    i.addEventListener('change', function () { if (c.in) send(c.k, c.nt ? Number(i.value) : i.value); });
    if (c.out) on(c.k, function (x) { if (document.activeElement !== i) i.value = x == null ? '' : String(x); });
  };
  INIT.log = function (c, el, r) {
    var l = r('l'), clr = r('clr'), buf = [], max = c.n || 100;
    function paint() {
      var stick = l.scrollTop + l.clientHeight >= l.scrollHeight - 8;
      l.textContent = buf.join('\n');
      if (stick) l.scrollTop = l.scrollHeight;
    }
    if (c.out) on(c.k, function (x, st) {
      if (st) return;
      buf.push(String(x == null ? '' : x));
      while (buf.length > max) buf.shift();
      paint();
    });
    if (clr) clr.addEventListener('click', function () { buf = []; paint(); });
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
