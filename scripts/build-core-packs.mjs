// Сборка «пакетов ядер» для офлайн-установки (см. scripts/README.md).
//
//   node scripts/build-core-packs.mjs              все пакеты (avr, esp8266, esp32)
//   node scripts/build-core-packs.mjs avr,esp8266  выбранные
//   node scripts/build-core-packs.mjs --no-zip     без итогового .zip для ESP32
//
// Для каждого пакета скачиваются архив платформы и архивы всех нужных инструментов (Windows x64) строго по индексу
// пакетов, проверяются размер и SHA-256, складываются в кэш build/cores-cache/ (повторный запуск ничего не качает заново,
// оборванная загрузка докачивается). Результат — папка с manifest.json, индексами и архивами:
//   AVR и ESP8266 → build/cores-bundle/<id>/            (electron-builder кладёт их в resources/cores/<id>/ установщика)
//   ESP32         → release/AVR-IDE-core-esp32-<версия>/ (отдельный «пакет ядра», ≈1,9 ГБ) и такой же .zip
// Файлы в пакет попадают жёсткими ссылками на кэш (на одном томе места не занимают), иначе копируются.
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  copyFileSync, createReadStream, createWriteStream, existsSync, linkSync, mkdirSync, readFileSync, renameSync, rmSync,
  statSync, writeFileSync
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'build', 'cores-cache')
const BUNDLE = join(ROOT, 'build', 'cores-bundle')
const RELEASE = join(ROOT, 'release')
const ARDUINO_INDEX = 'https://downloads.arduino.cc/packages/package_index.json'
const LIBRARY_INDEX = 'https://downloads.arduino.cc/libraries/library_index.json'

/**
 * version: точная версия или 'latest:3' — последняя стабильная версия с major 3.
 * bundle: true — пакет вкладывается в установщик, false — отдельный пакет в release/.
 * unpack: во сколько раз распакованное ядро больше архивов (замерено: AVR ≈ 3,6×, ESP32 ≈ 3,4× — 6,9 ГБ при 2,0 ГБ архивов).
 */
export const SPECS = [
  { id: 'avr', title: 'Arduino AVR', indexUrl: ARDUINO_INDEX, package: 'arduino', arch: 'avr', version: '1.8.8', bundle: true, unpack: 4 },
  { id: 'esp8266', title: 'ESP8266', indexUrl: 'https://arduino.esp8266.com/stable/package_esp8266com_index.json', package: 'esp8266', arch: 'esp8266', version: '3.1.2', bundle: true, unpack: 4 },
  { id: 'esp32', title: 'ESP32', indexUrl: 'https://espressif.github.io/arduino-esp32/package_esp32_index.json', package: 'esp32', arch: 'esp32', version: 'latest:3', bundle: false, unpack: 3.5 }
]

// Хосты Windows x64 в порядке предпочтения (так выбирает и arduino-cli)
const HOSTS = ['x86_64-mingw32', 'x86_64-w64-mingw32', 'i686-mingw32']

// ---------- Разбор индекса ----------

