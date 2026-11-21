// Генератор кода на HAL ST (stm32xxxx_hal.h): те же файлы gpio, clock, uart, board, но через HAL_GPIO_Init, HAL_RCC_OscConfig/ClockConfig, HAL_UART_Init.
// Включается только если в проекте есть заголовки HAL; имена и поля структур — из драйверов HAL F1, F4, G4 (проверяется сборкой с настоящим HAL).
import type { ChipRecord } from '../../chipdb'
import { clockProfile, computeClock } from '../clock'
import type { ClockResult } from '../clock'
import type { PinsConfig } from '../types'
import { banner, familyHeader } from './common'
import type { GenFile } from './common'
import type { GenOptions, GenOutput } from './cmsis'
import { planPins } from './pins'
import type { PinPlan } from './pins'
import { genFamily, usartInfo } from './support'
import type { GenNote } from './support'

const MHZ_TEXT = (hz: number): string => `${+(hz / 1e6).toFixed(3)} МГц`
const halHeader = (chip: ChipRecord): string => `${/^(stm32[a-z]\d)/.exec(chip.files.header)![1]}xx_hal.h`

function speedOf(p: PinPlan, fam: 'f1' | 'f4' | 'g4'): string {
  if (p.speed === 'low') return 'GPIO_SPEED_FREQ_LOW'
  if (p.speed === 'medium') return 'GPIO_SPEED_FREQ_MEDIUM'
  if (p.speed === 'high') return 'GPIO_SPEED_FREQ_HIGH'
  return fam === 'f1' ? 'GPIO_SPEED_FREQ_HIGH' : 'GPIO_SPEED_FREQ_VERY_HIGH'
}

function modeOf(p: PinPlan): string {
  if (p.mode === 'analog') return 'GPIO_MODE_ANALOG'
  if (p.mode === 'in') return 'GPIO_MODE_INPUT'
  if (p.mode === 'out') return p.otype === 'od' ? 'GPIO_MODE_OUTPUT_OD' : 'GPIO_MODE_OUTPUT_PP'
  if (p.dir === 'in') return 'GPIO_MODE_INPUT'
  return p.otype === 'od' || p.dir === 'od' ? 'GPIO_MODE_AF_OD' : 'GPIO_MODE_AF_PP'
}

const PULL = { none: 'GPIO_NOPULL', up: 'GPIO_PULLUP', down: 'GPIO_PULLDOWN' } as const

