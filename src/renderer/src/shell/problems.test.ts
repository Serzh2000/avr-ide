import test from 'node:test'
import assert from 'node:assert/strict'
import { markersFor, parseProblems, parseSize, phaseOf, samePath } from './problems'

const LOG = `$ arduino-cli compile --fqbn arduino:avr:uno --no-color C:\\Users\\me\\Blink
C:\\Users\\me\\Blink\\Blink.ino: In function 'void loop()':
C:\\Users\\me\\Blink\\Blink.ino:9:3: error: 'foo' was not declared in this scope
   foo();
   ^~~
C:\\Users\\me\\Blink\\Blink.ino:9:3: note: suggested alternative: 'for'
/home/me/Blink/util.h:4:10: fatal error: Missing.h: No such file or directory
C:/Users/me/Blink/Blink.ino:12:7: warning: unused variable 'x' [-Wunused-variable]
C:\\Users\\me\\Blink\\Blink.ino:9:3: error: 'foo' was not declared in this scope
C:\\Users\\me\\Blink\\Blink.ino:20: undefined reference to \`bar()'
collect2.exe: error: ld returned 1 exit status
Error during build: exit status 1
`

test('parseProblems: gcc-формат, Windows-пути, дедупликация', () => {
  const p = parseProblems(LOG)
  const errors = p.filter((x) => x.severity === 'error')
  assert.equal(errors[0].file, 'C:\\Users\\me\\Blink\\Blink.ino')
  assert.equal(errors[0].line, 9)
  assert.equal(errors[0].column, 3)
  assert.equal(errors[0].message, "'foo' was not declared in this scope")
  // дубликат схлопнут
  assert.equal(p.filter((x) => x.message.startsWith("'foo' was not")).length, 1)
  assert.ok(p.some((x) => x.severity === 'info' && x.message.startsWith('suggested')))
  assert.ok(p.some((x) => x.severity === 'warning' && x.line === 12))
  const fatal = p.find((x) => x.message.startsWith('Missing.h'))
  assert.equal(fatal?.file, '/home/me/Blink/util.h')
  assert.equal(fatal?.column, 10)
  const undef = p.find((x) => x.message.startsWith('undefined reference'))
  assert.equal(undef?.line, 20)
  assert.ok(p.some((x) => x.file === null && x.message.includes('ld returned')))
})

test('parseProblems: пустой и «чистый» вывод', () => {
  assert.deepEqual(parseProblems(''), [])
  assert.deepEqual(parseProblems('Sketch uses 924 bytes (2%) of program storage space. Maximum is 32256 bytes.'), [])
})

test('markersFor: фильтр по файлу и длина идентификатора', () => {
  const p = parseProblems(LOG)
  const m = markersFor(p, 'c:/users/me/blink/Blink.ino')
  assert.equal(m.length, 4) // error + note + warning + undefined reference
  const e = m.find((x) => x.severity === 'error' && x.startLine === 9)!
  assert.equal(e.endColumn - e.startColumn, 3)
  assert.equal(markersFor(p, null).length, 0)
  assert.equal(markersFor(p, '/other/file.ino').length, 0)
})

test('samePath', () => {
  assert.ok(samePath('C:\\A\\b.ino', 'c:/a/b.ino'))
  assert.ok(!samePath('/a/b.ino', '/a/B.ino'))
})

test('parseSize и phaseOf', () => {
  const s = parseSize(
    'Sketch uses 924 bytes (2%) of program storage space. Maximum is 32256 bytes.\nGlobal variables use 9 bytes (0%) of dynamic memory, leaving 2039 bytes for local variables. Maximum is 2048 bytes.'
  )
  assert.equal(s?.flash?.used, 924)
  assert.equal(s?.flash?.max, 32256)
  assert.equal(s?.ram?.pct, 0)
  const e = parseSize(
    '. Variables and constants in RAM (global, static), used 28104 / 80192 bytes (35%)\n. Code in flash (default, ICACHE_FLASH_ATTR), used 232148 / 1048576 bytes (22%)'
  )
  assert.equal(e?.flash?.used, 232148)
  assert.equal(e?.flash?.pct, 22)
  assert.equal(e?.ram?.max, 80192)
  // русская локаль arduino-cli
  const ru = parseSize(
    'Скетч использует 237157 байт (18%) памяти устройства. Всего доступно 1310720 байт.\nГлобальные переменные используют 21048 байт (6%) динамической памяти, оставляя 306632 байт для локальных переменных. Максимум: 327680 байт.'
  )
  assert.equal(ru?.flash?.used, 237157)
  assert.equal(ru?.flash?.max, 1310720)
  assert.equal(ru?.ram?.pct, 6)
  assert.equal(ru?.ram?.max, 327680)
  assert.equal(parseSize('nothing'), null)
  assert.equal(phaseOf('Linking everything together...')?.pct, 90)
  assert.equal(phaseOf('hello'), null)
})
