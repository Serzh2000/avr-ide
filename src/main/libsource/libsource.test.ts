// Тесты источника GitHub: без сети, на фикстурах.
// Запуск: node --import ./src/renderer/src/uibuilder/tests/register.mjs --test src/main/libsource/libsource.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deflateRawSync } from 'node:zlib'
import { buildCatalog, cleanAuthor, compactIndex, searchCatalog, tokenize } from './catalog-core'
import { dependStatus, parseDepends, parseProperties } from './props'
import {
  buildRefsUrl, buildTagsApiUrl, buildZipUrl, compareVersions, isOwner, isRef, isRepoName, normalizeRepoUrl, parseGitRefs, parseRepositories
} from './repo'
import { inspectLibraryZip, listZip } from './zip'

// ---------- нормализация URL ----------

test('normalizeRepoUrl: регистр, .git, слеш, www, ssh, глубокие ссылки, краткая запись', () => {
  const k = (s: string): string | undefined => normalizeRepoUrl(s)?.key
  assert.equal(k('https://github.com/Adafruit/Adafruit_BusIO'), 'adafruit/adafruit_busio')
  assert.equal(k('https://github.com/Adafruit/Adafruit_BusIO.git'), 'adafruit/adafruit_busio')
  assert.equal(k('https://github.com/Adafruit/Adafruit_BusIO/'), 'adafruit/adafruit_busio')
  assert.equal(k('http://www.GitHub.com/Adafruit/Adafruit_BusIO.GIT/'), 'adafruit/adafruit_busio')
  assert.equal(k('git@github.com:Adafruit/Adafruit_BusIO.git'), 'adafruit/adafruit_busio')
  assert.equal(k('https://github.com/s00500/ESPUI/tree/main/src'), 's00500/espui')
  assert.equal(k('s00500/ESPUI'), 's00500/espui')
  assert.equal(normalizeRepoUrl('https://github.com/s00500/ESPUI.git')?.repo, 'ESPUI') // регистр сохраняется для показа
})

test('normalizeRepoUrl: чужие и мусорные адреса отвергаются', () => {
  for (const bad of ['', 'https://gitlab.com/a/b', 'https://github.com/a', 'https://github.com/', 'ftp://github.com/a/b', 'https://github.com/-a/b',
    'https://github.com/a/..', 'javascript:alert(1)', 'https://evil.com/github.com/a/b', 'https://github.com.evil.com/a/b']) {
    assert.equal(normalizeRepoUrl(bad), null, bad)
  }
  assert.equal(normalizeRepoUrl(42 as unknown), null)
})

// ---------- repositories.txt ----------

test('parseRepositories: пропускает пустые, дубликаты и чужие хосты', () => {
  const txt = [
    'https://github.com/aikopras/RSbusMaster', '',
    'https://github.com/AIKOPRAS/rsbusmaster.git', // дубликат с другим регистром
    '# комментарий', 'https://gitlab.com/x/y', 'https://github.com/modest-iot/modest-iot-nano-framework\r',
    'мусор', 'https://github.com/mustafabagr/STPM32_UART/'
  ].join('\n')
  const r = parseRepositories(txt)
  assert.deepEqual(r.map((x) => `${x.owner}/${x.repo}`), ['aikopras/RSbusMaster', 'modest-iot/modest-iot-nano-framework', 'mustafabagr/STPM32_UART'])
})

// ---------- валидация и построение URL ----------

test('валидация owner / repo / ref', () => {
  assert.ok(isOwner('s00500') && isOwner('a') && isOwner('Adafruit'))
  assert.ok(!isOwner('') && !isOwner('-a') && !isOwner('a_b') && !isOwner('a/b') && !isOwner('a'.repeat(40)) && !isOwner('a b'))
  assert.ok(isRepoName('Adafruit_BusIO') && isRepoName('a.b-c_d') && isRepoName('...x'))
  assert.ok(!isRepoName('..') && !isRepoName('.') && !isRepoName('a/b') && !isRepoName('a b') && !isRepoName('a?b') && !isRepoName(''))
  assert.ok(isRef('v1.2.3') && isRef('1.0.0') && isRef('release/1.0') && isRef('feature_x+1'))
  assert.ok(!isRef('-x') && !isRef('a..b') && !isRef('a//b') && !isRef('a/') && !isRef('a b') && !isRef('a?b=1') && !isRef('a#b') && !isRef('a%2e') && !isRef('x.lock') && !isRef(''))
})

