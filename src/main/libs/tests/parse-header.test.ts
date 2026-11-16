// Запуск: node --import ./src/main/libs/tests/register.mjs --test src/main/libs/tests/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractIncludes, formatDoc, parseHeader } from '../parse-header'
import type { LibSymbol } from '../types'

const parse = (code: string): LibSymbol[] => parseHeader(code, { header: 'x.h' }).symbols
const find = (syms: LibSymbol[], name: string, owner?: string): LibSymbol | undefined => syms.find((s) => s.name === name && (owner === undefined || s.owner === owner))

const ADAFRUIT = `
/*!
 * @file Adafruit_BMP280.h
 * Copyright (c) 2012 Adafruit Industries. License: BSD
 */
#ifndef __BMP280_H__
#define __BMP280_H__

#include "Arduino.h"
#include <Adafruit_Sensor.h>

/** I2C address */
#define BMP280_ADDRESS (0x77) /**< The default I2C address for the sensor. */
#define BMP280_ADDRESS_ALT (0x76)
#define BMP280_CHIPID (0x58)
#define SQR(x) ((x) * (x))

/*!
 * Registers available on the sensor.
 */
enum {
  BMP280_REGISTER_DIG_T1 = 0x88,
  BMP280_REGISTER_DIG_T2 = 0x8A, ///< temperature calib
  BMP280_REGISTER_CHIPID = 0xD0
};

/** Struct to hold calibration data. */
typedef struct {
  uint16_t dig_T1; ///< dig_T1 cal register.
  int16_t dig_T2;
} bmp280_calib_data;

/**
 * Driver for the Adafruit BMP280 barometric pressure sensor.
 */
class Adafruit_BMP280 : public Adafruit_Sensor {
public:
  /** Oversampling rate for the sensor. */
  enum sensor_sampling {
    SAMPLING_NONE = 0x00,
    SAMPLING_X1 = 0x01,
    SAMPLING_X2 = 0x02
  };

  Adafruit_BMP280(TwoWire *theWire = &Wire);
  ~Adafruit_BMP280(void);

  /*!
   * @brief  Initialises the sensor.
   * @param  addr  The I2C address of the sensor
   * @param  chipid  The expected chip id
   * @return true if successful
   */
  bool begin(uint8_t addr = BMP280_ADDRESS, uint8_t chipid = BMP280_CHIPID);
  void reset(void);
  float readTemperature(void);
  float readPressure(void);
  float readAltitude(float seaLevelhPa = 1013.25);
  float seaLevelForAltitude(float altitude, float atmospheric);
  void setSampling(sensor_mode mode = MODE_NORMAL,
                   sensor_sampling tempSampling = SAMPLING_X16,
                   sensor_sampling pressSampling = SAMPLING_X16);
  bool getEvent(sensors_event_t *event) override;
  static const int kMax = 5;
  int32_t t_fine; // fine temperature

protected:
  int32_t _sensorID;
  void readCoefficients(void);

private:
  TwoWire *_wire;
  uint8_t read8(byte reg);
  bmp280_calib_data _bmp280_calib;
};

#endif
`

test('Adafruit-стиль: класс, методы, конструктор, значения по умолчанию, документация', () => {
  const syms = parse(ADAFRUIT)
  const cls = find(syms, 'Adafruit_BMP280')!
  assert.equal(cls.kind, 'class')
  assert.deepEqual(cls.bases, ['Adafruit_Sensor'])
  assert.match(cls.doc ?? '', /barometric pressure sensor/)
  const begin = find(syms, 'begin', 'Adafruit_BMP280')!
  assert.equal(begin.kind, 'method')
  assert.equal(begin.returns, 'bool')
  assert.equal(begin.signature, 'bool begin(uint8_t addr = BMP280_ADDRESS, uint8_t chipid = BMP280_CHIPID)')
  assert.deepEqual(begin.params, [
    { type: 'uint8_t', name: 'addr', defaultValue: 'BMP280_ADDRESS' },
    { type: 'uint8_t', name: 'chipid', defaultValue: 'BMP280_CHIPID' }
  ])
  assert.match(begin.doc ?? '', /Initialises the sensor/)
  assert.match(begin.doc ?? '', /addr — The I2C address/)
  assert.match(begin.doc ?? '', /Возвращает: true if successful/)
  const ctor = syms.find((s) => s.kind === 'constructor' && s.owner === 'Adafruit_BMP280')!
  assert.equal(ctor.signature, 'Adafruit_BMP280(TwoWire *theWire = &Wire)')
  assert.equal(ctor.params![0].defaultValue, '&Wire')
  const alt = find(syms, 'readAltitude')!
  assert.equal(alt.params![0].defaultValue, '1013.25')
  const multi = find(syms, 'setSampling')!
  assert.equal(multi.params!.length, 3)
  assert.equal(multi.params![1].name, 'tempSampling')
  const ev = find(syms, 'getEvent')!
  assert.equal(ev.params![0].type, 'sensors_event_t *')
  assert.equal(ev.params![0].name, 'event')
})

