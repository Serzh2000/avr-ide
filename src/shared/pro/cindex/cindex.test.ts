// Индекс символов C/C++: разбор препроцессора и объявлений, члены структур, значения макросов, адреса периферии, контекст дополнения.
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { evalCondition, evalConst, formatValue } from './expr'
import { cleanDoc, parseAsm, parseSource } from './parse'
import { ProjectIndex } from './projectIndex'
import type { IndexFile } from './projectIndex'
import { callContext, completionContext, cursorState, maskCode, wordContext } from './context'

const FIXTURE = `/**
  * @file    mini.h
  */
#ifndef __MINI_H
#define __MINI_H

#ifdef __cplusplus
 extern "C" {
#endif

#if !defined (MINI_F1) && !defined (MINI_F4)
  #define MINI_F4  /*!< default */
#endif

/* ------- Peripheral memory map ------- */
#define PERIPH_BASE           0x40000000UL /*!< Peripheral base address */
#define APB2PERIPH_BASE       (PERIPH_BASE + 0x00010000UL)
#define AHB1PERIPH_BASE       (PERIPH_BASE + 0x00020000UL)
#define GPIOA_BASE            (APB2PERIPH_BASE + 0x0800UL)
#define GPIOC_BASE            (APB2PERIPH_BASE + 0x1000UL)
#define RCC_BASE              (AHB1PERIPH_BASE + 0x1000UL)

#define __IO volatile
typedef unsigned int uint32_t;
typedef unsigned short uint16_t;

/** General Purpose I/O */
typedef struct
{
  __IO uint32_t CRL;   /*!< GPIO port configuration register low,      Address offset: 0x00 */
  __IO uint32_t CRH;   /*!< GPIO port configuration register high,     Address offset: 0x04 */
  __IO uint32_t IDR;
  __IO uint32_t ODR;
  __IO uint32_t BSRR;
  __IO uint32_t BRR;
  __IO uint32_t LCKR;
} GPIO_TypeDef;

typedef struct
{
  __IO uint32_t CR;
  uint32_t RESERVED0[3];
  __IO uint32_t APB2ENR;
  __IO uint16_t HALF;
  uint16_t RESERVED1;
  __IO uint32_t TAIL;
} RCC_TypeDef;

#define GPIOA  ((GPIO_TypeDef *) GPIOA_BASE)
#define GPIOC  ((GPIO_TypeDef *) GPIOC_BASE)
#define RCC    ((RCC_TypeDef *) RCC_BASE)

#define RCC_APB2ENR_IOPAEN_Pos  (2U)
#define RCC_APB2ENR_IOPAEN_Msk  (0x1UL << RCC_APB2ENR_IOPAEN_Pos)  /*!< 0x00000004 */
#define RCC_APB2ENR_IOPAEN      RCC_APB2ENR_IOPAEN_Msk             /*!< I/O port A clock enable */

typedef enum
{
  Reset = 0,
  Set = !Reset
} FlagStatus;

typedef enum IRQn
{
  NonMaskableInt_IRQn = -14,  /*!< 2 Non Maskable Interrupt */
  SysTick_IRQn        = -1,
  WWDG_IRQn           = 0
} IRQn_Type;

typedef union
{
  struct
  {
    uint32_t _reserved0:27;
    uint32_t Q:1;
    uint32_t N:1;
  } b;
  uint32_t w;
} APSR_Type;

typedef void (*Callback_t)(uint32_t arg);

extern uint32_t SystemCoreClock;   /*!< System Clock Frequency (Core Clock) */
static volatile uint32_t tick, tock;

/**
  * @brief  Setup the microcontroller system.
  * @param  None
  * @retval None
  */
extern void SystemInit(void);
uint32_t HAL_GetTick(void);

static inline uint32_t get_value(const uint32_t *ptr, uint32_t n)
{
  uint32_t i = 0;
  while (i < n) { i++; }
  return *ptr + i;
}

#if defined(MINI_F1)
  #define ONLY_F1 1
  void f1_only(void);
#elif defined(MINI_F4)
  #define ONLY_F4 4
  void f4_only(void);
#else
  #define NEITHER 0
#endif

#ifdef __cplusplus
}
#endif
#endif
`

function ix(text: string, defines: string[] = []): ProjectIndex {
  const f: IndexFile = { path: 'C:/p/mini.h', own: false, idx: parseSource(text, { defines }) }
  const i = new ProjectIndex()
  i.build([f])
  return i
}

