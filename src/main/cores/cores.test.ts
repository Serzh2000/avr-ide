// Тесты пакетов ядер: без сети, на временных папках и мини-индексах.
// Запуск: node --import ./src/main/libs/tests/register.mjs --test src/main/cores/cores.test.ts
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
// @ts-expect-error — .mjs без типов: общий код сборщика пакетов
import { pickVersion, planFiles } from '../../../scripts/build-core-packs.mjs'
import { indexFileName, indexSatisfies, packStatus, parseManifest, planInstall, resolveInside, safeRel } from './core'
import type { PackManifest } from './core'
import { itemsOf, makePlan, scanRoots, verifyItems } from './packs'

const sha = (b: Buffer | string): string => createHash('sha256').update(b).digest('hex')
const ARDUINO = 'https://downloads.arduino.cc/packages/package_index.json'
const ESP = 'https://arduino.esp8266.com/stable/package_esp8266com_index.json'

function manifestObj(over: Record<string, unknown> = {}): Record<string, any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    format: 1, id: 'esp8266', title: 'ESP8266', package: 'esp8266', arch: 'esp8266', coreId: 'esp8266:esp8266', version: '3.1.2', host: 'windows-x64',
    createdAt: '2026-01-01T00:00:00Z', indexUrl: ESP,
    indexes: [{ url: ESP, file: 'index/package_esp8266com_index.json', size: 10, sha256: sha('x') }, { url: ARDUINO, file: 'index/package_index.json', size: 10, sha256: sha('y') }],
    archivesBytes: 30, unpackFactor: 3,
    files: [
      { path: 'packages/esp8266-3.1.2.zip', size: 10, sha256: sha('a'), kind: 'platform', packager: 'esp8266', name: 'esp8266', version: '3.1.2', host: null, index: ESP },
      { path: 'packages/tool-1.zip', size: 10, sha256: sha('b'), kind: 'tool', packager: 'esp8266', name: 'tool', version: '1', host: 'x86_64-mingw32', index: ESP },
      { path: 'packages/ctags.zip', size: 10, sha256: sha('c'), kind: 'tool', packager: 'builtin', name: 'ctags', version: '5.8', host: 'i686-mingw32', index: ARDUINO }
    ],
    ...over
  }
}
const parse = (o: unknown): PackManifest => parseManifest(JSON.stringify(o))

// ---------- manifest ----------

test('parseManifest: корректный manifest', () => {
  const m = parse(manifestObj())
  assert.equal(m.coreId, 'esp8266:esp8266')
  assert.equal(m.files.length, 3)
  assert.equal(m.archivesBytes, 30)
  assert.equal(m.unpackFactor, 3)
})

test('parseManifest: отвергает мусор и подделки', () => {
  assert.throws(() => parseManifest('не json'), /JSON/)
  assert.throws(() => parse(manifestObj({ format: 2 })), /формат/)
  assert.throws(() => parse(manifestObj({ coreId: 'esp32:esp32' })), /coreId/)
  assert.throws(() => parse(manifestObj({ id: '../x' })), /id/)
  const dup = manifestObj(); dup.files.push({ ...dup.files[1] })
  assert.throws(() => parse(dup), /дважды/)
  const noPlat = manifestObj(); noPlat.files = noPlat.files.slice(1)
  assert.throws(() => parse(noPlat), /платформ/)
  const badIdx = manifestObj(); badIdx.files[1].index = 'https://evil.example/x.json'
  assert.throws(() => parse(badIdx), /индекс/)
  const badSha = manifestObj(); badSha.files[1].sha256 = 'zz'
  assert.throws(() => parse(badSha), /sha256/)
  const badSize = manifestObj(); badSize.files[1].size = -5
  assert.throws(() => parse(badSize), /размер/)
})

test('безопасные пути: выход за папку пакета запрещён', () => {
  for (const bad of ['../x.zip', 'packages/../x.zip', 'packages/a/b.zip', 'packages\\a.zip', '/etc/passwd', 'C:/x.zip', 'index/a.zip', 'packages/..', 'packages/', '']) {
    assert.throws(() => safeRel(bad, 'packages'), /./, bad)
  }
  assert.equal(safeRel('packages/a-1.2.zip', 'packages'), 'packages/a-1.2.zip')
  for (const bad of ['packages/../../x.zip', 'packages/..\\x']) {
    for (const mk of [() => parse(manifestObj({ files: [{ ...manifestObj().files[0], path: bad }] }))]) assert.throws(mk, /./, bad)
  }
  const root = join(tmpdir(), 'avride-root')
  assert.throws(() => resolveInside(root, '../x'), /за пределы/)
  assert.throws(() => resolveInside(root, 'C:\\Windows\\x'), /./)
  assert.ok(resolveInside(root, 'packages/a.zip').endsWith('a.zip'))
})

