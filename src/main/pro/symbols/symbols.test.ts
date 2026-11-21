// Индекс проекта: обход по #include, кэш, запросы редактора (дополнение, hover, переход, ссылки, переименование) на виртуальной файловой системе.
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ProjectIndex } from '../../../shared/pro/cindex/projectIndex'
import { buildIndex, isOwnPath } from './builder'
import type { BuildFs } from './builder'
import { completion, definitions, findWord, hover, references, renamePlan, signature } from './queries'
import type { TextSource } from './queries'
import type { CursorReq } from './types'

const HDR = `#ifndef DEV_H
#define DEV_H
#include <stdint.h>
#if defined(DEV_X)
#include "dev_x.h"
#endif
#define PERIPH 0x40000000UL
#define GPIOA_BASE (PERIPH + 0x800UL)
typedef struct {
  volatile uint32_t MODER; /*!< mode, Address offset: 0x00 */
  volatile uint32_t ODR;   /*!< output data, Address offset: 0x04 */
} GPIO_TypeDef;
#define GPIOA ((GPIO_TypeDef *) GPIOA_BASE)
#define GPIO_ODR_ODR5 (1UL << 5)
#define GPIO_ODR_ODR6 (1UL << 6)
#define GPIO_MODER_X 1
#endif
`
const X_HDR = '#define FROM_X 1\nvoid x_only(void);\n'
const MY_H = '#ifndef MY_H\n#define MY_H\nvoid led_on(int pin);\nint led_state;\n#endif\n'
const MAIN_C = `#include "dev.h"
#include "my.h"

/** Включить светодиод */
void led_on(int pin)
{
  GPIOA->ODR |= GPIO_ODR_ODR5;
}

static void helper(void) { led_on(5); }

int main(void)
{
  helper();
  led_on(6);
  // led_on в комментарии
  const char *s = "led_on";
}
`
const OTHER_C = '#include "my.h"\nstatic void helper(void) { }\nvoid other(void) { led_on(1); helper(); }\n'

function vfs(files: Record<string, string>): BuildFs & { reads: number } {
  const norm = (p: string): string => p.replace(/\\/g, '/')
  const m = new Map(Object.entries(files).map(([k, v]) => [norm(k), v]))
  const o = {
    reads: 0,
    async stat(p: string) { p = norm(p); if (m.has(p)) return { mtime: 1, size: m.get(p)!.length }; for (const k of m.keys()) if (k.startsWith(p + '/')) return { mtime: 1, size: 0 }; return null },
    async read(p: string) { o.reads++; const t = m.get(norm(p)); if (t === undefined) throw new Error('нет ' + p); return t },
    async list(d: string) {
      d = norm(d).replace(/\/$/, '') + '/'
      const seen = new Map<string, boolean>()
      for (const k of m.keys()) if (k.startsWith(d)) { const rest = k.slice(d.length); const i = rest.indexOf('/'); seen.set(i < 0 ? rest : rest.slice(0, i), i >= 0) }
      return [...seen].map(([name, dir]) => ({ name, dir }))
    }
  }
  return o
}

const ROOT = 'C:/proj'
const FILES = {
  [ROOT + '/src/main.c']: MAIN_C,
  [ROOT + '/src/other.c']: OTHER_C,
  [ROOT + '/include/my.h']: MY_H,
  [ROOT + '/drivers/CMSIS/Device/dev.h']: HDR,
  [ROOT + '/drivers/CMSIS/Device/dev_x.h']: X_HDR,
  [ROOT + '/drivers/CMSIS/Device/stm32f999xx.h']: '#define SHOULD_NOT_BE_INDEXED 1\n'
}

async function build(defines: string[] = [], cache?: Parameters<typeof buildIndex>[0]['cache']) {
  const fs = vfs(FILES)
  const r = await buildIndex({ root: ROOT, sources: ['src'], includes: ['include', 'drivers/CMSIS/Device'], defines, fs, cache })
  const ix = new ProjectIndex()
  ix.build(r.files)
  return { r, ix, fs }
}

