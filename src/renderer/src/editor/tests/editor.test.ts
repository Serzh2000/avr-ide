// Запуск: npm run test:editor
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { languageForPath, monacoLanguageId } from '../language'
import { scan, insideCommentOrString } from '../scan'
import { runLocalChecks } from '../diagnostics'
import { extractSymbols, variableTypes } from '../symbols'
import { computeCompletions } from '../completion'
import { findCallContext, wordAt } from '../signature'
import { findEntry, parseSignature, callSnippet, detectPlatform } from '../resolve'
import { formatCode } from '../format'
import { SNIPPETS } from '../snippets'
import { functions } from '../../reference/data'

const labels = (r: { items: { label: string }[] }): string[] => r.items.map((i) => i.label)

// ---------- язык ----------
test('язык по расширению', () => {
  for (const f of ['a.ino', 'b.h', 'c.cpp', 'd.c', 'D:\\x\\E.INO', '/p/q.hpp']) assert.equal(languageForPath(f), 'cpp', f)
  assert.equal(languageForPath('x.json'), 'json')
  assert.equal(languageForPath('x.md'), 'markdown')
  assert.equal(languageForPath('x.css'), 'css')
  assert.equal(languageForPath('x.html'), 'html')
  assert.equal(languageForPath('x.js'), 'javascript')
  assert.equal(languageForPath('x.txt'), 'plaintext')
  assert.equal(languageForPath('Makefile'), 'plaintext')
  assert.equal(languageForPath(null), 'cpp')
  assert.equal(monacoLanguageId('cpp'), 'arduino')
  assert.equal(monacoLanguageId('json'), 'json')
})

// ---------- сканер и скобки ----------
test('скан: корректный код без проблем', () => {
  const code = 'void setup() {\n  Serial.println("a(b{");\n  char c = \'{\'; // ) комментарий (\n}\nvoid loop() { int a[3] = {1,2,3}; /* ( */ }\n'
  assert.deepEqual(scan(code).problems, [])
})

test('скан: незакрытая скобка указывает на открывающую', () => {
  const code = 'void setup() {\n  if (x) {\n    y();\n}\n'
  const p = scan(code).problems
  assert.equal(p.length, 1)
  assert.match(p[0].message, /Не закрыта скобка \{/)
  assert.equal(code[p[0].start], '{')
  assert.equal(code.slice(0, p[0].start).split('\n').length, 1) // первая строка
})

test('скан: лишняя и несовпадающая скобки', () => {
  assert.match(scan('void f() {}\n}\n').problems[0].message, /Лишняя/)
  const m = scan('void f() { foo(1, 2]; }').problems
  assert.equal(m.length, 1)
  assert.match(m[0].message, /Ожидалась \)/)
})

test('скан: незакрытая строка и символ', () => {
  const p = scan('void f() {\n  Serial.println("abc);\n  char c = \'a;\n}\n').problems
  assert.equal(p.filter((x) => x.unterminated).length, 2)
  assert.match(p[0].message, /строка/)
  assert.match(p[1].message, /символьный/)
})

test('скан: апострофы, экранирование, разделители цифр, #error, сырые строки', () => {
  assert.deepEqual(scan('const char* s = "a\\"b(";\nchar q = \'\\\'\';\nlong n = 1\'000\'000;\n').problems, [])
  assert.deepEqual(scan('#error Don\'t build this\nvoid f() {}\n').problems, [])
  assert.deepEqual(scan('const char* h = R"html(<a href="x">(</a>)html";\n').problems, [])
  assert.deepEqual(scan('#include <Wire.h>\n#include "my.h"\n').problems, [])
})

test('скан: незакрытый /* */ комментарий', () => {
  const p = scan('void f() {}\n/* забыли закрыть\n').problems
  assert.equal(p.length, 1)
  assert.match(p[0].message, /комментарий/)
})

test('скан: при #else скобки не проверяются (условная компиляция)', () => {
  const code = '#if A\nvoid f() {\n#else\nvoid g() {\n#endif\n}\n'
  assert.deepEqual(scan(code).problems, [])
})