function genGpioHal(cfg: PinsConfig, chip: ChipRecord, opts: GenOptions): { files: GenFile[]; notes: GenNote[] } {
  const plan = planPins(cfg, chip)
  const fam = plan.fam
  const macros: string[] = []
  for (const p of plan.pins) {
    const id = p.label
    if (!id) continue
    macros.push(`/* ${p.pin}: ${p.signal ?? p.note} */`, `#define ${id}_PORT  GPIO${p.port}`, `#define ${id}_PIN   GPIO_PIN_${p.num}`)
    if (p.mode === 'out') macros.push(`#define ${id}_SET()    HAL_GPIO_WritePin(${id}_PORT, ${id}_PIN, GPIO_PIN_SET)`, `#define ${id}_RESET()  HAL_GPIO_WritePin(${id}_PORT, ${id}_PIN, GPIO_PIN_RESET)`, `#define ${id}_TOGGLE() HAL_GPIO_TogglePin(${id}_PORT, ${id}_PIN)`)
    if (p.mode === 'in') macros.push(`#define ${id}_READ()   (HAL_GPIO_ReadPin(${id}_PORT, ${id}_PIN) == GPIO_PIN_SET)`)
  }
  const h = `${banner('gpio.h', 'hal')}#ifndef AVRIDE_GPIO_H
#define AVRIDE_GPIO_H

#include "${halHeader(chip)}"

#ifdef __cplusplus
extern "C" {
#endif

/* Имена выводов по меткам из avride.pins.json */
${macros.length ? macros.join('\n') : '/* Меток нет: задайте метку выводу (например, LED) — здесь появятся LED_PORT, LED_PIN и LED_SET()/LED_RESET()/LED_TOGGLE(). */'}

/* USER CODE BEGIN gpio_h */

/* USER CODE END gpio_h */

/** Включает тактирование портов и настраивает все выводы из avride.pins.json (HAL_GPIO_Init). */
void gpio_init(void);

#ifdef __cplusplus
}
#endif

#endif /* AVRIDE_GPIO_H */
`
  const body: string[] = []
  for (const port of plan.ports) body.push(`    __HAL_RCC_GPIO${port}_CLK_ENABLE();`)
  if (fam === 'f1' && plan.remap && (plan.remap.fields.length || plan.jtagOff)) {
    body.push('    __HAL_RCC_AFIO_CLK_ENABLE();')
    if (plan.jtagOff) body.push('    __HAL_AFIO_REMAP_SWJ_NOJTAG(); /* JTAG отключён, SWD остаётся: выводы PA15, PB3, PB4 свободны */')
    for (const [periph, v] of Object.entries(plan.remap.byPeriph)) if (v) body.push(`    __HAL_AFIO_REMAP_${v}(); /* ${periph}: ремап */`)
  }
  body.push('')
  for (const p of plan.pins) {
    const port = `GPIO${p.port}`
    const what = `${p.pin}${p.label ? ` (${p.label})` : ''}: ${p.signal ? p.signal + ' — ' : ''}${p.note}`
    if (p.mode === 'out') body.push(`    HAL_GPIO_WritePin(${port}, GPIO_PIN_${p.num}, ${p.initial === 'high' ? 'GPIO_PIN_SET' : 'GPIO_PIN_RESET'}); /* начальный уровень */`)
    const alt = fam !== 'f1' && p.mode === 'af' ? ` gi.Alternate = ${p.af}u;` : ''
    body.push(`    gi.Pin = GPIO_PIN_${p.num}; gi.Mode = ${modeOf(p)}; gi.Pull = ${PULL[p.pull]}; gi.Speed = ${speedOf(p, fam)};${alt} HAL_GPIO_Init(${port}, &gi); /* ${what} */`)
  }
  if (plan.pins.length === 0) body.push('    /* Выводы в avride.pins.json не настроены. */')
  const c = `${banner('gpio.c', 'hal')}#include "gpio.h"

/* USER CODE BEGIN Includes_gpio */

/* USER CODE END Includes_gpio */

void gpio_init(void)
{
    GPIO_InitTypeDef gi = {0};

    /* USER CODE BEGIN gpio_init_begin */

    /* USER CODE END gpio_init_begin */
${body.join('\n')}

    /* USER CODE BEGIN gpio_init_end */

    /* USER CODE END gpio_init_end */
}

/* USER CODE BEGIN gpio_c */

/* USER CODE END gpio_c */
`
  return { files: [{ path: `${opts.incDir}/gpio.h`, content: h }, { path: `${opts.srcDir}/gpio.c`, content: c }], notes: plan.notes }
}

/** Имя дескриптора HAL: USART1 → huart1 */
const hv = (low: string): string => 'h' + low.replace(/^usart/, 'uart')

const AHB = (d: number): string => `RCC_SYSCLK_DIV${d}`
const APB = (d: number): string => `RCC_HCLK_DIV${d}`

function genClockHal(cfg: PinsConfig, chip: ChipRecord, opts: GenOptions): { files: GenFile[]; notes: GenNote[]; calc: ClockResult } {
  const prof = clockProfile(chip)
  const calc = computeClock(chip, cfg.clock)
  const notes: GenNote[] = []
  const ck = cfg.clock
  const known = prof.kind !== null
  const hseUsed = ck.source === 'hse' || (ck.source === 'pll' && ck.pllSource === 'hse')
  const h = `${banner('clock.h', 'hal')}#ifndef AVRIDE_CLOCK_H
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
#define CLOCK_TIMCLK1_HZ ${Math.round(calc.timclk1)}u
#define CLOCK_TIMCLK2_HZ ${Math.round(calc.timclk2)}u` : '/* Для этого семейства тактирование пока вручную: частоты не рассчитываются. */'}

/* USER CODE BEGIN clock_h */

/* USER CODE END clock_h */

/** Настраивает источник тактирования, PLL, делители шин и wait states Flash через HAL. 0 — успех, -1 — ошибка HAL. */
int clock_init(void);

#ifdef __cplusplus
}
#endif

