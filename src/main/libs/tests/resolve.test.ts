// Запуск: node --import ./src/main/libs/tests/register.mjs --test src/main/libs/tests/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { guessArch, parseProperties, resetLibCaches, resolveLibraries, type Roots } from '../resolve'

function put(file: string, text: string): void {
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(file, text)
}

const tmp = mkdtempSync(join(tmpdir(), 'avr-libs-'))
const user = join(tmp, 'Arduino', 'libraries')
const data = join(tmp, 'Arduino15')
const roots: Roots = { userLibraryDirs: [user], dataDirs: [data] }

// recursive-раскладка: src/, транзитивный include, примеры
put(join(user, 'Adafruit_BMP280_Library', 'library.properties'), 'name=Adafruit BMP280 Library\nversion=3.0.0\nauthor=Adafruit <info@adafruit.com>\nsentence=BMP280 driver\narchitectures=*\n')
put(join(user, 'Adafruit_BMP280_Library', 'Adafruit_BMP280.h'), '#include "detail/regs.h"\n#include <Wire.h>\nclass Adafruit_BMP280 { public: bool begin(uint8_t a = 0x77); };\n')
put(join(user, 'Adafruit_BMP280_Library', 'detail', 'regs.h'), '#define BMP_REG_ID 0xD0\n#include "deep/a.h"\n')
put(join(user, 'Adafruit_BMP280_Library', 'detail', 'deep', 'a.h'), '#define DEEP1 1\n#include "../../b.h"\n')
put(join(user, 'Adafruit_BMP280_Library', 'b.h'), '#define BEYOND_DEPTH 1\n')
put(join(user, 'Adafruit_BMP280_Library', 'examples', 'bmp280test', 'bmp280test.ino'), 'void setup(){}')
put(join(user, 'Adafruit_BMP280_Library', 'examples', 'sub', 'deep', 'other.ino'), 'void loop(){}')
// layout с src
put(join(user, 'ESPUI', 'library.properties'), 'name=ESPUI\nversion=2.3.0\narchitectures=esp8266,esp32\n')
put(join(user, 'ESPUI', 'src', 'ESPUI.h'), 'class ESPUIClass { public: void begin(const char* t); };\nextern ESPUIClass ESPUI;\n')
put(join(user, 'ESPUI', 'src', 'ESPUI.cpp'), 'void Hidden() {}\n')
// библиотека только для avr
put(join(user, 'LiquidCrystal_I2C', 'library.properties'), 'name=LiquidCrystal I2C\nversion=1.1.2\narchitectures=avr\n')
put(join(user, 'LiquidCrystal_I2C', 'LiquidCrystal_I2C.h'), 'class LiquidCrystal_I2C { public: void init(); };\n')
// две библиотеки с одним заголовком Servo.h: на avr и на esp32
put(join(user, 'ServoESP32', 'library.properties'), 'name=ServoESP32\nversion=1.1.1\narchitectures=esp32\n')
put(join(user, 'ServoESP32', 'src', 'Servo.h'), 'class Servo { public: void attach(int pin); void esp32only(); };\n')
put(join(user, 'ServoAVR', 'library.properties'), 'name=Servo\nversion=1.0\narchitectures=avr\n')
put(join(user, 'ServoAVR', 'src', 'Servo.h'), 'class Servo { public: void attach(int pin); void avronly(); };\n')
// библиотеки ядер: WiFi есть и в esp32, и в esp8266
put(join(data, 'packages', 'esp32', 'hardware', 'esp32', '2.0.0', 'libraries', 'WiFi', 'src', 'WiFi.h'), 'class WiFiClass { public: int old32(); };\n')
put(join(data, 'packages', 'esp32', 'hardware', 'esp32', '3.3.10', 'libraries', 'WiFi', 'library.properties'), 'name=WiFi\nversion=3.3.10\narchitectures=esp32\n')
put(join(data, 'packages', 'esp32', 'hardware', 'esp32', '3.3.10', 'libraries', 'WiFi', 'src', 'WiFi.h'), 'class WiFiClass { public: int status(); };\nextern WiFiClass WiFi;\n')
put(join(data, 'packages', 'esp8266', 'hardware', 'esp8266', '3.1.2', 'libraries', 'ESP8266WiFi', 'src', 'ESP8266WiFi.h'), 'class ESP8266WiFiClass { public: int status8266(); };\n')
put(join(data, 'packages', 'esp8266', 'hardware', 'esp8266', '3.1.2', 'libraries', 'Wire', 'Wire.h'), 'class TwoWire8266 { public: void begin(); };\n')
put(join(data, 'packages', 'esp32', 'hardware', 'esp32', '3.3.10', 'libraries', 'Wire', 'src', 'Wire.h'), 'class TwoWire { public: void begin(); void beginTransmission(int a); };\n')

