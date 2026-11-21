// Генератор кода на регистрах CMSIS (без HAL): gpio, clock, uart, board (SysTick) для семейств F1, F4, G4.
// Имена регистров и битов — из заголовков CMSIS устройства; результат проверяется компиляцией (юнит-тест и сборка проекта).
import type { ChipRecord } from '../../chipdb'
import { clockProfile, computeClock, usartBrr } from '../clock'
import type { ClockResult } from '../clock'
import type { GenNote } from './support'
import { genFamily, usartInfo } from './support'
import { banner, familyHeader } from './common'
import type { GenFile } from './common'
import { planPins } from './pins'
import type { PinPlan } from './pins'
import type { PinsConfig } from '../types'

export interface GenOptions { srcDir: string; incDir: string }
export interface GenOutput { files: GenFile[]; notes: GenNote[] }

const U = (n: number): string => `${n}u`
const MHZ_TEXT = (hz: number): string => `${+(hz / 1e6).toFixed(3)} МГц`

// ---------- gpio ----------

const SPEED_IDX = { low: 0, medium: 1, high: 2, veryhigh: 3 } as const
const PULL_IDX = { none: 0, up: 1, down: 2 } as const
/** F1: поле MODE для выходов: 2 МГц = 2, 10 МГц = 1, 50 МГц = 3 */
const F1_MODE = { low: 2, medium: 1, high: 3, veryhigh: 3 } as const

/** F1: четыре бита CNF:MODE для вывода. */
function f1Bits(p: PinPlan): { bits: number; odr?: 'set' | 'reset'; text: string } {
  const mode = F1_MODE[p.speed]
  if (p.mode === 'analog') return { bits: 0x0, text: 'аналоговый режим' }
  if (p.mode === 'out') return { bits: (p.otype === 'od' ? 0x4 : 0x0) | mode, text: `выход ${p.otype === 'od' ? 'с открытым стоком' : 'двухтактный'}, скорость ${p.speed === 'low' ? '2' : p.speed === 'medium' ? '10' : '50'} МГц` }
  if (p.mode === 'in' || p.dir === 'in') {
    if (p.pull === 'none') return { bits: 0x4, text: 'вход без подтяжки (floating)' }
    return { bits: 0x8, odr: p.pull === 'up' ? 'set' : 'reset', text: p.pull === 'up' ? 'вход с подтяжкой к питанию' : 'вход с подтяжкой к земле' }
  }
  return { bits: (p.dir === 'od' ? 0xc : 0x8) | mode, text: `альтернативная функция, ${p.dir === 'od' ? 'открытый сток' : 'двухтактный'}, ${p.speed === 'low' ? '2' : p.speed === 'medium' ? '10' : '50'} МГц` }
}

