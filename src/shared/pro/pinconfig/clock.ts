// Тактирование: профили семейств с подтверждёнными границами, расчёт частот, подбор PLL, wait states Flash, делитель USART.
// ИСТОЧНИКИ границ (скачаны и прочитаны целиком, см. CLOCK_SOURCES): драйверы HAL ST (stm32f1xx/f4xx/g4xx_hal_driver: макросы IS_RCC_PLL*_VALUE,
// комментарии о максимальных частотах шин, таблицы wait states) и примеры STM32Cube (F103RB, F411RE, G474RE). Чего там нет — не угадываем:
// для остальных семейств профиль «пока вручную», автоматический подбор PLL и генерация кода тактирования не предлагаются.
import type { ChipRecord } from '../chipdb'
import type { ClockCfg, PinIssue } from './types'

export type ClockKind = 'f1' | 'f4' | 'g4'

export interface ClockProfile {
  /** null — семейство не поддержано: тактирование «пока вручную» */
  kind: ClockKind | null
  /** Подбор PLL и генерация кода PLL подтверждены для этого чипа */
  pllAuto: boolean
  hsiHz: number
  hseMinHz: number
  hseMaxHz: number
  sysMaxHz: number
  ahbMaxHz: number
  apb1MaxHz: number
  apb2MaxHz: number
  /** Что именно не поддержано и почему (для интерфейса) */
  note?: string
}

const MHZ = 1_000_000

export const CLOCK_SOURCES: { id: string; what: string; url: string }[] = [
  { id: 'f1-hal', what: 'F1: HSE 4–16 МГц (F103), SYSCLK ≤ 72, PCLK1 ≤ 36, PCLK2 ≤ 72 МГц; множитель PLL 2…16; wait states 0/1/2 при ≤24/≤48/≤72 МГц (комментарии stm32f1xx_hal_rcc.c, макрос IS_RCC_PLL_MUL)', url: 'https://github.com/STMicroelectronics/stm32f1xx_hal_driver (Src/stm32f1xx_hal_rcc.c, Inc/stm32f1xx_hal_rcc_ex.h)' },
  { id: 'f4-hal', what: 'F4: HSE 4–26 МГц; PLLM 2…63, PLLN 50…432, PLLP 2/4/6/8, PLLQ 2…15; вход VCO 1–2 МГц, выход VCO 100–432 МГц; F411: 100/100/50 МГц, F401: 84/84/42, F407: 168/168/42/84 (stm32f4xx_hal_rcc.c, макросы IS_RCC_PLL*_VALUE); масштаб напряжения 1 — значение по умолчанию (stm32f4xx_hal_pwr_ex.h)', url: 'https://github.com/STMicroelectronics/stm32f4xx_hal_driver' },
  { id: 'f4-cube', what: 'F4: пример NUCLEO-F411RE (HSE 8 МГц, M=8, N=400, P=4, Q=7, масштаб 1, wait states 3, APB1 /2) и F4-Discovery (168 МГц, 5 wait states); 30 МГц на один такт ожидания при питании 3,3 В', url: 'https://github.com/STMicroelectronics/STM32CubeF4 (Projects/…/Examples/RCC/RCC_ClockConfig)' },
  { id: 'g4-hal', what: 'G4: HSE 4–48 МГц, все шины ≤ 170 МГц; PLLM 1…16, PLLN 8…127, PLLR 2/4/6/8; вход VCO 2,66–8 МГц, выход VCO 64–344 МГц; таблица wait states (режим boost: 34/68/102/136/170 МГц); промежуточный делитель AHB /2 при переходе выше 80 МГц (stm32g4xx_hal_rcc.c/.h)', url: 'https://github.com/STMicroelectronics/stm32g4xx_hal_driver' },
  { id: 'g4-cube', what: 'G4: пример NUCLEO-G474RE (HSI 16 МГц, M=4, N=85, R=2 → 170 МГц, boost, 4 wait states)', url: 'https://github.com/STMicroelectronics/STM32CubeG4 (Projects/NUCLEO-G474RE/Examples/RCC/RCC_ClockConfig)' }
]