test('Adafruit-стиль: приватное и деструктор игнорируются, protected помечен', () => {
  const syms = parse(ADAFRUIT)
  assert.equal(find(syms, 'read8'), undefined)
  assert.equal(find(syms, '_wire'), undefined)
  assert.equal(syms.some((s) => s.name.startsWith('~')), false)
  assert.equal(find(syms, 'Adafruit_BMP280', 'Adafruit_BMP280')?.kind, 'constructor')
  const rc = find(syms, 'readCoefficients')!
  assert.equal(rc.access, 'protected')
  const tf = find(syms, 't_fine')!
  assert.equal(tf.kind, 'variable')
  assert.match(tf.doc ?? '', /fine temperature/)
  const km = find(syms, 'kMax')!
  assert.equal(km.kind, 'constant')
  assert.equal(km.isStatic, true)
  assert.match(km.signature, /static const int kMax = 5/)
})

test('#define: объектные, функциональные, значения, trailing-документация; include guard пропущен', () => {
  const syms = parse(ADAFRUIT)
  const addr = find(syms, 'BMP280_ADDRESS')!
  assert.equal(addr.kind, 'macro')
  assert.equal(addr.signature, '#define BMP280_ADDRESS (0x77)')
  assert.match(addr.doc ?? '', /default I2C address/)
  assert.equal(find(syms, '__BMP280_H__'), undefined)
  const sqr = find(syms, 'SQR')!
  assert.deepEqual(sqr.params, [{ type: '', name: 'x' }])
  assert.match(sqr.signature, /^#define SQR\(x\)/)
})

test('enum: безымянный, вложенный в класс, значения и trailing-документация; typedef struct', () => {
  const syms = parse(ADAFRUIT)
  const reg = find(syms, 'BMP280_REGISTER_DIG_T2')!
  assert.equal(reg.kind, 'enumValue')
  assert.equal(reg.signature, 'BMP280_REGISTER_DIG_T2 = 0x8A')
  assert.match(reg.doc ?? '', /temperature calib/)
  const sm = find(syms, 'SAMPLING_X2')!
  assert.equal(sm.owner, 'Adafruit_BMP280')
  assert.equal(sm.returns, 'sensor_sampling')
  assert.equal(find(syms, 'sensor_sampling', 'Adafruit_BMP280')?.kind, 'enum')
  const calib = find(syms, 'bmp280_calib_data')!
  assert.equal(calib.kind, 'struct')
  assert.equal(find(syms, 'dig_T1', 'bmp280_calib_data')?.kind, 'variable')
})

const ESPASYNC = `
#pragma once
#include <functional>
#include "Arduino.h"
#include "FS.h"

class AsyncWebServerRequest;
class AsyncWebServerResponse;

typedef std::function<void(AsyncWebServerRequest *request)> ArRequestHandlerFunction;
typedef std::function<size_t(uint8_t *data, size_t len, size_t index)> AwsResponseFiller;
using ArJsonRequestHandlerFunction = std::function<void(AsyncWebServerRequest *request, JsonVariant &json)>;

#define ASYNCWEBSERVER_VERSION "3.0.0"
#define DEFAULT_MAX_SSE_CLIENTS 8

typedef enum {
  HTTP_GET = 0b00000001,
  HTTP_POST = 0b00000010,
  HTTP_ANY = 0b01111111,
} WebRequestMethod;

namespace asyncsrv {
  static constexpr const char* T_text = "text/plain";
  const char *getContentType(const String &path);
}

class AsyncWebServer {
protected:
  AsyncServer _server;
  uint32_t _count;
public:
  AsyncWebServer(uint16_t port);
  ~AsyncWebServer();

  void begin();
  void end();
  /** Adds a handler that matches by URI. */
  AsyncCallbackWebHandler &on(const char *uri, ArRequestHandlerFunction onRequest);
  AsyncCallbackWebHandler &on(const char *uri, WebRequestMethod method, ArRequestHandlerFunction onRequest, ArUploadHandlerFunction onUpload = nullptr, ArBodyHandlerFunction onBody = nullptr);
  template <typename T> void onTyped(T &&cb) { _cb = cb; }
  AsyncStaticWebHandler &serveStatic(const char *uri, fs::FS &fs, const char *path, const char *cache_control = NULL);
  void onNotFound(ArRequestHandlerFunction fn);
  size_t count() const { return _count; }
  bool operator==(const AsyncWebServer &o) const;
  template <typename Fn>
  AsyncWebHandler &addHandler(Fn &&f) {
    return *new Fn(f);
  }
  virtual void handle() = 0;
  virtual ~AsyncWebServer() = default;
  AsyncWebServer(const AsyncWebServer &) = delete;
  void setCb(std::function<void(int, const String &)> cb = [](int, const String &) {});
};

struct AsyncEventSourceClient {
  public:
  uint32_t lastId() const { return _lastId; }
  size_t packetsWaiting() const;
  static void IRAM_ATTR isr();
  uint32_t _lastId;
};
`

test('ESP-Async-стиль: шаблоны, std::function, typedef/using, перегрузки, inline-тело, = delete', () => {
  const syms = parse(ESPASYNC)
  const srv = syms.filter((s) => s.owner === 'AsyncWebServer')
  const ons = srv.filter((s) => s.name === 'on')
  assert.equal(ons.length, 2, 'перегрузки on()')
  assert.equal(ons[0].returns, 'AsyncCallbackWebHandler &')
  assert.deepEqual(ons[1].params!.map((p) => p.name), ['uri', 'method', 'onRequest', 'onUpload', 'onBody'])
  assert.equal(ons[1].params![3].defaultValue, 'nullptr')
  const tpl = srv.find((s) => s.name === 'addHandler')!
  assert.equal(tpl.signature, 'template <typename Fn> AsyncWebHandler &addHandler(Fn &&f)')
  assert.ok(tpl.template?.startsWith('template'))
  assert.equal(find(syms, 'onTyped', 'AsyncWebServer')?.template, 'template <typename T>')
  const cnt = srv.find((s) => s.name === 'count')!
  assert.equal(cnt.isConst, true)
  assert.match(cnt.signature, /\) const$/)
  assert.equal(srv.find((s) => s.name === 'operator==')?.kind, 'method')
  assert.equal(srv.filter((s) => s.kind === 'constructor').length, 1, 'ctor(const&)=delete пропущен')
  assert.equal(srv.find((s) => s.name === 'handle')?.signature, 'virtual void handle()')
  const scb = srv.find((s) => s.name === 'setCb')!
  assert.equal(scb.params![0].type, 'std::function<void(int, const String &)>')
  assert.equal(scb.params![0].name, 'cb')
  assert.equal(srv.find((s) => s.name === '_server')?.access, 'protected')
  // typedef / using
  assert.equal(find(syms, 'ArRequestHandlerFunction')?.kind, 'typedef')
  assert.equal(find(syms, 'ArJsonRequestHandlerFunction')?.kind, 'typedef')
  // typedef enum {..} WebRequestMethod;
  const get = find(syms, 'HTTP_GET')!
  assert.equal(get.kind, 'enumValue')
  assert.equal(get.signature, 'HTTP_GET = 0b00000001')
  assert.equal(get.returns, 'WebRequestMethod')
  assert.equal(find(syms, 'WebRequestMethod')?.kind, 'enum')
  // макросы со строкой
  assert.equal(find(syms, 'ASYNCWEBSERVER_VERSION')?.signature, '#define ASYNCWEBSERVER_VERSION "3.0.0"')
  // namespace
  const gct = find(syms, 'getContentType')!
  assert.equal(gct.owner, 'asyncsrv')
  assert.equal(gct.kind, 'function')
  assert.equal(find(syms, 'T_text', 'asyncsrv')?.kind, 'constant')
  // struct: IRAM_ATTR, static
  const isr = find(syms, 'isr', 'AsyncEventSourceClient')!
  assert.equal(isr.isStatic, true)
  assert.equal(isr.signature, 'static void isr()')
  assert.equal(find(syms, 'lastId', 'AsyncEventSourceClient')?.access, 'public')
  // предварительные объявления не попадают
  assert.equal(syms.some((s) => s.name === 'AsyncWebServerRequest'), false)
})