test('expr: значения макросов, приведения типов и условия', () => {
  const m: Record<string, string> = { A: '0x10UL', B: '(A << 2)', C: '((uint32_t)0x40000000 + 0x100)' }
  const look = (n: string): string | undefined => m[n]
  assert.equal(evalConst('B | 1', look), 0x41n)
  assert.equal(evalConst('C', look), 0x40000100n)
  assert.equal(evalConst('UNKNOWN', look), undefined)
  assert.equal(evalConst('1U << 31', look), 0x80000000n)
  assert.equal(evalCondition('defined(A) && !defined(Z)', look), true)
  assert.equal(evalCondition('(UNKNOWN == 4) || 0', look), false)
  assert.equal(evalCondition('A >= 16 ? 1 : 0', look), true)
  assert.equal(formatValue(4n), '4')
  assert.equal(formatValue(0x40021000n), '0x40021000 (1073876992)')
})

test('parse: макросы со значениями, doc-комментарии и охранники', () => {
  const idx = parseSource(FIXTURE, { defines: [] })
  const get = (n: string) => idx.syms.find((s) => s.n === n)!
  assert.equal(get('PERIPH_BASE').v, '0x40000000UL')
  assert.match(get('PERIPH_BASE').d ?? '', /Peripheral base address/)
  assert.match(get('RCC_APB2ENR_IOPAEN').d ?? '', /I\/O port A clock enable/)
  assert.equal(get('RCC_APB2ENR_IOPAEN_Msk').v, '(0x1UL << RCC_APB2ENR_IOPAEN_Pos)')
  assert.equal(get('RCC_APB2ENR_IOPAEN_Pos').l, 53)
  assert.equal(get('PERIPH_BASE').c, 9)
  assert.ok(idx.syms.some((s) => s.n === '__MINI_H'))
})

test('parse: #if/#elif/#else по define проекта и по умолчанию внутри файла', () => {
  const none = parseSource(FIXTURE, { defines: [] })
  assert.ok(none.syms.some((s) => s.n === 'MINI_F4'), 'ветка по умолчанию задала MINI_F4')
  assert.ok(none.syms.some((s) => s.n === 'f4_only'))
  assert.ok(!none.syms.some((s) => s.n === 'f1_only'))
  assert.ok(!none.syms.some((s) => s.n === 'NEITHER'))
  const f1 = parseSource(FIXTURE, { defines: ['MINI_F1'] })
  assert.ok(f1.syms.some((s) => s.n === 'f1_only'))
  assert.ok(!f1.syms.some((s) => s.n === 'f4_only'))
  assert.ok(f1.syms.some((s) => s.n === 'ONLY_F1'))
  assert.ok(!f1.syms.some((s) => s.n === 'MINI_F4'), 'при MINI_F1 макрос по умолчанию не задаётся')
})

test('parse: структуры, поля с doc, массивы, битовые поля, enum, union, указатели на функции', () => {
  const idx = ix(FIXTURE)
  const gpio = idx.membersOf('GPIO_TypeDef')
  assert.deepEqual(gpio.map((m) => m.n), ['CRL', 'CRH', 'IDR', 'ODR', 'BSRR', 'BRR', 'LCKR'])
  assert.equal(gpio[0].t, 'uint32_t')
  assert.match(gpio[0].d ?? '', /GPIO port configuration register low/)
  const rcc = idx.membersOf('RCC_TypeDef')
  assert.equal(rcc.find((m) => m.n === 'RESERVED0')!.arr, '3')
  assert.equal(idx.membersOf('FlagStatus').map((m) => m.n).join(), 'Reset,Set')
  assert.equal(idx.lookup('SysTick_IRQn')[0].v, '-1')
  assert.equal(idx.lookup('SysTick_IRQn')[0].p, 'IRQn_Type')
  assert.equal(idx.resolveType('IRQn'), 'IRQn_Type', 'тег ведёт к typedef-имени')
  const apsr = idx.membersOf('APSR_Type')
  assert.ok(apsr.some((m) => m.n === 'w'))
  assert.equal(apsr.find((m) => m.n === 'b')!.t, 'APSR_Type::<anon1>')
  assert.deepEqual(idx.membersOf('APSR_Type::<anon1>').map((m) => m.n), ['_reserved0', 'Q', 'N'])
  assert.equal(idx.membersOf('APSR_Type::<anon1>')[0].bits, 27)
  const cb = idx.lookup('Callback_t')[0]
  assert.equal(cb.k, 'typedef')
})

