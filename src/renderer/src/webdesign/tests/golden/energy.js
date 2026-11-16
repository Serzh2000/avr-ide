(function () {
  'use strict';
  var CFG = {"ws":"/ws","rc":5000,"tx":{"online":"Онлайн","offline":"Нет связи","connecting":"Подключение…","on":"Вкл","off":"Выкл","needSsid":"Введите имя сети","sent":"Отправлено на устройство","noconn":"Нет связи с устройством","otaNoFile":"Выберите файл","otaOk":"Загружено, устройство перезапускается","otaErr":"Ошибка загрузки"},"pg":["main"],"b":[{"i":"b_g_w","t":"gauge","k":"watt","in":0,"out":1,"u":"Вт","d":0,"min":0,"max":3500},{"i":"b_g_v","t":"gauge","k":"volt","in":0,"out":1,"u":"В","d":1,"min":180,"max":260},{"i":"b_s_a","t":"sensor","k":"amp","in":0,"out":1,"u":"А","d":2},{"i":"b_s_f","t":"sensor","k":"freq","in":0,"out":1,"u":"Гц","d":1},{"i":"b_s_pf","t":"sensor","k":"pf","in":0,"out":1,"d":2},{"i":"b_tb","t":"tabs"},{"i":"b_ch_w","t":"chart","k":"watt","in":0,"out":1,"u":"Вт","d":0,"min":0,"max":3500,"pts":90,"fill":1},{"i":"b_pr_lim","t":"progress","k":"kwh_today","in":0,"out":1,"d":0,"min":0,"max":15},{"i":"b_tbl","t":"table","cells":[["1-1","{kwh_today} кВт·ч",["kwh_today"]],["2-1","{kwh_month} кВт·ч",["kwh_month"]],["3-1","{uptime} с",["uptime"]]]},{"i":"b_clk","t":"clock","k":"uptime","in":0,"out":1,"cm":"uptime","sec":1,"h12":0,"date":1},{"i":"b_in_lim","t":"input","k":"limit_kwh","in":1,"out":1,"nt":1},{"i":"b_rd_tar","t":"radio","k":"tariff","in":1,"out":1},{"i":"b_cb_n","t":"checkbox","k":"notify","in":1,"out":1},{"i":"b_b_reset","t":"button","k":"energy_cmd","in":1,"out":0,"act":"send","val":"reset"}]};
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
  INIT.chart = function (c, el, r) {
    var cv2 = r('c'), v = r('v'), data = [];
    function draw() {
      var w = cv2.clientWidth, h = cv2.clientHeight;
      if (!w || !h) return;
      var dpr = window.devicePixelRatio || 1;
      if (cv2.width !== Math.round(w * dpr) || cv2.height !== Math.round(h * dpr)) { cv2.width = Math.round(w * dpr); cv2.height = Math.round(h * dpr); }
      var g = cv2.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      var cs = getComputedStyle(cv2);
      var col = cs.getPropertyValue('--wd-primary').trim() || '#4f6df5';
      var grid = cs.getPropertyValue('--wd-border').trim() || '#ccc';
      var mut = cs.getPropertyValue('--wd-muted').trim() || '#888';
      var lo = c.min, hi = c.max;
      for (var i = 0; i < data.length; i++) { if (data[i] < lo) lo = data[i]; if (data[i] > hi) hi = data[i]; }
      if (hi === lo) hi = lo + 1;
      var padL = 34, padR = 8, padT = 8, padB = 8;
      var pw = w - padL - padR, ph = h - padT - padB;
      g.font = '11px system-ui,sans-serif';
      g.textBaseline = 'middle';
      g.lineWidth = 1;
      for (var j = 0; j <= 4; j++) {
        var yy = padT + ph * j / 4;
        g.strokeStyle = grid; g.beginPath(); g.moveTo(padL, yy); g.lineTo(w - padR, yy); g.stroke();
        g.fillStyle = mut; g.fillText(String(Math.round((hi - (hi - lo) * j / 4) * 10) / 10), 2, yy);
      }
      if (data.length < 2) return;
      var n = c.pts, step = pw / Math.max(n - 1, 1);
      function X(k) { return padL + pw - (data.length - 1 - k) * step; }
      function Y(val) { return padT + ph - (val - lo) / (hi - lo) * ph; }
      g.beginPath();
      for (var k = 0; k < data.length; k++) { if (k === 0) g.moveTo(X(k), Y(data[k])); else g.lineTo(X(k), Y(data[k])); }
      g.lineJoin = 'round'; g.lineWidth = 2.2; g.strokeStyle = col; g.stroke();
      if (c.fill) {
        g.lineTo(X(data.length - 1), padT + ph); g.lineTo(X(0), padT + ph); g.closePath();
        var gr = g.createLinearGradient(0, padT, 0, padT + ph);
        gr.addColorStop(0, col); gr.addColorStop(1, 'transparent');
        g.globalAlpha = 0.22; g.fillStyle = gr; g.fill(); g.globalAlpha = 1;
      }
    }
    charts.push(draw);
    if (c.out) on(c.k, function (x) {
      var nv = Number(x);
      if (!isFinite(nv)) return;
      data.push(nv);
      while (data.length > c.pts) data.shift();
      v.textContent = fmtv(nv, c.d) + (c.u ? ' ' + c.u : '');
      draw();
    });
    if (window.ResizeObserver) new ResizeObserver(draw).observe(cv2); else window.addEventListener('resize', draw);
    draw();
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
  INIT.input = INIT.textarea = function (c, el, r) {
    var i = r('i');
    i.addEventListener('change', function () { if (c.in) send(c.k, c.nt ? Number(i.value) : i.value); });
    if (c.out) on(c.k, function (x) { if (document.activeElement !== i) i.value = x == null ? '' : String(x); });
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
  INIT.tabs = function (c, el) {
    var tabs = el.querySelectorAll(':scope > .wd-tablist > [data-r="t"]'), panels = el.querySelectorAll(':scope > [role="tabpanel"]');
    function sel(i) {
      for (var k = 0; k < tabs.length; k++) { tabs[k].setAttribute('aria-selected', String(k === i)); if (panels[k]) panels[k].hidden = k !== i; }
      redraw();
    }
    for (var k = 0; k < tabs.length; k++) (function (k) { tabs[k].addEventListener('click', function () { sel(k); }); })(k);
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
