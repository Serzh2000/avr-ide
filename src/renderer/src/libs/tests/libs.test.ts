// Запуск: node --import ./src/main/libs/tests/register.mjs --test src/renderer/src/libs/tests/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseHeader } from '../../../../main/libs/parse-header'
import type { ProjectLibrary } from '../../contracts'
import { buildIndex, lookupRef, membersOf, searchRefs, simpleTypeName, variableClasses } from '../model'
import { memberCandidates, operatorSignatures, pickOverload, resolveWord, scopeCandidates, signatureCandidates } from '../complete'
import { allVariableClasses, findIndexContext, inferExprClass } from '../infer'
import { computeCompletions } from '../../editor/completion'
import { extractSymbols, variableTypes } from '../../editor/symbols'
import { scan } from '../../editor/scan'
import { findCallContext, wordAt } from '../../editor/signature'
import { functions } from '../../reference/data'
import { libEntriesFor, lookupLibEntry } from '../../reference/libEntries'
import { includesOf } from '../store'

const BMP = `
#define BMP280_ADDRESS (0x77) ///< The default I2C address
class Adafruit_Sensor { public: virtual bool getEvent(int *e) = 0; float baseValue(); };
/** Driver for the BMP280 sensor. */
class Adafruit_BMP280 : public Adafruit_Sensor {
public:
  enum sensor_sampling { SAMPLING_NONE = 0x00, SAMPLING_X1 = 0x01 };
  Adafruit_BMP280(TwoWire *theWire = &Wire);
  /** @brief Initialises the sensor. @param addr I2C address @return true if OK */
  bool begin(uint8_t addr = BMP280_ADDRESS, uint8_t chipid = 0x58);
  float readTemperature(void);
  float readPressure(void);
  static const int kMax = 5;
  void setSampling(sensor_sampling s = SAMPLING_X1);
private:
  uint8_t read8(byte reg);
};`
const DHT = `
#define DHT22 22 ///< DHT TYPE 22
class DHT { public: DHT(uint8_t pin, uint8_t type, uint8_t count = 6); void begin(uint8_t usec = 55); float readTemperature(bool S = false, bool force = false); float readHumidity(bool force = false); };`
const ESPUI = `
enum class ControlColor : uint8_t { Turquoise, Emerald };
enum ControlType : uint8_t { Title = 0, Button = 3 };
class ESPUIClass { public: void begin(const char* title, const char* user = nullptr, uint16_t port = 80); uint16_t button(const char* label, std::function<void(int)> cb, ControlColor color, const String& value = ""); uint16_t addControl(ControlType type, const char* label); };
extern ESPUIClass ESPUI;
class AsyncWebServerRequest { public: void send(int code, const char* type, const String& content); const String& url() const; };
namespace asyncsrv { const char *getContentType(const String &path); }
void globalFn(int a, int b);`

function lib(name: string, src: string, header: string): ProjectLibrary {
  const r = parseHeader(src, { header })
  return { name, version: '1.0', path: `C:\\libs\\${name}`, matchedIncludes: [header], headers: [header], symbols: r.symbols, examples: [] }
}
const libs = [lib('Adafruit BMP280', BMP, 'Adafruit_BMP280.h'), lib('DHT sensor library', DHT, 'DHT.h'), lib('ESPUI', ESPUI, 'src/ESPUI.h')]
const index = buildIndex(libs)

function complete(code: string) {
  const symbols = extractSymbols(code)
  const libTypes = variableClasses(scan(code).masked, index)
  return computeCompletions({ textBefore: code, platform: 'esp32', entries: functions, symbols, libs: index, libTypes })
}
const labels = (r: { items: { label: string }[] }): string[] => r.items.map((i) => i.label)

