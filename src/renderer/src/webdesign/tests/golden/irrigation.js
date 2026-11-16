(function () {
  'use strict';
  var CFG = {"ws":"/ws","rc":5000,"tx":{"online":"Онлайн","offline":"Нет связи","connecting":"Подключение…","on":"Вкл","off":"Выкл","needSsid":"Введите имя сети","sent":"Отправлено на устройство","noconn":"Нет связи с устройством","otaNoFile":"Выберите файл","otaOk":"Загружено, устройство перезапускается","otaErr":"Ошибка загрузки"},"pg":["main"],"b":[{"i":"b_rd_mode","t":"radio","k":"irr_mode","in":1,"out":1},{"i":"b_cb_rain","t":"checkbox","k":"skip_rain","in":1,"out":1},{"i":"b_in_rain","t":"indicator","k":"gpio33","in":0,"out":1,"on":"идёт","off":"нет"},{"i":"b_pr_tank","t":"progress","k":"tank","in":0,"out":1,"u":"%","d":0,"min":0,"max":100},{"i":"b_clk","t":"clock","cm":"browser","sec":1,"h12":0,"date":1},{"i":"b_z1_sw","t":"switch","k":"gpio16","in":1,"out":0},{"i":"b_z1_pr","t":"progress","k":"soil1","in":0,"out":1,"u":"%","d":0,"min":0,"max":100},{"i":"b_z1_sl","t":"slider","k":"dur1","in":1,"out":1,"u":"мин","min":1,"max":30},{"i":"b_z2_sw","t":"switch","k":"gpio17","in":1,"out":0},{"i":"b_z2_pr","t":"progress","k":"soil2","in":0,"out":1,"u":"%","d":0,"min":0,"max":100},{"i":"b_z2_sl","t":"slider","k":"dur2","in":1,"out":1,"u":"мин","min":1,"max":30},{"i":"b_z3_sw","t":"switch","k":"gpio18","in":1,"out":0},{"i":"b_z3_pr","t":"progress","k":"soil3","in":0,"out":1,"u":"%","d":0,"min":0,"max":100},{"i":"b_z3_sl","t":"slider","k":"dur3","in":1,"out":1,"u":"мин","min":1,"max":30},{"i":"b_z4_sw","t":"switch","k":"gpio19","in":1,"out":0},{"i":"b_z4_pr","t":"progress","k":"soil4","in":0,"out":1,"u":"%","d":0,"min":0,"max":100},{"i":"b_z4_sl","t":"slider","k":"dur4","in":1,"out":1,"u":"мин","min":1,"max":30},{"i":"b_tbl","t":"table","cells":[["1-2","{dur1} мин",["dur1"]],["2-2","{dur2} мин",["dur2"]],["3-2","{dur3} мин",["dur3"]],["4-2","{dur4} мин",["dur4"]]]}]};
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
  INIT.table = INIT.list = function (c, el) {
    var vals = Object.create(null);
    (c.cells || []).forEach(function (cell) {
      var td = el.querySelector('[data-c="' + cell[0] + '"]');
      if (!td) return;
      function upd() {
        td.textContent = cell[1].replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, function (m, n) { return vals[n] === undefined ? '--' : fmtv(vals[n]); });
      }
      cell[2].forEach(function (k) { on(k, function (x) { vals[k] = x; upd(); }); });
    });
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
