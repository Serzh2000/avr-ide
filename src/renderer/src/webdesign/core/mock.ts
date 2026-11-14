// Скрипты только для превью в редакторе: мок WebSocket (симуляция значений) и мост выбора блоков.
// Выполняются в sandbox-iframe без allow-same-origin. В прошивку НЕ попадают.
import { jsonForScript, num } from './escape'
import { bindingFlags } from './js'
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
  walk(p.blocks, (b) => {
    const k = bindingKey(b.binding)
    if (!k) return
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
    const min = num(b.props.min, 0)
    const max = num(b.props.max, 100)
    const prev = map.get(k)
    map.set(k, {
      k, t, min, max, init,
      auto: (prev?.auto ?? false) || (f.out && !f.in)
    })
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
        else if (s.t === 'String') return;
        else {
          var mid = (s.min + s.max) / 2, amp = (s.max - s.min) * 0.35;
          v = mid + amp * Math.sin(n / (4 + idx)) + (Math.random() - 0.5) * amp * 0.15;
          v = Math.max(s.min, Math.min(s.max, v));
          v = s.t === 'int' ? Math.round(v) : Math.round(v * 10) / 10;
        }
        vals[s.k] = v;
        emit({ t: 'set', k: s.k, v: v });
      });
    }, 1000);
    this.send = function (d) {
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
    if (el) el.classList.add('wd-sel');
  }
  document.addEventListener('click', function (e) {
    if (interactive) return;
    var t = e.target, el = t && t.closest ? t.closest('[data-wd-id]') : null;
    e.preventDefault(); e.stopPropagation();
    parent.postMessage({ wd: 'select', id: el ? el.getAttribute('data-wd-id') : null }, '*');
  }, true);
  ['pointerdown', 'keydown'].forEach(function (n) {
    document.addEventListener(n, function (e) { if (!interactive) { e.stopPropagation(); } }, true);
  });
  window.addEventListener('message', function (e) {
    var m = e.data;
    if (!m || typeof m !== 'object') return;
    if (m.wd === 'mark') mark(m.id);
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