test('variableClasses: глобальные и локальные переменные, указатели, параметры', () => {
  const t = variableClasses(
    scan(`
Adafruit_BMP280 bmp;
DHT dht(2, DHT22);
const Adafruit_BMP280* pb = &bmp;
void f(AsyncWebServerRequest *request) { AsyncWebServerRequest &r2 = *request; DHT local(3, DHT11); }
auto x = 5; int DHTx = 3;
`).masked,
    index
  )
  assert.equal(t.bmp, 'Adafruit_BMP280')
  assert.equal(t.dht, 'DHT')
  assert.equal(t.pb, 'Adafruit_BMP280')
  assert.equal(t.request, 'AsyncWebServerRequest')
  assert.equal(t.r2, 'AsyncWebServerRequest')
  assert.equal(t.local, 'DHT')
  assert.equal(t.x, undefined)
})

test('автодополнение после точки: методы класса по объявлению, с наследованием; приватное скрыто', () => {
  const r = complete('Adafruit_BMP280 bmp;\nvoid setup() {\n  bmp.')
  const l = labels(r)
  for (const n of ['begin', 'readTemperature', 'readPressure', 'setSampling', 'getEvent', 'baseValue']) assert.ok(l.includes(n), n)
  assert.ok(!l.includes('read8'))
  assert.ok(!l.includes('Adafruit_BMP280'), 'конструктор не предлагается после точки')
  const begin = r.items.find((i) => i.label === 'begin')!
  assert.equal(begin.insertText, 'begin($0)', 'обязательных параметров нет — только скобки')
  assert.match(begin.detail ?? '', /bool begin\(uint8_t addr = BMP280_ADDRESS/)
  assert.match(begin.detail ?? '', /\[Adafruit BMP280\]/)
  assert.match(begin.documentation ?? '', /Initialises the sensor/)
  const ts = complete('DHT dht(2, DHT22);\ndht.')
  assert.deepEqual(labels(ts).sort(), ['begin', 'readHumidity', 'readTemperature'])
})

test('автодополнение: -> для указателей, локальные переменные в функциях, глобальный объект ESPUI', () => {
  assert.ok(labels(complete('void h(AsyncWebServerRequest *request) {\n  request->')).includes('send'))
  assert.ok(labels(complete('void loop() {\n  Adafruit_BMP280 b2;\n  b2.re')).includes('readPressure'))
  const e = complete('void setup() {\n  ESPUI.')
  assert.ok(labels(e).includes('button'))
  const btn = e.items.find((i) => i.label === 'button')!
  assert.equal(btn.insertText, 'button(${1:label}, ${2:cb}, ${3:color})', 'в сниппет — только обязательные параметры')
})

test('автодополнение: Класс::, enum class, пространство имён', () => {
  assert.deepEqual(labels(complete('ControlColor::')).sort(), ['Emerald', 'Turquoise'])
  const k = labels(complete('Adafruit_BMP280::'))
  assert.ok(k.includes('kMax') && k.includes('SAMPLING_X1'))
  assert.ok(!k.includes('begin'), 'нестатические методы после :: не показываем')
  assert.deepEqual(labels(complete('asyncsrv::')), ['getContentType'])
})

test('автодополнение без точки: классы, функции, макросы, значения enum, константы библиотек', () => {
  const l = labels(complete('void setup() {\n  '))
  for (const n of ['Adafruit_BMP280', 'DHT', 'DHT22', 'BMP280_ADDRESS', 'ESPUIClass', 'ESPUI', 'globalFn', 'ControlType', 'Title', 'Button']) assert.ok(l.includes(n), n)
  assert.ok(!l.includes('Turquoise'), 'значения enum class — только через ControlColor::')
  assert.ok(!l.includes('getContentType'), 'функции пространства имён — только через ns::')
  assert.ok(l.includes('digitalWrite'), 'справочник Arduino остаётся')
  const dht22 = complete('x').items.find((i) => i.label === 'DHT22')!
  assert.match(dht22.documentation ?? '', /DHT TYPE 22/)
})

test('без библиотек автодополнение не меняется', () => {
  const r = computeCompletions({ textBefore: 'Serial.', platform: null, entries: functions, fullText: 'Serial.' })
  assert.ok(labels(r).includes('println'))
})

test('hover и signature help: перегрузки, активная перегрузка, конструкторы переменной', () => {
  const code = 'Adafruit_BMP280 bmp;\nDHT dht(2, DHT22);\nESPUI.addControl(Title, '
  const types = variableTypes(extractSymbols(code))
  const lt = variableClasses(scan(code).masked, index)
  const ctx = findCallContext(code)!
  assert.equal(ctx.name, 'addControl')
  assert.equal(ctx.qualifier, 'ESPUI')
  const sc = signatureCandidates(index, ctx.name, ctx.qualifier, types, lt, ctx.scope)
  assert.equal(sc.length, 1)
  assert.equal(sc[0].params.length, 2)
  assert.equal(findCallContext('bmp.begin(0x76, ')!.argIndex, 1)
  assert.equal(findCallContext('ControlColor::foo(')!.scope, 'ControlColor')
  const sc2 = signatureCandidates(index, 'begin', 'bmp', types, lt, null)
  assert.equal(sc2.length, 1)
  assert.equal(sc2[0].label, 'bool begin(uint8_t addr = BMP280_ADDRESS, uint8_t chipid = 0x58)')
  assert.equal(sc2[0].paramDocs[0], 'I2C address')
  assert.equal(pickOverload(sc2, 1), 0)
  // DHT dht( → конструкторы класса
  const ctor = signatureCandidates(index, 'dht', null, types, lt, null)
  assert.equal(ctor.length, 1)
  assert.equal(ctor[0].label, 'DHT(uint8_t pin, uint8_t type, uint8_t count = 6)')
  assert.equal(signatureCandidates(index, 'DHT', null, types, lt, null).length, 1)
  assert.equal(wordAt('request->send', 10)?.qualifier, 'request')
  assert.equal(wordAt('ControlColor::Emerald', 15)?.scope, 'ControlColor')
  assert.deepEqual(resolveWord(index, 'send', 'request', types, { request: 'AsyncWebServerRequest' }, null).map((r) => r.sym.owner), ['AsyncWebServerRequest'])
})

test('lookupRef / поиск / записи справочника из символов библиотек', () => {
  assert.equal(lookupRef(index, 'Adafruit_BMP280.begin')?.sym.kind, 'method')
  assert.equal(lookupRef(index, 'Adafruit_BMP280::begin')?.sym.name, 'begin')
  assert.equal(lookupRef(index, 'DHT22')?.sym.kind, 'macro')
  assert.equal(lookupRef(index, 'ESPUI')?.sym.kind, 'variable')
  assert.equal(lookupRef(index, 'nonexistent'), undefined)
  assert.equal(lookupRef(index, 'getContentType')?.sym.owner, 'asyncsrv')
  const found = searchRefs(index, 'temperature')
  assert.ok(found.some((r) => r.sym.name === 'readTemperature' && r.lib.name === 'Adafruit BMP280'))
  assert.ok(found.some((r) => r.sym.name === 'readTemperature' && r.lib.name === 'DHT sensor library'))
  assert.equal(searchRefs(index, 'bmp readTemp')[0].sym.name, 'readTemperature')
  const entries = libEntriesFor(index, 'readPressure')
  assert.equal(entries[0].name, 'Adafruit_BMP280.readPressure')
  assert.equal(entries[0].source?.lib, 'Adafruit BMP280')
  assert.equal(entries[0].category, 'Библиотека: Adafruit BMP280')
  assert.equal(libEntriesFor(index, '').length, 0)
  assert.equal(lookupLibEntry(index, 'DHT.begin')?.signature, 'void begin(uint8_t usec = 55)')
  assert.equal(membersOf(index, 'Adafruit_BMP280', { kinds: ['constructor'] }).length, 1)
  assert.equal(simpleTypeName('const detail::VariantOperators<JsonArray>&'), 'VariantOperators')
  assert.equal(simpleTypeName('unsigned long'), 'long')
  assert.ok(memberCandidates(index, 'DHT').length === 3 && scopeCandidates(index, 'DHT').length === 0)
})

test('includesOf: #include из нескольких файлов, без комментариев и дубликатов', () => {
  const inc = includesOf(['#include <WiFi.h>\n// #include <No.h>\n#include "a.h"', '/* #include <Block.h> */\n#include <WiFi.h>\n#include <DHT.h>'])
  assert.deepEqual(inc, ['#include <WiFi.h>', '#include "a.h"', '#include <DHT.h>'])
})

test('псевдонимы классов (using Servo = ServoTemplate<int>) дают подсказки по объектам алиаса', () => {
  const l = lib('ServoESP32', 'template <class T> class ServoTemplate { public: bool attach(int pin); void write(T angle); };\nusing Servo = ServoTemplate<int>;', 'Servo.h')
  const idx = buildIndex([l])
  const types = variableClasses(scan('Servo myservo;\nServoTemplate<float> f;').masked, idx)
  assert.equal(types.myservo, 'Servo')
  assert.equal(types.f, 'ServoTemplate')
  const symbols = extractSymbols('Servo myservo;\nmyservo.')
  const r = computeCompletions({ textBefore: 'Servo myservo;\nmyservo.', platform: 'esp32', entries: functions, symbols, libs: idx, libTypes: variableClasses(scan('Servo myservo;').masked, idx) })
  assert.deepEqual(labels(r).sort(), ['attach', 'write'])
})

const CHAIN_SRC = `
class Reading { public: float value(); Reading &scale(float k); };
class JsonVariant { public: int size(); JsonVariant operator[](const char* k); JsonVariant operator[](int i); bool isNull() const; };
class JsonDocument { public: JsonVariant operator[](const char* key); JsonDocument &operator=(int); bool operator()(int a); template <typename T> T as(); void clear(); };
class Sensor { public: Reading read(); Sensor &setRate(int r); Reading history(int n); Sensor *self(); int amb(); float amb(int x); Reading dual(); JsonVariant dual(int x); };
Sensor makeSensor(int id);
extern Sensor sens;`
const cl = buildIndex([lib('Chain', CHAIN_SRC, 'chain.h')])

function cx(code: string) {
  const masked = scan(code).masked
  const libTypes = allVariableClasses(masked, cl)
  return { libTypes, res: computeCompletions({ textBefore: code, platform: 'esp32', entries: functions, symbols: extractSymbols(code), libs: cl, libTypes }) }
}

test('auto: auto x = obj.method(), auto&, auto*, const auto, new/ctor/функция; неуверенные случаи пропускаются', () => {
  const t = allVariableClasses(
    scan(`
JsonDocument doc;
auto r = sens.read();
auto& s2 = sens.setRate(1);
auto* p = sens.self();
const auto c = makeSensor(3);
auto* np = new Sensor();
auto ctor = Sensor();
auto v = doc["k"];
auto vv = doc["a"][2];
auto asInt = doc.as<int>();
auto f = r.value();
auto amb = sens.amb();
auto dual = sens.dual();
auto chain = sens.read().scale(2);
auto sum = r.value() + 1;
auto cond = flag ? sens.read() : sens.read();
auto unknown = foo.bar();
auto chained = sens.history(1).scale(0.5f);
auto copy = r;
`).masked,
    cl
  )
  assert.equal(t.r, 'Reading')
  assert.equal(t.s2, 'Sensor')
  assert.equal(t.p, 'Sensor')
  assert.equal(t.c, 'Sensor')
  assert.equal(t.np, 'Sensor')
  assert.equal(t.ctor, 'Sensor')
  assert.equal(t.v, 'JsonVariant')
  assert.equal(t.vv, 'JsonVariant')
  assert.equal(t.chain, 'Reading')
  assert.equal(t.chained, 'Reading')
  assert.equal(t.copy, 'Reading', 'auto copy = r; — тип по известной переменной')
  for (const n of ['asInt', 'f', 'amb', 'dual', 'sum', 'cond', 'unknown']) assert.equal(t[n], undefined, n + ' не угадываем')
})

test('цепочки: автодополнение после obj.a().b., doc["k"]., auto-переменных', () => {
  assert.deepEqual(labels(cx('void f() {\n  sens.read().').res).sort(), ['scale', 'value'])
  assert.deepEqual(labels(cx('JsonDocument doc;\nvoid f() {\n  doc["k"].').res).sort(), ['isNull', 'size'])
  assert.deepEqual(labels(cx('JsonDocument doc;\nvoid f() {\n  doc["a"][1].').res).sort(), ['isNull', 'size'])
  assert.deepEqual(labels(cx('void f() {\n  auto r = sens.read();\n  r.scale(2).').res).sort(), ['scale', 'value'])
  assert.deepEqual(labels(cx('void f() {\n  auto n = new Sensor();\n  n->').res).includes('read'), true)
  assert.deepEqual(labels(cx('void f() {\n  sens.self()->').res).includes('read'), true)
  // неуверенно — пусто (никаких «похожих»)
  assert.equal(labels(cx('void f() {\n  sens.dual().').res).length, 0)
  assert.equal(labels(cx('void f() {\n  sens.unknown().').res).length, 0)
  assert.equal(labels(cx('JsonDocument doc;\nvoid f() {\n  doc.as<int>().').res).length, 0)
  // operator не попадает в список методов
  assert.ok(!labels(cx('JsonDocument doc;\ndoc.').res).some((l) => l.startsWith('operator')))
})

test('operator[] и operator(): signature help и результат; контекст составного получателя', () => {
  const code = 'JsonDocument doc;\nauto v = doc["k"];\ndoc["k"]['
  const lt = allVariableClasses(scan(code).masked, cl)
  const ic = findIndexContext(scan(code).masked)!
  assert.equal(ic.receiver, 'doc[" "]', 'строки в masked-тексте пустые')
  const cls = inferExprClass(cl, ic.receiver, (n) => lt[n])
  assert.equal(cls, 'JsonVariant')
  const sigs = operatorSignatures(cl, cls!, 'operator[]')
  assert.deepEqual(sigs.map((s) => s.label), ['JsonVariant operator[](const char* k)', 'JsonVariant operator[](int i)'])
  assert.match(sigs[0].doc ?? '', /Результат: JsonVariant/)
  assert.deepEqual(sigs[0].params, ['const char* k'])
  // doc[ — класс самого doc
  const ic2 = findIndexContext('JsonDocument doc;\ndoc[')!
  assert.equal(inferExprClass(cl, ic2.receiver, () => 'JsonDocument'), 'JsonDocument')
  assert.equal(operatorSignatures(cl, 'JsonDocument', 'operator[]').length, 1)
  assert.equal(findIndexContext('foo(doc[')?.receiver, 'doc', '«[» внутренняя — индексация')
  assert.equal(findIndexContext('doc[1](a, '), null, 'внутри вызова — не индексация')
  // operator() у переменной
  const call = signatureCandidates(cl, 'doc', null, {}, { doc: 'JsonDocument' }, null)
  assert.equal(call.some((c) => c.label === 'bool operator()(int a)'), true)
  // составной получатель в контексте вызова
  const cc = findCallContext('sens.read().scale(')!
  assert.equal(cc.name, 'scale')
  assert.equal(cc.receiver, 'sens.read()')
  assert.equal(findCallContext('Serial.println(')!.receiver, undefined)
  assert.equal(wordAt('  sens.read().scale', 15)?.receiver, 'sens.read()')
  assert.equal(inferExprClass(cl, 'sens.read()', () => undefined), 'Reading', 'глобальный extern-объект sens')
  assert.equal(inferExprClass(cl, 'sens.dual()', () => undefined), undefined)
})