const DHT = `
#ifndef DHT_H
#define DHT_H
#include "Arduino.h"

// Uncomment to enable printing out nice debug messages.
//#define DHT_DEBUG

#define DEBUG_PRINTER Serial

#define DHT11 11 ///< DHT TYPE 11
#define DHT12 12 ///< DHY TYPE 12
#define DHT22 22 ///< DHT TYPE 22
#define AM2301 21 ///< AM2301

#define MIN_INTERVAL 2000 /**< min interval value */
#define TIMEOUT UINT32_MAX /**< Timeout threshold value */

/*!
 *  @brief Class that stores state and functions for DHT
 */
class DHT {
public:
  DHT(uint8_t pin, uint8_t type, uint8_t count = 6);
  void begin(uint8_t usec = 55);
  float readTemperature(bool S = false, bool force = false);
  float convertCtoF(float);
  float convertFtoC(float);
  float computeHeatIndex(float temperature, float percentHumidity,
                         bool isFahrenheit = true);
  float readHumidity(bool force = false);
  boolean read(bool force = false);

private:
  uint8_t data[5];
  uint8_t _pin, _type;
#ifdef __AVR
  // Use direct GPIO access on an 8-bit AVR so keep track of the port and bit used.
  uint8_t _bit, _port;
#endif
  uint32_t _lastreadtime, _maxcycles;
  bool _lastresult;
  uint8_t pullTime; ///< Amount of time to pull
  uint32_t expectPulse(bool level);
};

/*!
 *  @brief  Class that defines Interrupt Lock Avaiability
 */
class InterruptLock {
public:
  InterruptLock() {
#if !defined(ARDUINO_ARCH_NRF52)
    noInterrupts();
#endif
  }
  ~InterruptLock() {
#if !defined(ARDUINO_ARCH_NRF52)
    interrupts();
#endif
  }
};

#endif
`