// ---------- индексы ----------

test('indexFileName и indexSatisfies', () => {
  assert.equal(indexFileName(ESP), 'package_esp8266com_index.json')
  const m = parse(manifestObj())
  const good = {
    packages: [{
      name: 'esp8266',
      platforms: [{ architecture: 'esp8266', version: '3.1.2', checksum: 'SHA-256:' + sha('a') }],
      tools: [{ name: 'tool', version: '1', systems: [{ host: 'x86_64-mingw32', checksum: 'SHA-256:' + sha('b') }] }]
    }]
  }
  assert.equal(indexSatisfies(good, m, ESP), true)
  assert.equal(indexSatisfies(null, m, ESP), false)
  assert.equal(indexSatisfies({ packages: [] }, m, ESP), false)
  const other = JSON.parse(JSON.stringify(good)); other.packages[0].platforms[0].checksum = 'SHA-256:' + sha('другая')
  assert.equal(indexSatisfies(other, m, ESP), false, 'другая контрольная сумма — индекс не подходит')
  const old = JSON.parse(JSON.stringify(good)); old.packages[0].platforms[0].version = '3.0.0'
  assert.equal(indexSatisfies(old, m, ESP), false, 'нет нужной версии')
})

test('pickVersion: точная версия и последняя стабильная major 3', () => {
  const idx = { packages: [{ name: 'esp32', platforms: ['3.3.12', '3.3.2', '3.4.0-rc1', '3.10.0', '2.0.17', '4.0.0'].map((v) => ({ architecture: 'esp32', version: v })) }] }
  assert.equal(pickVersion(idx, 'esp32', 'esp32', 'latest:3'), '3.10.0')
  assert.equal(pickVersion(idx, 'esp32', 'esp32', 'latest'), '4.0.0')
  assert.equal(pickVersion(idx, 'esp32', 'esp32', '2.0.17'), '2.0.17')
  assert.throws(() => pickVersion(idx, 'esp32', 'esp32', '9.9.9'), /нет версии/)
  assert.throws(() => pickVersion(idx, 'esp32', 'avr', 'latest:3'), /нет платформы/)
  assert.throws(() => pickVersion(idx, 'esp32', 'esp32', 'latest:7'), /Нет стабильных/)
})

test('planFiles: платформа, инструменты (из своего и чужого индекса), встроенные; хост Windows x64', () => {
  const sys = (host: string, n: string): unknown => ({ host, url: `https://x/${n}`, archiveFileName: n, checksum: 'SHA-256:' + sha(n), size: '10' })
  const main = {
    packages: [{
      name: 'esp32',
      platforms: [{ architecture: 'esp32', version: '3.3.12', url: 'https://x/p.zip', archiveFileName: 'p.zip', checksum: 'SHA-256:' + sha('p'), size: '10', toolsDependencies: [{ packager: 'esp32', name: 't1', version: '1' }, { packager: 'arduino', name: 'dfu', version: '2' }] }],
      tools: [{ name: 't1', version: '1', systems: [sys('x86_64-pc-linux-gnu', 'lin'), sys('i686-mingw32', 'w32'), sys('x86_64-mingw32', 'w64')] }]
    }]
  }
  const ard = {
    packages: [
      { name: 'arduino', platforms: [], tools: [{ name: 'dfu', version: '2', systems: [sys('i686-mingw32', 'dfu32')] }] },
      { name: 'builtin', platforms: [], tools: [{ name: 'ctags', version: '5.8', systems: [sys('i686-mingw32', 'ct')] }, { name: 'serial', version: '1.4', systems: [sys('x86_64-mingw32', 's14')] }, { name: 'serial', version: '1.10', systems: [sys('x86_64-mingw32', 's110')] }] }
    ]
  }
  const files = planFiles({ indexUrl: 'U1', package: 'esp32', arch: 'esp32' }, '3.3.12', new Map<string, unknown>([['U1', main], [ARDUINO, ard]]))
  assert.deepEqual(files.map((f: { archiveFileName: string }) => f.archiveFileName), ['p.zip', 'w64', 'dfu32', 'ct', 's110'])
  assert.throws(() => planFiles({ indexUrl: 'U1', package: 'esp32', arch: 'esp32' }, '3.3.12', new Map<string, unknown>([['U1', { packages: [{ ...main.packages[0], tools: [] }] }], [ARDUINO, ard]])), /не найден/)
})

