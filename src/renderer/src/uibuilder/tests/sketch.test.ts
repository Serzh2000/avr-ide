import { test } from 'node:test'
import assert from 'node:assert/strict'
import { maskCode, parseSketch, resolvePinExpr } from '../sketch/parse'

const SKETCH = `#include <WiFi.h>
#include "config.h"
// комментарий float fake = 1;
#define LED_PIN 2
#define BTN D3
#define SQ(x) ((x)*(x))
#define VERSION "1.0"
const int relayPin = 5;
const uint8_t pwmPin = 18, fanPin = 19;
int counter = 0;
float temperature = 21.5f;
volatile bool ledState = false;
unsigned long lastMs = 0;
String status = "ready; ok";
char name[20] = "abc";
const char* ssid = "net";
int arr[3] = {1, 2, 3};
Servo myServo;
DHT dht(2, DHT22);
static int hidden;
int ledPinVar = 4;

struct Point { int x; int y; };
enum Mode { A, B };

void onSwitch(Control* sender, int type);
void setup() {
  int localVar = 5;
  Serial.begin(115200);
  /* int commented = 1; */
  String s = "int fake2 = 3;";
}

void onSwitch(Control* sender, int type) {
  counter = type;
}

void loop() {
  float notGlobal = 1.0;
  for (int i = 0; i < 3; i++) { counter++; }
}
`

test('maskCode: комментарии и строки замаскированы, длина сохранена', () => {
  const m = maskCode(SKETCH)
  assert.equal(m.length, SKETCH.length)
  assert.ok(!m.includes('fake = 1'))
  assert.ok(!m.includes('fake2'))
  assert.equal(m.split('\n').length, SKETCH.split('\n').length)
})

test('глобальные переменные: типы, строки, const', () => {
  const s = parseSketch(SKETCH)
  const by = (n: string) => s.vars.find((v) => v.name === n)
  assert.equal(by('counter')?.type, 'int')
  assert.equal(by('counter')?.line, 10)
  assert.equal(by('temperature')?.type, 'float')
  assert.equal(by('temperature')?.initValue, '21.5')
  assert.equal(by('ledState')?.type, 'bool')
  assert.equal(by('ledState')?.initValue, 'false')
  assert.equal(by('lastMs')?.type, 'int')
  assert.equal(by('lastMs')?.ctype, 'unsigned long')
  assert.equal(by('status')?.type, 'String')
  assert.equal(by('status')?.initValue, 'ready; ok')
  assert.equal(by('relayPin')?.isConst, true)
  assert.equal(by('hidden')?.isStatic, true)
})

test('локальные переменные и закомментированное не считаются глобальными', () => {
  const s = parseSketch(SKETCH)
  for (const n of ['localVar', 'commented', 'fake', 'fake2', 'notGlobal', 'i', 's'])
    assert.equal(s.vars.some((v) => v.name === n), false, n)
})

test('массивы, указатели и классы помечаются как неподдерживаемые', () => {
  const s = parseSketch(SKETCH)
  const by = (n: string) => s.vars.find((v) => v.name === n)
  assert.equal(by('name')?.type, null)
  assert.equal(by('name')?.isArray, true)
  assert.equal(by('arr')?.isArray, true)
  assert.equal(by('ssid')?.type, null)
  assert.equal(by('myServo')?.type, null)
  assert.ok(by('myServo')?.note)
  // объект с конструктором и прототипы не попадают
  assert.equal(by('dht'), undefined)
})

test('пины: #define, const и «похожие на пин» переменные', () => {
  const s = parseSketch(SKETCH)
  const by = (n: string) => s.pins.find((p) => p.name === n)
  assert.equal(by('LED_PIN')?.value, 2)
  assert.equal(by('LED_PIN')?.kind, 'define')
  assert.equal(by('BTN')?.value, null)
  assert.equal(by('BTN')?.expr, 'D3')
  assert.equal(by('relayPin')?.value, 5)
  assert.equal(by('pwmPin')?.value, 18)
  assert.equal(by('fanPin')?.value, 19)
  assert.equal(by('ledPinVar')?.kind, 'var')
  assert.equal(by('counter'), undefined)
  assert.equal(by('SQ'), undefined)
  assert.equal(by('VERSION'), undefined)
})

test('пины под платформу: D3 на ESP8266 — GPIO0', () => {
  assert.equal(resolvePinExpr('D3', 'esp8266'), 0)
  assert.equal(resolvePinExpr('D4', 'esp8266'), 2)
  assert.equal(resolvePinExpr('A0', 'esp8266'), 17)
  assert.equal(resolvePinExpr('D3', 'esp32'), null)
  assert.equal(resolvePinExpr('7', 'esp32'), 7)
})

test('функции: setup/loop, обработчики и их прототипы', () => {
  const s = parseSketch(SKETCH)
  assert.ok(s.setup && s.loop)
  assert.equal(s.setup?.line, 27)
  const cb = s.funcs.filter((f) => f.isCallback)
  assert.deepEqual(cb.map((f) => f.name), ['onSwitch'])
  assert.ok(cb.some((f) => f.name === 'onSwitch' && !f.isPrototype))
  assert.ok(s.setup && SKETCH[s.setup.bodyOpen] === '{' && SKETCH[s.setup.bodyClose] === '}')
})

test('#include: заголовки и строки', () => {
  const s = parseSketch(SKETCH)
  assert.deepEqual(s.includes.map((i) => [i.header, i.line]), [['WiFi.h', 1], ['config.h', 2]])
})

test('struct/enum и инициализаторы в фигурных скобках не ломают разбор', () => {
  const s = parseSketch('struct P { int a; int b; } p = {1,2};\nint x = 3;\nint y[] = {1,2};\nint z;\nvoid setup(){}\nvoid loop(){}')
  assert.equal(s.vars.find((v) => v.name === 'x')?.line, 2)
  assert.ok(s.vars.find((v) => v.name === 'z'))
  assert.ok(s.setup && s.loop)
})

test('несколько объявлений в одной строке и сложные инициализаторы', () => {
  const s = parseSketch('int a = 1, b = max(2, 3), c;\nfloat t = 1.5, u = -2.0;')
  assert.deepEqual(s.vars.map((v) => v.name), ['a', 'b', 'c', 't', 'u'])
  assert.equal(s.vars.find((v) => v.name === 'u')?.initValue, '-2.0')
  assert.equal(s.vars.find((v) => v.name === 'b')?.initValue, '')
})

test('CRLF и пустой текст', () => {
  assert.equal(parseSketch('').vars.length, 0)
  const s = parseSketch('int a = 1;\r\nbool b;\r\nvoid setup() {\r\n}\r\n')
  assert.equal(s.vars.find((v) => v.name === 'b')?.line, 2)
})

test('скобка функции на следующей строке и пустое тело', () => {
  const s = parseSketch('int k;\nvoid setup()\n{\n  int q;\n}\nvoid loop() {}')
  assert.deepEqual(s.vars.map((v) => v.name), ['k'])
  assert.equal(s.loop?.name, 'loop')
})