test('DHT-стиль: #define с trailing-документацией, #if внутри класса, безымянные параметры', () => {
  const syms = parse(DHT)
  const d22 = find(syms, 'DHT22')!
  assert.equal(d22.kind, 'macro')
  assert.equal(d22.signature, '#define DHT22 22')
  assert.match(d22.doc ?? '', /DHT TYPE 22/)
  assert.equal(find(syms, 'DHT_DEBUG'), undefined, 'закомментированный define не берём')
  assert.equal(find(syms, 'DHT_H'), undefined)
  assert.equal(find(syms, 'TIMEOUT')?.signature, '#define TIMEOUT UINT32_MAX')
  const dht = syms.filter((s) => s.owner === 'DHT')
  assert.equal(dht.find((s) => s.kind === 'constructor')?.signature, 'DHT(uint8_t pin, uint8_t type, uint8_t count = 6)')
  assert.equal(dht.find((s) => s.name === 'convertCtoF')?.params?.[0].name, '')
  assert.equal(dht.find((s) => s.name === 'convertCtoF')?.params?.[0].type, 'float')
  assert.equal(dht.find((s) => s.name === 'computeHeatIndex')?.params?.length, 3)
  assert.equal(dht.find((s) => s.name === 'read')?.returns, 'boolean')
  assert.equal(dht.some((s) => s.name === 'expectPulse'), false)
  assert.equal(dht.some((s) => s.name === '_bit'), false)
  // класс после #if/#endif с телами конструкторов продолжает разбираться
  assert.equal(find(syms, 'InterruptLock')?.kind, 'class')
  assert.match(find(syms, 'DHT')?.doc ?? '', /stores state and functions for DHT/)
})