test('построение URL из безопасных частей', () => {
  assert.equal(buildZipUrl('s00500', 'ESPUI', 'tag', '2.2.4'), 'https://codeload.github.com/s00500/ESPUI/zip/refs/tags/2.2.4')
  assert.equal(buildZipUrl('o', 'r', 'branch', 'release/1.0'), 'https://codeload.github.com/o/r/zip/refs/heads/release/1.0')
  assert.equal(buildZipUrl('o', 'r', 'default'), 'https://codeload.github.com/o/r/zip/HEAD')
  assert.equal(buildTagsApiUrl('o', 'r'), 'https://api.github.com/repos/o/r/tags?per_page=100')
  assert.equal(buildRefsUrl('o', 'r'), 'https://github.com/o/r.git/info/refs?service=git-upload-pack')
  assert.throws(() => buildZipUrl('o', 'r', 'tag', '../x'))
  assert.throws(() => buildZipUrl('o', 'r', 'tag'))
  assert.throws(() => buildZipUrl('o/x', 'r', 'default'))
  assert.throws(() => buildZipUrl('o', 'r?x=1', 'default'))
})

test('compareVersions', () => {
  assert.ok(compareVersions('1.10.0', '1.9.0') > 0)
  assert.ok(compareVersions('v2.0.0', '1.99.99') > 0)
  assert.ok(compareVersions('1.2', '1.2.1') < 0)
  assert.ok(compareVersions('1.2', '1.2-beta') > 0)
  assert.equal(compareVersions('1.0.0', 'v1.0.0'), 0)
})

// ---------- git refs ----------

function pkt(s: string): string {
  return (s.length + 4).toString(16).padStart(4, '0') + s
}

test('parseGitRefs: теги, ветка по умолчанию, peeled-теги', () => {
  const sha = 'a'.repeat(40)
  const body =
    pkt('# service=git-upload-pack\n') + '0000' +
    pkt(`${sha} HEAD\u0000multi_ack symref=HEAD:refs/heads/main agent=git/github\n`) +
    pkt(`${sha} refs/heads/dev\n`) + pkt(`${sha} refs/heads/main\n`) +
    pkt(`${sha} refs/tags/1.0.0\n`) + pkt(`${sha} refs/tags/1.0.0^{}\n`) + pkt(`${sha} refs/tags/v1.10.0\n`) +
    pkt(`${sha} refs/tags/v1.9.0\n`) + '0000'
  const r = parseGitRefs(Buffer.from(body, 'utf8'))
  assert.equal(r.defaultBranch, 'main')
  assert.deepEqual(r.tags, ['v1.10.0', 'v1.9.0', '1.0.0'])
  assert.deepEqual(r.heads, ['dev', 'main'])
})

// ---------- индекс и сопоставление ----------

const INDEX = [
  { name: 'ESPUI', version: '2.2.3', author: 'Lukas Bachschwell', sentence: 'ESP32 Web Interface Library', category: 'Communication', repository: 'https://github.com/s00500/ESPUI.git', website: 'https://github.com/s00500/ESPUI' },
  { name: 'ESPUI', version: '2.2.4', author: 'Lukas Bachschwell', sentence: 'Simple Web UI Library for ESP', category: 'Communication', repository: 'https://github.com/s00500/ESPUI.git' },
  { name: 'ESPUI', version: '2.2.10', author: 'Lukas Bachschwell', sentence: 'Simple Web UI Library for ESP', category: 'Communication', repository: 'https://github.com/s00500/ESPUI.git' },
  { name: 'Servo', version: '1.2.1', author: 'Arduino', sentence: 'Allows Arduino boards to control servo motors.', category: 'Device Control', repository: 'https://github.com/arduino-libraries/Servo.git' },
  { name: 'Only Website', version: '1.0.0', author: 'Someone', sentence: 'Matched by website', website: 'https://www.github.com/Some/Site/' },
  { name: 'No Github', version: '1.0.0', repository: 'https://gitlab.com/x/y.git' },
  { version: '1.0.0', repository: 'https://github.com/a/b' }, // без имени — пропуск
  null
]

