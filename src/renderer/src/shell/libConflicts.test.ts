import test from 'node:test'
import assert from 'node:assert/strict'
import { libConflictBanner, parseLibConflicts } from './libConflicts'

const bs = (s: string): string => s.split('/').join(String.fromCharCode(92))
const Q = "'"
const BT = String.fromCharCode(96)

const LD = [
  bs('C:/x/ld.exe: C:/bp/guiSrc/libraries/ESPUI/ESPUI.cpp.o: in function ' + BT + 'ESPUIClass::setCustomJS(char const*)' + Q + ':'),
  bs('C:/Users/u/Arduino/libraries/ESPUI/src') + '/ESPUI.cpp:33: multiple definition of ' + BT + 'ESPUIClass::setCustomJS(char const*)' + Q + '; '
    + bs('C:/bp/guiSrc/sketch/src/ESPUI/ESPUI.cpp.o:C:/Users/u/Arduino/gui/src/ESPUI') + '/ESPUI.cpp:33: first defined here',
  'collect2.exe: error: ld returned 1 exit status',
  ''
].join('\n')

test('копия библиотеки в src проекта: multiple definition → локальный конфликт', () => {
  const r = parseLibConflicts(LD)
  assert.equal(r.definitions.length, 1)
  const b = libConflictBanner(LD, bs('C:/Users/u/Arduino/gui'))!
  assert.match(b.title, /внутри проекта/)
  assert.match(b.text, /src\/ESPUI/)
  assert.equal(b.folders[0], 'C:/Users/u/Arduino/gui/src/ESPUI')
})

test('реальный вывод ld: перед путём идёт объектный файл', () => {
  const real = [
    bs('C:/t/ld.exe: C:/bp/guiSrc/libraries/ESPUI/ESPUI.cpp.o: in function ' + BT + 'ESPUIClass::setCustomJS(char const*)' + Q + ':'),
    bs('C:/bp/guiSrc/libraries/ESPUI/ESPUI.cpp.o:C:/U/libraries/ESPUI/src') + '/ESPUI.cpp:33: multiple definition of ' + BT + 'ESPUIClass::setCustomJS(char const*)' + Q + '; '
      + bs('C:/bp/guiSrc/sketch/src/ESPUI/ESPUI.cpp.o:C:/sk/guiSrc/src/ESPUI') + '/ESPUI.cpp:33: first defined here',
    ''
  ].join('\n')
  const b = libConflictBanner(real, bs('C:/sk/guiSrc'))!
  assert.match(b.title, /внутри проекта/)
  assert.deepEqual(b.folders, ['C:/sk/guiSrc/src/ESPUI', 'C:/U/libraries/ESPUI/src'])
})

test('без папки проекта: общая подсказка про две папки', () => {
  const b = libConflictBanner(LD)!
  assert.match(b.title, /двух папках/)
  assert.equal(b.folders.length, 2)
})

test('русское и английское «несколько библиотек»', () => {
  const ru = 'Несколько библиотек найдено для "ESPUI.h"\n  Используется: C:/L/ESPUI\n  Не используется: C:/L/ESPUI_old\n  Не используется: C:/L/ESPUI2\nКомпиляция...\n'
  const en = 'Multiple libraries were found for "ESPUI.h"\n  Used: /L/ESPUI\n  Not used: /L/ESPUI_old\n'
  const a = parseLibConflicts(ru).duplicates[0]
  assert.equal(a.header, 'ESPUI.h')
  assert.equal(a.used, 'C:/L/ESPUI')
  assert.equal(a.notUsed.length, 2)
  const b = libConflictBanner(en)!
  assert.match(b.title, /ESPUI\.h/)
  assert.deepEqual(b.folders, ['/L/ESPUI', '/L/ESPUI_old'])
})

test('несовместимая архитектура', () => {
  const en = 'WARNING: library ESP8266_ISR_Servo claims to run on [esp8266] architecture(s) and may be incompatible with your current board which runs on [esp32] architecture(s).'
  const ru = 'ВНИМАНИЕ: библиотека Servo должна запускаться на архитектуре(-ах) [avr] и может быть несовместима с вашей текущей платой, которая работает на архитектуре(-ах) [esp32].'
  assert.equal(parseLibConflicts(en).arch[0].declared, 'esp8266')
  assert.equal(parseLibConflicts(ru).arch[0].board, 'esp32')
  assert.match(libConflictBanner(en)!.text, /ESP8266_ISR_Servo/)
})

test('скобки (…) в предупреждении об архитектуре и «Найдено несколько библиотек»', () => {
  const ru = 'ПРЕДУПРЕЖДЕНИЕ: библиотека Bar заявляет о работе на архитектуре(ах) (avr) и может быть несовместима с платой, работающей на архитектуре(ах) (esp32).'
  assert.equal(parseLibConflicts(ru).arch[0].library, 'Bar')
  const d = parseLibConflicts('Найдено несколько библиотек для "DHT.h"\n  Используется: C:/lib/A\n  Не используется: C:/lib/B\n').duplicates[0]
  assert.equal(d.used, 'C:/lib/A')
  assert.deepEqual(d.notUsed, ['C:/lib/B'])
})

test('чистый журнал и лишние совпадения: ничего не сообщаем', () => {
  assert.equal(libConflictBanner('Скетч использует 1 байт\nАльтернативы для WiFi.h: [WiFi@3.3.12]\n'), null)
  assert.equal(libConflictBanner(''), null)
})