const NONE: ClockProfile = { kind: null, pllAuto: false, hsiHz: 0, hseMinHz: 0, hseMaxHz: 0, sysMaxHz: 0, ahbMaxHz: 0, apb1MaxHz: 0, apb2MaxHz: 0 }

/** Профиль тактирования чипа по базе. Незнакомое семейство — kind: null («пока вручную»). */
export function clockProfile(chip: ChipRecord): ClockProfile {
  const id = chip.id
  if (id.startsWith('stm32f103')) return { kind: 'f1', pllAuto: true, hsiHz: 8 * MHZ, hseMinHz: 4 * MHZ, hseMaxHz: 16 * MHZ, sysMaxHz: 72 * MHZ, ahbMaxHz: 72 * MHZ, apb1MaxHz: 36 * MHZ, apb2MaxHz: 72 * MHZ }
  if (id.startsWith('stm32f411')) return { kind: 'f4', pllAuto: true, hsiHz: 16 * MHZ, hseMinHz: 4 * MHZ, hseMaxHz: 26 * MHZ, sysMaxHz: 100 * MHZ, ahbMaxHz: 100 * MHZ, apb1MaxHz: 50 * MHZ, apb2MaxHz: 100 * MHZ }
  if (id.startsWith('stm32f407')) return { kind: 'f4', pllAuto: true, hsiHz: 16 * MHZ, hseMinHz: 4 * MHZ, hseMaxHz: 26 * MHZ, sysMaxHz: 168 * MHZ, ahbMaxHz: 168 * MHZ, apb1MaxHz: 42 * MHZ, apb2MaxHz: 84 * MHZ }
  if (id.startsWith('stm32f401')) return { kind: 'f4', pllAuto: false, hsiHz: 16 * MHZ, hseMinHz: 4 * MHZ, hseMaxHz: 26 * MHZ, sysMaxHz: 84 * MHZ, ahbMaxHz: 84 * MHZ, apb1MaxHz: 42 * MHZ, apb2MaxHz: 84 * MHZ, note: 'F401: масштаб напряжения регулятора для PLL не подтверждён источниками — подбор PLL отключён, генератор HSI и HSE без PLL работают. PLL настройте вручную.' }
  if (id.startsWith('stm32f446')) return { kind: 'f4', pllAuto: false, hsiHz: 16 * MHZ, hseMinHz: 4 * MHZ, hseMaxHz: 26 * MHZ, sysMaxHz: 180 * MHZ, ahbMaxHz: 180 * MHZ, apb1MaxHz: 45 * MHZ, apb2MaxHz: 90 * MHZ, note: 'F446: частота выше 168 МГц требует режима Over-drive (PWR_CR.ODEN) — генерация PLL для него не реализована: пока вручную. HSI и HSE без PLL работают.' }
  if (id.startsWith('stm32g4')) return { kind: 'g4', pllAuto: true, hsiHz: 16 * MHZ, hseMinHz: 4 * MHZ, hseMaxHz: 48 * MHZ, sysMaxHz: 170 * MHZ, ahbMaxHz: 170 * MHZ, apb1MaxHz: 170 * MHZ, apb2MaxHz: 170 * MHZ }
  return { ...NONE, note: `Для ${chip.family} границы PLL и частот в подтверждённых источниках не собраны — тактирование пока вручную: код тактирования не создаётся, ядро остаётся на частоте после сброса.` }
}

export const AHB_DIVS = [1, 2, 4, 8, 16, 64, 128, 256, 512]
export const APB_DIVS = [1, 2, 4, 8, 16]
export const PLL_P_VALUES = [2, 4, 6, 8]

export interface ClockResult {
  /** Расчёт возможен (нет грубых ошибок) */
  ok: boolean
  sysclk: number
  hclk: number
  pclk1: number
  pclk2: number
  /** Частоты таймеров: ×2, если делитель шины не 1 */
  timclk1: number
  timclk2: number
  pllIn?: number
  pllVco?: number
  pllQ?: number
  latency: number | null
  issues: PinIssue[]
}

const err = (code: string, message: string): PinIssue => ({ severity: 'error', code, message })
const warn = (code: string, message: string): PinIssue => ({ severity: 'warning', code, message })
const fmtHz = (hz: number): string => (hz >= MHZ ? `${+(hz / MHZ).toFixed(3)} МГц` : `${+(hz / 1000).toFixed(1)} кГц`)