const cmp = (a, b) => {
  const pa = a.split(/[.\-+]/).map((x) => parseInt(x, 10) || 0)
  const pb = b.split(/[.\-+]/).map((x) => parseInt(x, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0)
  return 0
}

/** Выбор версии платформы: точная или «latest:N» (последняя стабильная с major N). */
export function pickVersion(index, pkg, arch, want) {
  const p = index.packages.find((x) => x.name === pkg)
  const all = (p?.platforms ?? []).filter((x) => x.architecture === arch).map((x) => x.version)
  if (!all.length) throw new Error(`В индексе нет платформы ${pkg}:${arch}`)
  const m = /^latest(?::(\d+))?$/.exec(want)
  if (!m) {
    if (!all.includes(want)) throw new Error(`В индексе нет версии ${want} платформы ${pkg}:${arch}`)
    return want
  }
  const ok = all.filter((v) => !/[-+]/.test(v) && (!m[1] || v.split('.')[0] === m[1])).sort(cmp)
  if (!ok.length) throw new Error(`Нет стабильных версий ${pkg}:${arch}` + (m[1] ? ` с major ${m[1]}` : ''))
  return ok[ok.length - 1]
}

const sha = (s) => String(s).replace(/^SHA-256:/i, '').toLowerCase()

/**
 * План скачивания: платформа и все инструменты из toolsDependencies для Windows x64.
 * indexes — { url → json }: инструменты чужого пакета (например arduino:dfu-util в индексе ESP32) берутся из индекса Arduino.
 */
export function planFiles(spec, version, indexes) {
  const main = indexes.get(spec.indexUrl)
  const pkg = main.packages.find((x) => x.name === spec.package)
  const pl = pkg.platforms.find((x) => x.architecture === spec.arch && x.version === version)
  const files = [{
    kind: 'platform', packager: spec.package, name: spec.arch, version, archiveFileName: pl.archiveFileName, url: pl.url,
    size: Number(pl.size), sha256: sha(pl.checksum), index: spec.indexUrl
  }]
  for (const d of pl.toolsDependencies ?? []) {
    let found = null
    for (const [url, idx] of indexes) {
      const pk = idx.packages.find((x) => x.name === d.packager)
      const t = pk?.tools.find((x) => x.name === d.name && x.version === d.version)
      if (t) { found = { t, url }; break }
    }
    if (!found) throw new Error(`Инструмент ${d.packager}:${d.name}@${d.version} не найден ни в одном индексе`)
    const sys = HOSTS.map((h) => found.t.systems.find((s) => s.host === h)).find(Boolean)
    if (!sys) throw new Error(`У инструмента ${d.packager}:${d.name}@${d.version} нет сборки для Windows x64 (${HOSTS.join(', ')})`)
    files.push({
      kind: 'tool', packager: d.packager, name: d.name, version: d.version, host: sys.host, archiveFileName: sys.archiveFileName, url: sys.url,
      size: Number(sys.size), sha256: sha(sys.checksum), index: found.url
    })
  }
  // Встроенные инструменты arduino-cli (ctags, дискавери, монитор порта): без них arduino-cli при первом запуске
  // пытается скачать их из интернета и сообщает об ошибке инициализации. Берём последнюю версию каждого.
  const arduino = indexes.get(ARDUINO_INDEX)
  const builtin = arduino.packages.find((x) => x.name === 'builtin')
  const latest = new Map()
  for (const t of builtin?.tools ?? []) if (!latest.has(t.name) || cmp(t.version, latest.get(t.name).version) > 0) latest.set(t.name, t)
  for (const t of latest.values()) {
    const sys = HOSTS.map((h) => t.systems.find((s) => s.host === h)).find(Boolean)
    if (!sys) throw new Error(`У встроенного инструмента ${t.name}@${t.version} нет сборки для Windows x64`)
    files.push({
      kind: 'tool', packager: 'builtin', name: t.name, version: t.version, host: sys.host, archiveFileName: sys.archiveFileName, url: sys.url,
      size: Number(sys.size), sha256: sha(sys.checksum), index: ARDUINO_INDEX
    })
  }
  return files
}

// ---------- Скачивание ----------

const fmt = (n) => (n >= 1e9 ? (n / 1e9).toFixed(2) + ' ГБ' : (n / 1e6).toFixed(1) + ' МБ')

async function hashFile(path) {
  return new Promise((res, rej) => {
    const h = createHash('sha256')
    createReadStream(path).on('data', (d) => h.update(d)).on('end', () => res(h.digest('hex'))).on('error', rej)
  })
}

async function fetchRange(url, from, dest) {
  const r = await fetch(url, { headers: from ? { Range: `bytes=${from}-` } : {}, redirect: 'follow' })
  if (!r.ok && r.status !== 206) throw new Error(`HTTP ${r.status} для ${url}`)
  const append = from > 0 && r.status === 206
  const out = createWriteStream(dest, { flags: append ? 'a' : 'w' })
  let got = append ? from : 0
  const total = Number(r.headers.get('content-length') ?? 0) + (append ? from : 0)
  let last = 0
  for await (const chunk of r.body) {
    if (!out.write(chunk)) await new Promise((res) => out.once('drain', res))
    got += chunk.length
    if (Date.now() - last > 3000 && total > 20e6) { last = Date.now(); process.stdout.write(`\r    ${fmt(got)} из ${fmt(total)}   `) }
  }
  await new Promise((res, rej) => out.end((e) => (e ? rej(e) : res())))
  if (total > 20e6) process.stdout.write('\r' + ' '.repeat(40) + '\r')
}

/** Скачивает (докачивает) файл в кэш и проверяет размер и SHA-256. Возвращает путь. */
async function ensureCached(f) {
  mkdirSync(CACHE, { recursive: true })
  if (f.size == null) {
    // файл без контрольной суммы в индексе (индекс библиотек): всегда свежая копия, при недоступности сети — из кэша
    const dest = join(CACHE, 'idx', f.archiveFileName)
    try { await cachedText(f.url, f.archiveFileName) } catch (e) { if (!existsSync(dest)) throw e }
    return { path: dest, downloaded: false }
  }
  const dest = join(CACHE, f.archiveFileName)
  const part = dest + '.part'
  const good = (size, hash) => size === f.size && hash === f.sha256
  if (existsSync(dest)) {
    if (statSync(dest).size === f.size && (await hashFile(dest)) === f.sha256) return { path: dest, downloaded: false }
    rmSync(dest)
  }
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      let have = existsSync(part) ? statSync(part).size : 0
      if (have > f.size) { rmSync(part); have = 0 }
      if (have < f.size) await fetchRange(f.url, have, part)
      const hash = await hashFile(part)
      if (good(statSync(part).size, hash)) { renameSync(part, dest); return { path: dest, downloaded: true } }
      rmSync(part)
      throw new Error(`Размер или SHA-256 не совпали с индексом (${f.archiveFileName})`)
    } catch (e) {
      console.log(`    попытка ${attempt}: ${e.message}${e.cause ? ' (' + (e.cause.code ?? e.cause.message) + ')' : ''}`)
      if (attempt === 8) throw e
      await new Promise((r) => setTimeout(r, Math.min(30000, attempt * 4000)))
    }
  }
}

