// Скрипты только для превью в редакторе: мок WebSocket (симуляция значений) и мост выбора блоков.
// Выполняются в sandbox-iframe без allow-same-origin. В прошивку НЕ попадают.
import { jsonForScript, num } from './escape'
import { bindingFlags } from './js'
import { blockVarRefs } from './refs'
import { bindingKey, walk } from './factory'
import type { WdProject } from './types'

interface SimKey {
  k: string
  t: string
  min: number
  max: number
  init: unknown
  /** true — значение меняет «устройство» (симулируем), false — только приходит из страницы. */
  auto: boolean
}

export function simKeys(p: WdProject): SimKey[] {
  const map = new Map<string, SimKey>()
  const add = (k: string, t: string, init: unknown, min: number, max: number, auto: boolean, isLog = false): void => {
    const prev = map.get(k)
    map.set(k, { k, t: isLog ? 'log' : t, min, max, init, auto: (prev?.auto ?? false) || auto })
  }
  walk(p.blocks, (b) => {
    const min = num(b.props.min, 0)
    const max = num(b.props.max, 100)
    const k = bindingKey(b.binding)
    if (k) {
      const f = bindingFlags(b.binding)
      let t = 'float'
      let init: unknown = 0
      if (b.binding.kind === 'var') {
        const v = p.variables.find((x) => x.name === (b.binding as { variable: string }).variable)
        t = v?.type ?? 'float'
        init = v?.init ?? ''
        if (t === 'bool') init = init === 'true'
        else if (t === 'int' || t === 'float') init = Number(init) || 0
      } else if (b.binding.kind === 'pin') {
        t = b.binding.mode === 'digital' ? 'bool' : 'int'
        init = t === 'bool' ? false : 0
      }
      add(k, t, init, min, max, f.out && !f.in, b.type === 'log')
    }
    for (const r of blockVarRefs(b)) {
      if (r.source !== 'token' || map.has(r.name)) continue
      const v = p.variables.find((x) => x.name === r.name)
      const t = v?.type ?? 'float'
      add(r.name, t, t === 'bool' ? false : t === 'String' ? (v?.init ?? '') : Number(v?.init) || 0, 0, 100, true)
    }
  })
  return [...map.values()]
}

export function buildMockScript(p: WdProject): string {
  return String.raw`(function () {
  var SIM = ${jsonForScript(simKeys(p))};
  var vals = {};
  SIM.forEach(function (s) { vals[s.k] = s.init; });
  function MockWS(url) {
    var self = this;
    this.url = url; this.readyState = 0;
    function emit(o) { if (self.onmessage) self.onmessage({ data: JSON.stringify(o) }); }
    setTimeout(function () {
      self.readyState = 1;
      if (self.onopen) self.onopen({});
      emit({ t: 'state', v: vals });
    }, 350);
    var n = 0;
    this._timer = setInterval(function () {
      n++;
      SIM.forEach(function (s, idx) {
        if (!s.auto) return;
        var v;
        if (s.t === 'bool') { if ((n + idx * 3) % 12 === 0) v = !vals[s.k]; else return; }
        else if (s.t === 'log') { if (n % 2) return; v = '[' + n + '] sensor ok, value=' + Math.round(Math.random() * 100); }
        else if (s.t === 'String') return;
        else {
          var mid = (s.min + s.max) / 2, amp = (s.max - s.min) * 0.35;
          v = mid + amp * Math.sin(n / (4 + idx)) + (Math.random() - 0.5) * amp * 0.15;
          v = Math.max(s.min, Math.min(s.max, v));
          v = s.t === 'int' ? Math.round(v) : Math.round(v * 10) / 10;
        }
        if (s.t !== 'log') vals[s.k] = v;
        emit({ t: 'set', k: s.k, v: v });
      });
    }, 1000);
    this.send = function (d) {
      (window.__wdSent = window.__wdSent || []).push(String(d));
      try { var m = JSON.parse(d); if (m && m.t === 'set' && typeof m.k === 'string') vals[m.k] = m.v; } catch (e) {}
    };
    this.close = function () { clearInterval(self._timer); self.readyState = 3; if (self.onclose) self.onclose({}); };
  }
  MockWS.CONNECTING = 0; MockWS.OPEN = 1; MockWS.CLOSING = 2; MockWS.CLOSED = 3;
  window.WebSocket = MockWS;
})();
`
}

