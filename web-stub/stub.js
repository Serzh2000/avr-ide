// Заглушка window.api для проверки интерфейса в обычном браузере (vite.web.config.ts).
// Файловая система и arduino-cli эмулируются в памяти. Параметры адреса:
//   ?cli=none      — arduino-cli не найден
//   ?cores=none    — ядра не установлены (карточка установки)
//   ?project=none  — проект не открыт
//   ?ports=none    — нет портов
;(() => {
  const q = new URLSearchParams(location.search)
  const ok = (data) => ({ ok: true, data })
  const bad = (error) => ({ ok: false, error })
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const SEP = '\\'

  const BLINK = `// Мигание светодиодом\nvoid setup() {\n  pinMode(LED_BUILTIN, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  delay(500);\n  digitalWrite(LED_BUILTIN, LOW);\n  delay(500);\n}\n`
  const BOOK = 'C:\\Users\\demo\\Documents\\Arduino'
  const files = {}
  const dirs = new Set()
  let root = null
  const mt = {}

  const seed = (r) => {
    const name = r.split(SEP).pop()
    files[r + SEP + name + '.ino'] = BLINK
    files[r + SEP + 'config.h'] = '#pragma once\n#define LED_PIN 2\n'
    files[r + SEP + 'README.md'] = '# Blink\n'
    dirs.add(r + SEP + 'data')
    files[r + SEP + 'data' + SEP + 'index.html'] = '<!doctype html>\n<h1>Привет</h1>\n'
    for (const k of Object.keys(files)) mt[k] = Date.now()
  }
  const DEMO = BOOK + SEP + 'Blink'
  seed(DEMO)
  seed(BOOK + SEP + 'WifiLamp')
  if (q.get('project') !== 'none') root = DEMO

  const info = (r) => ({ root: r, name: r.split(SEP).pop(), mainFile: Object.keys(files).find((p) => p === r + SEP + r.split(SEP).pop() + '.ino') ?? null })
  const inside = (p) => root && typeof p === 'string' && (p === root || p.startsWith(root + SEP))

  const tree = (dir) => {
    const names = new Map()
    for (const p of [...Object.keys(files), ...dirs]) {
      if (!p.startsWith(dir + SEP)) continue
      const rest = p.slice(dir.length + 1).split(SEP)
      const isDir = rest.length > 1 || dirs.has(p)
      names.set(rest[0], isDir)
    }
    return [...names.entries()]
      .sort((a, b) => (a[1] === b[1] ? a[0].localeCompare(b[0]) : a[1] ? -1 : 1))
      .map(([n, isDir]) => ({ name: n, path: dir + SEP + n, dir: isDir, children: isDir ? tree(dir + SEP + n) : undefined }))
  }

  const lis = { log: [], done: [], mdata: [], mclosed: [] }
  const emit = (k, e) => lis[k].forEach((f) => f(e))
  const sub = (k) => (cb) => { lis[k].push(cb); return () => { lis[k] = lis[k].filter((x) => x !== cb) } }

  let cliFound = q.get('cli') !== 'none'
  let cores = q.get('cores') === 'none' ? [] : [
    { id: 'arduino:avr', name: 'Arduino AVR Boards', installed: '1.8.6', latest: '1.8.6' },
    { id: 'esp32:esp32', name: 'esp32', installed: '3.0.0', latest: '3.0.7' }
  ]
  let libs = [{ name: 'ESPUI', version: '2.2.4', latest: '2.2.4', sentence: 'Simple Web UI Library for ESP' }, { name: 'Servo', version: '1.2.1', latest: '1.2.2', sentence: 'Control servo motors' }]
  let espUrls = { esp8266: false, esp32: false }
  const catalog = [
    { id: 'arduino:avr', name: 'Arduino AVR Boards', latest: '1.8.6' },
    { id: 'esp32:esp32', name: 'esp32', latest: '3.0.7' },
    { id: 'esp8266:esp8266', name: 'esp8266', latest: '3.1.2' },
    { id: 'STMicroelectronics:stm32', name: 'STM32 MCU based boards', latest: '2.7.1' }
  ]
  const libCatalog = [
    { name: 'ESPUI', latest: '2.2.4', sentence: 'Simple Web UI Library for ESP' },
    { name: 'DHT sensor library', latest: '1.4.6', sentence: 'Arduino library for DHT11, DHT22, etc Temp & Humidity Sensors' },
    { name: 'Servo', latest: '1.2.2', sentence: 'Control servo motors' },
    { name: 'Adafruit NeoPixel', latest: '1.12.3', sentence: 'Arduino library for controlling single-wire LED pixels' }
  ]
  const statusObj = () => cliFound
    ? { found: true, path: 'C:\\Program Files\\AVR IDE\\resources\\arduino-cli.exe', version: '1.2.2', source: 'bundled' }
    : { found: false, help: 'arduino-cli не найден. Установите вручную: winget install ArduinoSA.CLI, затем перезапустите IDE.' }

  const allBoards = () => {
    const out = []
    for (const c of cores) {
      if (c.id === 'arduino:avr') out.push(['Arduino Uno', 'uno'], ['Arduino Nano', 'nano'], ['Arduino Mega or Mega 2560', 'mega'], ['Arduino Leonardo', 'leonardo']
        .map((x) => x)).length
    }
    return out
  }
  const boardList = () => {
    const out = []
    for (const c of cores) {
      const [v, a] = c.id.split(':')
      const names = c.id === 'arduino:avr' ? ['Arduino Uno', 'Arduino Nano', 'Arduino Mega or Mega 2560', 'Arduino Leonardo', 'Arduino Pro Mini']
        : c.id === 'esp32:esp32' ? ['ESP32 Dev Module', 'ESP32S3 Dev Module', 'ESP32C3 Dev Module', 'DOIT ESP32 DEVKIT V1', 'WEMOS D1 MINI ESP32', ...Array.from({ length: 70 }, (_, i) => 'ESP32 Board ' + (i + 1))]
        : ['Generic ' + a]
      const ids = { 'Arduino Uno': 'uno', 'Arduino Nano': 'nano', 'Arduino Mega or Mega 2560': 'mega', 'ESP32 Dev Module': 'esp32', 'ESP32S3 Dev Module': 'esp32s3', 'ESP32C3 Dev Module': 'esp32c3' }
      for (const n of names) out.push({ name: n, fqbn: `${v}:${a}:${ids[n] ?? n.toLowerCase().replace(/\W+/g, '_')}`, platform: c.id })
    }
    return out
  }

  let opSeq = 0
  let timer = null
  let busy = false
  const startOp = (kind, lines, code = 0, step = 350) => {
    if (busy) return bad('Уже выполняется другая операция. Дождитесь окончания или нажмите «Отмена».')
    busy = true
    const opId = ++opSeq
    let i = 0
    const tick = () => {
      if (i < lines.length) {
        emit('log', { opId, stream: lines[i].startsWith('$') ? 'info' : 'stdout', text: lines[i] + '\n' })
        i++
        timer = setTimeout(tick, step)
      } else {
        busy = false
        timer = null
        emit('done', { opId, kind, code, cancelled: false })
      }
    }
    timer = setTimeout(tick, 150)
    return ok({ opId })
  }
  const dl = (what) => [`$ arduino-cli ${what}`, 'Downloading packages...', 'pkg 12.00 MiB / 120 MiB 10.00%', 'pkg 60.00 MiB / 120 MiB 50.00%', 'pkg 120.00 MiB / 120 MiB 100.00%', 'Installing...', 'Installed']

  const compileLines = (path, fqbn) => {
    const src = files[path] ?? ''
    const head = [`$ arduino-cli compile --fqbn ${fqbn} --no-color ${path.slice(0, path.lastIndexOf(SEP))}`, 'Detecting libraries used...', 'Generating function prototypes...', 'Compiling sketch...']
    if (/foo\s*\(/.test(src)) {
      const ln = src.split('\n').findIndex((l) => /foo\s*\(/.test(l)) + 1
      const col = src.split('\n')[ln - 1].indexOf('foo') + 1
      return { lines: [...head, `${path}: In function 'void loop()':`, `${path}:${ln}:${col}: error: 'foo' was not declared in this scope`, '   foo();', '   ^~~', 'Error during build: exit status 1'], code: 1 }
    }
    return { lines: [...head, 'Compiling libraries...', 'Compiling core...', 'Linking everything together...', 'Sketch uses 924 bytes (2%) of program storage space. Maximum is 32256 bytes.', 'Global variables use 9 bytes (0%) of dynamic memory, leaving 2039 bytes for local variables. Maximum is 2048 bytes.'], code: 0 }
  }

  let mon = null
  const api = {
    app: { quit: async () => true, onCloseRequest: () => () => {} },
    project: {
      pickOpen: async () => { root = DEMO; return ok(info(DEMO)) },
      pickFile: async () => { root = DEMO; return ok({ project: info(DEMO), file: DEMO + SEP + 'Blink.ino' }) },
      open: async (p) => { if (!Object.keys(files).some((f) => f.startsWith(p + SEP))) return bad('Папка не найдена.'); root = p; return ok(info(p)) },
      close: async () => { root = null; return ok(true) },
      tree: async () => (root ? ok(tree(root)) : bad('Сначала откройте папку проекта.')),
      recent: async () => ok([{ path: DEMO, name: 'Blink', lastOpened: Date.now() }, { path: BOOK + SEP + 'WifiLamp', name: 'WifiLamp', lastOpened: Date.now() - 86400000 }]),
      removeRecent: async () => ok(true),
      templates: async () => ok([
        { id: 'empty', name: 'Пустой скетч', description: 'Только setup() и loop()', group: 'basic' },
        { id: 'blink', name: 'Blink', description: 'Мигание встроенным светодиодом', group: 'basic' },
        { id: 'serial', name: 'Монитор порта', description: 'Вывод текста и счётчика в Serial', group: 'basic' },
        { id: 'esp32-wifi', name: 'ESP32 Wi-Fi', description: 'Подключение к сети, вывод IP', group: 'esp32' },
        { id: 'esp8266-wifi', name: 'ESP8266 Wi-Fi', description: 'Подключение к сети, вывод IP', group: 'esp8266' }
      ]),
      sketchbook: async () => ok(BOOK),
      pickSketchbook: async () => ok(null),
      pickFolder: async () => ok(null),
      suggestName: async () => ok('sketch_nov15a'),
      create: async (t, name) => {
        if (!/^[A-Za-z0-9_][A-Za-z0-9_-]{0,62}$/.test(name)) return bad('Недопустимое имя скетча.')
        const r = BOOK + SEP + name
        if (Object.keys(files).some((f) => f.startsWith(r + SEP))) return bad(`Папка «${name}» уже существует.`)
        files[r + SEP + name + '.ino'] = BLINK
        root = r
        return ok(info(r))
      }
    },
    fs: {
      read: async (p) => (inside(p) && p in files ? ok({ content: files[p], mtime: mt[p] ?? 1 }) : bad('Файл не найден.')),
      write: async (p, c) => { if (!inside(p)) return bad('Путь вне папки проекта — операция запрещена.'); files[p] = c; mt[p] = Date.now(); return ok({ mtime: mt[p] }) },
      mtimes: async (ps) => ok(Object.fromEntries(ps.map((p) => [p, mt[p] ?? null]))),
      create: async (p, kind) => { if (!inside(p)) return bad('Путь вне папки проекта.'); if (p in files || dirs.has(p)) return bad('Файл или папка с таким именем уже существует.'); if (kind === 'dir') dirs.add(p); else { files[p] = ''; mt[p] = Date.now() } return ok(p) },
      rename: async (p, n) => {
        const to = p.slice(0, p.lastIndexOf(SEP) + 1) + n
        if (to in files || dirs.has(to)) return bad('Файл или папка с таким именем уже существует.')
        for (const k of Object.keys(files)) if (k === p || k.startsWith(p + SEP)) { files[to + k.slice(p.length)] = files[k]; delete files[k] }
        if (dirs.has(p)) { dirs.delete(p); dirs.add(to) }
        return ok(to)
      },
      trash: async (p) => { for (const k of Object.keys(files)) if (k === p || k.startsWith(p + SEP)) delete files[k]; dirs.delete(p); return ok(true) },
      reveal: async () => ok(true),
      writeSketchFile: async (name, content) => { if (!root) return bad('Сначала откройте папку проекта.'); const p = root + SEP + name; files[p] = content; mt[p] = Date.now(); return ok(p) }
    },
    cli: {
      status: async () => statusObj(),
      boards: async () => (cliFound ? ok(q.get('ports') === 'none' ? [] : [
        { address: 'COM3', label: 'COM3 Serial Port (USB)', protocol: 'serial', boards: [{ name: 'Arduino Uno', fqbn: 'arduino:avr:uno' }] },
        { address: 'COM7', label: 'COM7 Serial Port (USB)', protocol: 'serial', boards: [] }
      ]) : { ok: false, error: 'нет arduino-cli', notFound: true }),
      allBoards: async () => ok(boardList()),
      cores: async () => ok(cores),
      searchCores: async (s) => ok(catalog.filter((c) => (c.id + c.name).toLowerCase().includes(s.toLowerCase()))),
      searchLibs: async (s) => ok(libCatalog.filter((c) => c.name.toLowerCase().includes(s.toLowerCase()))),
      installedLibs: async () => ok(libs),
      espUrls: async () => ok(espUrls),
      installCore: (id) => { const r = startOp('core-install', dl('core install ' + id)); if (r.ok) setTimeout(() => { const c = catalog.find((x) => x.id === id); if (c && !cores.some((x) => x.id === id)) cores = [...cores, { ...c, installed: c.latest }] }, 1800); return Promise.resolve(r) },
      upgradeCore: (id) => Promise.resolve(startOp('core-install', dl('core upgrade ' + id))),
      uninstallCore: (id) => { const r = startOp('core-install', ['$ arduino-cli core uninstall ' + id, 'Uninstalled'], 0, 200); if (r.ok) setTimeout(() => { cores = cores.filter((c) => c.id !== id) }, 300); return Promise.resolve(r) },
      installLib: (n) => Promise.resolve(startOp('lib-install', dl('lib install ' + n))),
      upgradeLib: (n) => Promise.resolve(startOp('lib-install', dl('lib upgrade ' + n))),
      uninstallLib: (n) => Promise.resolve(startOp('lib-install', ['$ arduino-cli lib uninstall ' + n, 'Uninstalled'], 0, 200)),
      updateIndex: () => Promise.resolve(startOp('index-update', ['$ arduino-cli core update-index', 'Downloading index... 100.00%', 'Done'])),
      addEspUrls: () => { espUrls = { esp8266: true, esp32: true }; return Promise.resolve(startOp('index-update', ['$ arduino-cli config add board_manager.additional_urls ...', 'Downloading index... 50.00%', 'Downloading index... 100.00%', 'Done'])) },
      pickPath: async () => ok(null),
      resetPath: async () => true,
      compile: (path, fqbn) => { const c = compileLines(path, fqbn); return Promise.resolve(startOp('compile', c.lines, c.code, 400)) },
      upload: (path, fqbn, port) => { const c = compileLines(path, fqbn); return Promise.resolve(startOp('upload', c.code ? c.lines : [...c.lines, 'Uploading... avrdude: writing flash (924 bytes)', 'avrdude done.  Thank you.'], c.code, 400)) },
      cancel: async () => { if (!busy) return false; clearTimeout(timer); busy = false; emit('done', { opId: opSeq, kind: 'compile', code: null, cancelled: true }); return true },
      onLog: sub('log'),
      onDone: sub('done')
    },
    monitor: {
      start: async (port, baud) => { let n = 0; mon = setInterval(() => emit('mdata', { text: `Счётчик: ${n++}\n`, stream: 'stdout' }), 700); return ok(null) },
      send: async () => true,
      stop: async () => { if (mon) { clearInterval(mon); mon = null; emit('mclosed', null) } return true },
      onData: sub('mdata'),
      onClosed: sub('mclosed')
    }
  }
  window.api = api
  window.__stub = { files, setCli: (v) => { cliFound = v } }
})()