export function genGpio(cfg: PinsConfig, chip: ChipRecord, opts: GenOptions): { files: GenFile[]; notes: GenNote[] } {
  const plan = planPins(cfg, chip)
  const fam = plan.fam
  const hdr = familyHeader(chip)
  const notes = [...plan.notes]
  // gpio.h
  const macros: string[] = []
  for (const p of plan.pins) {
    const id = p.label
    if (!id) continue
    macros.push(`/* ${p.pin}: ${p.signal ?? p.note} */`, `#define ${id}_PORT  GPIO${p.port}`, `#define ${id}_PIN   ${U(p.num)}`, `#define ${id}_MASK  (1u << ${U(p.num)})`)
    if (p.mode === 'out') macros.push(`#define ${id}_SET()    (${id}_PORT->BSRR = ${id}_MASK)`, `#define ${id}_RESET()  (${id}_PORT->BSRR = ${id}_MASK << 16u)`, `#define ${id}_TOGGLE() (${id}_PORT->ODR ^= ${id}_MASK)`)
    if (p.mode === 'in') macros.push(`#define ${id}_READ()   ((${id}_PORT->IDR & ${id}_MASK) != 0u)`)
  }
  const h = `${banner('gpio.h', 'cmsis')}#ifndef AVRIDE_GPIO_H
#define AVRIDE_GPIO_H

#include "${hdr}"

#ifdef __cplusplus
extern "C" {
#endif

/* Имена выводов по меткам из avride.pins.json */
${macros.length ? macros.join('\n') : '/* Меток нет: задайте метку выводу (например, LED) — здесь появятся LED_PORT, LED_PIN и LED_SET()/LED_RESET()/LED_TOGGLE(). */'}

/* USER CODE BEGIN gpio_h */
${'' /* пусто */}
/* USER CODE END gpio_h */

/** Включает тактирование портов и настраивает все выводы из avride.pins.json. */
void gpio_init(void);

#ifdef __cplusplus
}
#endif

#endif /* AVRIDE_GPIO_H */
`
  // gpio.c
  const body: string[] = []
  const enable = (): string => {
    if (fam === 'f1') return `    RCC->APB2ENR |= ${[...plan.ports.map((p) => `RCC_APB2ENR_IOP${p}EN`), ...(plan.remap && (plan.remap.fields.length || plan.jtagOff) ? ['RCC_APB2ENR_AFIOEN'] : [])].join(' | ') || '0u'};\n    (void)RCC->APB2ENR; /* дождаться включения тактирования */`
    const reg = fam === 'f4' ? 'AHB1ENR' : 'AHB2ENR'
    return `    RCC->${reg} |= ${plan.ports.map((p) => `RCC_${reg}_GPIO${p}EN`).join(' | ') || '0u'};\n    (void)RCC->${reg}; /* дождаться включения тактирования */`
  }
  body.push(enable())
  if (fam === 'f1' && plan.remap && (plan.remap.fields.length || plan.jtagOff)) {
    const masks = [...(plan.jtagOff ? ['AFIO_MAPR_SWJ_CFG_Msk'] : []), ...plan.remap.fields.map((f) => f.mask)]
    const vals = [...(plan.jtagOff ? ['AFIO_MAPR_SWJ_CFG_JTAGDISABLE'] : []), ...plan.remap.fields.map((f) => f.value)]
    const why = [...(plan.jtagOff ? ['JTAG отключён (SWD остаётся): выводы PA15, PB3, PB4 свободны'] : []), ...Object.entries(plan.remap.byPeriph).filter(([, v]) => v).map(([k, v]) => `${k}: ремап ${v}`)]
    body.push(`\n    /* ${why.join('; ')} */\n    {\n        uint32_t mapr = AFIO->MAPR;\n        mapr &= ~(${masks.join(' | ')});\n        mapr |= ${vals.join(' | ')};\n        AFIO->MAPR = mapr;\n    }`)
  }
  body.push('')
  for (const p of plan.pins) {
    const port = `GPIO${p.port}`
    const what = `${p.pin}${p.label ? ` (${p.label})` : ''}: ${p.signal ? p.signal + ' — ' : ''}`
    if (fam === 'f1') {
      const b = f1Bits(p)
      if (p.mode === 'out') body.push(`    ${port}->BSRR = ${p.initial === 'high' ? `1u << ${U(p.num)}` : `1u << ${U(p.num + 16)}`}; /* начальный уровень: ${p.initial === 'high' ? 'высокий' : 'низкий'} */`)
      if (b.odr) body.push(`    ${port}->BSRR = ${b.odr === 'set' ? `1u << ${U(p.num)}` : `1u << ${U(p.num + 16)}`}; /* подтяжка ${b.odr === 'set' ? 'вверх' : 'вниз'} задаётся регистром ODR */`)
      body.push(`    gpio_cfg(${port}, ${U(p.num)}, 0x${b.bits.toString(16).toUpperCase()}u); /* ${what}${b.text} */`)
    } else {
      if (p.mode === 'out') body.push(`    ${port}->BSRR = ${p.initial === 'high' ? `1u << ${U(p.num)}` : `1u << ${U(p.num + 16)}`}; /* ${p.pin}: начальный уровень ${p.initial === 'high' ? 'высокий' : 'низкий'} */`)
      const mode = p.mode === 'in' ? 'PIN_IN' : p.mode === 'out' ? 'PIN_OUT' : p.mode === 'af' ? 'PIN_AF' : 'PIN_ANALOG'
      body.push(`    gpio_cfg(${port}, ${U(p.num)}, ${mode}, ${p.otype === 'od' ? 'PIN_OD' : 'PIN_PP'}, ${SPEED_IDX[p.speed]}u, ${PULL_IDX[p.pull]}u, ${U(p.af ?? 0)}); /* ${what}${p.note} */`)
    }
  }
  if (plan.pins.length === 0) body.push('    /* Выводы в avride.pins.json не настроены. */')
  const helper = fam === 'f1'
    ? `/* Четыре бита CNF:MODE вывода: 0x0 аналоговый, 0x4 вход, 0x8 вход с подтяжкой / AF двухтактный, 0xC AF с открытым стоком, 0x1–0x3 выход (скорость) */
static void gpio_cfg(GPIO_TypeDef *port, uint32_t n, uint32_t cnf_mode)
{
    volatile uint32_t *reg = (n < 8u) ? &port->CRL : &port->CRH;
    uint32_t shift = (n & 7u) * 4u;
    *reg = (*reg & ~(0xFu << shift)) | (cnf_mode << shift);
}`
    : `#define PIN_IN     0u
#define PIN_OUT    1u
#define PIN_AF     2u
#define PIN_ANALOG 3u
#define PIN_PP     0u
#define PIN_OD     1u

/* Режим, тип выхода, скорость (0 низкая … 3 очень высокая), подтяжка (0 нет, 1 вверх, 2 вниз), номер AF */
static void gpio_cfg(GPIO_TypeDef *port, uint32_t n, uint32_t mode, uint32_t otype, uint32_t speed, uint32_t pull, uint32_t af)
{
    uint32_t afr_shift = (n & 7u) * 4u;
    port->OTYPER  = (port->OTYPER  & ~(1u << n))         | (otype << n);
    port->OSPEEDR = (port->OSPEEDR & ~(3u << (2u * n))) | (speed << (2u * n));
    port->PUPDR   = (port->PUPDR   & ~(3u << (2u * n))) | (pull  << (2u * n));
    port->AFR[n >> 3] = (port->AFR[n >> 3] & ~(0xFu << afr_shift)) | (af << afr_shift);
    port->MODER   = (port->MODER   & ~(3u << (2u * n))) | (mode  << (2u * n));
}`
  const c = `${banner('gpio.c', 'cmsis')}#include "gpio.h"

/* USER CODE BEGIN Includes_gpio */

/* USER CODE END Includes_gpio */

${helper}

void gpio_init(void)
{
    /* USER CODE BEGIN gpio_init_begin */

    /* USER CODE END gpio_init_begin */
${body.join('\n')}

    /* USER CODE BEGIN gpio_init_end */

    /* USER CODE END gpio_init_end */
}

/* USER CODE BEGIN gpio_c */

/* USER CODE END gpio_c */
`
  return { files: [{ path: `${opts.incDir}/gpio.h`, content: h }, { path: `${opts.srcDir}/gpio.c`, content: c }], notes }
}

