// Ремап AFIO у STM32F1: поле «remap» функции вывода в базе (имя из HAL: USART1_ENABLE, TIM3_PARTIAL …) → поле регистра AFIO->MAPR.
// Имена макросов взяты из заголовка CMSIS stm32f103xb.h (проверяется тестом по кэшу пакета поддержки, если он есть).
import type { ChipPackage } from '../../chipdb'
import { commonRemap, remapChoices, signalPins } from '../model'
import type { PinsConfig } from '../types'

export interface RemapField { mask: string; value: string }

export const F1_REMAP: Record<string, RemapField> = {
  USART1_ENABLE: { mask: 'AFIO_MAPR_USART1_REMAP', value: 'AFIO_MAPR_USART1_REMAP' },
  USART2_ENABLE: { mask: 'AFIO_MAPR_USART2_REMAP', value: 'AFIO_MAPR_USART2_REMAP' },
  USART3_PARTIAL: { mask: 'AFIO_MAPR_USART3_REMAP', value: 'AFIO_MAPR_USART3_REMAP_PARTIALREMAP' },
  USART3_ENABLE: { mask: 'AFIO_MAPR_USART3_REMAP', value: 'AFIO_MAPR_USART3_REMAP_FULLREMAP' },
  SPI1_ENABLE: { mask: 'AFIO_MAPR_SPI1_REMAP', value: 'AFIO_MAPR_SPI1_REMAP' },
  I2C1_ENABLE: { mask: 'AFIO_MAPR_I2C1_REMAP', value: 'AFIO_MAPR_I2C1_REMAP' },
  TIM1_PARTIAL: { mask: 'AFIO_MAPR_TIM1_REMAP', value: 'AFIO_MAPR_TIM1_REMAP_PARTIALREMAP' },
  TIM1_ENABLE: { mask: 'AFIO_MAPR_TIM1_REMAP', value: 'AFIO_MAPR_TIM1_REMAP_FULLREMAP' },
  TIM2_PARTIAL_1: { mask: 'AFIO_MAPR_TIM2_REMAP', value: 'AFIO_MAPR_TIM2_REMAP_PARTIALREMAP1' },
  TIM2_PARTIAL_2: { mask: 'AFIO_MAPR_TIM2_REMAP', value: 'AFIO_MAPR_TIM2_REMAP_PARTIALREMAP2' },
  TIM2_ENABLE: { mask: 'AFIO_MAPR_TIM2_REMAP', value: 'AFIO_MAPR_TIM2_REMAP_FULLREMAP' },
  TIM3_PARTIAL: { mask: 'AFIO_MAPR_TIM3_REMAP', value: 'AFIO_MAPR_TIM3_REMAP_PARTIALREMAP' },
  TIM3_ENABLE: { mask: 'AFIO_MAPR_TIM3_REMAP', value: 'AFIO_MAPR_TIM3_REMAP_FULLREMAP' },
  TIM4_ENABLE: { mask: 'AFIO_MAPR_TIM4_REMAP', value: 'AFIO_MAPR_TIM4_REMAP' },
  CAN1_2: { mask: 'AFIO_MAPR_CAN_REMAP', value: 'AFIO_MAPR_CAN_REMAP_REMAP2' },
  CAN1_3: { mask: 'AFIO_MAPR_CAN_REMAP', value: 'AFIO_MAPR_CAN_REMAP_REMAP3' }
}

export interface RemapPlan {
  /** Ремап по периферии: значение из базы (USART1_ENABLE) или '' (без ремапа); null — выводы несовместимы */
  byPeriph: Record<string, string | null>
  /** Поля MAPR для записи */
  fields: RemapField[]
  /** Токены ремапа, которые генератор не умеет */
  unknown: string[]
}

/** Ремап выбранных выводов у F1: у всех выводов одной периферии он должен быть одинаковым. */
export function planRemap(cfg: PinsConfig, pkg: ChipPackage): RemapPlan {
  const byPeriph: Record<string, string | null> = {}
  const fields: RemapField[] = []
  const unknown: string[] = []
  for (const [periph, per] of Object.entries(cfg.peripherals)) {
    if (!per.enabled) continue
    const choices: string[][] = []
    for (const [signal, pin] of Object.entries(per.signals)) {
      const sp = signalPins(pkg, signal).find((s) => s.pin === pin)
      if (sp) choices.push(remapChoices(sp))
    }
    if (choices.length === 0) continue
    const r = commonRemap(choices)
    byPeriph[periph] = r
    if (r) {
      const f = F1_REMAP[r]
      if (f) { if (!fields.some((x) => x.mask === f.mask)) fields.push(f) } else unknown.push(r)
    }
  }
  return { byPeriph, fields, unknown }
}