test('enum class: значения с владельцем, базовый тип, документация', () => {
  const syms = parse(`
/** Режим работы. */
enum class Mode : uint8_t {
  Off,        // выключено
  On = 5,
  /** Автоматика */
  Auto
};
enum Color { RED, GREEN = 3, BLUE };
namespace ui { enum class Kind { A, B }; }
`)
  const mode = find(syms, 'Mode')!
  assert.equal(mode.kind, 'enum')
  assert.equal(mode.signature, 'enum class Mode : uint8_t')
  assert.equal(mode.doc, 'Режим работы.')
  const off = find(syms, 'Off')!
  assert.equal(off.owner, 'Mode')
  assert.equal(off.signature, 'Mode::Off = 0')
  assert.equal(off.doc, 'выключено')
  assert.equal(find(syms, 'On')?.signature, 'Mode::On = 5')
  assert.equal(find(syms, 'Auto')?.signature, 'Mode::Auto = 6')
  assert.equal(find(syms, 'Auto')?.doc, 'Автоматика')
  const blue = find(syms, 'BLUE')!
  assert.equal(blue.owner, undefined)
  assert.equal(blue.signature, 'BLUE = 4')
  assert.equal(blue.returns, 'Color')
  assert.equal(find(syms, 'A')?.owner, 'Kind')
})

test('свободные функции, extern, const/constexpr, переменные, typedef указателя на функцию, extern "C"', () => {
  const syms = parse(`
extern "C" {
  void ets_delay_us(uint32_t us);
  typedef void (*isr_cb_t)(void *arg);
}
extern WiFiClass WiFi;
extern const char *const kNames[];
const int LED_PIN = 2;
constexpr float kPi = 3.14159f;
static uint8_t counter = 0, other[4];
int add(int a, int b = 2);
inline int twice(int x) { return x * 2; }
void IRAM_ATTR onTimer();
String format(const String &fmt, ...);
unsigned long millisSince(unsigned long since);
void (*callback)(int);
template <typename T> T clampTo(T v, T lo, T hi);
ESP_DEPRECATED("use other") void oldApi(int x);
DHT dht(2, DHT22);
`)
  assert.equal(find(syms, 'ets_delay_us')?.kind, 'function')
  assert.equal(find(syms, 'isr_cb_t')?.kind, 'typedef')
  const wifi = find(syms, 'WiFi')!
  assert.equal(wifi.kind, 'variable')
  assert.equal(wifi.returns, 'WiFiClass')
  assert.equal(find(syms, 'kNames')?.kind, 'constant')
  assert.equal(find(syms, 'LED_PIN')?.signature, 'const int LED_PIN = 2')
  assert.equal(find(syms, 'kPi')?.kind, 'constant')
  assert.equal(find(syms, 'counter')?.kind, 'variable')
  assert.equal(find(syms, 'other')?.kind, 'variable')
  assert.equal(find(syms, 'add')?.signature, 'int add(int a, int b = 2)')
  assert.equal(find(syms, 'twice')?.kind, 'function')
  assert.equal(find(syms, 'onTimer')?.signature, 'void onTimer()')
  const fmt = find(syms, 'format')!
  assert.deepEqual(fmt.params!.map((p) => p.type), ['const String &', '...'])
  assert.equal(find(syms, 'millisSince')?.params?.[0].name, 'since')
  assert.equal(find(syms, 'callback')?.kind, 'variable')
  assert.equal(find(syms, 'clampTo')?.template, 'template <typename T>')
  assert.equal(find(syms, 'oldApi')?.kind, 'function')
  const dht = find(syms, 'dht')!
  assert.equal(dht.kind, 'variable')
  assert.equal(dht.returns, 'DHT')
})