// ---------- clock ----------

const AHB_MACRO: Record<number, string> = { 1: 'RCC_CFGR_HPRE_DIV1', 2: 'RCC_CFGR_HPRE_DIV2', 4: 'RCC_CFGR_HPRE_DIV4', 8: 'RCC_CFGR_HPRE_DIV8', 16: 'RCC_CFGR_HPRE_DIV16', 64: 'RCC_CFGR_HPRE_DIV64', 128: 'RCC_CFGR_HPRE_DIV128', 256: 'RCC_CFGR_HPRE_DIV256', 512: 'RCC_CFGR_HPRE_DIV512' }
const apbMacro = (n: 1 | 2, d: number): string => `RCC_CFGR_PPRE${n}_DIV${d}`

export function genClock(cfg: PinsConfig, chip: ChipRecord, opts: GenOptions): { files: GenFile[]; notes: GenNote[]; calc: ClockResult } {
  const prof = clockProfile(chip)
  const calc = computeClock(chip, cfg.clock)
  const notes: GenNote[] = []
  const hdr = familyHeader(chip)
  const ck = cfg.clock
  const known = prof.kind !== null
  const sys = known ? calc.sysclk : 0
  const hseUsed = ck.source === 'hse' || (ck.source === 'pll' && ck.pllSource === 'hse')
  const h = `${banner('clock.h', 'cmsis')}#ifndef AVRIDE_CLOCK_H
#define AVRIDE_CLOCK_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

${known ? `/* Частоты по настройке тактирования (расчёт AVR IDE) */
#define CLOCK_HSE_HZ     ${hseUsed ? `${Math.round(ck.hseHz)}u` : '0u /* HSE не используется */'}
#define CLOCK_SYSCLK_HZ  ${Math.round(calc.sysclk)}u
#define CLOCK_HCLK_HZ    ${Math.round(calc.hclk)}u
#define CLOCK_PCLK1_HZ   ${Math.round(calc.pclk1)}u
#define CLOCK_PCLK2_HZ   ${Math.round(calc.pclk2)}u
/* Частота счёта таймеров на APB1 и APB2 (вдвое выше шины, если её делитель не 1) */
#define CLOCK_TIMCLK1_HZ ${Math.round(calc.timclk1)}u
#define CLOCK_TIMCLK2_HZ ${Math.round(calc.timclk2)}u` : '/* Для этого семейства тактирование пока вручную: частоты не рассчитываются. */'}

/* USER CODE BEGIN clock_h */

/* USER CODE END clock_h */

/** Настраивает источник тактирования, PLL, делители шин и wait states Flash. 0 — успех, -1 — генератор не запустился (остаётся HSI). */
int clock_init(void);

#ifdef __cplusplus
}
#endif