#endif /* AVRIDE_CLOCK_H */
`
  if (!known) {
    notes.push({ severity: 'warning', text: prof.note ?? 'Тактирование для этого семейства пока вручную: clock_init() пустая.' })
    const c = `${banner('clock.c', 'hal')}#include "clock.h"

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
  const hal = halHeader(chip)
  const lines: string[] = []
  if (kind === 'f4' && ck.source === 'pll') lines.push('    /* Масштаб напряжения 1 (так делает пример STM32Cube) */\n    __HAL_RCC_PWR_CLK_ENABLE();\n    __HAL_PWR_VOLTAGESCALING_CONFIG(PWR_REGULATOR_VOLTAGE_SCALE1);\n')
  if (kind === 'g4' && ck.source === 'pll') lines.push('    /* Режим boost регулятора: нужен для частот выше 150 МГц (как в примере STM32Cube) */\n    if (HAL_PWREx_ControlVoltageScaling(PWR_REGULATOR_VOLTAGE_SCALE1_BOOST) != HAL_OK) {\n        return -1;\n    }\n')
  if (ck.source !== 'hsi') {
    const usingHse = hseUsed
    const p = ck.pll
    const o: string[] = []
    o.push(`    osc.OscillatorType = ${usingHse ? 'RCC_OSCILLATORTYPE_HSE' : 'RCC_OSCILLATORTYPE_HSI'};`)
    if (usingHse) {
      o.push(`    osc.HSEState = ${ck.hseBypass ? 'RCC_HSE_BYPASS' : 'RCC_HSE_ON'}; /* HSE ${MHZ_TEXT(ck.hseHz)}: значение HSE_VALUE в stm32…_hal_conf.h должно совпадать */`)
      if (kind === 'f1') o.push(`    osc.HSEPredivValue = ${ck.source === 'pll' && p.hseDiv2 ? 'RCC_HSE_PREDIV_DIV2' : 'RCC_HSE_PREDIV_DIV1'};`)
    } else {
      o.push('    osc.HSIState = RCC_HSI_ON;', '    osc.HSICalibrationValue = RCC_HSICALIBRATION_DEFAULT;')
    }
    if (ck.source === 'hse') o.push('    osc.PLL.PLLState = RCC_PLL_NONE;')
    else {
      o.push('    osc.PLL.PLLState = RCC_PLL_ON;')
      if (kind === 'f1') o.push(`    osc.PLL.PLLSource = ${ck.pllSource === 'hse' ? 'RCC_PLLSOURCE_HSE' : 'RCC_PLLSOURCE_HSI_DIV2'};`, `    osc.PLL.PLLMUL = RCC_PLL_MUL${p.mul}; /* SYSCLK ${MHZ_TEXT(calc.sysclk)} */`)
      else {
        o.push(`    osc.PLL.PLLSource = ${ck.pllSource === 'hse' ? 'RCC_PLLSOURCE_HSE' : 'RCC_PLLSOURCE_HSI'};`)
        if (kind === 'f4') o.push(`    osc.PLL.PLLM = ${p.m}u;`, `    osc.PLL.PLLN = ${p.n}u;`, `    osc.PLL.PLLP = RCC_PLLP_DIV${p.p};`, `    osc.PLL.PLLQ = ${p.q ?? 2}u; /* VCO ${MHZ_TEXT(calc.pllVco ?? 0)}, SYSCLK ${MHZ_TEXT(calc.sysclk)} */`)
        else o.push(`    osc.PLL.PLLM = RCC_PLLM_DIV${p.m};`, `    osc.PLL.PLLN = ${p.n}u;`, '    osc.PLL.PLLP = RCC_PLLP_DIV2;', '    osc.PLL.PLLQ = RCC_PLLQ_DIV2;', `    osc.PLL.PLLR = RCC_PLLR_DIV${p.r}; /* VCO ${MHZ_TEXT(calc.pllVco ?? 0)}, SYSCLK ${MHZ_TEXT(calc.sysclk)} */`)
      }
    }
    lines.push(`${o.join('\n')}\n    if (HAL_RCC_OscConfig(&osc) != HAL_OK) {\n        return -1;\n    }\n`)
  }
  lines.push(`    clk.ClockType = RCC_CLOCKTYPE_HCLK | RCC_CLOCKTYPE_SYSCLK | RCC_CLOCKTYPE_PCLK1 | RCC_CLOCKTYPE_PCLK2;
    clk.SYSCLKSource = ${ck.source === 'pll' ? 'RCC_SYSCLKSOURCE_PLLCLK' : ck.source === 'hse' ? 'RCC_SYSCLKSOURCE_HSE' : 'RCC_SYSCLKSOURCE_HSI'};
    clk.AHBCLKDivider = ${AHB(ck.ahbDiv)};
    clk.APB1CLKDivider = ${APB(ck.apb1Div)};
    clk.APB2CLKDivider = ${APB(ck.apb2Div)};
    if (HAL_RCC_ClockConfig(&clk, FLASH_LATENCY_${calc.latency ?? 0}) != HAL_OK) { /* wait states Flash: ${calc.latency ?? 0} */
        return -1;
    }`)
  const guard = hseUsed ? `
/* Расчёт тактирования сделан для HSE ${MHZ_TEXT(ck.hseHz)}: HAL берёт частоту из HSE_VALUE (stm32…_hal_conf.h). */
#if defined(HSE_VALUE) && (HSE_VALUE != ${Math.round(ck.hseHz)}U)
#warning "HSE_VALUE в hal_conf не равен ${Math.round(ck.hseHz)}: частоты, посчитанные HAL, будут неверными"
#endif
` : ''
  const c = `${banner('clock.c', 'hal')}#include "${hal}"
#include "clock.h"

/* USER CODE BEGIN Includes_clock */

/* USER CODE END Includes_clock */
${guard}
/* Источник SYSCLK: ${ck.source === 'pll' ? 'PLL' : ck.source === 'hse' ? 'HSE' : 'HSI'}; SYSCLK ${MHZ_TEXT(calc.sysclk)}, HCLK ${MHZ_TEXT(calc.hclk)}, PCLK1 ${MHZ_TEXT(calc.pclk1)}, PCLK2 ${MHZ_TEXT(calc.pclk2)} */
int clock_init(void)
{
    RCC_OscInitTypeDef osc = {0};
    RCC_ClkInitTypeDef clk = {0};
${ck.source === 'hsi' ? '    (void)osc;\n' : ''}
    /* USER CODE BEGIN clock_init_begin */

    /* USER CODE END clock_init_begin */

${lines.join('\n')}

    /* USER CODE BEGIN clock_init_end */

    /* USER CODE END clock_init_end */
    return 0;
}

/* USER CODE BEGIN clock_c */

/* USER CODE END clock_c */
`
  return { files: [{ path: `${opts.incDir}/clock.h`, content: h }, { path: `${opts.srcDir}/clock.c`, content: c }], notes, calc }
}