test('комментарии, строки и #if 0 не ломают разбор; атрибуты и #else с несбалансированными скобками', () => {
  const syms = parse(`
// void commentedOut();
/* void alsoCommented(); */
const char *s = "void inString(); { // not a comment";
#if 0
void hidden() {
#endif
void visible(int a);
#ifdef ESP32
void platformFn(int a) {
#else
void platformFn(int a, int b) {
#endif
  if (a) { }
}
void afterIfdef(const char *msg);
__attribute__((always_inline)) void fast(int x);
[[nodiscard]] bool check();
class __attribute__((packed)) Packed { public: int v; };
class MYLIB_API Exported { public: void run(); };
`)
  const names = syms.map((x) => x.name)
  assert.ok(names.includes('visible'))
  assert.ok(!names.includes('hidden'))
  assert.ok(!names.includes('commentedOut'))
  assert.ok(!names.includes('inString'))
  assert.ok(names.includes('platformFn'))
  assert.ok(names.includes('afterIfdef'))
  assert.ok(names.includes('fast'))
  assert.ok(names.includes('check'))
  assert.equal(find(syms, 'Packed')?.kind, 'class')
  assert.equal(find(syms, 'Exported')?.kind, 'class')
  assert.equal(find(syms, 'run', 'Exported')?.kind, 'method')
  assert.equal(find(syms, 'v', 'Packed')?.kind, 'variable')
})

test('Doxygen: ///, //!, /** */, @brief/@param/@return; лицензия и разделители не попадают в doc', () => {
  const syms = parse(`
/*
 * Copyright (c) 2020 Someone. All rights reserved.
 * Licensed under the MIT license.
 */
/// Читает значение.
/// @param pin номер пина
/// @return прочитанное значение
int readIt(int pin);

//! Краткое описание через //!
void other();

// ------------------------------
// Обычный комментарий над функцией
// вторая строка
void plain();

/* ===== */
void nodoc();

void trailing(); // trailing описание
`)
  assert.equal(find(syms, 'readIt')?.doc, 'Читает значение.\npin — номер пина\nВозвращает: прочитанное значение')
  assert.equal(find(syms, 'other')?.doc, 'Краткое описание через //!')
  assert.equal(find(syms, 'plain')?.doc, 'Обычный комментарий над функцией вторая строка')
  assert.equal(find(syms, 'nodoc')?.doc, undefined)
  assert.equal(find(syms, 'trailing')?.doc, 'trailing описание')
  assert.equal(formatDoc(['Copyright (c) 2019 Foo. All rights reserved. Permission is hereby granted']), undefined)
})

test('вложенные классы и структуры, using в классе, friend, виртуальные и static методы', () => {
  const syms = parse(`
class Outer {
public:
  struct Config { int a; bool b; };
  class Inner { public: void ping(); };
  using Callback = void (*)(int);
  using Base::method;
  friend class Other;
  static Outer &instance();
  virtual void tick() = 0;
  const char *name() const;
  Callback cb;
private:
  class Hidden { public: void secret(); };
};
struct Point { int x; int y; Point(int x, int y); float dist(const Point &o) const; };
`)
  assert.equal(find(syms, 'Config')?.owner, 'Outer')
  assert.equal(find(syms, 'a', 'Outer::Config')?.kind, 'variable')
  assert.equal(find(syms, 'ping', 'Outer::Inner')?.kind, 'method')
  assert.equal(find(syms, 'Callback')?.kind, 'typedef')
  assert.equal(find(syms, 'instance')?.isStatic, true)
  assert.equal(find(syms, 'tick')?.signature, 'virtual void tick()')
  assert.equal(find(syms, 'name')?.returns, 'const char *')
  assert.equal(find(syms, 'name')?.isConst, true)
  assert.equal(find(syms, 'secret'), undefined)
  assert.equal(find(syms, 'Hidden'), undefined)
  assert.equal(find(syms, 'x', 'Point')?.access, 'public')
  assert.equal(find(syms, 'Point', 'Point')?.kind, 'constructor')
  assert.equal(find(syms, 'dist', 'Point')?.params?.[0].type, 'const Point &')
})

test('устойчивость: мусор, незакрытые скобки и строки не бросают исключений', () => {
  const junk = ['class {', 'void f(', '"unterminated', '/* open', '}}}}{{{{', 'template <', 'enum {', '#define', 'x = = = ;', 'struct A : { int', '#if 0\nvoid x();', 'namespace {{{']
  for (const j of junk) {
    const r = parseHeader(j, { header: 'junk.h' })
    assert.ok(Array.isArray(r.symbols), j)
  }
})