#endif /* AVRIDE_CLOCK_H */
`
  if (!known) {
    notes.push({ severity: 'warning', text: prof.note ?? 'Тактирование для этого семейства пока вручную: clock_init() пустая.' })
    const c = `${banner('clock.c', 'cmsis')}#include "clock.h"

/* Генерация тактирования для этого семейства не поддерживается: ядро работает на частоте после сброса. Настройте её в блоке ниже. */
int clock_init(void)
{
    /* USER CODE BEGIN clock_init_manual */

    /* USER CODE END clock_init_manual */
    return 0;
}
`
    return { files: [{ path: `${opts.incDir}/clock.h`, content: h }, { path: `${opts.srcDir}/clock.c`, content: c }], notes, calc }
  }
  if (ck.source === 'pll' && !prof.pllAuto) notes.push({ severity: 'warning', text: prof.note ?? 'PLL для этого чипа пока вручную.' })
  const kind = prof.kind!
  const lat = calc.latency ?? 0
  const lines: string[] = []
  const wait = (cond: string, what: string): string => `    for (t = CLOCK_TIMEOUT; t != 0u && ${cond}; t--) { }\n    if (t == 0u) { ${what}; }`
  const hpre = AHB_MACRO[ck.ahbDiv]
  const ppre = `${apbMacro(1, ck.apb1Div)} | ${apbMacro(2, ck.apb2Div)}`
  const latBits = kind === 'f1' ? `FLASH_ACR_PRFTBE | ${U(lat)}` : `FLASH_ACR_ICEN | FLASH_ACR_DCEN | FLASH_ACR_PRFTEN | ${U(lat)}`
  const flashMask = 'FLASH_ACR_LATENCY_Msk'
  const failHse = 'return -1' // HSE не запустился — остаёмся на HSI
  if (kind === 'g4' && ck.source === 'pll') {
    lines.push(`    /* Режим boost регулятора (как в примере STM32Cube NUCLEO-G474RE): нужен для частот выше 150 МГц */\n    RCC->APB1ENR1 |= RCC_APB1ENR1_PWREN;\n    (void)RCC->APB1ENR1;\n    PWR->CR5 &= ~PWR_CR5_R1MODE;\n`)
  }
  if (kind === 'f4' && ck.source === 'pll') {
    lines.push(`    /* Масштаб напряжения 1 (значение по умолчанию после сброса; так делает пример STM32Cube) */\n    RCC->APB1ENR |= RCC_APB1ENR_PWREN;\n    (void)RCC->APB1ENR;\n    PWR->CR |= PWR_CR_VOS;\n`)
  }
  // вернуться на HSI и остановить PLL (повторный вызов безопасен)
  lines.push(`    /* Вернуться на HSI и остановить PLL: настройка PLL возможна только при выключенном PLL */\n    RCC->CR |= RCC_CR_HSION;\n${wait('(RCC->CR & RCC_CR_HSIRDY) == 0u', failHse)}\n    RCC->CFGR &= ~RCC_CFGR_SW;\n${wait('(RCC->CFGR & RCC_CFGR_SWS) != 0u', failHse)}\n    RCC->CR &= ~RCC_CR_PLLON;\n${wait('(RCC->CR & RCC_CR_PLLRDY) != 0u', failHse)}`)
  if (hseUsed) {
    lines.push(`\n    /* Внешний генератор HSE ${MHZ_TEXT(ck.hseHz)}${ck.hseBypass ? ' (внешний сигнал, без кварца)' : ''} */\n    ${ck.hseBypass ? 'RCC->CR |= RCC_CR_HSEBYP;\n    ' : 'RCC->CR &= ~RCC_CR_HSEBYP;\n    '}RCC->CR |= RCC_CR_HSEON;\n${wait('(RCC->CR & RCC_CR_HSERDY) == 0u', failHse)}`)
  }
  lines.push(`\n    /* Wait states Flash (${lat}) до повышения частоты${kind === 'f4' ? ': 30 МГц на такт ожидания при питании 3,3 В' : ''} */\n    FLASH->ACR = (FLASH->ACR & ~${flashMask}) | ${latBits};`)
  // делители шин
  const g4Inter = kind === 'g4' && ck.source === 'pll' && sys > 80e6 && ck.ahbDiv === 1
  lines.push(`\n    /* Делители шин: AHB /${ck.ahbDiv}, APB1 /${ck.apb1Div}, APB2 /${ck.apb2Div} */\n    RCC->CFGR = (RCC->CFGR & ~(RCC_CFGR_HPRE | RCC_CFGR_PPRE1 | RCC_CFGR_PPRE2)) | ${g4Inter ? 'RCC_CFGR_HPRE_DIV2' : hpre} | ${ppre};`)
  if (ck.source === 'pll') {
    const p = ck.pll
    if (kind === 'f1') {
      const src = ck.pllSource === 'hse' ? ` | RCC_CFGR_PLLSRC${p.hseDiv2 ? ' | RCC_CFGR_PLLXTPRE' : ''}` : ''
      lines.push(`\n    /* PLL: ${ck.pllSource === 'hse' ? `HSE${p.hseDiv2 ? ' / 2' : ''}` : 'HSI / 2'} × ${p.mul} = ${MHZ_TEXT(sys)} */\n    RCC->CFGR = (RCC->CFGR & ~(RCC_CFGR_PLLSRC | RCC_CFGR_PLLXTPRE | RCC_CFGR_PLLMULL)) | ((${p.mul}u - 2u) << RCC_CFGR_PLLMULL_Pos)${src};`)
    } else if (kind === 'f4') {
      lines.push(`\n    /* PLL: (${ck.pllSource === 'hse' ? 'HSE' : 'HSI'} / M=${p.m}) × N=${p.n} = ${MHZ_TEXT(calc.pllVco ?? 0)}; SYSCLK = / P=${p.p} = ${MHZ_TEXT(sys)}; Q=${p.q} → ${MHZ_TEXT(calc.pllQ ?? 0)} (USB, SDIO, RNG) */\n    RCC->PLLCFGR = (${p.m}u << RCC_PLLCFGR_PLLM_Pos) | (${p.n}u << RCC_PLLCFGR_PLLN_Pos) | (${((p.p ?? 2) / 2) - 1}u << RCC_PLLCFGR_PLLP_Pos) | (${p.q ?? 2}u << RCC_PLLCFGR_PLLQ_Pos)${ck.pllSource === 'hse' ? ' | RCC_PLLCFGR_PLLSRC_HSE' : ''};`)
    } else {
      lines.push(`\n    /* PLL: (${ck.pllSource === 'hse' ? 'HSE' : 'HSI'} / M=${p.m}) × N=${p.n} = ${MHZ_TEXT(calc.pllVco ?? 0)}; SYSCLK = / R=${p.r} = ${MHZ_TEXT(sys)} */\n    RCC->PLLCFGR = ((${p.m}u - 1u) << RCC_PLLCFGR_PLLM_Pos) | (${p.n}u << RCC_PLLCFGR_PLLN_Pos) | (${((p.r ?? 2) / 2) - 1}u << RCC_PLLCFGR_PLLR_Pos) | RCC_PLLCFGR_PLLREN | ${ck.pllSource === 'hse' ? 'RCC_PLLCFGR_PLLSRC_HSE' : 'RCC_PLLCFGR_PLLSRC_HSI'};`)
    }
    lines.push(`    RCC->CR |= RCC_CR_PLLON;\n${wait('(RCC->CR & RCC_CR_PLLRDY) == 0u', failHse)}`)
    lines.push(`\n    RCC->CFGR = (RCC->CFGR & ~RCC_CFGR_SW) | RCC_CFGR_SW_PLL;\n${wait('(RCC->CFGR & RCC_CFGR_SWS) != RCC_CFGR_SWS_PLL', failHse)}`)
    if (g4Inter) lines.push(`    /* Промежуточный делитель AHB /2 выше 80 МГц снят (так делает HAL) */\n    RCC->CFGR = (RCC->CFGR & ~RCC_CFGR_HPRE) | ${hpre};`)
  } else if (ck.source === 'hse') {
    lines.push(`\n    RCC->CFGR = (RCC->CFGR & ~RCC_CFGR_SW) | RCC_CFGR_SW_HSE;\n${wait('(RCC->CFGR & RCC_CFGR_SWS) != RCC_CFGR_SWS_HSE', failHse)}`)
  }
  const c = `${banner('clock.c', 'cmsis')}#include "${hdr}"