test('parse: функции, переменные, extern "C", prototypes и static inline', () => {
  const idx = ix(FIXTURE)
  const fn = idx.lookup('get_value')[0]
  assert.equal(fn.k, 'function')
  assert.equal(fn.b, 1)
  assert.equal(fn.st, 1)
  assert.deepEqual(fn.a, ['const uint32_t *ptr', 'uint32_t n'])
  assert.equal(fn.s, 'uint32_t get_value(const uint32_t *ptr, uint32_t n)')
  const proto = idx.lookup('SystemInit')[0]
  assert.equal(proto.b, undefined)
  assert.match(proto.d ?? '', /Setup the microcontroller system/)
  assert.equal(idx.lookup('HAL_GetTick')[0].r, 'uint32_t')
  const core = idx.lookup('SystemCoreClock')[0]
  assert.equal(core.k, 'variable')
  assert.match(core.d ?? '', /Core Clock/)
  assert.ok(idx.lookup('tick').length === 1 && idx.lookup('tock').length === 1, 'несколько объявителей через запятую')
})

test('index: периферия, адреса, смещения регистров, значения масок', () => {
  const idx = ix(FIXTURE)
  assert.equal(idx.instance('GPIOA')?.type, 'GPIO_TypeDef')
  assert.equal(idx.instanceAddress('GPIOA'), 0x40010800n)
  assert.equal(idx.instanceAddress('GPIOC'), 0x40011000n)
  assert.equal(idx.instanceAddress('RCC'), 0x40021000n)
  assert.equal(idx.fieldOffset('GPIO_TypeDef', 'ODR'), 12)
  assert.equal(idx.fieldOffset('GPIO_TypeDef', 'LCKR'), 24)
  // RCC: CR(0) RESERVED0[3](4..15) APB2ENR(16) HALF(20) RESERVED1(22) TAIL(24)
  assert.equal(idx.fieldOffset('RCC_TypeDef', 'APB2ENR'), 16)
  assert.equal(idx.fieldOffset('RCC_TypeDef', 'HALF'), 20)
  assert.equal(idx.fieldOffset('RCC_TypeDef', 'TAIL'), 24)
  assert.equal(idx.layout('RCC_TypeDef')?.size, 28)
  assert.equal(idx.macroValue('RCC_APB2ENR_IOPAEN'), 4n)
  assert.equal(idx.describeMacro('RCC_APB2ENR_IOPAEN'), '4')
  assert.equal(idx.layout('APSR_Type'), undefined, 'с битовыми полями раскладка не считается')
})

test('index: тип выражения по цепочке, локальные переменные, дополнение и биты регистра', () => {
  const idx = ix(FIXTURE)
  assert.equal(idx.chainType(['GPIOA'], ''), 'GPIO_TypeDef')
  assert.equal(idx.chainType(['g'], 'void f(void) { GPIO_TypeDef *g = GPIOC;\n'), 'GPIO_TypeDef')
  assert.equal(idx.chainType(['unknown'], ''), undefined)
  const labels = idx.complete('RCC_APB', 10).map((c) => c.sym.n)
  assert.ok(labels.includes('RCC_APB2ENR_IOPAEN'))
  assert.deepEqual(idx.bitMacros('RCC_TypeDef', 'APB2ENR', 5).map((s) => s.n), ['RCC_APB2ENR_IOPAEN', 'RCC_APB2ENR_IOPAEN_Msk', 'RCC_APB2ENR_IOPAEN_Pos'])
  assert.ok(idx.search('gpioc', 5).some((s) => s.n === 'GPIOC'))
  assert.equal(idx.best('SystemInit')?.k, 'function')
})

test('context: после -> и ., в комментариях и строках, include, биты регистра', () => {
  const c1 = completionContext('int main(void) {\n  GPIOA->')
  assert.deepEqual(c1, { kind: 'member', chain: ['GPIOA'], op: '->', prefix: '' })
  const c2 = completionContext('x = hdr.sub->OD')
  assert.deepEqual(c2, { kind: 'member', chain: ['hdr', 'sub'], op: '->', prefix: 'OD' })
  assert.equal(completionContext('/* GPIOA-> ').kind, 'none')
  assert.equal(completionContext('// RCC->').kind, 'none')
  assert.equal(completionContext('printf("a->').kind, 'none')
  assert.deepEqual(completionContext('#include "stm'), { kind: 'include', quote: '"', prefix: 'stm' })
  const c3 = completionContext('{\n RCC->APB2ENR |= RCC_APB2')
  assert.equal(c3.kind, 'plain')
  assert.deepEqual((c3 as { reg?: unknown }).reg, { chain: ['RCC'], reg: 'APB2ENR' })
  assert.equal((c3 as { prefix: string }).prefix, 'RCC_APB2')
  assert.equal((completionContext('int x = 1.') as { kind: string }).kind, 'plain')
  assert.equal(cursorState('a /* x'), 'comment')
  assert.equal(cursorState('a "x'), 'string')
  assert.equal(cursorState('a "x" /* y */ b'), 'code')
  assert.equal(maskCode('a "bc" /* d */ e // f').trim(), 'a "  "' + ' '.repeat(9) + 'e')
})