test('маска сохраняет длину и переводы строк', () => {
  const code = 'a // x\nb "y" /* z\nw */ c\n'
  const { masked } = scan(code)
  assert.equal(masked.length, code.length)
  assert.equal(masked.split('\n').length, code.split('\n').length)
  assert.equal(masked.includes('x'), false)
  assert.equal(masked.includes('z'), false)
  assert.ok(masked.includes('c'))
})

test('insideCommentOrString', () => {
  assert.equal(insideCommentOrString('int a; // комм'), true)
  assert.equal(insideCommentOrString('int a; //'), true)
  assert.equal(insideCommentOrString('s = "abc'), true)
  assert.equal(insideCommentOrString('s = "'), true)
  assert.equal(insideCommentOrString('s = "abc" + dig'), false)
  assert.equal(insideCommentOrString('/* x\n y'), true)
  assert.equal(insideCommentOrString('/* x */ dig'), false)
  assert.equal(insideCommentOrString('digitalW'), false)
})

// ---------- локальные проверки ----------
test('проверка: delay() > 3 с на ESP — предупреждение, на AVR — нет', () => {
  const code = 'void loop() {\n  delay(10000);\n  delay(500);\n}\n'
  const esp = runLocalChecks(code, { effectivePlatform: 'esp32' })
  assert.equal(esp.length, 1)
  assert.equal(esp[0].severity, 'warning')
  assert.equal(esp[0].startLine, 2)
  assert.deepEqual(runLocalChecks(code, { effectivePlatform: 'avr' }), [])
  assert.deepEqual(runLocalChecks(code, {}), [])
  assert.deepEqual(runLocalChecks('// delay(10000);\nvoid f(){ const char* s = "delay(9000)"; }', { effectivePlatform: 'esp32' }), [])
})

test('проверка: присваивание в условии', () => {
  const m = runLocalChecks('void f() {\n  if (x = 5) {}\n  if (a == 5) {}\n  if ((y = foo())) {}\n  while (n = 0) {}\n}\n')
  assert.equal(m.length, 2)
  assert.deepEqual(m.map((x) => x.startLine), [2, 5])
  assert.match(m[0].message, /==/)
})

test('проверка: Serial.print без Serial.begin', () => {
  const bad = 'void setup() {\n  Serial.println("hi");\n}\nvoid loop() {}\n'
  const m = runLocalChecks(bad)
  assert.equal(m.length, 1)
  assert.equal(m[0].severity, 'info')
  assert.deepEqual(runLocalChecks('void setup() {\n  Serial.begin(9600);\n  Serial.println("hi");\n}\n'), [])
  // без setup() (дополнительный файл) — не проверяем
  assert.deepEqual(runLocalChecks('void helper() { Serial.println("x"); }\n'), [])
})

test('проверка: заголовки чужой платформы', () => {
  const code = '#include <ESP8266WiFi.h>\n#include <Wire.h>\n// #include <avr/sleep.h>\n#include <WebServer.h>\n'
  const m = runLocalChecks(code, { platform: 'esp32' })
  assert.equal(m.length, 1)
  assert.equal(m[0].startLine, 1)
  assert.equal(m[0].startColumn, 11)
  const m2 = runLocalChecks(code, { platform: 'esp8266' })
  assert.deepEqual(m2.map((x) => x.startLine), [4])
  assert.deepEqual(runLocalChecks(code, { platform: null }), [])
  assert.equal(runLocalChecks('#include <avr/pgmspace.h>\n', { platform: 'esp32' }).length, 1)
  assert.equal(runLocalChecks('#include <avr/pgmspace.h>\n', { platform: 'avr' }).length, 0)
})

test('проверка: положение маркера скобки (строка/столбец с 1)', () => {
  const m = runLocalChecks('void f() {\n  g(1;\n}\n')
  assert.ok(m.length >= 1)
  assert.equal(m[0].severity, 'error')
  assert.equal(m[0].startLine, 3)
  assert.match(m[0].message, /строке 2/)
})