#include "clock.h"

/* USER CODE BEGIN Includes_clock */

/* USER CODE END Includes_clock */

/* Предельное число проверок готовности генератора и PLL */
#define CLOCK_TIMEOUT 0x20000u

/* Источник SYSCLK: ${ck.source === 'pll' ? 'PLL' : ck.source === 'hse' ? 'HSE' : 'HSI'}; SYSCLK ${MHZ_TEXT(sys)}, HCLK ${MHZ_TEXT(calc.hclk)}, PCLK1 ${MHZ_TEXT(calc.pclk1)}, PCLK2 ${MHZ_TEXT(calc.pclk2)} */
int clock_init(void)
{
    uint32_t t;

    /* USER CODE BEGIN clock_init_begin */

    /* USER CODE END clock_init_begin */

${lines.join('\n')}

    SystemCoreClock = CLOCK_SYSCLK_HZ;

    /* USER CODE BEGIN clock_init_end */

    /* USER CODE END clock_init_end */
    return 0;
}

/* USER CODE BEGIN clock_c */

/* USER CODE END clock_c */
`
  return { files: [{ path: `${opts.incDir}/clock.h`, content: h }, { path: `${opts.srcDir}/clock.c`, content: c }], notes, calc }
}

// ---------- uart ----------

export function genUart(cfg: PinsConfig, chip: ChipRecord, opts: GenOptions, calc: ClockResult): { files: GenFile[]; notes: GenNote[] } {
  const fam = genFamily(chip)!
  const notes: GenNote[] = []
  const hdr = familyHeader(chip)
  const items: { name: string; low: string; init: string; funcs: string; protos: string }[] = []
  for (const [name, per] of Object.entries(cfg.peripherals).sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!per.enabled || !/^USART\d$/.test(name)) continue
    const info = usartInfo(chip, name)
    if (!info) { notes.push({ severity: 'warning', text: `${name}: инициализация USART этого чипа не поддерживается генерацией.` }); continue }
    const low = name.toLowerCase()
    const hasTx = Object.keys(per.signals).some((s) => s.endsWith('_TX'))
    const hasRx = Object.keys(per.signals).some((s) => s.endsWith('_RX'))
    const tx = hasTx || (!hasTx && !hasRx)
    const rx = hasRx || (!hasTx && !hasRx)
    const baud = per.baud ?? 115200
    const fck = info.bus === 'apb1' ? calc.pclk1 : calc.pclk2
    const brr = usartBrr(fck, baud)
    if (!brr && calc.ok) notes.push({ severity: 'warning', text: `${name}: скорость ${baud} бод недостижима при частоте шины ${MHZ_TEXT(fck)}.` })
    const pclk = info.bus === 'apb1' ? 'CLOCK_PCLK1_HZ' : 'CLOCK_PCLK2_HZ'
    const flagTx = fam === 'g4' ? `${name}->ISR & USART_ISR_TXE_TXFNF` : `${name}->SR & USART_SR_TXE`
    const flagTc = fam === 'g4' ? `${name}->ISR & USART_ISR_TC` : `${name}->SR & USART_SR_TC`
    const flagRx = fam === 'g4' ? `${name}->ISR & USART_ISR_RXNE_RXFNE` : `${name}->SR & USART_SR_RXNE`
    const dataTx = fam === 'g4' ? `${name}->TDR` : `${name}->DR`
    const dataRx = fam === 'g4' ? `${name}->RDR` : `${name}->DR`
    const init = `    /* ${name}: ${baud} бод, 8 бит, без чётности, 1 стоп-бит; шина ${info.bus.toUpperCase().replace('APB', 'APB')}${fam === 'g4' ? ' (источник тактирования USART после сброса — PCLK)' : ''} */
    RCC->${info.enReg} |= ${info.enBit};
    (void)RCC->${info.enReg};
    ${name}->CR1 = 0u;
    ${name}->CR2 = 0u;
    ${name}->CR3 = 0u;
    ${name}->BRR = (${pclk} + (${baud}u - 1u) / 2u) / ${baud}u;${brr ? ` /* = ${brr.brr}, фактическая скорость ${Math.round(brr.actualBaud)} бод (ошибка ${brr.errorPct.toFixed(2)} %) */` : ''}
    ${name}->CR1 = ${[tx ? 'USART_CR1_TE' : '', rx ? 'USART_CR1_RE' : '', 'USART_CR1_UE'].filter(Boolean).join(' | ')};`
    const funcs = [
      tx ? `void ${low}_write_byte(uint8_t b)
{
    while ((${flagTx}) == 0u) { }
    ${dataTx} = b;
}

