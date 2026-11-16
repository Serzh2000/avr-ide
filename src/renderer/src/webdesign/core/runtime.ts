// Клиентский рантайм страницы (JS, исполняется в браузере). Конфигурация подставляется вместо __CFG__.
// Правила: никакого innerHTML — значения от устройства пишутся только через textContent / value / style;
// ключи реестра хранятся в Object.create(null); все обращения к localStorage в try/catch.
// В шаблонах нельзя использовать обратные кавычки и «${». Рантайм собирается из частей: подключаются только нужные блокам
// (страница для ESP8266 должна быть как можно меньше).
import type { BlockType } from './types'

const HEAD = String.raw`(function () {
  'use strict';
  var CFG = __CFG__;
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
`

const PARTS: Record<string, string> = {
  textual: String.raw`
  INIT.heading = INIT.text = INIT.badge = INIT.sensor = function (c, el, r) {
    var v = r('v');
    if (c.out && v) on(c.k, function (x) { v.textContent = (c.p || '') + fmtv(x, c.d) + (c.s || ''); });
  };`,
  indicator: String.raw`
  INIT.indicator = function (c, el, r) {
    var t = r('t');
    if (c.out) on(c.k, function (x) {
      var s = truthy(x);
      el.setAttribute('data-on', s ? '1' : '0');
      if (t) t.textContent = s ? c.on : c.off;
    });
  };`,
  gauge: String.raw`
  INIT.gauge = function (c, el, r) {
    var fg = r('fg'), v = r('v');
    if (c.out) on(c.k, function (x) {
      var n = Number(x);
      if (!isFinite(n)) return;
      fg.style.strokeDashoffset = String(100 - clamp01((n - c.min) / ((c.max - c.min) || 1)) * 100);
      v.textContent = fmtv(n, c.d) + (c.u ? ' ' + c.u : '');
    });
  };`,
  progress: String.raw`
  INIT.progress = function (c, el, r) {
    var bar = r('bar'), v = r('v'), pb = r('pb');
    if (c.out) on(c.k, function (x) {
      var n = Number(x);
      if (!isFinite(n)) return;
      bar.style.width = (clamp01((n - c.min) / ((c.max - c.min) || 1)) * 100) + '%';
      v.textContent = fmtv(n, c.d) + (c.u ? ' ' + c.u : '');
      pb.setAttribute('aria-valuenow', String(n));
    });
  };`,
  chart: String.raw`
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
  };`,
  button: String.raw`
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
  };`,
  switch: String.raw`
  INIT.switch = INIT.checkbox = function (c, el, r) {
    var i = r('i');
    i.addEventListener('change', function () { if (c.in) send(c.k, i.checked); });
    if (c.out) on(c.k, function (x) { i.checked = truthy(x); });
  };`,
  slider: String.raw`
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
  };`,
  input: String.raw`
  INIT.input = INIT.textarea = function (c, el, r) {
    var i = r('i');
    i.addEventListener('change', function () { if (c.in) send(c.k, c.nt ? Number(i.value) : i.value); });
    if (c.out) on(c.k, function (x) { if (document.activeElement !== i) i.value = x == null ? '' : String(x); });
  };`,
  color: String.raw`
  INIT.color = function (c, el, r) {
    var i = r('i'), ts = throttle(function (v) { send(c.k, v); }, 80);
    i.addEventListener('input', function () { if (c.in) ts(i.value); });
    if (c.out) on(c.k, function (x) { if (/^#[0-9a-fA-F]{6}$/.test(String(x))) i.value = String(x); });
  };`,
  select: String.raw`
  INIT.select = function (c, el, r) {
    var i = r('i');
    i.addEventListener('change', function () { if (c.in) send(c.k, cv(c, i.value)); });
    if (c.out) on(c.k, function (x) { i.value = String(x); });
  };`,
  radio: String.raw`
  INIT.radio = function (c, el) {
    var ins = el.querySelectorAll('input');
    Array.prototype.forEach.call(ins, function (i) {
      i.addEventListener('change', function () { if (i.checked && c.in) send(c.k, cv(c, i.value)); });
    });
    if (c.out) on(c.k, function (x) { Array.prototype.forEach.call(ins, function (i) { i.checked = String(x) === i.value; }); });
  };`,
  log: String.raw`
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
  };`,
  pad: String.raw`
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
  };`,
  clock: String.raw`
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
  };`,
  tabs: String.raw`
  INIT.tabs = function (c, el) {
    var tabs = el.querySelectorAll(':scope > .wd-tablist > [data-r="t"]'), panels = el.querySelectorAll(':scope > [role="tabpanel"]');
    function sel(i) {
      for (var k = 0; k < tabs.length; k++) { tabs[k].setAttribute('aria-selected', String(k === i)); if (panels[k]) panels[k].hidden = k !== i; }
      redraw();
    }
    for (var k = 0; k < tabs.length; k++) (function (k) { tabs[k].addEventListener('click', function () { sel(k); }); })(k);
  };`,
  modal: String.raw`
  INIT.modal = function (c, el, r) {
    var m = r('m'), o = r('open'), x = r('close');
    function show(v) { m.hidden = !v; if (v) redraw(); }
    o.addEventListener('click', function () { show(true); });
    x.addEventListener('click', function () { show(false); });
    m.addEventListener('click', function (e) { if (e.target === m) show(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') show(false); });
  };`,
  table: String.raw`
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
  };`,
  wifisetup: String.raw`
  INIT.wifisetup = function (c, el, r) {
    var s = r('s'), p = r('p'), msg = r('msg'), go = r('go');
    function run() {
      if (!s.value) { msg.textContent = tx.needSsid; return; }
      if (send(c.vs, s.value) && send(c.vp, p.value) && send(c.vv, true)) msg.textContent = tx.sent;
      else msg.textContent = tx.noconn;
    }
    /* не полагаемся на встроенную отправку формы: в песочнице превью она запрещена */
    el.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    go.addEventListener('click', run);
    [s, p].forEach(function (i) { i.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); run(); } }); });
  };`,
  ota: String.raw`
  INIT.ota = function (c, el, r) {
    var f = r('f'), bar = r('bar'), msg = r('msg'), go = r('go'), busy = false;
    function run() {
      if (busy) return;
      var file = f.files && f.files[0];
      if (!file) { msg.textContent = tx.otaNoFile; return; }
      var fd = new FormData();
      fd.append('firmware', file, file.name);
      var x = new XMLHttpRequest();
      busy = true; msg.textContent = '';
      x.open('POST', c.u);
      x.upload.onprogress = function (ev) { if (ev.lengthComputable) bar.style.width = (ev.loaded / ev.total * 100) + '%'; };
      x.onload = function () { busy = false; msg.textContent = (x.status >= 200 && x.status < 300) ? tx.otaOk : tx.otaErr + ' (' + x.status + ')'; };
      x.onerror = function () { busy = false; msg.textContent = tx.otaErr; };
      x.send(fd);
    }
    el.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    go.addEventListener('click', run);
  };`
}