test('compactIndex: версии, самое новое описание, сопоставление по repository и website', () => {
  const m = compactIndex(INDEX)
  assert.deepEqual(m['s00500/espui'].v, ['2.2.10', '2.2.4', '2.2.3'])
  assert.equal(m['s00500/espui'].s, 'Simple Web UI Library for ESP')
  assert.equal(m['some/site'].n, 'Only Website')
  assert.equal(m['a/b'], undefined)
  assert.equal(Object.keys(m).length, 3)
})

function catalog() {
  const registry = parseRepositories([
    'https://github.com/s00500/ESPUI', 'https://github.com/arduino-libraries/Servo.git', 'https://github.com/unknown-dev/Mystery_Lib/',
    'https://github.com/foo/ServoHelper'
  ].join('\n'))
  return buildCatalog(registry, compactIndex(INDEX), [])
}

test('buildCatalog: описание из индекса, «owner/repo» без записи, репозитории только из индекса', () => {
  const c = catalog()
  const by = (id: string) => c.entries.find((e) => e.id === id)!
  assert.equal(by('s00500/ESPUI').name, 'ESPUI')
  assert.equal(by('s00500/ESPUI').latest, '2.2.10')
  assert.equal(by('s00500/ESPUI').inIndex, true)
  assert.equal(by('unknown-dev/Mystery_Lib').name, 'unknown-dev/Mystery_Lib')
  assert.equal(by('unknown-dev/Mystery_Lib').inIndex, false)
  assert.equal(by('unknown-dev/Mystery_Lib').sentence, undefined)
  assert.ok(c.entries.some((e) => e.id === 'Some/Site' && e.inIndex)) // есть в индексе, нет в реестре
  assert.equal(c.entries.length, 5)
})

test('buildCatalog: свой список помечается и идёт первым; дубликат реестра не плодится', () => {
  const registry = parseRepositories('https://github.com/s00500/ESPUI')
  const custom = [normalizeRepoUrl('https://github.com/S00500/espui.git')!, normalizeRepoUrl('me/mine')!]
  const c = buildCatalog(registry, {}, custom)
  assert.equal(c.entries.length, 2)
  assert.ok(c.entries.every((e) => e.custom))
})

// ---------- поиск ----------

test('cleanAuthor убирает email', () => {
  assert.equal(cleanAuthor('Benoit Blanchon <blog.benoitblanchon.fr>'), 'Benoit Blanchon')
  assert.equal(cleanAuthor('A <a@b.c>, B <d@e.f>'), 'A, B')
  assert.equal(cleanAuthor(undefined), undefined)
})

test('tokenize', () => {
  assert.deepEqual(tokenize('  ESP-UI  web, lib '), ['esp-ui', 'web', 'lib'])
  assert.deepEqual(tokenize('Привет мир'), ['привет', 'мир'])
  assert.deepEqual(tokenize(''), [])
})

test('поиск: по имени, автору, описанию и owner/repo; ранжирование', () => {
  const c = catalog()
  assert.equal(searchCatalog(c, 'espui').items[0].id, 's00500/ESPUI')
  assert.equal(searchCatalog(c, 'lukas').total, 1) // автор
  assert.equal(searchCatalog(c, 'servo motors').items[0].id, 'arduino-libraries/Servo') // описание, несколько токенов
  assert.equal(searchCatalog(c, 'mystery').items[0].id, 'unknown-dev/Mystery_Lib') // по owner/repo
  assert.equal(searchCatalog(c, 'unknown-dev/mystery').total, 1)
  assert.equal(searchCatalog(c, 'servo').items[0].id, 'arduino-libraries/Servo') // точное имя выше, чем ServoHelper
  assert.equal(searchCatalog(c, 'servo').total, 2)
  assert.equal(searchCatalog(c, 'нет такого').total, 0)
  assert.equal(searchCatalog(c, 'ESPUI nonsense').total, 0) // все токены обязательны
})