void ${low}_write(const char *s)
{
    while (*s != '\\0') {
        ${low}_write_byte((uint8_t)*s++);
    }
    while ((${flagTc}) == 0u) { }
}` : '',
      rx ? `/* Принятый байт или -1, если данных нет */
int ${low}_read_byte(void)
{
    if ((${flagRx}) == 0u) {
        return -1;
    }
    return (int)(${dataRx} & 0xFFu);
}` : ''
    ].filter(Boolean).join('\n\n')
    const protos = [tx ? `void ${low}_write_byte(uint8_t b);\nvoid ${low}_write(const char *s);` : '', rx ? `int ${low}_read_byte(void);` : ''].filter(Boolean).join('\n')
    items.push({ name, low, init, funcs, protos })
  }
  const h = `${banner('uart.h', 'cmsis')}#ifndef AVRIDE_UART_H
#define AVRIDE_UART_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

${items.length ? items.map((i) => `/* ${i.name} */\n${i.protos}`).join('\n\n') : '/* USART в avride.pins.json не включены. */'}

/* USER CODE BEGIN uart_h */

/* USER CODE END uart_h */

/** Включает тактирование и настраивает все включённые USART (выводы настраивает gpio_init). */
void uart_init(void);

#ifdef __cplusplus
}
#endif