/** Мост превью ↔ редактор: выбор блока кликом, подсветка выбранного, режим интерактивности, тема. */
export const PREVIEW_BRIDGE = String.raw`(function () {
  var interactive = false, sel = null;
  var style = document.createElement('style');
  style.textContent = '[data-wd-id]{cursor:default}.wd-sel{outline:2px solid #3794ff!important;outline-offset:2px}';
  document.head.appendChild(style);
  function mark(id) {
    var old = document.querySelectorAll('.wd-sel');
    for (var i = 0; i < old.length; i++) old[i].classList.remove('wd-sel');
    sel = id;
    if (!id) return;
    var el = document.querySelector('[data-wd-id="' + String(id).replace(/"/g, '') + '"]');
    if (!el) return;
    el.classList.add('wd-sel');
    // раскрыть скрытых предков: страницу сайта, вкладку, модальное окно, аккордеон
    var pg = el.closest('[data-page]');
    if (pg && pg.hidden) location.hash = '#/' + pg.getAttribute('data-page');
    var pn = el.closest('[role="tabpanel"]');
    if (pn && pn.hidden && pn.parentNode) {
      var tb = pn.parentNode.querySelector(':scope > .wd-tablist > [data-i="' + pn.getAttribute('data-i') + '"]');
      if (tb) tb.click();
    }
    var md = el.closest('.wd-modal');
    if (md) md.hidden = false;
    var ac = el.closest('details');
    if (ac) ac.open = true;
  }
  document.addEventListener('click', function (e) {
    if (interactive) return;
    var t = e.target, el = t && t.closest ? t.closest('[data-wd-id]') : null;
    e.preventDefault(); e.stopPropagation();
    parent.postMessage({ wd: 'select', id: el ? el.getAttribute('data-wd-id') : null }, '*');
  }, true);
  ['pointerdown', 'keydown'].forEach(function (n) {
    document.addEventListener(n, function (e) { if (!interactive && !(e.target && e.target.isContentEditable)) { e.stopPropagation(); } }, true);
  });
  function edit(el) {
    var host = el.closest('[data-wd-id]');
    if (!host) return;
    var prop = el.getAttribute('data-wd-edit');
    var old = el.textContent;
    el.contentEditable = 'plaintext-only';
    if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
    el.focus();
    try { var r = document.createRange(); r.selectNodeContents(el); var s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {}
    var done = false;
    function finish(ok) {
      if (done) return; done = true;
      el.removeAttribute('contenteditable');
      el.removeEventListener('blur', onBlur); el.removeEventListener('keydown', onKey);
      var v = el.innerText.replace(/\n+$/, '');
      if (ok && v !== old) parent.postMessage({ wd: 'edit', id: host.getAttribute('data-wd-id'), prop: prop, value: v }, '*');
      else el.textContent = old;
    }
    function onBlur() { finish(true); }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finish(true); }
    }
    el.addEventListener('blur', onBlur); el.addEventListener('keydown', onKey);
  }
  document.addEventListener('dblclick', function (e) {
    if (interactive) return;
    var t = e.target, el = t && t.closest ? t.closest('[data-wd-edit]') : null;
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    parent.postMessage({ wd: 'select', id: el.closest('[data-wd-id]').getAttribute('data-wd-id') }, '*');
    edit(el);
  }, true);
  window.addEventListener('message', function (e) {
    var m = e.data;
    if (!m || typeof m !== 'object') return;
    if (m.wd === 'mark') mark(m.id);
    else if (m.wd === 'page') location.hash = '#/' + String(m.id).replace(/[^\w-]/g, '');
    else if (m.wd === 'interactive') { interactive = !!m.on; }
    else if (m.wd === 'theme') {
      if (m.mode === 'light' || m.mode === 'dark') document.documentElement.setAttribute('data-theme', m.mode);
      else document.documentElement.removeAttribute('data-theme');
      document.dispatchEvent(new Event('wd-redraw'));
    }
  });
  parent.postMessage({ wd: 'ready' }, '*');
})();
`