/** Wait states Flash: F1 по SYSCLK (таблица HAL), F4 — 30 МГц на такт ожидания при 2,7–3,6 В, G4 — таблица режима boost. */
export function flashLatency(kind: ClockKind, sysclk: number, hclk: number): number {
  if (kind === 'f1') return sysclk <= 24 * MHZ ? 0 : sysclk <= 48 * MHZ ? 1 : 2
  if (kind === 'f4') return Math.max(0, Math.ceil(hclk / (30 * MHZ)) - 1)
  return hclk <= 34 * MHZ ? 0 : hclk <= 68 * MHZ ? 1 : hclk <= 102 * MHZ ? 2 : hclk <= 136 * MHZ ? 3 : 4
}

/** Значения по умолчанию после сброса: ядро на HSI, делители 1. */
export function defaultClock(chip: ChipRecord): ClockCfg {
  void chip
  return { source: 'hsi', pllSource: 'hsi', hseHz: 8 * MHZ, hseBypass: false, pll: {}, ahbDiv: 1, apb1Div: 1, apb2Div: 1 }
}

/** Частоты по настройке тактирования и нарушенные границы. */
export function computeClock(chip: ChipRecord, cfg: ClockCfg): ClockResult {
  const prof = clockProfile(chip)
  const issues: PinIssue[] = []
  const res: ClockResult = { ok: false, sysclk: 0, hclk: 0, pclk1: 0, pclk2: 0, timclk1: 0, timclk2: 0, latency: null, issues }
  if (!prof.kind) { issues.push(warn('clock-manual', prof.note ?? 'Тактирование пока вручную.')); return res }
  let sys = 0
  if (cfg.source === 'hsi') sys = prof.hsiHz
  else {
    if (cfg.hseHz < prof.hseMinHz || cfg.hseHz > prof.hseMaxHz) issues.push(err('hse-range', `Частота HSE ${fmtHz(cfg.hseHz)} вне допустимых ${fmtHz(prof.hseMinHz)}–${fmtHz(prof.hseMaxHz)} для ${chip.family}.`))
    if (cfg.source === 'hse') sys = cfg.hseHz
    else {
      if (!prof.pllAuto) { issues.push(err('clock-pll-manual', prof.note ?? 'PLL для этого чипа пока вручную.')); return res }
      const inHz = cfg.pllSource === 'hse' ? cfg.hseHz : prof.hsiHz
      const p = cfg.pll
      if (prof.kind === 'f1') {
        const pre = cfg.pllSource === 'hse' ? (p.hseDiv2 ? 2 : 1) : 2
        const mul = p.mul ?? 0
        res.pllIn = inHz / pre
        if (!Number.isInteger(mul) || mul < 2 || mul > 16) { issues.push(err('pll-mul', `Множитель PLL ${mul || '—'}: допустимо 2…16.`)); return res }
        sys = (inHz / pre) * mul
        res.pllVco = sys
      } else {
        const m = p.m ?? 0, n = p.n ?? 0
        const mMin = prof.kind === 'f4' ? 2 : 1, mMax = prof.kind === 'f4' ? 63 : 16
        const nMin = prof.kind === 'f4' ? 50 : 8, nMax = prof.kind === 'f4' ? 432 : 127
        if (!Number.isInteger(m) || m < mMin || m > mMax) { issues.push(err('pll-m', `Делитель M ${m || '—'}: допустимо ${mMin}…${mMax}.`)); return res }
        if (!Number.isInteger(n) || n < nMin || n > nMax) { issues.push(err('pll-n', `Множитель N ${n || '—'}: допустимо ${nMin}…${nMax}.`)); return res }
        const vin = inHz / m
        const vco = (inHz * n) / m
        res.pllIn = vin
        res.pllVco = vco
        const [inLo, inHi, outLo, outHi] = prof.kind === 'f4' ? [1 * MHZ, 2 * MHZ, 100 * MHZ, 432 * MHZ] : [2.66 * MHZ, 8 * MHZ, 64 * MHZ, 344 * MHZ]
        if (vin < inLo - 1 || vin > inHi + 1) issues.push(err('vco-in', `Вход VCO ${fmtHz(vin)} вне допустимых ${fmtHz(inLo)}–${fmtHz(inHi)}.`))
        if (vco < outLo - 1 || vco > outHi + 1) issues.push(err('vco-out', `Выход VCO ${fmtHz(vco)} вне допустимых ${fmtHz(outLo)}–${fmtHz(outHi)}.`))
        const d = prof.kind === 'f4' ? p.p ?? 0 : p.r ?? 0
        if (!PLL_P_VALUES.includes(d)) { issues.push(err(prof.kind === 'f4' ? 'pll-p' : 'pll-r', `Делитель ${prof.kind === 'f4' ? 'P' : 'R'} ${d || '—'}: допустимо 2, 4, 6, 8.`)); return res }
        sys = vco / d
        if (prof.kind === 'f4') {
          const q = p.q ?? 0
          if (q) {
            if (!Number.isInteger(q) || q < 2 || q > 15) issues.push(err('pll-q', `Делитель Q ${q}: допустимо 2…15.`))
            else res.pllQ = vco / q
          }
        }
      }
    }
  }
  if (!AHB_DIVS.includes(cfg.ahbDiv)) { issues.push(err('ahb-div', `Делитель AHB ${cfg.ahbDiv}: допустимо ${AHB_DIVS.join(', ')}.`)); return res }
  if (!APB_DIVS.includes(cfg.apb1Div) || !APB_DIVS.includes(cfg.apb2Div)) { issues.push(err('apb-div', `Делитель APB: допустимо ${APB_DIVS.join(', ')}.`)); return res }
  const hclk = sys / cfg.ahbDiv
  const pclk1 = hclk / cfg.apb1Div
  const pclk2 = hclk / cfg.apb2Div
  if (sys > prof.sysMaxHz) issues.push(err('sys-max', `SYSCLK ${fmtHz(sys)} выше предела ${fmtHz(prof.sysMaxHz)} для ${chip.name}.`))
  if (hclk > prof.ahbMaxHz) issues.push(err('hclk-max', `HCLK ${fmtHz(hclk)} выше предела ${fmtHz(prof.ahbMaxHz)}.`))
  if (pclk1 > prof.apb1MaxHz) issues.push(err('pclk1-max', `PCLK1 (APB1) ${fmtHz(pclk1)} выше предела ${fmtHz(prof.apb1MaxHz)}: увеличьте делитель APB1.`))
  if (pclk2 > prof.apb2MaxHz) issues.push(err('pclk2-max', `PCLK2 (APB2) ${fmtHz(pclk2)} выше предела ${fmtHz(prof.apb2MaxHz)}: увеличьте делитель APB2.`))
  Object.assign(res, { sysclk: sys, hclk, pclk1, pclk2, timclk1: cfg.apb1Div === 1 ? pclk1 : pclk1 * 2, timclk2: cfg.apb2Div === 1 ? pclk2 : pclk2 * 2 })
  res.latency = flashLatency(prof.kind, sys, hclk)
  res.ok = !issues.some((i) => i.severity === 'error')
  return res
}

