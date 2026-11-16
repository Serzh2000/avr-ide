// Тесты источников плат: без сети, на фикстурах.
// Запуск: node --import ./src/main/libs/tests/register.mjs --test src/main/boardsources/boardsources.test.ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  addUrlToList, buildSourceViews, compareVersions, groupCores, parsePackageIndex, removeUrlFromList, sameUrl, searchCatalog,
  urlsFromConfigDump, validateSourceUrl
} from './core'
import type { CatalogSource, CustomSource } from './types'

// ---------- проверка адреса ----------

test('validateSourceUrl: нормальные адреса', () => {
  const a = validateSourceUrl('https://espressif.github.io/arduino-esp32/package_esp32_index.json')
  assert.deepEqual(a, { ok: true, url: 'https://espressif.github.io/arduino-esp32/package_esp32_index.json', https: true })
  const b = validateSourceUrl('  http://example.com/path/package_x_index.json  ')
  assert.deepEqual(b, { ok: true, url: 'http://example.com/path/package_x_index.json', https: false })
  assert.equal(validateSourceUrl('https://github.com/a/b/raw/main/package_a_index.json?x=1').ok, true)
})

test('validateSourceUrl: мусор, опасные схемы и знаки отвергаются', () => {
  const bad = [
    '', '   ', 'ftp://a.com/x.json', 'file:///C:/x.json', 'javascript:alert(1)', 'https://a.com/x y.json', 'https://a.com/x.json\n--foo',
    'https://a.com/"x".json', "https://a.com/'x'.json", 'https://a.com/x`.json', 'https://u:p@a.com/x.json', 'https://a.com/index.html',
    'https://localhostx/x.json', '-https://a.com/x.json', '--additional-urls', 'https://a.com/' + 'a'.repeat(400) + '.json', 'https://[::1]/x.json'
  ]
  for (const s of bad) assert.equal(validateSourceUrl(s).ok, false, s)
  assert.equal(validateSourceUrl(42).ok, false)
  assert.equal(validateSourceUrl(null).ok, false)
})

test('sameUrl: регистр хоста и пустой путь не различаются, схема различается', () => {
  assert.equal(sameUrl('https://Example.COM/a/p.json', 'https://example.com/a/p.json'), true)
  assert.equal(sameUrl('https://example.com/a/p.json', 'http://example.com/a/p.json'), false)
  assert.equal(sameUrl('https://example.com/a/p.json', 'https://example.com/a/q.json'), false)
})

// ---------- разбор индекса ----------

const fixture = {
  packages: [
    {
      name: 'acme', maintainer: 'Acme Labs',
      platforms: [
        { name: 'Acme AVR', architecture: 'avr', version: '1.9.0', boards: [{ name: 'Acme One' }, { name: 'Acme Two' }] },
        { name: 'Acme AVR', architecture: 'avr', version: '1.10.2', boards: [{ name: 'Acme One' }, { name: 'Acme Three' }, { name: '<b>html</b>' }] },
        { name: 'Acme AVR', architecture: 'avr', version: '1.10.0-rc1', boards: [{ name: 'Old' }] },
        { name: 'Acme ARM', architecture: 'samd', version: '0.1.0' }
      ],
      tools: [{ name: 'x', version: '1' }]
    },
    { name: 'broken', platforms: 'нет' },
    { name: 'other', maintainer: 'Other Co', platforms: [{ name: 'Other', architecture: 'esp', version: '2.0' }, { architecture: 'bad' }] }
  ]
}

test('parsePackageIndex: платформы, последняя версия, платы, мейнтейнеры', () => {
  const s = parsePackageIndex(fixture)
  assert.deepEqual(s.maintainers, ['Acme Labs', 'Other Co'])
  assert.deepEqual(s.platforms.map((p) => p.id), ['acme:avr', 'acme:samd', 'other:esp'])
  const avr = s.platforms[0]
  assert.equal(avr.latest, '1.10.2')
  assert.equal(avr.releases, 3)
  assert.deepEqual(avr.boards, ['Acme One', 'Acme Three']) // HTML-мусор отброшен, платы только последнего релиза
  assert.deepEqual(s.platforms[1].boards, [])
})

test('parsePackageIndex: не индекс — понятная ошибка', () => {
  assert.throws(() => parsePackageIndex({}), /packages/)
  assert.throws(() => parsePackageIndex([]), /packages/)
  assert.throws(() => parsePackageIndex({ packages: [{ name: 'a', platforms: [] }] }), /platforms/)
  assert.throws(() => parsePackageIndex('текст'), /packages/)
})

test('compareVersions', () => {
  assert.ok(compareVersions('1.10.0', '1.9.0') > 0)
  assert.ok(compareVersions('3.3.12', '3.3.10') > 0)
  assert.equal(compareVersions('1.0', '1.0.0'), 0)
})

// ---------- правка списка адресов ----------

test('addUrlToList / removeUrlFromList: без дублей, без побочных эффектов', () => {
  const a = 'https://a.com/p.json'
  const b = 'https://b.com/p.json'
  const base = [a]
  const l1 = addUrlToList(base, b)
  assert.deepEqual(l1, [a, b])
  assert.deepEqual(base, [a], 'исходный список не меняется')
  assert.deepEqual(addUrlToList(l1, 'https://A.com/p.json'), [a, b], 'дубликат с другим регистром хоста')
  assert.deepEqual(removeUrlFromList(l1, 'https://B.com/p.json'), [a])
  assert.deepEqual(removeUrlFromList(l1, 'https://c.com/p.json'), [a, b])
})