const textSource = (ix: ProjectIndex): TextSource => ({ all: () => ix.files.map((f) => ({ path: f.path, own: f.own })), read: async (p) => FILES[p] })

const req = (path: string, text: string, marker: string, off = 0): CursorReq => {
  const at = text.indexOf(marker) + off
  const before = text.slice(0, at)
  const line = before.split('\n').length
  const lineStart = before.lastIndexOf('\n') + 1
  const lineEnd = text.indexOf('\n', at)
  return { path, line, col: at - lineStart + 1, lineText: text.slice(lineStart, lineEnd < 0 ? undefined : lineEnd), before }
}

test('builder: корни — свои файлы, сторонние заголовки только по #include, лишние заголовки устройства не берутся', async () => {
  const { r } = await build()
  const names = r.files.map((f) => f.path.split('/').pop())
  assert.ok(names.includes('main.c') && names.includes('other.c') && names.includes('my.h') && names.includes('dev.h'))
  assert.ok(!names.includes('stm32f999xx.h'), 'заголовок устройства без #include в индекс не попадает')
  assert.ok(!names.includes('dev_x.h'), 'ветка #if defined(DEV_X) неактивна')
  assert.equal(r.files.find((f) => f.path.endsWith('dev.h'))!.own, false)
  assert.equal(r.files.find((f) => f.path.endsWith('my.h'))!.own, true)
  assert.equal(isOwnPath(ROOT, ROOT + '/Drivers/x.h'), false)
  assert.equal(isOwnPath(ROOT, ROOT + '/src/drivers_helper.c'), true)
  const x = await build(['DEV_X'])
  assert.ok(x.r.files.some((f) => f.path.endsWith('dev_x.h')), 'с define DEV_X заголовок подключается')
  assert.equal(x.ix.lookup('x_only').length, 1)
})

test('builder: повторный запуск берёт разбор из кэша без чтения файлов', async () => {
  const first = await build()
  const fs = vfs(FILES)
  const again = await buildIndex({ root: ROOT, sources: ['src'], includes: ['include', 'drivers/CMSIS/Device'], defines: [], fs, cache: first.r.cache })
  assert.equal(again.stats.parsed, 0)
  assert.equal(fs.reads, 0)
  assert.equal(again.stats.files, first.r.stats.files)
  // другие define — кэш недействителен
  const other = await buildIndex({ root: ROOT, sources: ['src'], includes: ['include', 'drivers/CMSIS/Device'], defines: ['DEV_X'], fs: vfs(FILES), cache: first.r.cache })
  assert.ok(other.stats.parsed > 0)
})

test('queries: после GPIOA-> поля GPIO_TypeDef, после биты регистра, include', async () => {
  const { ix } = await build()
  const m = completion(ix, { before: 'int main(void){\n  GPIOA->' })
  assert.equal(m.context, 'member')
  assert.deepEqual(m.items.map((i) => i.label), ['MODER', 'ODR'])
  assert.match(m.items[1].doc ?? '', /Смещение: 0x04 \(адрес 0x40000804\)/)
  const bits = completion(ix, { before: '  GPIOA->ODR |= GPIO_' })
  assert.deepEqual(bits.items.slice(0, 2).map((i) => i.label), ['GPIO_ODR_ODR5', 'GPIO_ODR_ODR6'], 'сначала биты именно регистра ODR')
  assert.ok(bits.items.some((i) => i.label === 'GPIO_MODER_X'))
  const plain = completion(ix, { before: '  led_' })
  assert.equal(plain.items[0].label, 'led_on')
  assert.ok(plain.items[0].own)
  assert.deepEqual(completion(ix, { before: '#include "m' }).items.map((i) => i.label), ['my.h'])
  assert.equal(completion(ix, { before: '/* GPIOA->' }).items.length, 0)
})

