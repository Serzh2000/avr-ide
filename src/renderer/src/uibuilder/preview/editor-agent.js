// «Агент» холста: выполняется ВНУТРИ sandbox-iframe с настоящим фронтом ESPUI.
// Сообщает родителю (редактору) геометрию карточек и вкладок, высоту страницы и открытую вкладку,
// выполняет его команды (переключить вкладку). DOM фронта родитель читать не может (sandbox без allow-same-origin),
// поэтому всё идёт через postMessage. Конфигурация — window.__ESPUI_PREVIEW__ (cards: числовой id → id элемента, tabs).
(function () {
  'use strict'
  var cfg = window.__ESPUI_PREVIEW__ || {}
  var cards = cfg.cards || {}
  var tabs = cfg.tabs || {}
  var edit = cfg.mode === 'edit'
  var last = ''
  var raf = 0
  var rendered = false
  var restored = false

  function post(o) {
    o.espuiPreview = true
    try {
      parent.postMessage(o, '*')
    } catch (e) {
      /* родитель недоступен */
    }
  }

  // Страница всегда «по высоте содержимого»: прокрутка — у родителя, поэтому внутри iframe полос нет.
  var st = document.createElement('style')
  st.textContent =
    'html,body{overflow:hidden!important;min-height:0!important}' +
    (edit ? 'body *{cursor:default!important;user-select:none!important;-webkit-user-select:none!important}' : '')
  document.head.appendChild(st)

  function rectOf(n) {
    var r = n.getBoundingClientRect()
    return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height }
  }

  /** Открытая вкладка: id вкладки конструктора (строка) или null. */
  function currentTab() {
    var a = document.querySelector('#tabsnav a[aria-selected="true"]')
    if (!a) return null
    var m = /tablink(\d+)/.exec(a.id)
    return m && tabs[m[1]] !== undefined ? tabs[m[1]] : null
  }

  function layout() {
    raf = 0
    var out = { kind: 'layout', cards: {}, tabs: {}, nav: null, height: 0, activeTab: currentTab(), rendered: rendered }
    Object.keys(cards).forEach(function (num) {
      var n = document.getElementById('id' + num)
      if (!n) return
      var r = n.getBoundingClientRect()
      if (!r.width && !r.height) return
      var c = rectOf(n)
      var h = n.querySelector('h5')
      if (h) {
        var hr = rectOf(h)
        c.label = hr
      }
      out.cards[cards[num]] = c
    })
    Object.keys(tabs).forEach(function (num) {
      var a = document.getElementById('tablink' + num)
      if (a) out.tabs[tabs[num]] = rectOf(a)
    })
    var nav = document.getElementById('tabsnav')
    if (nav && nav.offsetHeight) out.nav = rectOf(nav)
    var hd = document.getElementById('mainHeader')
    if (hd) out.header = rectOf(hd)
    out.height = Math.ceil(document.body.getBoundingClientRect().bottom + window.scrollY)
    var key = JSON.stringify(out)
    if (key === last) return
    last = key
    post(out)
  }
  function schedule() {
    if (!raf) raf = requestAnimationFrame(layout)
  }

  function clickTab(num) {
    var a = document.getElementById('tablink' + num)
    if (a) a.click()
  }

  window.addEventListener('message', function (e) {
    var d = e.data
    if (!d || e.source !== parent) return
    if (d.espuiCmd === 'tab') {
      var num = Object.keys(tabs).filter(function (k) {
        return tabs[k] === d.tab
      })[0]
      if (num !== undefined) clickTab(num)
    }
  })

  // Открытая вкладка: после каждого переключения (в том числе кликом в режиме «Тест») сообщаем родителю.
  document.addEventListener(
    'click',
    function (e) {
      var a = e.target && e.target.closest ? e.target.closest('#tabsnav a') : null
      if (!a) return
      setTimeout(function () {
        schedule()
        post({ kind: 'tab', tab: currentTab() })
      }, 30)
    },
    true
  )

  window.addEventListener('espui-rendered', function () {
    rendered = true
    if (!restored) {
      restored = true
      if (cfg.activeTab != null) clickTab(cfg.activeTab)
    }
    setTimeout(function () {
      schedule()
      post({ kind: 'rendered' })
    }, 30)
  })

  window.addEventListener('resize', schedule)
  window.addEventListener('load', function () {
    schedule()
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule)
    if (typeof ResizeObserver === 'function') {
      var ro = new ResizeObserver(schedule)
      ro.observe(document.body)
    }
    if (typeof MutationObserver === 'function') {
      var mo = new MutationObserver(schedule)
      mo.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true })
    }
  })
})()