/** Наименьшие делители шин APB, при которых частоты не выше предела. */
export function autoApbDividers(prof: ClockProfile, hclk: number): { apb1Div: number; apb2Div: number } {
  const pick = (max: number): number => APB_DIVS.find((d) => hclk / d <= max) ?? 16
  return { apb1Div: pick(prof.apb1MaxHz), apb2Div: pick(prof.apb2MaxHz) }
}

export interface PllSolution { pll: ClockCfg['pll']; sysclk: number; exact: boolean }

/**
 * Подбор параметров PLL под целевую частоту SYSCLK. Точное совпадение предпочитается; среди точных — наибольший вход VCO (HAL рекомендует 2 МГц F4, меньше дрожание).
 * null — подобрать нельзя (источник вне диапазона, семейство не поддержано).
 */
export function solvePll(chip: ChipRecord, src: { pllSource: 'hsi' | 'hse'; hseHz: number }, targetHz: number, wantUsb = false): PllSolution | null {
  const prof = clockProfile(chip)
  if (!prof.kind || !prof.pllAuto || targetHz <= 0 || targetHz > prof.sysMaxHz) return null
  const inHz = src.pllSource === 'hse' ? src.hseHz : prof.hsiHz
  if (src.pllSource === 'hse' && (inHz < prof.hseMinHz || inHz > prof.hseMaxHz)) return null
  let best: (PllSolution & { score: number[] }) | null = null
  const consider = (pll: ClockCfg['pll'], sys: number, vin: number, extra = 0): void => {
    const exact = Math.abs(sys - targetHz) < 0.5
    const score = [exact ? 0 : Math.abs(sys - targetHz), -vin, extra]
    if (!best || cmp(score, best.score) < 0) best = { pll, sysclk: sys, exact, score }
  }
  if (prof.kind === 'f1') {
    const pres = src.pllSource === 'hse' ? [1, 2] : [2]
    for (const pre of pres) for (let mul = 2; mul <= 16; mul++) {
      const sys = (inHz / pre) * mul
      if (sys > prof.sysMaxHz) continue
      consider(src.pllSource === 'hse' ? { mul, hseDiv2: pre === 2 } : { mul }, sys, inHz / pre, pre === 2 ? 1 : 0)
    }
  } else if (prof.kind === 'f4') {
    for (let m = 2; m <= 63; m++) {
      const vin = inHz / m
      if (vin < MHZ || vin > 2 * MHZ) continue
      for (let n = 50; n <= 432; n++) {
        const vco = vin * n
        if (vco < 100 * MHZ || vco > 432 * MHZ) continue
        for (const p of PLL_P_VALUES) {
          const sys = vco / p
          if (sys > prof.sysMaxHz) continue
          let q = 2, qerr = Infinity
          for (let qq = 2; qq <= 15; qq++) { const e = Math.abs(vco / qq - 48 * MHZ); if (e < qerr) { qerr = e; q = qq } }
          consider({ m, n, p, q }, sys, vin, wantUsb ? qerr : 0)
        }
      }
    }
  } else {
    for (let m = 1; m <= 16; m++) {
      const vin = inHz / m
      if (vin < 2.66 * MHZ - 1 || vin > 8 * MHZ + 1) continue
      for (let n = 8; n <= 127; n++) {
        const vco = vin * n
        if (vco < 64 * MHZ || vco > 344 * MHZ) continue
        for (const r of PLL_P_VALUES) {
          const sys = vco / r
          if (sys > prof.sysMaxHz) continue
          consider({ m, n, r }, sys, vin)
        }
      }
    }
  }
  const b = best as (PllSolution & { score: number[] }) | null
  return b ? { pll: b.pll, sysclk: b.sysclk, exact: b.exact } : null
}