test('проверка: чистый скетч без замечаний', () => {
  const code = 'const int LED = 13;\nvoid setup() {\n  pinMode(LED, OUTPUT);\n  Serial.begin(115200);\n}\nvoid loop() {\n  digitalWrite(LED, HIGH);\n  delay(1000);\n}\n'
  assert.deepEqual(runLocalChecks(code, { platform: 'esp32', effectivePlatform: 'esp32' }), [])
})

// ---------- символы ----------
const SKETCH = `#include <WebServer.h>
#define LED_PIN 2
#define SQR(x) ((x)*(x))
const char* ssid = "net";
volatile int counter = 0;
WebServer server(80);
Servo myServo;
struct Config { int a; };
enum Mode { A, B };
int readSensor(int pin, float k);
static void IRAM_ATTR onTick() {
  counter++;
}
void setup() {
  int local = 5;
  float t = 1.5;
  for (int i = 0; i < 3; i++) {}
  Serial.println(local);
  foo(1, 2);
}
`

test('символы файла', () => {
  const s = extractSymbols(SKETCH)
  const by = (n: string) => s.find((x) => x.name === n)
  assert.equal(by('LED_PIN')?.kind, 'macro')
  assert.deepEqual(by('SQR')?.params, ['x'])
  assert.equal(by('ssid')?.kind, 'variable')
  assert.equal(by('counter')?.kind, 'variable')
  assert.equal(by('server')?.kind, 'variable')
  assert.equal(by('server')?.type, 'WebServer')
  assert.equal(by('Config')?.kind, 'type')
  assert.equal(by('Mode')?.kind, 'type')
  assert.equal(by('readSensor')?.kind, 'function')
  assert.deepEqual(by('readSensor')?.params, ['pin', 'k'])
  assert.equal(by('onTick')?.kind, 'function')
  assert.equal(by('setup')?.kind, 'function')
  assert.equal(by('local')?.kind, 'variable')
  assert.equal(by('t')?.kind, 'variable')
  assert.equal(by('i')?.kind, 'variable')
  assert.equal(by('foo'), undefined, 'вызов не должен считаться объявлением')
  assert.equal(by('println'), undefined)
  assert.equal(by('LED_PIN')?.line, 2)
})

test('символы: типы переменных', () => {
  const t = variableTypes(extractSymbols(SKETCH))
  assert.equal(t.server, 'WebServer')
  assert.equal(t.myServo, 'Servo')
  assert.equal(t.local, 'int')
})

test('символы: комментарии и строки не порождают символов', () => {
  const s = extractSymbols('// int hidden = 1;\n/* int hidden2; */\nconst char* t = "int fake = 3;";\n')
  assert.deepEqual(s.map((x) => x.name), ['t'])
})

// ---------- справочник и автодополнение ----------
test('findEntry: строгий поиск', () => {
  assert.equal(findEntry(functions, 'pinMode')?.name, 'pinMode')
  assert.equal(findEntry(functions, 'println', { qualifier: 'Serial' })?.name, 'Serial.println')
  assert.equal(findEntry(functions, 'println', { qualifier: 'Serial1' })?.name, 'Serial.println')
  assert.equal(findEntry(functions, 'println'), undefined, 'без объекта println не угадываем')
  assert.equal(findEntry(functions, 'i'), undefined, 'короткие слова не должны давать префиксных совпадений')
  assert.equal(findEntry(functions, 'pin'), undefined)
  assert.equal(findEntry(functions, 'begin', { qualifier: 'strip' }), undefined)
  assert.equal(findEntry(functions, 'DDRB')?.name, 'DDRx')
  const a = findEntry(functions, 'begin', { qualifier: 'WiFi', platform: 'esp8266' })
  assert.ok(a?.platforms.includes('esp8266'))
  const b = findEntry(functions, 'begin', { qualifier: 'WiFi', platform: 'esp32' })
  assert.ok(b?.platforms.includes('esp32'))
})

