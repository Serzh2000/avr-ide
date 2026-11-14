// Мок «устройства ESPUI» для живого превью. Выполняется ВНУТРИ sandbox-iframe до загрузки controls.js.
// Подменяет window.WebSocket классом, который ведёт себя как ESPUI-сервер (ESPUIclient.cpp): после «подключения» шлёт
// InitialGui порциями + ExtendGUI по запросу uiok:N, принимает команды фронтенда (bdown/bup, sactive/sinactive, slvalue,
// nvalue, tvalue, svalue, pXdown/up, tabvalue, uifragmentok) и отвечает UPDATE_* сообщениями (type+100).
// Конфигурация приходит в window.__ESPUI_PREVIEW__ = { page, sim }. Формат команд сверен с data/espui/frontend/js/controls.js.
(function () {
  'use strict'
  var cfg = window.__ESPUI_PREVIEW__ || { page: { controls: [] }, sim: [] }
  var CHUNK = 12 // контролов в одной порции (ESP8266 в реальности режет по размеру JSON-документа)

  function note(kind, text) {
    try {
      parent.postMessage({ espuiPreview: true, kind: kind, text: String(text) }, '*')
    } catch (e) {
      /* родитель недоступен */
    }
  }
  window.addEventListener('error', function (e) {
    note('error', (e.message || 'ошибка') + (e.lineno ? ' (стр. ' + e.lineno + ')' : ''))
  })
  window.addEventListener('unhandledrejection', function (e) {
    note('error', 'Promise: ' + (e.reason && e.reason.message ? e.reason.message : e.reason))
  })

  // В sandbox без allow-same-origin доступ к localStorage бросает SecurityError, а controls.js (Graph) его использует.
  try {
    window.localStorage.getItem('x')
  } catch (e) {
    var mem = {}
    var shim = {
      getItem: function (k) {
        return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null
      },
      setItem: function (k, v) {
        mem[k] = String(v)
      },
      removeItem: function (k) {
        delete mem[k]
      },
      clear: function () {
        mem = {}
      }
    }
    try {
      Object.defineProperty(window, 'localStorage', { configurable: true, get: function () { return shim } })
    } catch (e2) {
      note('error', 'не удалось подменить localStorage: ' + e2)
    }
  }

  // ---------- состояние «устройства» ----------
  var title = { type: 0, label: 'ESPUI' }
  var order = []
  var controls = {}
  ;(cfg.page.controls || []).forEach(function (c) {
    if (c.type === 0) title = c
    else {
      order.push(c)
      controls[c.id] = c
    }
  })
  var sims = {}
  ;(cfg.sim || []).forEach(function (s) {
    sims[s.id] = s
  })

  var sockets = []
  var timer = null

  function emit(ws, obj) {
    setTimeout(function () {
      if (ws.readyState !== 1 || typeof ws.onmessage !== 'function') return
      try {
        ws.onmessage({ data: JSON.stringify(obj) })
      } catch (e) {
        note('error', 'onmessage: ' + e)
      }
    }, 4)
  }
  function broadcast(obj) {
    sockets.forEach(function (ws) {
      emit(ws, obj)
    })
  }

  // Фронтенд после каждой порции просит «uiok:N», где N считается как startindex + (controls.length - 1). Для ExtendGUI
  // (в нём нет заголовка) это на единицу меньше числа уже отправленных контролов, и слепое выполнение «отдай с N» дублировало
  // бы по одному контролу на порцию. Поэтому сервер ведёт собственный счётчик отправленного и значение N не использует.
  function sendInitial(ws) {
    var first = order.slice(0, CHUNK)
    ws.sent = first.length
    emit(ws, {
      type: 200,
      sliderContinuous: !!cfg.page.sliderContinuous,
      startindex: 0,
      totalcontrols: order.length,
      controls: [title].concat(first)
    })
  }
  function sendExtend(ws) {
    var start = ws.sent || 0
    if (start >= order.length) return
    var part = order.slice(start, start + CHUNK)
    ws.sent = start + part.length
    emit(ws, { type: 210, startindex: start, totalcontrols: order.length, controls: part })
  }

  // ---------- модель значений ----------
  var vals = {} // имя переменной / ключ канала -> значение (number | boolean | string)
  var chans = {} // ключ -> { lo, hi, kind, walk }
  var members = {} // ключ -> [sim] (элементы, показывающие это значение)

  function isUserCtl(s) {
    return s.type === 6 || s.type === 7 || s.type === 5 || s.type === 8 || s.type === 12 || s.type === 3
  }
  var controlled = {}
  Object.keys(sims).forEach(function (k) {
    var s = sims[k]
    if (s.kind === 'var' && isUserCtl(s) && (s.dir === 'fromUi' || s.dir === 'both')) controlled[s.variable] = true
  })

  function keyOf(s) {
    if (s.kind === 'var') return 'v:' + s.variable
    if (s.type === 9) return 'g:' + s.id
    return 'p:' + s.id
  }
  function initNum(s) {
    var n = parseFloat(s.init)
    return isNaN(n) ? 0 : n
  }
  Object.keys(sims).forEach(function (k) {
    var s = sims[k]
    var visible = controls[s.id] && controls[s.id].visible !== false
    if (!visible) return
    var shows = s.type === 4 || s.type === 6 || s.type === 7 || s.type === 5 || s.type === 8 || s.type === 12 || s.type === 9
    if (!shows) return
    if (s.kind === 'var' && s.dir === 'fromUi' && s.type !== 9) {
      // только UI -> устройство: показывает собственное значение, делить не с кем
      if (!members['v:' + s.variable]) members['v:' + s.variable] = []
      members['v:' + s.variable].push(s)
      if (!(('v:' + s.variable) in vals)) initChan('v:' + s.variable, s)
      return
    }
    var key = keyOf(s)
    if (!members[key]) members[key] = []
    members[key].push(s)
    if (!(key in vals)) initChan(key, s)
  })

  function initChan(key, s) {
    var kind = 'num'
    if (s.kind === 'var') kind = s.vtype === 'bool' ? 'bool' : s.vtype === 'String' ? 'str' : 'num'
    else if (s.kind === 'pin') kind = s.analog ? 'num' : 'bool'
    else if (s.type === 5) kind = 'bool'
    else if (s.type === 8 || s.type === 12) kind = 'str'
    var lo = 0
    var hi = 100
    var v
    if (kind === 'bool') v = s.init === 'true' || s.init === '1' || s.init === '1.0'
    else if (kind === 'str') v = s.init || ''
    else {
      v = initNum(s)
      if (s.type === 6 || s.type === 7) {
        lo = s.min == null ? 0 : s.min
        hi = s.max == null ? 100 : s.max
      } else if (s.kind === 'pin') {
        lo = 0
        hi = 1023
      } else if (s.type === 9) {
        lo = 0
        hi = 100
        v = 50
      } else {
        var span = Math.max(10, Math.abs(v) * 0.3)
        lo = v - span
        hi = v + span
      }
      if (v < lo) v = lo
      if (v > hi) v = hi
    }
    vals[key] = v
    // «Ходит» только то, чем управляет устройство, а не пользователь, и что не строка
    chans[key] = { lo: lo, hi: hi, kind: kind, walk: kind !== 'str' && !!s.driven && !(s.kind === 'var' && controlled[s.variable]) }
  }

  function fmtLabel(s, v) {
    var core
    var ch = chans[keyOf(s)] || {}
    if (ch.kind === 'bool') core = v ? 'ON' : 'OFF'
    else if (s.kind === 'var' && s.vtype === 'float') core = Number(v).toFixed(s.decimals == null ? 2 : s.decimals)
    else if (s.kind === 'var' && s.vtype === 'String') core = String(v)
    else core = String(Math.round(Number(v)))
    return (s.prefix || '') + core + (s.suffix || '')
  }
  function render(s, v) {
    var ch = chans[keyOf(s)] || {}
    switch (s.type) {
      case 4:
        return fmtLabel(s, v)
      case 5:
        return (ch.kind === 'bool' ? v : Number(v) >= (ch.lo + ch.hi) / 2) ? '1' : '0'
      case 6:
        return String(Math.round(Number(v)))
      case 7:
        return s.kind === 'var' && s.vtype === 'float' ? Number(v).toFixed(s.decimals == null ? 1 : s.decimals) : String(Math.round(Number(v)))
      default:
        return String(v)
    }
  }

  function pushUpdate(id, value) {
    var c = controls[id]
    if (!c) return
    c.value = String(value)
    var u = {}
    Object.keys(c).forEach(function (k) {
      u[k] = c[k]
    })
    u.type = c.type + 100
    broadcast(u)
  }
  function refresh(key, except) {
    ;(members[key] || []).forEach(function (s) {
      if (s.id === except || s.type === 9) return
      pushUpdate(s.id, render(s, vals[key]))
    })
  }

  function tick() {
    Object.keys(chans).forEach(function (key) {
      var ch = chans[key]
      if (!ch.walk) return
      var v = vals[key]
      if (ch.kind === 'bool') {
        if (Math.random() < 0.15) v = !v
      } else {
        v += (Math.random() - 0.5) * (ch.hi - ch.lo) * 0.18
        if (v < ch.lo) v = ch.lo
        if (v > ch.hi) v = ch.hi
      }
      vals[key] = v
      var graphs = (members[key] || []).filter(function (s) {
        return s.type === 9
      })
      graphs.forEach(function (s) {
        broadcast({ type: 10, id: s.id, value: String(Math.round(v)) })
      })
      refresh(key, -1)
    })
  }
  function startTimer() {
    if (timer) return
    timer = setInterval(function () {
      try {
        tick()
      } catch (e) {
        note('error', 'симуляция: ' + e)
      }
    }, 1000)
  }

  // ---------- команды фронтенда ----------
  function userSet(s, v) {
    if (s.kind !== 'var') return
    var key = 'v:' + s.variable
    if (s.vtype === 'bool') v = !!v && v !== '0'
    vals[key] = v
    refresh(key, s.id)
  }

  function onClient(ws, raw) {
    var p = String(raw)
    var i = p.indexOf(':')
    var cmd = i < 0 ? p : p.slice(0, i)
    var rest = i < 0 ? '' : p.slice(i + 1)
    var j = rest.lastIndexOf(':')
    var id = Number(j < 0 ? rest : rest.slice(j + 1))
    var val = j < 0 ? '' : rest.slice(0, j)
    var s = sims[id]
    var what = s ? ' (' + (s.label || 'id ' + id) + ')' : ''
    switch (cmd) {
      case 'uiok':
        sendExtend(ws)
        return
      case 'uifragmentok':
        return // фрагменты значений не эмулируются
      case 'bdown':
      case 'bup':
        note('event', cmd + ':' + rest + what)
        if (s && s.kind === 'var') {
          var cur = vals['v:' + s.variable]
          if (s.action === 'toggle') {
            if (cmd === 'bdown') userSet(s, s.vtype === 'bool' ? !cur : cur ? 0 : 1)
          } else if (s.vtype === 'int') {
            if (cmd === 'bdown') userSet(s, Number(cur) + 1)
          } else userSet(s, cmd === 'bdown')
        }
        return
      case 'sactive':
      case 'sinactive':
        note('event', cmd + ':' + rest + what)
        if (s) userSet(s, s.vtype === 'bool' ? cmd === 'sactive' : cmd === 'sactive' ? 1 : 0)
        return
      case 'slvalue':
      case 'nvalue':
        note('event', cmd + ':' + val + ':' + id + what)
        if (s) userSet(s, s.vtype === 'float' ? parseFloat(val) || 0 : parseInt(val, 10) || 0)
        return
      case 'tvalue':
      case 'svalue':
        note('event', cmd + ':' + val + ':' + id + what)
        if (s) userSet(s, val)
        return
      case 'time':
      case 'tabvalue':
        note('event', cmd + ':' + rest)
        return
      default:
        note('event', p)
    }
  }

  // ---------- класс WebSocket ----------
  function MockWebSocket(url) {
    var self = this
    this.url = url
    this.readyState = 0
    this.onopen = this.onclose = this.onerror = this.onmessage = null
    this.protocol = ''
    this.extensions = ''
    this.bufferedAmount = 0
    this.binaryType = 'blob'
    setTimeout(function () {
      if (self.readyState !== 0) return
      self.readyState = 1
      sockets.push(self)
      try {
        if (typeof self.onopen === 'function') self.onopen({ type: 'open' })
      } catch (e) {
        note('error', 'onopen: ' + e)
      }
      sendInitial(self)
      startTimer()
    }, 80)
  }
  MockWebSocket.CONNECTING = 0
  MockWebSocket.OPEN = 1
  MockWebSocket.CLOSING = 2
  MockWebSocket.CLOSED = 3
  MockWebSocket.prototype.send = function (data) {
    var self = this
    if (this.readyState !== 1) return
    setTimeout(function () {
      try {
        onClient(self, data)
      } catch (e) {
        note('error', 'устройство: ' + e)
      }
    }, 2)
  }
  MockWebSocket.prototype.close = function () {
    if (this.readyState === 3) return
    this.readyState = 3
    var k = sockets.indexOf(this)
    if (k >= 0) sockets.splice(k, 1)
    var self = this
    setTimeout(function () {
      if (typeof self.onclose === 'function') self.onclose({ type: 'close', code: 1000 })
    }, 0)
  }
  MockWebSocket.prototype.addEventListener = function (t, fn) {
    this['on' + t] = fn
  }
  MockWebSocket.prototype.removeEventListener = function () {}
  window.WebSocket = MockWebSocket
})()