// ---------- план установки ----------

const baseIn = (over: Record<string, unknown> = {}): Parameters<typeof planInstall>[0] => ({
  manifest: parse(manifestObj({ libraryIndex: { file: 'index/library_index.json.gz', size: 10, sha256: sha('l'), sig: { file: 'index/library_index.json.sig', size: 10, sha256: sha('s') } } })),
  dataIndexes: new Map(), staged: new Map(), configuredUrls: [], freeData: 100 * 1024 ** 3, freeStaging: 100 * 1024 ** 3, sameVolume: true, ...over
})

test('planInstall: установка с нуля — всё копируется, адрес добавляется, команда без сети', () => {
  const p = planInstall(baseIn())
  assert.equal(p.action, 'install')
  assert.equal(p.copyFiles.length, 3)
  assert.equal(p.copyIndexes.length, 2)
  assert.equal(p.copyLibraryIndex, true)
  assert.equal(p.addUrl, ESP)
  assert.deepEqual(p.command, ['core', 'install', 'esp8266:esp8266@3.1.2', '--no-color'])
})

test('planInstall: уже установлено — не трогаем; более новая версия — тоже', () => {
  assert.equal(planInstall(baseIn({ installed: '3.1.2' })).action, 'skip')
  assert.match(planInstall(baseIn({ installed: '3.1.2' })).reason, /уже установлено/)
  assert.equal(planInstall(baseIn({ installed: '3.3.0' })).action, 'skip')
  const up = planInstall(baseIn({ installed: '3.0.0' }))
  assert.equal(up.action, 'install')
  assert.match(up.reason, /Обновление/)
  assert.equal(packStatus(parse(manifestObj()), undefined), 'ready')
})

test('planInstall: готовое не копируем (индексы пользователя, установленные инструменты, файлы в staging, адрес уже в настройках)', () => {
  const m = parse(manifestObj())
  const good = (url: string): unknown => url === ESP
    ? { packages: [{ name: 'esp8266', platforms: [{ architecture: 'esp8266', version: '3.1.2', checksum: 'SHA-256:' + sha('a') }], tools: [{ name: 'tool', version: '1', systems: [{ host: 'x86_64-mingw32', checksum: 'SHA-256:' + sha('b') }] }] }] }
    : { packages: [{ name: 'builtin', tools: [{ name: 'ctags', version: '5.8', systems: [{ host: 'i686-mingw32', checksum: 'SHA-256:' + sha('c') }] }] }] }
  const p = planInstall(baseIn({
    manifest: m,
    dataIndexes: new Map([[indexFileName(ESP), good(ESP)], [indexFileName(ARDUINO), good(ARDUINO)]]),
    installedTools: new Set(['builtin/ctags/5.8']),
    staged: new Map([['esp8266-3.1.2.zip', 10]]),
    configuredUrls: [ESP.toUpperCase().replace('HTTPS', 'https').replace('ARDUINO.ESP8266.COM', 'arduino.esp8266.com') + '/'],
    hasLibraryIndex: true
  }))
  assert.equal(p.action, 'install')
  assert.deepEqual(p.copyFiles.map((f) => f.path), ['packages/tool-1.zip'])
  assert.equal(p.copyIndexes.length, 0)
  assert.equal(p.copyLibraryIndex, false)
})

test('planInstall: нехватка места — понятная ошибка', () => {
  const big = parse(manifestObj({ archivesBytes: 1900 * 1024 ** 2, files: manifestObj().files.map((f: { size: number }, i: number) => ({ ...f, size: i === 0 ? 1900 * 1024 ** 2 : f.size })) }))
  const p = planInstall(baseIn({ manifest: big, freeData: 3 * 1024 ** 3, freeStaging: 3 * 1024 ** 3 }))
  assert.equal(p.action, 'blocked')
  assert.match(p.reason, /Недостаточно места/)
  assert.match(p.reason, /ГБ/)
  const ok = planInstall(baseIn({ manifest: big, freeData: 50 * 1024 ** 3, freeStaging: 50 * 1024 ** 3 }))
  assert.equal(ok.action, 'install')
  const split = planInstall(baseIn({ manifest: big, sameVolume: false, freeData: 7 * 1024 ** 3, freeStaging: 1 * 1024 ** 3 }))
  assert.equal(split.action, 'blocked', 'на томе staging не хватает под архивы')
})