test('поиск: пагинация и ограничение выдачи 100', () => {
  const registry = Array.from({ length: 350 }, (_, i) => ({ owner: 'o', repo: 'lib' + String(i).padStart(3, '0'), key: `o/lib${String(i).padStart(3, '0')}` }))
  const c = buildCatalog(registry, {}, [])
  const p1 = searchCatalog(c, 'lib', 0, 1000)
  assert.equal(p1.items.length, 100)
  assert.equal(p1.total, 350)
  const p4 = searchCatalog(c, 'lib', 300, 100)
  assert.equal(p4.items.length, 50)
  assert.equal(searchCatalog(c, '', 0, 100).total, 350)
  assert.equal(searchCatalog(c, '', 340, 100).items.length, 10)
  const ids = new Set([...searchCatalog(c, 'lib', 0).items, ...searchCatalog(c, 'lib', 100).items].map((e) => e.id))
  assert.equal(ids.size, 200)
})

// ---------- library.properties ----------

test('parseProperties и parseDepends', () => {
  const p = parseProperties('﻿name=ESPUI\nversion=2.2.4\n# коммент\ndepends=ESP Async WebServer (>=1.0), ArduinoJson (>=6.0, <7), Foo\nsentence=a=b\n')
  assert.equal(p.name, 'ESPUI')
  assert.equal(p.sentence, 'a=b')
  assert.deepEqual(parseDepends(p.depends), [
    { name: 'ESP Async WebServer', constraint: '>=1.0' },
    { name: 'ArduinoJson', constraint: '>=6.0, <7' },
    { name: 'Foo', constraint: undefined }
  ])
  assert.deepEqual(parseDepends(undefined), [])
  assert.deepEqual(parseDepends(''), [])
})

test('dependStatus: что не установлено (без учёта регистра, пробел = «_»)', () => {
  const r = dependStatus('Adafruit BusIO, ArduinoJson (>=6), Missing Lib', ['Adafruit_BusIO', 'arduinojson'])
  assert.deepEqual(r.map((d) => [d.name, d.installed]), [['Adafruit BusIO', true], ['ArduinoJson', true], ['Missing Lib', false]])
})

// ---------- zip ----------

function makeZip(files: Record<string, string>, deflate = true): Buffer {
  const locals: Buffer[] = []
  const central: Buffer[] = []
  let off = 0
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text)
    const comp = deflate ? deflateRawSync(data) : data
    const nameB = Buffer.from(name)
    const lh = Buffer.alloc(30)
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(deflate ? 8 : 0, 8)
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nameB.length, 26)
    const local = Buffer.concat([lh, nameB, comp])
    const ch = Buffer.alloc(46)
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(deflate ? 8 : 0, 10)
    ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nameB.length, 28); ch.writeUInt32LE(off, 42)
    central.push(Buffer.concat([ch, nameB]))
    locals.push(local)
    off += local.length
  }
  const cd = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(central.length, 8); end.writeUInt16LE(central.length, 10)
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16)
  return Buffer.concat([...locals, cd, end])
}

test('zip: чтение library.properties из архива GitHub (с корневой папкой)', () => {
  const z = makeZip({
    'ESPUI-2.2.4/': '', 'ESPUI-2.2.4/library.properties': 'name=ESPUI\nversion=2.2.4\ndepends=ArduinoJson\n', 'ESPUI-2.2.4/src/ESPUI.h': '#pragma once'
  })
  assert.equal(listZip(z).length, 3)
  const r = inspectLibraryZip(z)
  assert.equal(r.ok, true)
  assert.equal(r.props?.name, 'ESPUI')
  assert.equal(r.props?.depends, 'ArduinoJson')
  assert.equal(r.headers, 1)
  for (const stored of [false]) assert.equal(inspectLibraryZip(makeZip({ 'a/library.properties': 'name=A' }, stored)).props?.name, 'A')
})

test('zip: без library.properties — предупреждение при наличии .h, отказ без них', () => {
  const withH = inspectLibraryZip(makeZip({ 'x/x.h': '//', 'x/x.cpp': '//' }))
  assert.equal(withH.ok, true)
  assert.equal(withH.hasProperties, false)
  assert.equal(withH.warnings.length, 1)
  const none = inspectLibraryZip(makeZip({ 'x/README.md': 'hi' }))
  assert.equal(none.ok, false)
  assert.match(none.error!, /не библиотека/)
})

test('zip: небезопасные пути и не-zip отвергаются', () => {
  assert.equal(inspectLibraryZip(makeZip({ 'x/../../evil.h': '//' })).ok, false)
  assert.equal(inspectLibraryZip(makeZip({ '/abs/evil.h': '//' })).ok, false)
  assert.equal(inspectLibraryZip(Buffer.from('это не zip')).ok, false)
})