const PAGES = String.raw`
  /* ---------- страницы сайта ---------- */
  var PG = document.querySelectorAll('[data-page]');
  function showPage(id) {
    var found = false, i;
    for (i = 0; i < PG.length; i++) if (PG[i].getAttribute('data-page') === id) found = true;
    if (!found) id = CFG.pg[0];
    for (i = 0; i < PG.length; i++) PG[i].hidden = PG[i].getAttribute('data-page') !== id && PG[i].getAttribute('data-page') !== '*';
    var ls = document.querySelectorAll('[data-wdp]');
    for (i = 0; i < ls.length; i++) { if (ls[i].getAttribute('data-wdp') === id) ls[i].setAttribute('aria-current', 'page'); else ls[i].removeAttribute('aria-current'); }
    try { window.scrollTo(0, 0); } catch (e) {}
    redraw();
  }
  function fromHash() { var m = /^#\/([\w-]+)$/.exec(location.hash); showPage(m ? m[1] : CFG.pg[0]); }
  window.addEventListener('hashchange', fromHash);
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('[data-wdp]') : null;
    if (!a) return;
    e.preventDefault();
    var id = a.getAttribute('data-wdp');
    try { history.pushState(null, '', '#/' + id); } catch (x) { try { location.hash = '#/' + id; } catch (y) {} }
    showPage(id);
  });
  fromHash();
`

const TAIL = String.raw`
  for (var bi = 0; bi < CFG.b.length; bi++) {
    var c = CFG.b[bi];
    var el = document.getElementById(c.i);
    if (!el || !INIT[c.t]) continue;
    try { INIT[c.t](c, el, (function (root2) { return function (n) { return q('[data-r="' + n + '"]', root2); }; })(el)); }
    catch (err) { if (window.console) console.error('wd init ' + c.i, err); }
  }
  connect();
})();
`

/** Часть рантайма, обслуживающая тип блока. */
const PART_OF: Partial<Record<BlockType, string>> = {
  heading: 'textual', text: 'textual', badge: 'textual', sensor: 'textual',
  indicator: 'indicator', gauge: 'gauge', progress: 'progress', chart: 'chart', button: 'button',
  switch: 'switch', checkbox: 'switch', slider: 'slider', input: 'input', textarea: 'input', color: 'color',
  select: 'select', radio: 'radio', log: 'log', pad: 'pad', clock: 'clock', tabs: 'tabs', modal: 'modal',
  table: 'table', list: 'table', wifisetup: 'wifisetup', ota: 'ota'
}

const PART_ORDER = Object.keys(PARTS)

/** Тип блока, которому нужен JS (есть часть рантайма). */
export function hasRuntimePart(t: BlockType): boolean {
  return PART_OF[t] !== undefined
}

export function buildRuntime(used: Set<BlockType>, multiPage: boolean, cfgJson: string): string {
  const need = new Set<string>()
  for (const t of used) {
    const p = PART_OF[t]
    if (p) need.add(p)
  }
  const body = PART_ORDER.filter((p) => need.has(p)).map((p) => PARTS[p]).join('')
  return (HEAD + body + (multiPage ? PAGES : '') + TAIL).replace('__CFG__', () => cfgJson)
}
