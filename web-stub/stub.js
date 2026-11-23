// Заглушка window.api для проверки интерфейса в обычном браузере (vite.web.config.ts).
// Файловая система и arduino-cli эмулируются в памяти. Параметры адреса:
//   ?cli=none      — arduino-cli не найден
//   ?cores=none    — ядра не установлены (карточка установки)
//   (приложение всегда стартует со стартового экрана; ?recent=none — список недавних пуст)
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
  files[DEMO + SEP + 'sketch.yaml'] = 'default_fqbn: esp32:esp32:esp32\n'
  files[BOOK + SEP + 'WifiLamp' + SEP + 'sketch.yaml'] = 'default_fqbn: arduino:avr:uno\n'

  const yamlOf = (r) => { const t = files[r + SEP + 'sketch.yaml'] ?? ''; const m = /^default_fqbn:\s*(\S+)/m.exec(t); const pm = /^default_port:\s*(\S+)/m.exec(t); return { fqbn: m ? m[1] : null, port: pm ? pm[1] : null } }
  const info = (r) => ({ root: r, name: r.split(SEP).pop(), kind: Object.hasOwn(files, r + SEP + 'avride.project.json') ? 'stm32' : 'arduino', mainFile: Object.keys(files).find((p) => p === r + SEP + r.split(SEP).pop() + '.ino') ?? null, ...yamlOf(r) })
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

  const lis = { log: [], done: [], mdata: [], mclosed: [], gprog: [], gres: [] }
  const emit = (k, e) => lis[k].forEach((f) => f(e))
  const sub = (k) => (cb) => { lis[k].push(cb); return () => { lis[k] = lis[k].filter((x) => x !== cb) } }

  let cliFound = q.get('cli') !== 'none'
  let cores = q.get('cores') === 'none' ? [] : [
    { id: 'arduino:avr', name: 'Arduino AVR Boards', installed: '1.8.6', latest: '1.8.6' },
    { id: 'esp32:esp32', name: 'esp32', installed: '3.0.0', latest: '3.0.7' }
  ]
  let libs = [{ name: 'ESPUI', version: '2.2.4', latest: '2.2.4', sentence: 'Simple Web UI Library for ESP', installDir: 'C:\\Users\\demo\\Documents\\Arduino\\libraries\\ESPUI' }, { name: 'Servo', version: '1.2.1', latest: '1.2.2', sentence: 'Control servo motors', installDir: 'C:\\Users\\demo\\Documents\\Arduino\\libraries\\Servo' }]
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

  // ---- Источник GitHub (?gh=empty — каталог не загружен; ?gh=offline — обновление не удаётся; ?gh=norefs — теги не грузятся) ----
  const ghq = q.get('gh')
  let ghStatus = { loaded: ghq !== 'empty', registryAt: Date.now() - 86400000 * 3, indexAt: Date.now() - 86400000 * 3, total: 0, inIndex: 0, custom: 0, consent: false, hasToken: false, refreshing: false }
  const ghBase = [
    ['s00500/ESPUI', 'ESPUI', 'Lukas Bachschwell', 'Simple Web UI Library for ESP', 'Communication', '2.2.4'],
    ['adafruit/DHT-sensor-library', 'DHT sensor library', 'Adafruit', 'Arduino library for DHT11, DHT22, etc Temp & Humidity Sensors', 'Sensors', '1.4.6'],
    ['arduino-libraries/Servo', 'Servo', 'Michael Margolis, Arduino', 'Allows Arduino boards to control a variety of servo motors.', 'Device Control', '1.2.2'],
    ['bblanchon/ArduinoTrace', 'ArduinoTrace', 'Benoit Blanchon', 'Tracing and debugging macros for Arduino: TRACE(), DUMP(), DEBUG()', 'Other', '1.2.0'],
    ['unknown-dev/Mystery_Lib', null, null, null, null, null],
    ['adafruit/Adafruit_NeoPixel', 'Adafruit NeoPixel', 'Adafruit', 'Arduino library for controlling single-wire-based LED pixels and strip.', 'Display', '1.12.3']
  ]
  let ghCustom = []
  const ghAll = () => {
    const rows = ghBase.map(([id, n, a, s, c, v]) => ({ id, owner: id.split('/')[0], repo: id.split('/')[1], name: n ?? id, author: a ?? undefined, sentence: s ?? undefined, category: c ?? undefined, latest: v ?? undefined, inIndex: !!n }))
    for (let i = 0; i < 240; i++) rows.push({ id: 'dev' + (i % 17) + '/Lib_' + i, owner: 'dev' + (i % 17), repo: 'Lib_' + i, name: 'Sample library ' + i, author: 'Dev ' + (i % 17), sentence: 'Тестовая запись каталога номер ' + i, inIndex: i % 3 !== 0, latest: i % 3 !== 0 ? '1.0.' + i : undefined })
    return [...ghCustom.map((id) => ({ id, owner: id.split('/')[0], repo: id.split('/')[1], name: id, inIndex: false, custom: true })), ...rows]
  }
  const ghUpdate = () => { const a = ghAll(); ghStatus = { ...ghStatus, total: a.length, inIndex: a.filter((e) => e.inIndex).length, custom: ghCustom.length } }
  ghUpdate()
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
    circuitpython: {
      open: async () => bad('Выбор файлов доступен в настольном приложении.'),
      save: async () => bad('Сохранение файлов доступно в настольном приложении.'),
      deploy: async () => bad('Запись на плату доступна в настольном приложении.'),
      firmware: async () => bad('Переход на страницу прошивки доступен в настольном приложении.'),
      discard: async () => ok(true)
    },
    app: { quit: async () => true, onCloseRequest: () => () => {} },
    cores: { list: async () => ok({ packs: [], searched: [], custom: [] }), addFolder: async () => ok(null), clearFolders: async () => true, installPack: async () => bad('Недоступно в стенде'), onProgress: () => () => {} },
    project: {
      pickOpen: async () => { root = DEMO; return ok(info(DEMO)) },
      pickFile: async () => { root = DEMO; return ok({ project: info(DEMO), file: DEMO + SEP + 'Blink.ino' }) },
      open: async (p) => { if (!Object.keys(files).some((f) => f.startsWith(p + SEP))) return bad('Папка не найдена.'); root = p; return ok(info(p)) },
      close: async () => { root = null; return ok(true) },
      tree: async () => (root ? ok(tree(root)) : bad('Сначала откройте папку проекта.')),
      recent: async () => ok(q.get('recent') === 'none' ? [] : [{ path: DEMO, name: 'Blink', lastOpened: Date.now() - 3600000, fqbn: yamlOf(DEMO).fqbn }, { path: BOOK + SEP + 'WifiLamp', name: 'WifiLamp', lastOpened: Date.now() - 86400000, fqbn: 'arduino:avr:uno' }, { path: BOOK + SEP + 'Sketch_with_a_rather_long_project_name', name: 'Sketch_with_a_rather_long_project_name', lastOpened: Date.now() - 86400000 * 12 }]),
      removeRecent: async () => ok(true),
      sketchbook: async () => ok(BOOK),
      pickSketchbook: async () => ok(null),
      pickFolder: async () => ok(null),
      suggestName: async () => ok('sketch_nov15a'),
      checkName: async (name) => {
        if (!name) return ok('Введите имя проекта.')
        if (!/^[A-Za-z0-9_][A-Za-z0-9_-]{0,62}$/.test(name)) return ok('Допустимы латинские буквы, цифры, «_» и «-».')
        return ok(Object.keys(files).some((f) => f.startsWith(BOOK + SEP + name + SEP)) ? `Папка «${name}» уже существует в «${BOOK}». Выберите другое имя.` : null)
      },
      create: async (name, parent, fqbn) => {
        if (!/^[A-Za-z0-9_][A-Za-z0-9_-]{0,62}$/.test(name)) return bad('Недопустимое имя проекта.')
        const r = (parent || BOOK) + SEP + name
        if (Object.keys(files).some((f) => f.startsWith(r + SEP))) return bad(`Папка «${name}» уже существует.`)
        files[r + SEP + name + '.ino'] = 'void setup() {\n  // Код, который выполняется один раз при старте\n}\n\nvoid loop() {\n  // Код, который выполняется постоянно\n}\n'
        if (fqbn) files[r + SEP + 'sketch.yaml'] = 'default_fqbn: ' + fqbn + '\n'
        for (const k of Object.keys(files)) mt[k] ??= Date.now()
        root = r
        return ok(info(r))
      },
      setBoard: async (fqbn) => {
        if (!root) return bad('Сначала откройте папку проекта.')
        const f = root + SEP + 'sketch.yaml'
        const t = files[f] ?? ''
        files[f] = /^default_fqbn:.*$/m.test(t) ? t.replace(/^default_fqbn:.*$/m, 'default_fqbn: ' + fqbn) : t + 'default_fqbn: ' + fqbn + '\n'
        mt[f] = Date.now()
        return ok(true)
      }
    },
    libsource: {
      status: async () => ok({ ...ghStatus }),
      refresh: async () => {
        ghStatus.refreshing = true
        for (const t of ['Загрузка списка репозиториев (реестр Arduino)…', 'Загрузка индекса библиотек Arduino: 20 из 60 МБ…', 'Разбор индекса…']) { emit('gprog', { text: t }); await wait(500) }
        ghStatus.refreshing = false
        if (ghq === 'offline') return ok({ status: { ...ghStatus }, errors: ['Реестр репозиториев: Нет соединения с raw.githubusercontent.com. Проверьте интернет.', 'Индекс библиотек: Нет соединения с downloads.arduino.cc. Проверьте интернет.'] })
        ghStatus.loaded = true; ghStatus.registryAt = ghStatus.indexAt = Date.now(); ghUpdate()
        return ok({ status: { ...ghStatus }, errors: [] })
      },
      search: async (text, offset = 0, limit = 100) => {
        const t = text.toLowerCase().split(/\s+/).filter(Boolean)
        const all = ghAll().filter((e) => t.every((x) => (e.name + ' ' + (e.author ?? '') + ' ' + (e.sentence ?? '') + ' ' + e.id).toLowerCase().includes(x)))
        return ok({ total: all.length, offset, items: all.slice(offset, offset + Math.min(limit, 100)) })
      },
      refs: async (owner, repo) => {
        await wait(400)
        if (ghq === 'norefs') return bad('Лимит запросов к GitHub исчерпан (без токена — 60 запросов в час). Лимит сбросится около 23:40. Подождите или укажите токен GitHub в настройках источника.')
        return ok({ tags: repo.startsWith('Mystery') ? [] : ['v2.2.4', 'v2.2.3', 'v2.1.0', 'v1.0.0'], defaultBranch: 'main', source: 'git' })
      },
      install: (owner, repo, kind, ref) => {
        if (!ghStatus.consent) return Promise.resolve(bad('Нужно согласие на установку библиотек напрямую с GitHub.'))
        const lines = [`Скачивание ${owner}/${repo} (${ref ?? 'ветка по умолчанию'}) с GitHub…`, 'Скачано 0.3 МБ 50%', 'Скачано 0.6 МБ 100%', 'Архив 616 КБ, файлов: 42, библиотека «' + repo + '» 1.2.0', `$ arduino-cli lib install --zip-path C:\\Temp\\${repo}.zip --no-deps --no-color`, 'Флаги --git-url и --zip-path позволяют устанавливать недоверенные файлы, используйте их на свой страх и риск.', 'Библиотека установлена']
        const r = startOp('lib-install', lines, 0, 300)
        if (r.ok) {
          const opId = r.data.opId
          setTimeout(() => {
            if (!libs.some((l) => l.name === repo)) libs = [...libs, { name: repo, version: '1.2.0', latest: '1.2.0', installDir: 'C:\\Users\\demo\\Documents\\Arduino\\libraries\\' + repo }]
            emit('gres', { opId, owner, repo, ok: true, name: repo, version: '1.2.0', depends: [{ name: 'Adafruit BusIO', installed: false, constraint: '>=1.2' }, { name: 'ArduinoJson', installed: true }], warnings: [] })
          }, 150 + 300 * (lines.length - 0.5))
        }
        return Promise.resolve(r)
      },
      installDeps: (names) => Promise.resolve(startOp('lib-install', ['$ arduino-cli lib install ' + names.join(' '), 'Downloading ' + names[0] + '...', 'Installed'], 0, 300)),
      setConsent: async (v) => { ghStatus.consent = !!v; return ghStatus.consent },
      setToken: async (t) => { ghStatus.hasToken = !!t; return ok(!!t) },
      addCustom: async (s) => { const m = /github\.com\/([^/\s]+)\/([^/\s.]+)|^([^/\s]+)\/([^/\s]+)$/.exec(s.trim()); if (!m) return bad('Не удалось распознать адрес. Введите ссылку вида https://github.com/владелец/репозиторий или «владелец/репозиторий».'); const id = (m[1] ?? m[3]) + '/' + (m[2] ?? m[4]); ghCustom = [id, ...ghCustom.filter((x) => x !== id)]; ghUpdate(); return ok({ id }) },
      removeCustom: async (o, r) => { ghCustom = ghCustom.filter((x) => x !== o + '/' + r); ghUpdate(); return true },
      openRepo: async () => true,
      onProgress: sub('gprog'),
      onResult: sub('gres')
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
      writeSketchFile: async (expectedRoot, name, content, previous) => {
        if (!root || root !== expectedRoot) return bad('Проект сменился. Файл не записан.')
        const p = root + SEP + name
        if (previous !== undefined && (files[p] ?? null) !== previous) return bad(`${name} изменился вне конструктора. Версия на диске не затронута.`)
        files[p] = content; mt[p] = Date.now()
        return ok(p)
      }
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
    boardsources: (() => {
      const mk = (id, name, url, maintainer, description, cs, https = true) => ({ kind: 'catalog', id, name, maintainer, url, https, description, platformsCount: cs.length, verifiedAt: '2026-11-16', cores: cs.map(([cid, cn, v]) => ({ id: cid, name: cn, latest: v })) })
      const cat = [
        mk('esp32', 'ESP32 (Espressif)', 'https://espressif.github.io/arduino-esp32/package_esp32_index.json', 'Espressif Systems', 'Официальное ядро Espressif для чипов ESP32 всех серий: Wi-Fi, Bluetooth, платы DevKit.', [['esp32:esp32', 'esp32', '3.3.12']]),
        mk('esp8266', 'ESP8266 (сообщество)', 'https://arduino.esp8266.com/stable/package_esp8266com_index.json', 'ESP8266 Community', 'Ядро ESP8266 Community: NodeMCU, Wemos D1, ESP-01 и другие платы на ESP8266.', [['esp8266:esp8266', 'esp8266', '3.1.2']]),
        mk('stm32', 'STM32 (STMicroelectronics)', 'https://github.com/stm32duino/BoardManagerFiles/raw/main/package_stmicroelectronics_index.json', 'STMicroelectronics', 'Официальное ядро STM32duino: Nucleo, Discovery, Blue Pill и платы на микроконтроллерах STM32.', [['STMicroelectronics:stm32', 'STM32 MCU based boards', '3.1.0'], ['STMicroelectronics:stm8', 'STM8 MCU based boards', '1.0.0']]),
        mk('rp2040', 'Raspberry Pi Pico (RP2040/RP2350)', 'https://github.com/earlephilhower/arduino-pico/releases/download/global/package_rp2040_index.json', 'Earle F. Philhower, III', 'Ядро arduino-pico (Earle Philhower): Raspberry Pi Pico, Pico W и десятки плат на RP2040 и RP2350.', [['rp2040:rp2040', 'Raspberry Pi Pico/RP2040/RP2350', '6.3.2']]),
        mk('drazzy', 'ATTinyCore, megaTinyCore, DxCore', 'https://drazzy.com/package_drazzy.com_index.json', 'Spence Konde', 'Ядра Спенса Конде: ATtiny (ATTinyCore), новые ATtiny серий 0/1/2 (megaTinyCore) и AVR-Dx (DxCore).', [['ATTinyCore:avr', 'ATTinyCore', '1.5.2'], ['DxCore:megaavr', 'DxCore', '1.6.2'], ['megaTinyCore:megaavr', 'megaTinyCore', '2.6.11']]),
        mk('minicore', 'MiniCore (ATmega8/48/88/168/328)', 'https://mcudude.github.io/MiniCore/package_MCUdude_MiniCore_index.json', 'MCUdude', 'Ядро MCUdude для «голых» микроконтроллеров ATmega8, 48, 88, 168, 328 и 328PB.', [['MiniCore:avr', 'MiniCore', '3.1.3']]),
        mk('maixduino', 'Sipeed Maixduino (K210)', 'http://dl.sipeed.com/MAIX/Maixduino/package_Maixduino_k210_index.json', 'Sipeed', 'Плата Sipeed Maixduino на RISC-V K210 с ИИ-ускорителем.', [['Maixduino:k210', 'Maixduino(k210)', '0.3.11']], false)
      ]
      let conf = ['https://espressif.github.io/arduino-esp32/package_esp32_index.json']
      let custom = []
      const checked = {}
      const view = () => [...cat.map((s) => ({ ...s, connected: conf.includes(s.url) })),
        ...custom.map((c) => ({ kind: 'custom', id: 'custom:' + c.url, name: c.name, maintainer: c.maintainer, url: c.url, https: c.url.startsWith('https:'), description: 'Свой адрес. Найдено платформ: 1.', platformsCount: 1, connected: conf.includes(c.url), cores: [{ id: 'my:arch', name: c.name, latest: '1.0.0' }] }))]
      const addCore = (id) => { const c = catalog.find((x) => x.id === id) ?? { id, name: id, latest: '1.0.0' }; if (!cores.some((x) => x.id === id)) cores = [...cores, { ...c, installed: c.latest }] }
      return {
        list: async () => ok({ sources: view(), configured: conf, configPath: 'C:\\Users\\demo\\AppData\\Local\\Arduino15\\arduino-cli.yaml' }),
        check: async (url) => {
          if (!/^https?:\/\/[^\s"']+\.json$/i.test(url)) return bad('Ожидается ссылка на файл индекса, он обычно называется package_…_index.json.')
          if (/bad|404/.test(url)) return bad('Файл не найден на сервере (ошибка 404): проверьте адрес.')
          if (/offline/.test(url)) return bad('Нет соединения с example.com. Проверьте интернет.')
          const known = cat.find((s) => s.url === url)
          checked[url] = true
          return ok({ url, https: url.startsWith('https:'), size: 41234, alreadyConnected: conf.includes(url), catalogId: known?.id,
            summary: { maintainers: ['Example Maker'], platforms: [{ id: 'maker:avr', name: 'Maker AVR Boards', latest: '1.4.0', releases: 5, boards: ['Maker One', 'Maker Two'] }, { id: 'maker:samd', name: 'Maker SAMD Boards', latest: '0.9.2', releases: 2, boards: ['Maker Zero'] }] } })
        },
        connect: (url, ack, ackHttp, installCore) => {
          if (!ack) return Promise.resolve(bad('Нужно подтвердить подключение источника.'))
          const known = cat.find((s) => s.url === url)
          if (!known && !checked[url]) return Promise.resolve(bad('Сначала проверьте адрес кнопкой «Проверить».'))
          const lines = ['Подключение источника плат: ' + url, '$ arduino-cli config add board_manager.additional_urls ' + url, '$ arduino-cli core update-index --no-color', 'Скачивание индекса: package_index.json 50.00%', 'Скачивание индекса: package_index.json 100.00%']
          if (installCore) lines.push(...dl('core install ' + installCore))
          const r = startOp('index-update', lines)
          if (r.ok) setTimeout(() => {
            if (!conf.includes(url)) conf = [...conf, url]
            if (!known && !custom.some((c) => c.url === url)) custom = [...custom, { url, name: 'Example Maker', maintainer: 'Example Maker' }]
            if (installCore) addCore(installCore)
          }, 600)
          return Promise.resolve(r)
        },
        disconnect: (url) => { const r = startOp('config', ['Отключение источника плат: ' + url, '$ arduino-cli config remove board_manager.additional_urls ' + url, 'Источник отключён. Установленные ядра остались на месте.'], 0, 250); if (r.ok) setTimeout(() => { conf = conf.filter((u) => u !== url) }, 150); return Promise.resolve(r) },
        searchCores: async (s) => {
          const t = s.toLowerCase()
          const found = catalog.filter((c) => (c.id + c.name).toLowerCase().includes(t)).filter((c) => c.id.startsWith('arduino:') || c.id === 'esp32:esp32' || cores.some((x) => x.id === c.id))
            .map((c) => ({ ...c, installed: cores.find((x) => x.id === c.id)?.installed }))
          const groups = []
          for (const c of found) {
            const src = cat.find((x) => x.cores.some((k) => k.id === c.id))
            const gid = src ? src.id : '_arduino'
            let g = groups.find((x) => x.sourceId === gid)
            if (!g) { g = { sourceId: gid, title: src ? src.name : 'Arduino (встроенный источник)', url: src?.url, cores: [] }; groups.push(g) }
            g.cores.push(c)
          }
          const hits = cat.filter((x) => !conf.includes(x.url) && (x.name + ' ' + x.description + ' ' + x.cores.map((k) => k.id + k.name).join(' ')).toLowerCase().includes(t))
            .map((x) => ({ source: { ...x, connected: false }, matches: x.cores.map((k) => k.name).slice(0, 3), coreIds: x.cores.map((k) => k.id) }))
          return ok({ groups, hits })
        },
        ide2Urls: async () => ok({ path: 'C:\\Users\\demo\\.arduinoIDE\\arduino-cli.yaml', found: q.get('ide2') !== 'none', urls: q.get('ide2') === 'none' ? [] : [
          { url: 'https://espressif.github.io/arduino-esp32/package_esp32_index.json', valid: true, https: true, alreadyConnected: conf.includes('https://espressif.github.io/arduino-esp32/package_esp32_index.json'), catalogName: 'ESP32 (Espressif)' },
          { url: 'https://arduino.esp8266.com/stable/package_esp8266com_index.json', valid: true, https: true, alreadyConnected: conf.includes('https://arduino.esp8266.com/stable/package_esp8266com_index.json'), catalogName: 'ESP8266 (сообщество)' },
          { url: 'http://maker.example.com/package_maker_index.json', valid: true, https: false, alreadyConnected: false },
          { url: 'ftp://old.example.com/index.json', valid: false, error: 'Поддерживаются только адреса http:// и https://.', https: false, alreadyConnected: false }
        ] }),
        catalogSearch: async (s) => {
          const t = s.toLowerCase()
          return ok(cat.filter((x) => (x.name + ' ' + x.description + ' ' + x.cores.map((k) => k.id + k.name).join(' ')).toLowerCase().includes(t))
            .map((x) => ({ source: { ...x, connected: conf.includes(x.url) }, matches: x.cores.map((k) => k.name).slice(0, 3), coreIds: x.cores.map((k) => k.id) })))
        }
      }
    })(),
    monitor: {
      start: async (port, baud) => {
        if (mon) clearInterval(mon)
        let n = 0
        mon = setInterval(() => {
          n++
          const t = n / 10
          const line = `temp:${(24 + 3 * Math.sin(t)).toFixed(2)},hum:${(45 + 10 * Math.cos(t / 2)).toFixed(1)},pwm:${(n * 7) % 100}\n`
          if (n % 5 === 0) { emit('mdata', { text: line.slice(0, 9), stream: 'stdout' }); emit('mdata', { text: line.slice(9), stream: 'stdout' }) }
          else emit('mdata', { text: line, stream: 'stdout' })
          if (n % 40 === 0) emit('mdata', { text: `Привет из имитации порта\n`, stream: 'stdout' })
        }, 50)
        return ok(null)
      },
      send: async () => true,
      stop: async () => { if (mon) { clearInterval(mon); mon = null; emit('mclosed', null) } return true },
      onData: sub('mdata'),
      onClosed: sub('mclosed')
    },
    examples: (() => {
      const blink = `void setup() {\n  pinMode(LED_BUILTIN, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  delay(1000);\n}\n`
      const mkl = (id, name, origin, core, archs, names) => ({ id, name, origin, core, architectures: archs, examples: names.map((n, i) => ({ id: id + '-' + i, name: n })) })
      const libs = [
        mkl('c1', 'WiFi', 'core', 'esp32:esp32', ['esp32'], ['WiFiScan', 'WiFiClient', 'SimpleWiFiServer']),
        mkl('c2', 'BluetoothSerial', 'core', 'esp32:esp32', ['esp32'], ['SerialToSerialBT']),
        mkl('b1', 'Servo', 'builtin', undefined, ['avr', 'esp32', 'sam'], ['Sweep', 'Knob']),
        mkl('u1', 'DHT sensor library', 'user', undefined, ['*'], ['DHTtester']),
        mkl('u2', 'LiquidCrystal I2C', 'user', undefined, ['avr', 'esp8266'], ['HelloWorld', 'SerialDisplay'])
      ]
      return {
        list: async () => ok({ libs, scannedAt: Date.now(), truncated: false }),
        preview: async (id) => ok({ name: id, files: [{ name: 'Example.ino', content: blink, cut: false }, { name: 'config.h', content: '#define LED 2\n', cut: false }] }),
        suggestName: async (id, label) => ok((label.split(' / ').pop() || 'Example').replace(/[^A-Za-z0-9_]+/g, '_')),
        copy: async (id, name) => {
          const r = BOOK + SEP + name
          if (Object.keys(files).some((p) => p.startsWith(r + SEP))) return bad('Папка «' + name + '» уже существует в «' + BOOK + '». Выберите другое имя.')
          files[r + SEP + name + '.ino'] = blink
          root = r
          return ok(info(r))
        }
      }
    })(),
    search: {
      run: async (query, o) => {
        let re
        try { re = new RegExp(o.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), o.caseSensitive ? 'g' : 'gi') } catch { return bad('Неверное регулярное выражение.') }
        const out = []
        let total = 0
        for (const [p, t] of Object.entries(files)) {
          if (!inside(p) || typeof t !== 'string') continue
          const ms = []
          t.split(/\r?\n/).forEach((l, i) => { re.lastIndex = 0; let m; while ((m = re.exec(l))) { if (!m[0]) { re.lastIndex++; continue } ms.push({ line: i + 1, col: m.index + 1, len: m[0].length, text: l, start: m.index }) } })
          if (ms.length) { out.push({ path: p, rel: p.slice(root.length + 1).replace(/\\/g, '/'), matches: ms }); total += ms.length }
        }
        return ok({ files: out, total, scanned: Object.keys(files).length, truncated: false })
      },
      replace: async (query, o, rep, paths) => {
        const re = new RegExp(o.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), o.caseSensitive ? 'g' : 'gi')
        let replaced = 0, n = 0
        for (const p of paths) { if (!inside(p) || !files[p]) continue; let c = 0; files[p] = files[p].replace(re, () => { c++; return rep }); if (c) { replaced += c; n++; mt[p] = Date.now() } }
        return ok({ replaced, files: n, skipped: [] })
      }
    },
  }
  window.api = api
  window.__stub = { files, setCli: (v) => { cliFound = v } }
})()
