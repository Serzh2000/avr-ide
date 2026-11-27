import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadCatalog, searchCatalog } from '../catalog'

test('каталог: последняя версия, чистый текст описания, поиск по имени и заголовку', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'avride-catalog-'))
  try {
    await writeFile(join(dir, 'library_index.json'), JSON.stringify({ libraries: [
      { name: 'Servo', version: '1.2.0', architectures: ['avr'], sentence: 'old' },
      { name: 'Servo', version: '1.10.0', architectures: ['avr'], sentence: 'Servo motors', paragraph: 'One<br />Two &amp; <b>three</b>', providesIncludes: ['Servo.h'] },
      { name: 'ESP32Servo', version: '3.1.3', architectures: ['esp32'], sentence: 'Servo for ESP32', dependencies: [{ name: 'X' }] }
    ] }))
    const libs = await loadCatalog(dir)
    assert.ok(libs)
    const servo = libs.find((l) => l.name === 'Servo')!
    assert.equal(servo.version, '1.10.0')
    assert.deepEqual(servo.versions, ['1.10.0', '1.2.0'])
    assert.equal(servo.paragraph, 'One\nTwo & three')
    assert.deepEqual(searchCatalog(libs, 'servo').map((l) => l.name), ['Servo', 'ESP32Servo'])
    assert.deepEqual(searchCatalog(libs, 'servo.h').map((l) => l.name), ['Servo'])
    assert.deepEqual(libs.find((l) => l.name === 'ESP32Servo')!.dependencies, ['X'])
    assert.equal(await loadCatalog(join(dir, 'missing')), null)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
