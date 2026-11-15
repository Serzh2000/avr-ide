(function () {
  'use strict';
  var CFG = {"ws":"/ws","rc":5000,"tx":{"online":"Онлайн","offline":"Нет связи","connecting":"Подключение…","on":"Вкл","off":"Выкл","needSsid":"Введите имя сети","sent":"Отправлено на устройство","noconn":"Нет связи с устройством","otaNoFile":"Выберите файл","otaOk":"Загружено, устройство перезапускается","otaErr":"Ошибка загрузки"},"pg":["home","settings"],"b":[{"i":"b_bd_mode","t":"badge","k":"mode","in":0,"out":1},{"i":"b_g_t","t":"gauge","k":"temp","in":0,"out":1,"u":"°C","d":1,"min":-10,"max":50},{"i":"b_s_h","t":"sensor","k":"hum","in":0,"out":1,"u":"%","d":0},{"i":"b_clk","t":"clock","k":"uptime","in":0,"out":1,"cm":"uptime","sec":1,"h12":0,"date":1},{"i":"b_tb","t":"tabs"},{"i":"b_tbl","t":"table","cells":[["1-1","{temp} °C",["temp"]],["2-1","{hum} %",["hum"]],["3-1","{uptime} с",["uptime"]]]},{"i":"b_lg","t":"log","k":"logline","in":0,"out":1,"n":50},{"i":"b_faq2_l","t":"list","cells":[["0","Подставляет {temp} из переменных",["temp"]]]},{"i":"b_about","t":"modal"},{"i":"b_wf","t":"wifisetup","vs":"wifi_ssid","vp":"wifi_pass","vv":"wifi_save"},{"i":"b_ota1","t":"ota","u":"/update"}]};
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
  INIT.modal = function (c, el, r) {
    var m = r('m'), o = r('open'), x = r('close');
    function show(v) { m.hidden = !v; if (v) redraw(); }
    o.addEventListener('click', function () { show(true); });
    x.addEventListener('click', function () { show(false); });
    m.addEventListener('click', function (e) { if (e.target === m) show(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') show(false); });
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
  INIT.wifisetup = function (c, el, r) {
    var s = r('s'), p = r('p'), msg = r('msg');
    el.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!s.value) { msg.textContent = tx.needSsid; return; }
      if (send(c.vs, s.value) && send(c.vp, p.value) && send(c.vv, true)) msg.textContent = tx.sent;
      else msg.textContent = tx.noconn;
    });
  };
  INIT.ota = function (c, el, r) {
    var f = r('f'), bar = r('bar'), msg = r('msg'), busy = false;
    el.addEventListener('submit', function (e) {
      e.preventDefault();
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
    });
  };
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

  for (var bi = 0; bi < CFG.b.length; bi++) {
    var c = CFG.b[bi];
    var el = document.getElementById(c.i);
    if (!el || !INIT[c.t]) continue;
    INIT[c.t](c, el, (function (root2) { return function (n) { return q('[data-r="' + n + '"]', root2); }; })(el));
  }
  connect();
})();