test('queries: hover — регистр, периферия, макрос, функция с doc', async () => {
  const { ix } = await build()
  const h1 = hover(ix, req('C:/proj/src/main.c', MAIN_C, 'ODR |=', 1))!
  assert.match(h1.code, /uint32_t ODR/)
  assert.ok(h1.facts.some((f) => f.includes('Адрес регистра: 0x40000804')))
  assert.match(h1.doc ?? '', /output data/)
  const h2 = hover(ix, req('C:/proj/src/main.c', MAIN_C, 'GPIOA->', 2))!
  assert.ok(h2.facts.some((f) => f.includes('GPIO_TypeDef') && f.includes('0x40000800')))
  const h3 = hover(ix, req('C:/proj/src/main.c', MAIN_C, 'GPIO_ODR_ODR5;', 3))!
  assert.ok(h3.facts.some((f) => f.includes('Значение: 0x20 (32)')))
  const h4 = hover(ix, req('C:/proj/src/main.c', MAIN_C, 'led_on(6)', 1))!
  assert.match(h4.code, /void led_on\(int pin\)/)
  assert.equal(h4.doc, 'Включить светодиод')
  assert.ok(h4.where && h4.where.own)
  assert.equal(hover(ix, { path: 'x', line: 1, col: 3, lineText: 'if (a)', before: '' }), null, 'ключевое слово')
})

test('queries: signature help и переход к определению', async () => {
  const { ix } = await build()
  const s = signature(ix, 'int main(void){ led_on(')!
  assert.equal(s.signatures[0].label, 'void led_on(int pin)')
  assert.deepEqual(s.signatures[0].params, ['int pin'])
  assert.equal(signature(ix, 'if (')?.signatures, undefined)
  // F12 по led_on в main — определение в main.c (с телом), а не прототип из my.h
  const d = definitions(ix, req('C:/proj/src/main.c', MAIN_C, 'led_on(6)', 1))
  assert.equal(d[0].path, 'C:/proj/src/main.c')
  assert.equal(d[0].line, 5)
  assert.equal(d[1].path, 'C:/proj/include/my.h')
  // GPIOA → заголовок устройства
  const g = definitions(ix, req('C:/proj/src/main.c', MAIN_C, 'GPIOA->', 2))
  assert.ok(g[0].path.endsWith('dev.h') && !g[0].own)
  // поле ODR
  const f = definitions(ix, req('C:/proj/src/main.c', MAIN_C, 'ODR |=', 1))
  assert.equal(f[0].kind, 'field')
  // #include "my.h"
  const inc = definitions(ix, req('C:/proj/src/main.c', MAIN_C, '"my.h"', 2))
  assert.equal(inc[0].path, 'C:/proj/include/my.h')
})

test('queries: ссылки — только свои файлы, границы слов, без комментариев и строк', async () => {
  const { ix } = await build()
  const r = await references(ix, req('C:/proj/src/main.c', MAIN_C, 'led_on(6)', 1), textSource(ix))
  assert.ok(!('error' in r))
  if ('error' in r) return
  const places = r.refs.map((m) => `${m.path.split('/').pop()}:${m.line}`)
  assert.deepEqual([...places].sort(), ['main.c:10', 'main.c:15', 'main.c:5', 'my.h:3', 'other.c:3'])
  assert.ok(!places.includes('main.c:16') && !places.includes('main.c:17'), 'комментарий и строка не считаются')
  assert.equal(findWord('a led_on b led_on_x led_onx', 'led_on').length, 1)
})