async function cachedText(url, name) {
  const dest = join(CACHE, 'idx', name)
  mkdirSync(dirname(dest), { recursive: true })
  const r = await fetch(url, { redirect: 'follow' })
  if (!r.ok) throw new Error(`HTTP ${r.status} для ${url}`)
  const buf = Buffer.from(await r.arrayBuffer())
  writeFileSync(dest, buf)
  return { path: dest, buf }
}

/** Индекс: всегда свежая копия (маленький файл); при недоступности сети берётся копия из кэша. */
async function loadIndex(url) {
  const name = url.split('/').pop()
  const dest = join(CACHE, 'idx', name)
  try {
    const { buf } = await cachedText(url, name)
    let sig = null
    try { sig = (await cachedText(url + '.sig', name + '.sig')).path } catch { /* подписи у большинства сторонних индексов нет */ }
    return { json: JSON.parse(buf.toString('utf8').replace(/^﻿/, '')), path: dest, sig, name }
  } catch (e) {
    if (!existsSync(dest)) throw e
    console.log(`  сеть недоступна, индекс ${name} берётся из кэша`)
    const sigPath = dest + '.sig'
    return { json: JSON.parse(readFileSync(dest, 'utf8').replace(/^﻿/, '')), path: dest, sig: existsSync(sigPath) ? sigPath : null, name }
  }
}

// ---------- Сборка пакета ----------

function put(src, dst) {
  mkdirSync(dirname(dst), { recursive: true })
  if (existsSync(dst)) rmSync(dst)
  try { linkSync(src, dst) } catch { copyFileSync(src, dst) }
}