test('urlsFromConfigDump: разные формы вывода arduino-cli', () => {
  const u = 'https://x.com/p.json'
  assert.deepEqual(urlsFromConfigDump(JSON.stringify({ config: { board_manager: { additional_urls: [u] } } })), [u])
  assert.deepEqual(urlsFromConfigDump(JSON.stringify({ board_manager: { additional_urls: [u, 5] } })), [u])
  assert.deepEqual(urlsFromConfigDump(JSON.stringify({ config: { board_manager: {} } })), [])
  assert.deepEqual(urlsFromConfigDump('не json'), [])
})

// ---------- группировка поиска ----------

const cat = (id: string, name: string, url: string, cores: string[], tags = ''): CatalogSource => ({
  id, name, maintainer: 'M', url, architectures: cores.map((c) => c.split(':')[1]), description: `Описание ${name}`, tags,
  cores: cores.map((c) => ({ id: c, name: c.toUpperCase(), latest: '1.0.0', releases: 1, boardExamples: [], boards: [`Плата ${c}`] })),
  verifiedAt: '2026-11-16', platformsCount: cores.length, releasesCount: cores.length, https: true
})
const catalogFx = [
  cat('esp32', 'ESP32 (Espressif)', 'https://e.io/esp32.json', ['esp32:esp32'], 'esp32 wifi'),
  cat('mcud', 'MCUdude', 'https://m.io/mc.json', ['MiniCore:avr', 'MegaCore:avr'], 'atmega')
]
const customFx: CustomSource[] = [{ url: 'https://my.org/p.json', https: true, name: 'My Org', maintainers: ['me'], platforms: [{ id: 'my:arch', name: 'My', latest: '1' }], addedAt: '2026-11-16' }]

test('groupCores: по источникам, Arduino первым, неизвестные в конец', () => {
  const g = groupCores(
    [{ id: 'esp32:esp32', name: 'esp32' }, { id: 'arduino:avr', name: 'Arduino AVR Boards' }, { id: 'zzz:zzz', name: 'Z' },
      { id: 'MiniCore:avr', name: 'MiniCore' }, { id: 'MegaCore:avr', name: 'MegaCore' }, { id: 'my:arch', name: 'My' }],
    catalogFx, customFx
  )
  assert.deepEqual(g.map((x) => x.sourceId), ['_arduino', 'esp32', 'mcud', 'custom:https://my.org/p.json', '_unknown'])
  assert.deepEqual(g[2].cores.map((c) => c.id), ['MegaCore:avr', 'MiniCore:avr'])
  assert.equal(g[1].url, 'https://e.io/esp32.json')
  assert.deepEqual(groupCores([], catalogFx, customFx), [])
})

test('searchCatalog: по тегам, ядрам и названиям плат; connected берётся из конфига', () => {
  const conf = ['https://E.io/esp32.json']
  const h1 = searchCatalog('wifi', catalogFx, conf)
  assert.equal(h1.length, 1)
  assert.equal(h1[0].source.id, 'esp32')
  assert.equal(h1[0].source.connected, true)
  const h2 = searchCatalog('плата megacore', catalogFx, conf)
  assert.deepEqual(h2.map((h) => h.source.id), ['mcud'])
  assert.equal(h2[0].source.connected, false)
  assert.deepEqual(searchCatalog('', catalogFx, conf), [])
  assert.deepEqual(searchCatalog('нетакого', catalogFx, conf), [])
})

test('buildSourceViews: каталог, свои, чужие адреса из конфига без дублей', () => {
  const v = buildSourceViews(catalogFx, customFx, ['https://m.io/mc.json', 'https://my.org/p.json', 'https://stranger.net/x.json'])
  assert.deepEqual(v.map((x) => [x.kind, x.connected]), [['catalog', false], ['catalog', true], ['custom', true], ['other', true]])
  assert.equal(v[3].name, 'stranger.net')
  // свой адрес, совпавший с каталожным, не дублируется
  const dup = buildSourceViews(catalogFx, [{ ...customFx[0], url: 'https://M.io/mc.json' }], [])
  assert.equal(dup.length, 2)
})

// ---------- встроенный каталог ----------

test('data/boardsources/sources.json: структура и безопасность адресов', () => {
  const j = JSON.parse(readFileSync(new URL('../../../data/boardsources/sources.json', import.meta.url), 'utf8')) as { sources: CatalogSource[] }
  assert.ok(j.sources.length >= 30)
  const ids = new Set<string>()
  const urls = new Set<string>()
  for (const s of j.sources) {
    assert.ok(!ids.has(s.id), 'дубликат id ' + s.id)
    ids.add(s.id)
    const v = validateSourceUrl(s.url)
    assert.ok(v.ok, 'адрес не проходит проверку: ' + s.url)
    assert.equal(s.https, s.url.startsWith('https://'))
    assert.ok(!urls.has(s.url.toLowerCase()), 'дубликат адреса ' + s.url)
    urls.add(s.url.toLowerCase())
    assert.ok(s.platformsCount >= 1 && s.cores.length >= 1)
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(s.verifiedAt))
    assert.ok(s.description.length > 10 && !s.description.includes('\n'))
    for (const c of s.cores) assert.match(c.id, /^[A-Za-z0-9_][A-Za-z0-9_.-]*:[A-Za-z0-9_.-]+$/)
  }
})
