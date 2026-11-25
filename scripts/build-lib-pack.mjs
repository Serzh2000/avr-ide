// Сборка пакета встроенных библиотек для офлайн-установки (см. scripts/README.md).
//
//   node scripts/build-lib-pack.mjs
//
// Берёт закреплённые библиотеки из официального индекса Arduino (library_index.json), скачивает архивы, проверяет размер
// и SHA-256 и кладёт их в build/libs-bundle/ вместе с manifest.json. electron-builder переносит папку в resources/libs/
// установщика; IDE ставит оттуда библиотеки скетча раньше, чем обращается в сеть.
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'build', 'libs-bundle')
const CACHE = join(ROOT, 'build', 'cores-cache')
const LIBRARY_INDEX = 'https://downloads.arduino.cc/libraries/library_index.json'

/** Библиотеки, без которых не собираются страницы конструкторов. version: точная версия или 'latest'. */
export const LIBRARIES = [
  { name: 'ESPUI', version: 'latest' },
  { name: 'ESP Async WebServer', version: 'latest' },
  { name: 'Async TCP', version: 'latest' },
  { name: 'ESP Async TCP', version: 'latest' },
  { name: 'RPAsyncTCP', version: 'latest' },
  { name: 'ArduinoJson', version: 'latest' }
]

const cmp = (a, b) => {
  const pa = a.split(/[.\-+]/).map((x) => parseInt(x, 10) || 0)
  const pb = b.split(/[.\-+]/).map((x) => parseInt(x, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0)
  return 0
}

export function pickLibrary(index, name, want) {
  const all = index.libraries.filter((l) => l.name === name)
  if (!all.length) throw new Error(`В индексе нет библиотеки ${name}`)
  if (want !== 'latest') {
    const hit = all.find((l) => l.version === want)
    if (!hit) throw new Error(`В индексе нет версии ${want} библиотеки ${name}`)
    return hit
  }
  const stable = all.filter((l) => !/[-+]/.test(l.version)).sort((a, b) => cmp(a.version, b.version))
  if (!stable.length) throw new Error(`Нет стабильных версий ${name}`)
  return stable[stable.length - 1]
}

const sha = (s) => String(s).replace(/^SHA-256:/i, '').toLowerCase()
const hashBuf = (buf) => createHash('sha256').update(buf).digest('hex')

async function download(url, to, size, checksum) {
  if (existsSync(to) && statSync(to).size === size && hashBuf(readFileSync(to)) === checksum) return
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length !== size) throw new Error(`${url}: размер ${buf.length}, ожидался ${size}`)
  if (hashBuf(buf) !== checksum) throw new Error(`${url}: SHA-256 не совпал`)
  writeFileSync(to + '.part', buf)
  renameSync(to + '.part', to)
}

/** Кладёт файлы лицензий из архива библиотеки в build/libs-bundle/licenses/<имя>/ (условие LGPL/MIT: текст лицензии сопровождает копию). */
function extractLicenses(zip, name) {
  const tmp = join(tmpdir(), 'avride-lib-' + process.pid + '-' + Math.random().toString(36).slice(2))
  mkdirSync(tmp, { recursive: true })
  try {
    const r = spawnSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${tmp}' -Force`], { encoding: 'utf8' })
    if (r.status !== 0) throw new Error(`Не удалось распаковать ${zip}: ${r.stderr}`)
    const found = []
    const walk = (dir, depth) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name)
        if (e.isDirectory()) { if (depth < 2) walk(p, depth + 1) } else if (/^(licen[cs]e|copying|notice)/i.test(e.name)) found.push(p)
      }
    }
    walk(tmp, 0)
    if (!found.length) throw new Error(`В архиве ${name} нет файла лицензии`)
    const to = join(OUT, 'licenses', name.replace(/[^A-Za-z0-9._-]+/g, '_'))
    mkdirSync(to, { recursive: true })
    for (const f of found) copyFileSync(f, join(to, basename(f)))
  } finally { rmSync(tmp, { recursive: true, force: true }) }
}

async function main() {
  mkdirSync(CACHE, { recursive: true })
  mkdirSync(OUT, { recursive: true })
  const indexPath = join(CACHE, 'library_index.json')
  console.log('Индекс библиотек Arduino…')
  const res = await fetch(LIBRARY_INDEX)
  if (!res.ok) throw new Error(`library_index.json: HTTP ${res.status}`)
  writeFileSync(indexPath, Buffer.from(await res.arrayBuffer()))
  const index = JSON.parse(readFileSync(indexPath, 'utf8'))
  const libraries = []
  for (const want of LIBRARIES) {
    const lib = pickLibrary(index, want.name, want.version)
    const file = `${lib.name.replace(/[^A-Za-z0-9._-]+/g, '_')}-${lib.version}.zip`
    const checksum = sha(lib.checksum)
    console.log(`  ${lib.name} ${lib.version} (${(Number(lib.size) / 1e3).toFixed(0)} КБ)`)
    await download(lib.url, join(OUT, file), Number(lib.size), checksum)
    extractLicenses(join(OUT, file), lib.name)
    libraries.push({
      name: lib.name, version: lib.version, architectures: lib.architectures ?? ['*'],
      providesIncludes: lib.providesIncludes ?? [], depends: (lib.dependencies ?? []).map((d) => d.name), license: lib.license ?? '', file, sha256: checksum, size: Number(lib.size)
    })
  }
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ version: 1, libraries }, null, 2) + '\n')
  console.log(`Готово: ${libraries.length} библиотек в ${OUT}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(String(e.message ?? e)); rmSync(join(OUT, 'manifest.json'), { force: true }); process.exit(1) })
}
