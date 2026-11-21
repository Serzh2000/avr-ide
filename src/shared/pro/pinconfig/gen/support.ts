// Что генератор кода умеет по семействам. Всё, что не перечислено, честно помечается «генерация не поддерживается».
import type { ChipRecord } from '../../chipdb'
import { clockProfile } from '../clock'

export type GenFamily = 'f1' | 'f4' | 'g4'

/** Семейство с подтверждённой генерацией GPIO/USART/SysTick (проверено сборкой для F103C8, F411RE, G474RE). */
export function genFamily(chip: ChipRecord): GenFamily | null {
  if (chip.id.startsWith('stm32f1')) return 'f1'
  if (chip.id.startsWith('stm32f4')) return 'f4'
  if (chip.id.startsWith('stm32g4')) return 'g4'
  return null
}

export interface UsartInfo {
  bus: 'apb1' | 'apb2'
  /** Регистр включения тактирования: RCC->APB1ENR, APB1ENR1, APB2ENR */
  enReg: string
  enBit: string
}

const USART: Record<GenFamily, Record<string, UsartInfo>> = {
  f1: {
    USART1: { bus: 'apb2', enReg: 'APB2ENR', enBit: 'RCC_APB2ENR_USART1EN' },
    USART2: { bus: 'apb1', enReg: 'APB1ENR', enBit: 'RCC_APB1ENR_USART2EN' },
    USART3: { bus: 'apb1', enReg: 'APB1ENR', enBit: 'RCC_APB1ENR_USART3EN' }
  },
  f4: {
    USART1: { bus: 'apb2', enReg: 'APB2ENR', enBit: 'RCC_APB2ENR_USART1EN' },
    USART2: { bus: 'apb1', enReg: 'APB1ENR', enBit: 'RCC_APB1ENR_USART2EN' },
    USART3: { bus: 'apb1', enReg: 'APB1ENR', enBit: 'RCC_APB1ENR_USART3EN' },
    USART6: { bus: 'apb2', enReg: 'APB2ENR', enBit: 'RCC_APB2ENR_USART6EN' }
  },
  g4: {
    USART1: { bus: 'apb2', enReg: 'APB2ENR', enBit: 'RCC_APB2ENR_USART1EN' },
    USART2: { bus: 'apb1', enReg: 'APB1ENR1', enBit: 'RCC_APB1ENR1_USART2EN' },
    USART3: { bus: 'apb1', enReg: 'APB1ENR1', enBit: 'RCC_APB1ENR1_USART3EN' }
  }
}

/** Сведения об USART для генерации; null — для этой периферии/семейства генерация не поддерживается. */
export function usartInfo(chip: ChipRecord, periph: string): UsartInfo | null {
  const f = genFamily(chip)
  if (!f || !chip.peripherals.includes(periph)) return null
  return USART[f][periph] ?? null
}

export const isUsartName = (p: string): boolean => /^USART\d$/.test(p)

/** Генерация кода тактирования возможна: SYSCLK из HSI/HSE (все поддержанные семейства) и PLL (если подтверждён для чипа). */
export function clockGenerated(chip: ChipRecord): boolean { return genFamily(chip) !== null && clockProfile(chip).kind !== null }

export interface GenNote { severity: 'info' | 'warning'; text: string }