test('context: слово под курсором и вызов функции', () => {
  assert.deepEqual(wordContext('  GPIOA->ODR |= 1;', 11), { word: 'ODR', start: 9, end: 12, chain: ['GPIOA'] })
  assert.deepEqual(wordContext('  foo(1)', 3), { word: 'foo', start: 2, end: 5 })
  assert.equal(wordContext('  12 ', 3), null)
  assert.deepEqual(callContext('x = f(1, g(2), '), { name: 'f', arg: 2 })
  assert.deepEqual(callContext('if (a ||'), null)
  assert.deepEqual(callContext('HAL_Delay('), { name: 'HAL_Delay', arg: 0 })
})

test('parse: ассемблер (метки, .equ) и очистка doc-комментариев', () => {
  const a = parseAsm('  .syntax unified\n.global Reset_Handler\nReset_Handler:\n  ldr r0, =_estack @ stack\nDefault_Handler:\nInfinite_Loop:\n  b Infinite_Loop\n.equ BOOT, 0x20\n')
  assert.deepEqual(a.syms.filter((s) => s.k === 'label').map((s) => s.n), ['Reset_Handler', 'Default_Handler', 'Infinite_Loop'])
  assert.equal(a.syms.find((s) => s.n === 'BOOT')?.v, '0x20')
  assert.equal(cleanDoc('*****\n * @brief Hello\n * world \n *****'), 'Hello\nworld')
  assert.equal(cleanDoc('!< Port mode register'), 'Port mode register')
})

test('replaceFile: перечитывание одного файла обновляет индекс', () => {
  const i = ix(FIXTURE)
  i.replaceFile(0, parseSource(FIXTURE.replace('HAL_GetTick', 'HAL_Tick2')))
  assert.equal(i.lookup('HAL_GetTick').length, 0)
  assert.equal(i.lookup('HAL_Tick2').length, 1)
  assert.equal(i.membersOf('GPIO_TypeDef').length, 7)
})

// ---- реальные заголовки CMSIS (если есть в кэше пакетов поддержки) ----

function cmsisDir(): string | null {
  const cands = [process.env['AVRIDE_CMSIS_DIR'], process.env['AVRIDE_PRO_DIR'] && join(process.env['AVRIDE_PRO_DIR'], 'pro', 'support'), process.env['APPDATA'] && join(process.env['APPDATA'], 'avr-ide', 'pro', 'support')]
  for (const c of cands) if (c && existsSync(c)) return c
  return null
}

const REAL: [string, string, string, number, bigint, bigint, number][] = [
  // файл, define, периферия, число GPIO-регистров, адрес GPIOC, адрес RCC, смещение ODR
  ['cmsis-device-f1@v4.3.5/Include/stm32f103xb.h', 'STM32F103xB', 'GPIO_TypeDef', 7, 0x40011000n, 0x40021000n, 12],
  ['cmsis-device-f4@v2.6.12/Include/stm32f411xe.h', 'STM32F411xE', 'GPIO_TypeDef', 9, 0x40020800n, 0x40023800n, 20],
  ['cmsis-device-g4@v1.2.6/Include/stm32g474xx.h', 'STM32G474xx', 'GPIO_TypeDef', 10, 0x48000800n, 0x40021000n, 20]
]

for (const [file, define, type, nregs, gpioc, rcc, odr] of REAL) {
  test(`реальный CMSIS ${file.split('/').pop()}: периферия, поля, макросы, скорость`, (t) => {
    const dir = cmsisDir()
    const path = dir && join(dir, file)
    if (!path || !existsSync(path)) { t.skip('нет кэша CMSIS (AVRIDE_CMSIS_DIR)'); return }
    const text = readFileSync(path, 'utf8')
    const t0 = performance.now()
    const idx = parseSource(text, { defines: [define] })
    const ms = performance.now() - t0
    assert.ok(ms < 2000, `разбор занял ${ms.toFixed(0)} мс`)
    const pi = new ProjectIndex()
    pi.build([{ path: 'C:/p/' + file.split('/').pop(), own: false, idx }])
    assert.equal(pi.membersOf(type).filter((m) => m.k === 'field').length, nregs)
    assert.equal(pi.instanceAddress('GPIOC'), gpioc)
    assert.equal(pi.instanceAddress('RCC'), rcc)
    assert.equal(pi.fieldOffset(type, 'ODR'), odr)
    assert.ok(pi.lookup('GPIO_ODR_ODR13').length + pi.lookup('GPIO_ODR_OD13').length > 0)
    assert.ok(pi.lookup('IRQn_Type').some((s) => s.k === 'enum'))
    assert.ok(pi.symbolCount > 5000)
  })
}