#endif /* AVRIDE_UART_H */
`
  const c = `${banner('uart.c', 'cmsis')}#include "${hdr}"
#include "clock.h"
#include "uart.h"

/* USER CODE BEGIN Includes_uart */

/* USER CODE END Includes_uart */

void uart_init(void)
{
    /* USER CODE BEGIN uart_init_begin */

    /* USER CODE END uart_init_begin */
${items.length ? items.map((i) => i.init).join('\n\n') : '    /* USART не включены. */'}

    /* USER CODE BEGIN uart_init_end */

    /* USER CODE END uart_init_end */
}

${items.map((i) => i.funcs).filter(Boolean).join('\n\n')}

/* USER CODE BEGIN uart_c */

/* USER CODE END uart_c */
`
  return { files: [{ path: `${opts.incDir}/uart.h`, content: h }, { path: `${opts.srcDir}/uart.c`, content: c }], notes }
}

// ---------- board ----------

export function genBoard(cfg: PinsConfig, chip: ChipRecord, opts: GenOptions): { files: GenFile[]; notes: GenNote[] } {
  const hdr = familyHeader(chip)
  const h = `${banner('board.h', 'cmsis')}#ifndef AVRIDE_BOARD_H
#define AVRIDE_BOARD_H

#include <stdint.h>
#include "${hdr}"
#include "clock.h"
#include "gpio.h"
#include "uart.h"