test('queries: переименование — статическая функция только в своём файле, план с подсчётом, проверки имени', async () => {
  const { ix } = await build()
  const p = await renamePlan(ix, req('C:/proj/src/main.c', MAIN_C, 'helper();', 1), 'blink_helper', textSource(ix))
  assert.ok(p.ok)
  if (!p.ok) return
  assert.equal(p.files.length, 1, 'static helper есть и в other.c, но это другая функция')
  assert.equal(p.files[0].path, 'C:/proj/src/main.c')
  assert.equal(p.files[0].count, 2)
  assert.match(p.files[0].newText, /static void blink_helper\(void\)/)
  assert.ok(!/\bhelper\b/.test(p.files[0].newText.replace(/blink_helper/g, '')))
  const g = await renamePlan(ix, req('C:/proj/src/main.c', MAIN_C, 'led_on(6)', 1), 'led_set', textSource(ix))
  assert.ok(g.ok && g.files.length === 3, 'глобальная функция — во всех файлах (main.c, other.c, my.h)')
  const bad = await renamePlan(ix, req('C:/proj/src/main.c', MAIN_C, 'led_on(6)', 1), '1abc', textSource(ix))
  assert.ok(!bad.ok)
  const kw = await renamePlan(ix, req('C:/proj/src/main.c', MAIN_C, 'led_on(6)', 1), 'while', textSource(ix))
  assert.ok(!kw.ok)
  const clash = await renamePlan(ix, req('C:/proj/src/main.c', MAIN_C, 'led_on(6)', 1), 'GPIO_MODER_X', textSource(ix))
  assert.ok(!clash.ok, 'имя занято макросом')
  const vendor = await renamePlan(ix, req('C:/proj/src/main.c', MAIN_C, 'GPIOA->', 2), 'PORTA', textSource(ix))
  assert.ok(!vendor.ok && /стороннем/.test(vendor.error))
})

// ---- настоящий CMSIS из кэша пакетов поддержки (если есть): проект как у мастера ----

const SUP = process.env['AVRIDE_CMSIS_DIR']

test('реальный проект F103: включения, SysTick_Config, повторный запуск из кэша быстрее секунды', async (t) => {
  if (!SUP || !existsSync(join(SUP, 'cmsis-device-f1@v4.3.5'))) { t.skip('нет AVRIDE_CMSIS_DIR'); return }
  const realFs: BuildFs = {
    async stat(p) { try { const s = statSync(p); return { mtime: s.mtimeMs, size: s.size } } catch { return null } },
    async read(p) { return readFileSync(p, 'utf8') },
    async list(d) { return readdirSync(d, { withFileTypes: true }).map((e) => ({ name: e.name, dir: e.isDirectory() })) }
  }
  const root = (process.env['TEMP'] ?? '.').replace(/\\/g, '/') + '/avride-sym-test'
  const extra = [join(SUP, 'cmsis-device-f1@v4.3.5', 'Include').replace(/\\/g, '/'), join(SUP, 'cmsis_core@v5.6.0_cm3', 'Core', 'Include').replace(/\\/g, '/')]
  const { mkdirSync, writeFileSync } = await import('node:fs')
  mkdirSync(root + '/src', { recursive: true })
  writeFileSync(root + '/src/main.c', '#include "stm32f1xx.h"\nint main(void)\n{\n  SysTick_Config(8000);\n  GPIOC->CRH = 0;\n}\n')
  const a = await buildIndex({ root, sources: ['src'], includes: [], defines: ['STM32F103xB'], extraIncludeDirs: extra, fs: realFs })
  const ix = new ProjectIndex()
  ix.build(a.files)
  assert.equal(ix.lookup('SysTick_Config').length, 1, 'ветка #if (__Vendor_SysTickConfig == 0U) из другого файла учтена')
  assert.equal(ix.instanceAddress('GPIOC'), 0x40011000n)
  assert.ok(ix.lookup('__enable_irq').length >= 1)
  const t0 = Date.now()
  const b = await buildIndex({ root, sources: ['src'], includes: [], defines: ['STM32F103xB'], extraIncludeDirs: extra, fs: realFs, cache: JSON.parse(JSON.stringify(a.cache)) })
  assert.ok(Date.now() - t0 < 1000)
  assert.ok(b.stats.parsed <= 3, `из кэша, перечитано ${b.stats.parsed}`)
  console.log(`# F103: первичная ${a.stats.ms} мс (${a.stats.symbols} символов, ${a.stats.files} файлов), из кэша ${b.stats.ms} мс`)
})