function genUartHal(cfg: PinsConfig, chip: ChipRecord, opts: GenOptions): { files: GenFile[]; notes: GenNote[] } {
  const fam = genFamily(chip)!
  const notes: GenNote[] = []
  const items: { name: string; low: string; init: string; funcs: string; protos: string }[] = []
  for (const [name, per] of Object.entries(cfg.peripherals).sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!per.enabled || !/^USART\d$/.test(name)) continue
    if (!usartInfo(chip, name)) { notes.push({ severity: 'warning', text: `${name}: инициализация USART этого чипа не поддерживается генерацией.` }); continue }
    const low = name.toLowerCase()
    const hasTx = Object.keys(per.signals).some((s) => s.endsWith('_TX'))
    const hasRx = Object.keys(per.signals).some((s) => s.endsWith('_RX'))
    const tx = hasTx || (!hasTx && !hasRx)
    const rx = hasRx || (!hasTx && !hasRx)
    const mode = tx && rx ? 'UART_MODE_TX_RX' : tx ? 'UART_MODE_TX' : 'UART_MODE_RX'
    const extra = fam === 'g4' ? `\n    ${hv(low)}.Init.ClockPrescaler = UART_PRESCALER_DIV1;\n    ${hv(low)}.AdvancedInit.AdvFeatureInit = UART_ADVFEATURE_NO_INIT;` : ''
    const init = `    /* ${name}: ${per.baud ?? 115200} бод, 8 бит, без чётности, 1 стоп-бит */
    __HAL_RCC_${name}_CLK_ENABLE();
    ${hv(low)}.Instance = ${name};
    ${hv(low)}.Init.BaudRate = ${per.baud ?? 115200}u;
    ${hv(low)}.Init.WordLength = UART_WORDLENGTH_8B;
    ${hv(low)}.Init.StopBits = UART_STOPBITS_1;
    ${hv(low)}.Init.Parity = UART_PARITY_NONE;
    ${hv(low)}.Init.Mode = ${mode};
    ${hv(low)}.Init.HwFlowCtl = UART_HWCONTROL_NONE;
    ${hv(low)}.Init.OverSampling = UART_OVERSAMPLING_16;${extra}
    (void)HAL_UART_Init(&${hv(low)});`
    const funcs = [
      tx ? `void ${low}_write_byte(uint8_t b)
{
    (void)HAL_UART_Transmit(&${hv(low)}, &b, 1u, HAL_MAX_DELAY);
}

void ${low}_write(const char *s)
{
    (void)HAL_UART_Transmit(&${hv(low)}, (uint8_t *)(uintptr_t)s, (uint16_t)strlen(s), HAL_MAX_DELAY);
}` : '',
      rx ? `/* Принятый байт или -1, если данных нет */
int ${low}_read_byte(void)
{
    uint8_t b;
    if (HAL_UART_Receive(&${hv(low)}, &b, 1u, 0u) == HAL_OK) {
        return (int)b;
    }
    return -1;
}` : ''
    ].filter(Boolean).join('\n\n')
    const protos = [`extern UART_HandleTypeDef ${hv(low)};`, tx ? `void ${low}_write_byte(uint8_t b);\nvoid ${low}_write(const char *s);` : '', rx ? `int ${low}_read_byte(void);` : ''].filter(Boolean).join('\n')
    items.push({ name, low, init, funcs, protos })
  }
  const h = `${banner('uart.h', 'hal')}#ifndef AVRIDE_UART_H
#define AVRIDE_UART_H

#include <stdint.h>
#include "${halHeader(chip)}"

#ifdef __cplusplus
extern "C" {
#endif

${items.length ? items.map((i) => `/* ${i.name} */\n${i.protos}`).join('\n\n') : '/* USART в avride.pins.json не включены. */'}

/* USER CODE BEGIN uart_h */

/* USER CODE END uart_h */

/** Настраивает все включённые USART через HAL_UART_Init (выводы настраивает gpio_init). */
void uart_init(void);

#ifdef __cplusplus
}
#endif

#endif /* AVRIDE_UART_H */
`
  const c = `${banner('uart.c', 'hal')}#include <stdint.h>
#include <string.h>
#include "uart.h"

/* USER CODE BEGIN Includes_uart */

/* USER CODE END Includes_uart */

${items.map((i) => `UART_HandleTypeDef ${hv(i.low)};`).join('\n')}

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

function genBoardHal(chip: ChipRecord, opts: GenOptions): { files: GenFile[]; notes: GenNote[] } {
  const h = `${banner('board.h', 'hal')}#ifndef AVRIDE_BOARD_H