#ifdef __cplusplus
extern "C" {
#endif

/* USER CODE BEGIN board_h */

/* USER CODE END board_h */

/** Тактирование → SysTick (1 мс) → GPIO → USART. Вызовите первой строкой main(). */
void board_init(void);
/** Миллисекунды с запуска (счётчик SysTick) */
uint32_t board_millis(void);
/** Ожидание в миллисекундах */
void board_delay_ms(uint32_t ms);

#ifdef __cplusplus
}
#endif

#endif /* AVRIDE_BOARD_H */
`
  const c = `${banner('board.c', 'cmsis')}#include "board.h"

/* USER CODE BEGIN Includes_board */

/* USER CODE END Includes_board */

static volatile uint32_t s_ms;

/* Прерывание SysTick раз в миллисекунду. Если этот обработчик нужен вам в другом файле — удалите его здесь, но не из шаблона: он создаётся заново. */
void SysTick_Handler(void)
{
    s_ms++;
    /* USER CODE BEGIN SysTick_Handler */

    /* USER CODE END SysTick_Handler */
}

uint32_t board_millis(void)
{
    return s_ms;
}

void board_delay_ms(uint32_t ms)
{
    uint32_t t0 = s_ms;
    while ((uint32_t)(s_ms - t0) < ms) {
    }
}

void board_init(void)
{
    /* USER CODE BEGIN board_init_begin */

    /* USER CODE END board_init_begin */
    (void)clock_init();
    (void)SysTick_Config(SystemCoreClock / 1000u); /* 1 мс; SystemCoreClock обновляет clock_init() */
    gpio_init();
    uart_init();
    /* USER CODE BEGIN board_init_end */

    /* USER CODE END board_init_end */
}

/* USER CODE BEGIN board_c */

/* USER CODE END board_c */
`
  void cfg
  return { files: [{ path: `${opts.incDir}/board.h`, content: h }, { path: `${opts.srcDir}/board.c`, content: c }], notes: [] }
}

/** Все файлы режима CMSIS. */
export function genCmsis(cfg: PinsConfig, chip: ChipRecord, opts: GenOptions): GenOutput {
  const gpio = genGpio(cfg, chip, opts)
  const clock = genClock(cfg, chip, opts)
  const uart = genUart(cfg, chip, opts, clock.calc)
  const board = genBoard(cfg, chip, opts)
  return { files: [...board.files, ...clock.files, ...gpio.files, ...uart.files], notes: [...gpio.notes, ...clock.notes, ...uart.notes, ...board.notes] }
}