// ---------- файлы на диске ----------

function makePack(dir: string, tamper?: (d: string) => void): PackManifest {
  const files = [['packages/esp8266-3.1.2.zip', 'platform-bytes', 'platform', 'esp8266', 'esp8266'], ['packages/tool-1.zip', 'tool-bytes', 'tool', 'esp8266', 'tool']] as const
  mkdirSync(join(dir, 'packages'), { recursive: true })
  mkdirSync(join(dir, 'index'), { recursive: true })
  for (const f of files) writeFileSync(join(dir, f[0]), f[1])
  writeFileSync(join(dir, 'index', 'package_esp8266com_index.json'), '{"packages":[]}')
  const o = manifestObj({
    indexes: [{ url: ESP, file: 'index/package_esp8266com_index.json', size: 15, sha256: sha('{"packages":[]}') }],
    files: files.map((f) => ({ path: f[0], size: f[1].length, sha256: sha(f[1]), kind: f[2], packager: 'esp8266', name: f[4], version: f[2] === 'platform' ? '3.1.2' : '1', host: null, index: ESP }))
  })
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(o))
  tamper?.(dir)
  return parse(o)
}

test('scanRoots + verifyItems: целый пакет проходит; подмена, обрезка и отсутствие файла — ошибки', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'avride-cores-'))
  try {
    const dir = join(tmp, 'AVR-IDE-core-esp8266-3.1.2')
    const m = makePack(dir)
    const found = await scanRoots([{ dir: tmp, origin: 'external' }])
    assert.equal(found.length, 1)
    assert.equal(found[0].manifest?.version, '3.1.2')
    assert.match(found[0].key, /^e:esp8266:3\.1\.2:[0-9a-f]{10}$/)
    const plan = await makePlan(m, { data: join(tmp, 'data'), downloads: join(tmp, 'dl'), urls: [] })
    assert.equal(plan.action, 'install')
    const items = itemsOf(m, plan)
    assert.equal(items.length, 3)
    await verifyItems(dir, items, () => undefined)

    writeFileSync(join(dir, 'packages', 'tool-1.zip'), 'tool-BYTES') // тот же размер, другое содержимое
    await assert.rejects(verifyItems(dir, items, () => undefined), /контрольной суммы/)
    writeFileSync(join(dir, 'packages', 'tool-1.zip'), 'коротко')
    await assert.rejects(verifyItems(dir, items, () => undefined), /размер/)
    rmSync(join(dir, 'packages', 'tool-1.zip'))
    await assert.rejects(verifyItems(dir, items, () => undefined), /Нет файла/)
    // после поломки пакет сканом помечается как неполный
    const bad = await scanRoots([{ dir: tmp, origin: 'external' }])
    assert.equal(bad[0].manifest, null)
    assert.match(bad[0].error ?? '', /неполный/)
  } finally { rmSync(tmp, { recursive: true, force: true }) }
})

test('scanRoots: на ядро берётся самая свежая версия; встроенный при равенстве раньше внешнего; чужие папки игнорируются', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'avride-cores-'))
  try {
    makePack(join(tmp, 'ext', 'AVR-IDE-core-esp8266-3.1.2'))
    makePack(join(tmp, 'bundled', 'esp8266'))
    mkdirSync(join(tmp, 'ext', 'Other-folder'), { recursive: true })
    writeFileSync(join(tmp, 'ext', 'Other-folder', 'manifest.json'), '{}')
    const found = await scanRoots([{ dir: join(tmp, 'ext'), origin: 'external' }, { dir: join(tmp, 'bundled'), origin: 'bundled' }])
    assert.equal(found.length, 1)
    assert.equal(found[0].origin, 'bundled')
    // распакованный zip: вложенная папка с тем же именем
    makePack(join(tmp, 'ext2', 'AVR-IDE-core-esp8266-3.1.2', 'AVR-IDE-core-esp8266-3.1.2'))
    const nested = await scanRoots([{ dir: join(tmp, 'ext2'), origin: 'external' }])
    assert.equal(nested.length, 1)
    assert.ok(nested[0].manifest)
  } finally { rmSync(tmp, { recursive: true, force: true }) }
})