#define AVRIDE_BOARD_H

#include <stdint.h>
#include "${halHeader(chip)}"
#include "clock.h"
#include "gpio.h"
#include "uart.h"

#ifdef __cplusplus
extern "C" {
#endif

/* USER CODE BEGIN board_h */

/* USER CODE END board_h */

/** HAL_Init → тактирование → GPIO → USART. Вызовите первой строкой main(). */
void board_init(void);
/** Миллисекунды с запуска (HAL_GetTick) */
uint32_t board_millis(void);
/** Ожидание в миллисекундах (HAL_Delay) */
void board_delay_ms(uint32_t ms);

#ifdef __cplusplus
}
#endif

#endif /* AVRIDE_BOARD_H */
`
  const c = `${banner('board.c', 'hal')}#include "board.h"

/* USER CODE BEGIN Includes_board */

/* USER CODE END Includes_board */

/* Прерывание SysTick: HAL считает миллисекунды. Если в проекте уже есть SysTick_Handler (например, в stm32…_it.c), удалите его там. */
void SysTick_Handler(void)
{
    HAL_IncTick();
    /* USER CODE BEGIN SysTick_Handler */

    /* USER CODE END SysTick_Handler */
}

uint32_t board_millis(void)
{
    return HAL_GetTick();
}

void board_delay_ms(uint32_t ms)
{
    HAL_Delay(ms);
}

void board_init(void)
{
    /* USER CODE BEGIN board_init_begin */

    /* USER CODE END board_init_begin */
    (void)HAL_Init();
    (void)clock_init();
    gpio_init();
    uart_init();
    /* USER CODE BEGIN board_init_end */

    /* USER CODE END board_init_end */
}

/* USER CODE BEGIN board_c */

/* USER CODE END board_c */
`
  return { files: [{ path: `${opts.incDir}/board.h`, content: h }, { path: `${opts.srcDir}/board.c`, content: c }], notes: [] }
}

/** Все файлы режима HAL. */
export function genHal(cfg: PinsConfig, chip: ChipRecord, opts: GenOptions): GenOutput {
  const gpio = genGpioHal(cfg, chip, opts)
  const clock = genClockHal(cfg, chip, opts)
  const uart = genUartHal(cfg, chip, opts)
  const board = genBoardHal(chip, opts)
  return { files: [...board.files, ...clock.files, ...gpio.files, ...uart.files], notes: [...gpio.notes, ...clock.notes, ...uart.notes, ...board.notes] }
}
