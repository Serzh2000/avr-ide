import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { defaultProfile, declaredDependencies, directHeaders, resolveDependencyPlan } from '../dependencies'
import { planProjectDependencies } from '../project-dependencies'

const index = [
  { name: 'Sensor Lib', version: '1.0.0', architectures: ['avr'], providesIncludes: ['Sensor.h'] },
  { name: 'Sensor Lib', version: '2.0.0', architectures: ['esp32'], providesIncludes: ['Sensor.h'] },
  { name: 'Sensor Lib', version: '1.1.0-beta', architectures: ['avr'], providesIncludes: ['Sensor.h'] },
  { name: 'Alternative', version: '1.0.0', architectures: ['*'], providesIncludes: ['Sensor.h'] },
  { name: 'ArduinoJson', version: '7.0.0', architectures: ['*'] },
  { name: 'ESP Async WebServer', version: '3.12.1', architectures: ['*'] },
  { name: 'RPAsyncTCP', version: '1.3.2', architectures: ['rp2040'] }
]
const plan = (headers: string[], extra: Partial<Parameters<typeof resolveDependencyPlan>[0]> = {}) =>
  resolveDependencyPlan({ headers, availableHeaders: new Set(), installed: new Map(), declared: [], index, arch: 'avr', ...extra })

test('распознаёт реальные #include, пропускает строки, комментарии и условные ветки', () => {
  const code = `#ifndef HEADER_H
#define HEADER_H
/* #include <Comment.h> */
const char *s = R"HTML(//
#include <InHtml.h>
)HTML";
#if FEATURE
  #include <Feature.h>
#elif OTHER
  #include <Other.h>
#else
  #include "Else.h"
#endif
# include \\
  "Sensor.h" // external quoted include
// keep commented \\
#include <AlsoComment.h>
#include <ArduinoJson.h>
#endif
`
  assert.deepEqual(directHeaders(code), ['Sensor.h', 'ArduinoJson.h'])
})

test('выбирает только однозначную совместимую версию и не угадывает по похожему имени', () => {
  const result = plan(['Sensor.h', 'ArduinoJson.h', 'NotFound.h', 'WiFi.h'])
  assert.deepEqual(result.install, [{ name: 'ArduinoJson', version: '7.0.0' }])
  assert.deepEqual(result.unknown, ['NotFound.h'])
  assert.deepEqual(result.choose[0].libraries, [{ name: 'Alternative', version: '1.0.0' }, { name: 'Sensor Lib', version: '1.0.0' }])
  assert.equal(plan(['Sensor.h'], { index: null }).needsIndex, true)
})

test('точное имя из манифеста разрешает неоднозначность, но не заменяет установленную версию', () => {
  const declared = declaredDependencies('{"libraries":["Sensor Lib@1.0.0"]}')
  assert.deepEqual(plan(['Sensor.h'], { declared }).install, declared)
  assert.deepEqual(plan(['Sensor.h'], { declared }).choose, [])
  const locked = plan(['Sensor.h'], { declared, installed: new Map([['sensor lib', '0.9.0']]) })
  assert.deepEqual(locked.install, [])
  assert.match(locked.conflicts[0], /0\.9\.0.*1\.0\.0/)
  assert.throws(() => declaredDependencies('{"libraries":["--zip-path","https://example.com/lib.zip"]}'))
  assert.equal(defaultProfile('profiles: {}\n"default_profile": portable\n'), 'portable')
})

test('на Pico подтягивает RPAsyncTCP, в том числе если заголовок сервера уже установлен', () => {
  const result = plan(['ESPAsyncWebServer.h'], { arch: 'rp2040', availableHeaders: new Set(['ESPAsyncWebServer.h']) })
  assert.deepEqual(result.install, [{ name: 'RPAsyncTCP', version: '1.3.2' }])
})

test('сканирование проекта учитывает локальные файлы, Arduino-профиль и установленные библиотеки', async () => {
  const work = await mkdtemp(join(tmpdir(), 'avride-dependency-test-'))
  try {
    const root = join(work, 'Blink')
    const data = join(work, 'data')
    const user = join(work, 'user')
    const put = async (file: string, text: string) => { await mkdir(dirname(file), { recursive: true }); await writeFile(file, text) }
    await put(join(root, 'Blink.ino'), '#include "Sensor.h"\n#include <ArduinoJson.h>\n#include <Wire.h>\n')
    await put(join(root, 'Sensor.h'), '#pragma once\n')
    await put(join(root, 'src', 'other.cpp'), '#include <NotFound.h>\n')
    await put(join(root, 'ignored', 'file.cpp'), '#include <Ignored.h>\n')
    await put(join(data, 'library_index.json'), JSON.stringify({ libraries: index }))
    const scan = () => planProjectDependencies(root, 'arduino:avr:uno', user, data)
    const result = await scan()
    assert.deepEqual(result.install, [{ name: 'ArduinoJson', version: '7.0.0' }])
    assert.deepEqual(result.unknown, ['NotFound.h'])
    await put(join(user, 'libraries', 'ArduinoJson', 'src', 'ArduinoJson.h'), '')
    assert.deepEqual((await scan()).install, [])
    await put(join(root, 'sketch.yaml'), 'default_profile: portable\n')
    assert.deepEqual(await scan(), { profile: 'portable', install: [], choose: [], unknown: [], conflicts: [], needsIndex: false })
  } finally {
    await rm(work, { recursive: true, force: true })
  }
})

test('стандартные заголовки и заголовки ядра не считаются недостающими библиотеками', () => {
  const plan = resolveDependencyPlan({
    headers: ['math.h', 'stdint.h', 'Preferences.h', 'esp_wifi.h', 'WiFiClientSecure.h'], availableHeaders: new Set(), installed: new Map(),
    declared: [], index: [{ name: 'X', version: '1', architectures: ['*'], providesIncludes: ['x.h'] }], arch: 'esp32'
  })
  assert.deepEqual(plan.unknown, [])
  assert.deepEqual(plan.install, [])
})

test('при неполном индексе (только встроенные библиотеки) неизвестное требует индекс, а не считается ненайденным', () => {
  const plan = resolveDependencyPlan({
    headers: ['ESPUI.h', 'DHT.h'], availableHeaders: new Set(), installed: new Map(), declared: [], arch: 'esp32', partial: true,
    index: [{ name: 'ESPUI', version: '2.3.0', architectures: ['esp32'], providesIncludes: ['ESPUI.h'] }]
  })
  assert.deepEqual(plan.install.map((d) => d.name), ['ESPUI'])
  assert.deepEqual(plan.unknown, [])
  assert.equal(plan.needsIndex, true)
})

test('основная библиотека заголовка ставится без вопроса, даже если заголовок объявляют и другие', () => {
  const plan = resolveDependencyPlan({
    headers: ['ArduinoJson.h'], availableHeaders: new Set(), installed: new Map(), declared: [], arch: 'esp32',
    index: [
      { name: 'ArduinoJson', version: '7.4.3', architectures: ['*'], providesIncludes: ['ArduinoJson.h'] },
      { name: 'EasyMQTT', version: '1.0.0', architectures: ['esp32'], providesIncludes: ['ArduinoJson.h'] }
    ]
  })
  assert.deepEqual(plan.choose, [])
  assert.deepEqual(plan.install, [{ name: 'ArduinoJson', version: '7.4.3' }])
})
