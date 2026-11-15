(function () {
  'use strict';
  var CFG = {"ws":"/ws","rc":5000,"tx":{"online":"Онлайн","offline":"Нет связи","connecting":"Подключение…","on":"Вкл","off":"Выкл","needSsid":"Введите имя сети","sent":"Отправлено на устройство","noconn":"Нет связи с устройством","otaNoFile":"Выберите файл","otaOk":"Загружено, устройство перезапускается","otaErr":"Ошибка загрузки"},"pg":["main"],"b":[{"i":"b_pad1","t":"pad","k":"drive","in":1,"out":0,"rel":"stop"},{"i":"b_speed","t":"radio","k":"speed_mode","in":1,"out":1,"num":1},{"i":"b_prog","t":"select","k":"program","in":1,"out":1},{"i":"b_cb_l","t":"checkbox","k":"lights","in":1,"out":1},{"i":"b_ta","t":"textarea","k":"note","in":1,"out":0},{"i":"b_clk","t":"clock","cm":"browser","sec":1,"h12":0,"date":1},{"i":"b_lg","t":"log","k":"robot_log","in":0,"out":1,"n":100}]};
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
  INIT.input = INIT.textarea = function (c, el, r) {
    var i = r('i');
    i.addEventListener('change', function () { if (c.in) send(c.k, c.nt ? Number(i.value) : i.value); });
    if (c.out) on(c.k, function (x) { if (document.activeElement !== i) i.value = x == null ? '' : String(x); });
  };
  INIT.select = function (c, el, r) {
    var i = r('i');
    i.addEventListener('change', function () { if (c.in) send(c.k, cv(c, i.value)); });
    if (c.out) on(c.k, function (x) { i.value = String(x); });
  };
  INIT.radio = function (c, el) {
    var ins = el.querySelectorAll('input');
    Array.prototype.forEach.call(ins, function (i) {
      i.addEventListener('change', function () { if (i.checked && c.in) send(c.k, cv(c, i.value)); });
    });
    if (c.out) on(c.k, function (x) { Array.prototype.forEach.call(ins, function (i) { i.checked = String(x) === i.value; }); });
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
  INIT.pad = function (c, el, r) {
    if (!c.in) return;
    var j = r('j');
    if (!j) {
      var cur = null;
      var rel = function () { if (cur) { cur.removeAttribute('data-down'); cur = null; send(c.k, c.rel); } };
      Array.prototype.forEach.call(el.querySelectorAll('.wd-pb'), function (b) {
        b.addEventListener('pointerdown', function (e) {
          try { b.setPointerCapture(e.pointerId); } catch (x) {}
          cur = b; b.setAttribute('data-down', '1'); send(c.k, b.getAttribute('data-d'));
        });
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (n) { b.addEventListener(n, function () { if (cur === b) rel(); }); });
      });
      return;
    }
    var knob = r('k'), act = false, ts = throttle(function (v) { send(c.k, v); }, 80);
    function move(e) {
      var b = j.getBoundingClientRect(), R = b.width / 2;
      var dx = (e.clientX - b.left - R) / R, dy = (e.clientY - b.top - R) / R, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1) { dx /= d; dy /= d; }
      knob.style.transform = 'translate(' + (dx * R * 0.6) + 'px,' + (dy * R * 0.6) + 'px)';
      ts(Math.round(dx * 100) + ',' + Math.round(-dy * 100));
    }
    function end() { if (!act) return; act = false; knob.style.transform = ''; send(c.k, c.rel); }
    j.addEventListener('pointerdown', function (e) { act = true; try { j.setPointerCapture(e.pointerId); } catch (x) {} move(e); });
    j.addEventListener('pointermove', function (e) { if (act) move(e); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (n) { j.addEventListener(n, end); });
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
    INIT[c.t](c, el, (function (root2) { return function (n) { return q('[data-r="' + n + '"]', root2); }; })(el));
  }
  connect();
})();