function cmp(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}

/** Готовая настройка тактирования: PLL под целевую частоту и минимальные делители шин. null — подобрать нельзя. */
export function autoClock(chip: ChipRecord, base: ClockCfg, targetHz: number): { cfg: ClockCfg; exact: boolean } | null {
  const prof = clockProfile(chip)
  const sol = solvePll(chip, { pllSource: base.pllSource, hseHz: base.hseHz }, targetHz)
  if (!sol) return null
  const { apb1Div, apb2Div } = autoApbDividers(prof, sol.sysclk)
  return { cfg: { ...base, source: 'pll', pll: sol.pll, ahbDiv: 1, apb1Div, apb2Div }, exact: sol.exact }
}

// ---------- USART ----------

export interface BrrResult { brr: number; actualBaud: number; errorPct: number }

/**
 * Значение BRR при передискретизации 16 (OVER8 = 0): USARTDIV = fck / (16·baud), BRR = fck / baud, округлённое к ближайшему —
 * мантисса и дробная часть в одном числе (RM0008 §27.3.4, RM0090 §30.3.4, RM0440 §37.5.4). null — скорость недостижима (BRR вне 16…65535).
 */
export function usartBrr(fck: number, baud: number): BrrResult | null {
  if (!(fck > 0) || !(baud > 0)) return null
  // к ближайшему, половина — вниз (так в таблицах RM: 36 МГц и 115200 → 312 = 0x138)
  const brr = Math.ceil(fck / baud - 0.5)
  if (brr < 16 || brr > 0xffff) return null
  const actual = fck / brr
  return { brr, actualBaud: actual, errorPct: ((actual - baud) / baud) * 100 }
}