test.after(() => rmSync(tmp, { recursive: true, force: true }))

const names = (libs: { name: string }[]): string[] => libs.map((l) => l.name)

test('parseProperties и guessArch', () => {
  assert.deepEqual(parseProperties('# c\nname=A B\nversion = 1.2\n\nbad'), { name: 'A B', version: '1.2' })
  assert.equal(guessArch(['ESP8266WiFi.h']), 'esp8266')
  assert.equal(guessArch(['ESP8266Audio.h']), null)
  assert.equal(guessArch(['WiFi.h']), null)
})

test('include → библиотека: версия, автор, sentence, символы, примеры; системные и неизвестные заголовки пропускаются', async () => {
  resetLibCaches()
  const libs = await resolveLibraries('#include <Arduino.h>\n#include <stdint.h>\n#include <Adafruit_BMP280.h>\n#include "local.h"\n#include <Unknown.h>\n', { roots, fqbn: 'esp32:esp32:esp32' })
  assert.deepEqual(names(libs), ['Adafruit BMP280 Library'])
  const l = libs[0]
  assert.equal(l.version, '3.0.0')
  assert.equal(l.author, 'Adafruit')
  assert.equal(l.sentence, 'BMP280 driver')
  assert.deepEqual(l.matchedIncludes, ['Adafruit_BMP280.h'])
  assert.ok(l.symbols.some((s) => s.name === 'begin' && s.owner === 'Adafruit_BMP280'))
  assert.equal(l.symbols.find((s) => s.name === 'begin')?.header, 'Adafruit_BMP280.h')
  assert.deepEqual(l.examples.map((e) => e.name).sort(), ['bmp280test', 'sub/deep'])
  assert.ok(l.examples.every((e) => e.path.endsWith('.ino')))
})

test('транзитивные include внутри библиотеки: глубина 2', async () => {
  const [l] = await resolveLibraries('#include <Adafruit_BMP280.h>', { roots, fqbn: 'esp32:esp32:esp32' })
  const n = l.symbols.map((s) => s.name)
  assert.ok(n.includes('BMP_REG_ID'), 'depth 1')
  assert.ok(n.includes('DEEP1'), 'depth 2')
  assert.ok(!n.includes('BEYOND_DEPTH'), 'depth 3 не разбираем')
  assert.deepEqual(l.headers, ['Adafruit_BMP280.h', 'detail/regs.h', 'detail/deep/a.h'])
})

test('layout src/: разбираются только заголовки, .cpp не трогаем; относительные пути от папки библиотеки', async () => {
  const [l] = await resolveLibraries('#include "ESPUI.h"', { roots, fqbn: 'esp32:esp32:esp32' })
  assert.equal(l.name, 'ESPUI')
  assert.deepEqual(l.headers, ['src/ESPUI.h'])
  assert.ok(!l.symbols.some((s) => s.name === 'Hidden'))
  assert.equal(l.symbols.find((s) => s.name === 'ESPUI')?.header, 'src/ESPUI.h')
})