test('parseSignature и callSnippet', () => {
  assert.deepEqual(parseSignature('void digitalWrite(uint8_t pin, uint8_t val)').params, ['uint8_t pin', 'uint8_t val'])
  assert.deepEqual(parseSignature('long map(long x, long a, long b)').params.length, 3)
  assert.deepEqual(parseSignature('int f(int (*cb)(int, int), int x)').params, ['int (*cb)(int, int)', 'int x'])
  assert.equal(parseSignature('HIGH').hasParens, false)
  assert.equal(parseSignature('void noInterrupts()').params.length, 0)
  const dw = findEntry(functions, 'digitalWrite')!
  assert.match(callSnippet(dw, 'digitalWrite'), /^digitalWrite\(\$\{1:\w+\}, \$\{2:\w+\}\)$/)
  const ni = findEntry(functions, 'noInterrupts')!
  assert.equal(callSnippet(ni, 'noInterrupts'), 'noInterrupts($0)')
})

test('автодополнение: функции со вставкой параметров и описанием', () => {
  const r = computeCompletions({ textBefore: 'void loop() {\n  digW', platform: 'esp32', entries: functions })
  const it = r.items.find((i) => i.label === 'digitalWrite')
  assert.ok(it)
  assert.equal(it.isSnippet, true)
  assert.match(it.insertText, /\$\{1:/)
  assert.match(it.documentation ?? '', /HIGH/)
})

test('автодополнение: члены объекта после точки', () => {
  const r = computeCompletions({ textBefore: 'void setup() {\n  Serial.', platform: null, entries: functions })
  const l = labels(r)
  assert.ok(l.includes('begin') && l.includes('println'))
  assert.ok(!l.includes('digitalWrite'), 'после точки только члены объекта')
  const r2 = computeCompletions({ textBefore: 'Serial1.pri', platform: null, entries: functions })
  assert.ok(labels(r2).includes('println'))
  // переменная известного типа
  const r3 = computeCompletions({ textBefore: 'WiFiServer srv(80);\nvoid f() { srv.', platform: 'esp32', entries: functions, fullText: 'WiFiServer srv(80);\nvoid f() { srv.' })
  assert.deepEqual(labels(r3), [])
  // число с точкой — ничего
  assert.deepEqual(labels(computeCompletions({ textBefore: 'float a = 3.', platform: null, entries: functions })), [])
})

test('автодополнение: учитывает платформу', () => {
  const esp32 = labels(computeCompletions({ textBefore: 'led', platform: 'esp32', entries: functions }))
  const avr = labels(computeCompletions({ textBefore: 'led', platform: 'avr', entries: functions }))
  const e8266 = labels(computeCompletions({ textBefore: 'led', platform: 'esp8266', entries: functions }))
  assert.ok(esp32.includes('ledcWrite'))
  assert.ok(!avr.includes('ledcWrite'))
  assert.ok(!e8266.includes('ledcWrite'))
  assert.ok(computeCompletions({ textBefore: '', platform: 'avr', entries: functions }).items.some((i) => i.label === 'DDRB'))
  assert.ok(!computeCompletions({ textBefore: '', platform: 'esp32', entries: functions }).items.some((i) => i.label === 'DDRB'))
  assert.ok(!labels(computeCompletions({ textBefore: '', platform: 'esp32', entries: functions })).includes('ADC2 и WiFi'))
})

test('автодополнение: символы файла, константы, ключевые слова, типы', () => {
  const full = 'int sensorValue = 0;\n#define MAX_TEMP 80\nvoid doWork(int a, int b) {}\n'
  const l = computeCompletions({ textBefore: full + 'se', platform: null, entries: functions, fullText: full })
  const names = labels(l)
  for (const n of ['sensorValue', 'MAX_TEMP', 'doWork', 'HIGH', 'LOW', 'INPUT_PULLUP', 'while', 'uint8_t', 'String', 'millis']) assert.ok(names.includes(n), n)
  const fn = l.items.find((i) => i.label === 'doWork')!
  assert.equal(fn.insertText, 'doWork(${1:a}, ${2:b})')
  // символ файла в списке выше справочника
  const sv = l.items.find((i) => i.label === 'sensorValue')!
  assert.ok(sv.rank < l.items.find((i) => i.label === 'millis')!.rank)
})

test('автодополнение: нет подсказок в комментарии и строке', () => {
  assert.deepEqual(computeCompletions({ textBefore: 'int a; // dig', platform: null, entries: functions }).items, [])
  assert.deepEqual(computeCompletions({ textBefore: 'Serial.println("dig', platform: null, entries: functions }).items, [])
})

test('автодополнение: #include и директивы', () => {
  const r = computeCompletions({ textBefore: '#include <ESP', platform: 'esp8266', entries: functions })
  assert.ok(labels(r).includes('ESP8266WiFi.h'))
  assert.ok(!labels(r).includes('WebServer.h'))
  assert.equal(r.replaceFromInLine, '#include <'.length)
  const r2 = computeCompletions({ textBefore: '#include <', platform: 'avr', entries: functions })
  assert.ok(labels(r2).includes('avr/sleep.h'))
  assert.ok(labels(computeCompletions({ textBefore: '#de', platform: null, entries: functions })).includes('define'))
})

test('сниппеты: префиксы и платформы', () => {
  const need = ['sketch', 'millis', 'wifi', 'webserver', 'sensor', 'pwm', 'serial', 'espui', 'interrupt', 'eeprom', 'preferences']
  for (const p of need) assert.ok(SNIPPETS.some((s) => s.prefix === p), p)
  const wifi32 = computeCompletions({ textBefore: 'wi', platform: 'esp32', entries: functions }).items.filter((i) => i.kind === 'snippet' && i.label === 'wifi')
  assert.equal(wifi32.length, 1)
  assert.match(wifi32[0].insertText, /#include <WiFi\.h>/)
  const wifi8266 = computeCompletions({ textBefore: 'wi', platform: 'esp8266', entries: functions }).items.filter((i) => i.kind === 'snippet' && i.label === 'wifi')
  assert.match(wifi8266[0].insertText, /ESP8266WiFi/)
  // платформа неизвестна — предлагаются оба
  assert.equal(computeCompletions({ textBefore: 'wi', platform: null, entries: functions }).items.filter((i) => i.kind === 'snippet' && i.label === 'wifi').length, 2)
  assert.equal(computeCompletions({ textBefore: 'pw', platform: 'avr', entries: functions }).items.filter((i) => i.label === 'pwm').length, 1)
  assert.ok(!computeCompletions({ textBefore: 'es', platform: 'avr', entries: functions }).items.some((i) => i.label === 'espui'))
  assert.ok(!computeCompletions({ textBefore: 'pr', platform: 'avr', entries: functions }).items.some((i) => i.label === 'preferences'))
})

test('сниппеты: синтаксис плейсхолдеров корректен', () => {
  for (const s of SNIPPETS) {
    const opens = (s.body.match(/\$\{\d+:/g) ?? []).length
    // каждый ${n:...} закрыт
    let depth = 0
    for (let i = 0; i < s.body.length; i++) {
      if (s.body[i] === '$' && s.body[i + 1] === '{') depth++
      else if (s.body[i] === '}' && depth > 0) depth--
    }
    // фигурные скобки C-кода вне плейсхолдеров допустимы; плейсхолдеры должны быть сбалансированы
    assert.equal(depth, 0, s.prefix + ': незакрытый плейсхолдер')
    assert.ok(opens >= 0)
    assert.ok(!/\$[a-zA-Z]/.test(s.body), s.prefix + ': неэкранированный $')
  }
})

// ---------- Signature Help ----------
test('контекст вызова: имя и индекс аргумента', () => {
  assert.deepEqual(findCallContext('digitalWrite('), { chain: 'digitalWrite', name: 'digitalWrite', qualifier: null, argIndex: 0 })
  assert.equal(findCallContext('digitalWrite(13, ')?.argIndex, 1)
  assert.equal(findCallContext('Serial.print(map(x, 0, 1, ')?.name, 'map')
  assert.equal(findCallContext('Serial.print(map(x, 0, 1, ')?.argIndex, 3)
  assert.equal(findCallContext('Serial.print(map(x, 0, 1, 2), ')?.name, 'print')
  assert.equal(findCallContext('Serial.print(map(x, 0, 1, 2), ')?.argIndex, 1)
  assert.equal(findCallContext('Serial.println(')?.qualifier, 'Serial')
  assert.equal(findCallContext('foo("a,b", ')?.argIndex, 1, 'запятая в строке не считается')
  assert.equal(findCallContext('foo(a[1, ')?.name, 'foo')
  assert.equal(findCallContext('if (x > 1'), null, 'if — не вызов')
  assert.equal(findCallContext('for (int i = 0; i < 3; '), null)
  assert.equal(findCallContext('foo(1);\nbar'), null)
  assert.equal(findCallContext('void loop() {\n  x'), null)
  assert.equal(findCallContext('if (digitalRead(')?.name, 'digitalRead')
})

test('слово под курсором и квалификатор', () => {
  const line = '  Serial.println(value);'
  const w = wordAt(line, 11)
  assert.equal(w?.word, 'println')
  assert.equal(w?.qualifier, 'Serial')
  assert.equal(wordAt(line, 3)?.word, 'Serial')
  assert.equal(wordAt(line, 3)?.qualifier, null)
  assert.equal(wordAt('x = 12;', 5), null)
  assert.equal(wordAt('   ', 1), null)
})

test('определение платформы по тексту', () => {
  assert.equal(detectPlatform('#include <ESP8266WiFi.h>'), 'esp8266')
  assert.equal(detectPlatform('#include <WebServer.h>\n'), 'esp32')
  assert.equal(detectPlatform('void IRAM_ATTR isr() {}'), 'esp32')
  assert.equal(detectPlatform('DDRB |= 1;'), 'avr')
  assert.equal(detectPlatform('void setup(){}'), null)
})

// ---------- форматирование ----------
test('форматирование: отступы по скобкам', () => {
  const src = 'void setup() {\npinMode(2, OUTPUT);\nif (a) {\nb();\n} else {\nc();\n}\n}\n'
  const want = 'void setup() {\n  pinMode(2, OUTPUT);\n  if (a) {\n    b();\n  } else {\n    c();\n  }\n}\n'
  assert.equal(formatCode(src), want)
})

test('форматирование: идемпотентно, число строк не меняется', () => {
  const src = '  void  f(){\n\t\tint a=1;   \nswitch (a) {\ncase 1:\nfoo();\nbreak;\ndefault:\nbar();\n}\n}\n'
  const once = formatCode(src)
  assert.equal(formatCode(once), once)
  assert.equal(once.split('\n').length, src.split('\n').length)
  assert.match(once, /\n {4}case 1:\n {6}foo\(\);/)
  assert.match(once, /\n {4}default:\n {6}bar\(\);\n {2}\}\n\}/)
})

test('форматирование: препроцессор, комментарии, многострочные вызовы, if без скобок', () => {
  const src = '  #define A 1\nvoid f() {\n/* a\n     b */\n// c\nfoo(1,\n2);\nif (x)\ny();\nelse\nz();\nw();\n}\n'
  const out = formatCode(src).split('\n')
  assert.equal(out[0], '#define A 1')
  assert.equal(out[2], '  /* a')
  assert.equal(out[3], '     b */', 'внутренность блочного комментария не трогаем')
  assert.equal(out[4], '  // c')
  assert.equal(out[6], '    2);')
  assert.equal(out[7], '  if (x)')
  assert.equal(out[8], '    y();')
  assert.equal(out[9], '  else')
  assert.equal(out[10], '    z();')
  assert.equal(out[11], '  w();')
})

test('форматирование: сохраняет CRLF, пустые строки и строки в литералах', () => {
  const src = 'void f() {\r\nconst char* s = "{";\r\n\r\nx();\r\n}\r\n'
  const out = formatCode(src)
  assert.equal(out, 'void f() {\r\n  const char* s = "{";\r\n\r\n  x();\r\n}\r\n')
})

test('форматирование: скобка на отдельной строке и закрывающие несколько уровней', () => {
  const src = 'void f()\n{\nif (a)\n{\nb();\n}\n}\n'
  assert.equal(formatCode(src), 'void f()\n{\n  if (a)\n  {\n    b();\n  }\n}\n')
})