async function build(spec, opts) {
  console.log(`\n=== ${spec.title} (${spec.id}) ===`)
  const indexes = new Map()
  const loaded = new Map()
  for (const url of new Set([spec.indexUrl, ARDUINO_INDEX])) {
    const li = await loadIndex(url)
    indexes.set(url, li.json)
    loaded.set(url, li)
  }
  const version = pickVersion(indexes.get(spec.indexUrl), spec.package, spec.arch, spec.version)
  const files = planFiles(spec, version, indexes)
  const total = files.reduce((s, f) => s + f.size, 0)
  console.log(`  версия ${version}, файлов ${files.length}, ${fmt(total)}`)

  const folder = spec.bundle ? join(BUNDLE, spec.id) : join(RELEASE, `AVR-IDE-core-${spec.id}-${version}`)
  rmSync(folder, { recursive: true, force: true })
  mkdirSync(join(folder, 'packages'), { recursive: true })
  mkdirSync(join(folder, 'index'), { recursive: true })

  let i = 0
  for (const f of files) {
    i++
    const t0 = Date.now()
    const r = await ensureCached(f)
    console.log(`  [${i}/${files.length}] ${f.archiveFileName}  ${fmt(f.size)}  ${r.downloaded ? 'скачано за ' + Math.round((Date.now() - t0) / 1000) + ' с' : 'из кэша'}`)
    put(r.path, join(folder, 'packages', f.archiveFileName))
  }

  // Индексы кладём целиком: подпись официального индекса Arduino привязана к содержимому, а в индексе
  // остаётся полный список версий, поэтому «Обновить» и установка других версий работают как обычно.
  const need = new Set(files.map((f) => f.index))
  need.add(ARDUINO_INDEX) // arduino-cli всегда читает свой основной индекс
  const idxList = []
  for (const url of need) {
    const li = loaded.get(url)
    put(li.path, join(folder, 'index', li.name))
    const e = { url, file: `index/${li.name}`, size: statSync(li.path).size, sha256: await hashFile(li.path) }
    if (li.sig) { put(li.sig, join(folder, 'index', li.name + '.sig')); e.sig = { file: `index/${li.name}.sig`, size: statSync(li.sig).size, sha256: await hashFile(li.sig) } }
    idxList.push(e)
  }

  // Индекс библиотек: arduino-cli при первом запуске скачивает его (gz ≈ 5 МБ; распакованный ≈ 60 МБ — распаковывает IDE при установке)
  const lib = await ensureCached({ archiveFileName: 'library_index.json.gz', url: LIBRARY_INDEX + '.gz', size: null, sha256: null })
  const libSig = await ensureCached({ archiveFileName: 'library_index.json.sig', url: LIBRARY_INDEX + '.sig', size: null, sha256: null })
  put(lib.path, join(folder, 'index', 'library_index.json.gz'))
  put(libSig.path, join(folder, 'index', 'library_index.json.sig'))
  const libraryIndex = {
    file: 'index/library_index.json.gz', size: statSync(lib.path).size, sha256: await hashFile(lib.path),
    sig: { file: 'index/library_index.json.sig', size: statSync(libSig.path).size, sha256: await hashFile(libSig.path) }
  }

  const manifest = {
    format: 1,
    id: spec.id,
    title: spec.title,
    package: spec.package,
    arch: spec.arch,
    coreId: `${spec.package}:${spec.arch}`,
    version,
    host: 'windows-x64',
    createdAt: new Date().toISOString(),
    indexUrl: spec.indexUrl,
    indexes: idxList,
    libraryIndex,
    archivesBytes: total,
    unpackFactor: spec.unpack,
    diskNeedBytes: total * (1 + spec.unpack),
    files: files.map((f) => ({
      path: `packages/${f.archiveFileName}`, size: f.size, sha256: f.sha256, kind: f.kind, packager: f.packager, name: f.name,
      version: f.version, host: f.host ?? null, index: f.index
    }))
  }
  writeFileSync(join(folder, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`  готово: ${folder}`)
  return { spec, version, folder, total }
}

function zipFolder(folder) {
  const zip = folder + '.zip'
  rmSync(zip, { force: true })
  console.log(`  архив ${zip} (bsdtar, без сжатия: архивы уже сжаты)…`)
  // bsdtar из Windows (GNU tar из Git Bash zip не умеет)
  const tarExe = process.platform === 'win32' ? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe') : 'tar'
  const r = spawnSync(tarExe, ['-a', '-c', '-f', zip, '--options', 'zip:compression=store', '-C', dirname(folder), folder.split(/[\\/]/).pop()], { stdio: 'inherit' })
  if (r.status !== 0) { console.log('  не удалось создать .zip — оставлена папка'); rmSync(zip, { force: true }); return null }
  console.log(`  .zip: ${fmt(statSync(zip).size)}`)
  return zip
}

// ---------- Запуск ----------

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const names = (args.find((a) => !a.startsWith('--')) ?? 'all').split(',')
  const chosen = names.includes('all') ? SPECS : SPECS.filter((s) => names.includes(s.id))
  if (!chosen.length) { console.error('Неизвестный пакет. Доступны: ' + SPECS.map((s) => s.id).join(', ')); process.exit(2) }
  const done = []
  for (const s of chosen) {
    const r = await build(s, {})
    if (!s.bundle && !args.includes('--no-zip')) r.zip = zipFolder(r.folder)
    done.push(r)
  }
  console.log('\nИтого:')
  for (const d of done) console.log(`  ${d.spec.id} ${d.version}: ${fmt(d.total)} -> ${d.folder}${d.zip ? ' (+ ' + d.zip + ')' : ''}`)
}