test('архитектура: Servo.h на esp32 и на avr — разные библиотеки; несовместимая — с замечанием', async () => {
  const esp = await resolveLibraries('#include <Servo.h>', { roots, fqbn: 'esp32:esp32:esp32' })
  assert.equal(esp[0].name, 'ServoESP32')
  assert.ok(esp[0].symbols.some((s) => s.name === 'esp32only'))
  const avr = await resolveLibraries('#include <Servo.h>', { roots, fqbn: 'arduino:avr:uno' })
  assert.equal(avr[0].name, 'Servo')
  assert.ok(avr[0].symbols.some((s) => s.name === 'avronly'))
  const bad = await resolveLibraries('#include <LiquidCrystal_I2C.h>', { roots, fqbn: 'esp32:esp32:esp32' })
  assert.equal(bad.length, 1)
  assert.match(bad[0].warnings?.join(' ') ?? '', /архитектур/)
})

test('библиотеки ядра: берётся последняя версия выбранной платы; без FQBN — по архитектуре include', async () => {
  const wifi = await resolveLibraries('#include <WiFi.h>', { roots, fqbn: 'esp32:esp32:esp32' })
  assert.equal(wifi[0].version, '3.3.10')
  assert.ok(wifi[0].symbols.some((s) => s.name === 'status'))
  assert.ok(!wifi[0].symbols.some((s) => s.name === 'old32'), 'старая версия ядра не берётся')
  // ядро esp8266 не выбрано: WiFi.h из него не подтягиваем
  const only32 = await resolveLibraries('#include <ESP8266WiFi.h>', { roots, fqbn: 'esp32:esp32:esp32' })
  assert.equal(only32.length, 0)
  // без платы, но ESP8266WiFi.h → архитектура esp8266
  const guess = await resolveLibraries('#include <ESP8266WiFi.h>\n#include <Wire.h>', { roots })
  assert.deepEqual(names(guess), ['ESP8266WiFi', 'Wire'])
  assert.ok(guess[1].symbols.some((s) => s.name === 'TwoWire8266'))
  // без платы и без признаков — esp32 (если установлено)
  const def = await resolveLibraries('#include <Wire.h>', { roots })
  assert.ok(def[0].symbols.some((s) => s.name === 'beginTransmission'))
})

test('кэш: повторный вызов быстрый; изменение library.properties/заголовка видно после сброса и по mtime', async () => {
  resetLibCaches()
  const code = '#include <ESPUI.h>'
  const a = await resolveLibraries(code, { roots, fqbn: 'esp32:esp32:esp32' })
  const t0 = Date.now()
  const b = await resolveLibraries(code, { roots, fqbn: 'esp32:esp32:esp32' })
  assert.ok(Date.now() - t0 < 50)
  assert.equal(a, b, 'тот же объект из кэша')
  // меняем заголовок: разбор должен подхватить по mtime (после сброса результата)
  const h = join(user, 'ESPUI', 'src', 'ESPUI.h')
  put(h, 'class ESPUIClass { public: void begin(const char* t); void added(); };\n')
  const future = new Date(Date.now() + 5000)
  utimesSync(h, future, future)
  resetLibCaches()
  const c = await resolveLibraries(code, { roots, fqbn: 'esp32:esp32:esp32' })
  assert.ok(c[0].symbols.some((s) => s.name === 'added'))
})

test('безопасность и устойчивость: мусорный ввод, огромный текст, нет include', async () => {
  assert.deepEqual(await resolveLibraries('', { roots }), [])
  assert.deepEqual(await resolveLibraries('void setup(){}', { roots }), [])
  assert.deepEqual(await resolveLibraries('#include <../../etc/passwd>\n#include <C:\\Windows\\win.h>\n#include </abs/x.h>', { roots }), [])
  const big = '#include <ESPUI.h>\n' + 'int x;\n'.repeat(300_000)
  const t0 = Date.now()
  const r = await resolveLibraries(big, { roots, fqbn: 'esp32:esp32:esp32' })
  assert.equal(r.length, 1)
  assert.ok(Date.now() - t0 < 3000)
  assert.deepEqual(await resolveLibraries('#include <ESPUI.h>', { roots: { userLibraryDirs: [join(tmp, 'nope')], dataDirs: [] } }), [])
})