test('большой файл (10k строк) разбирается быстро; лимиты дают предупреждения', () => {
  let code = ''
  for (let i = 0; i < 2500; i++) code += `/** doc ${i} */\nclass C${i} {\npublic:\n  C${i}(int a);\n  int get${i}(int x, float y = 1.0f) const;\n};\n`
  const t0 = Date.now()
  const r = parseHeader(code, { header: 'big.h', maxSymbols: 50000 })
  const ms = Date.now() - t0
  assert.ok(ms < 1500, `слишком долго: ${ms} мс`)
  assert.equal(r.symbols.filter((s) => s.kind === 'class').length, 2500)
  const limited = parseHeader(code, { header: 'big.h', maxSymbols: 100 })
  assert.equal(limited.symbols.length, 100)
  assert.ok(limited.warnings.some((w) => /лимит символов/.test(w)))
  const cut = parseHeader(code, { header: 'big.h', maxBytes: 1000 })
  assert.ok(cut.warnings.some((w) => /слишком большой/.test(w)))
  assert.ok(cut.symbols.length > 0 && cut.symbols.length < 100)
})

test('extractIncludes: <> и "", комментарии игнорируются, дубликаты', () => {
  const inc = extractIncludes(`
#include <WiFi.h>
#include "ESPUI.h"
  # include <Adafruit_BMP280.h>
// #include <Commented.h>
/* #include <Block.h> */
#include <WiFi.h>
#include <utility/foo.h>
`)
  assert.deepEqual(inc.map((x) => x.name), ['WiFi.h', 'ESPUI.h', 'Adafruit_BMP280.h', 'utility/foo.h'])
  assert.equal(inc[1].angle, false)
})

test('ArduinoJson-стиль: макросы-обёртки namespace, шаблоны с аргументами по умолчанию, указатели в типе переменной', () => {
  const syms = parse(`
ARDUINOJSON_BEGIN_PUBLIC_NAMESPACE

class JsonObject;

// Ссылка на массив
class JsonArray : public detail::VariantOperators<JsonArray> {
  friend class detail::VariantAttorney;
 public:
  template <typename T, detail::enable_if_t<
                            !detail::is_same<T, JsonVariant>::value, int> = 0>
  T add() const {
    return add<JsonVariant>().to<T>();
  }
  operator JsonVariant() { return JsonVariant(); }
  bool set(JsonArrayConst src) const;
};
ARDUINOJSON_END_PUBLIC_NAMESPACE
const char *ui_title = "x";
`)
  assert.equal(find(syms, 'JsonArray')?.kind, 'class')
  assert.equal(syms.some((s) => /ARDUINOJSON/.test(s.name)), false)
  const add = find(syms, 'add', 'JsonArray')!
  assert.equal(add.kind, 'method')
  assert.match(add.signature, /T add\(\) const$/)
  assert.equal(find(syms, 'set', 'JsonArray')?.kind, 'method')
  assert.equal(find(syms, 'ui_title')?.signature, 'const char *ui_title = "x"')
})

test('операторы: [], (), ==, =, bool, шаблонные; friend и внешние определения пропускаются', () => {
  const syms = parse(`
class JsonDoc {
 public:
  JsonVariant operator[](const char* key);
  const JsonVariant operator[](size_t index) const;
  template <typename T> MemberProxy<JsonDoc&, T> operator[](const T& key);
  bool operator()(int a, int b) const;
  JsonDoc &operator=(const JsonDoc &o);
  bool operator==(const JsonDoc &o) const { return true; }
  explicit operator bool() const;
  operator JsonVariant();
  friend bool operator!=(const JsonDoc &a, const JsonDoc &b);
  Stream &operator<<(int x);
};
bool JsonDoc::operator==(const JsonDoc &o) const { return false; }
`)
  const ops = syms.filter((s) => s.owner === 'JsonDoc' && s.name.startsWith('operator'))
  assert.deepEqual(ops.map((o) => o.name), ['operator[]', 'operator[]', 'operator[]', 'operator()', 'operator=', 'operator==', 'operator bool', 'operator JsonVariant', 'operator<<'])
  assert.equal(ops[0].kind, 'method')
  assert.equal(ops[0].returns, 'JsonVariant')
  assert.equal(ops[0].signature, 'JsonVariant operator[](const char* key)')
  assert.equal(ops[1].isConst, true)
  assert.equal(ops[3].params!.length, 2)
  assert.equal(ops[6].returns, 'bool')
  assert.equal(ops[7].returns, 'JsonVariant')
  assert.equal(syms.some((s) => s.name === 'operator!='), false)
})
