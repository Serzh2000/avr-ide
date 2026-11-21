// Подтверждённые факты о платах с чипами базы: светодиод и кнопка (по именам выводов порта, не Arduino-номерам).
// Источник каждого факта — заголовок варианта ядра STM32duino (BSD-3-Clause, © STMicroelectronics), файл прочитан целиком:
// https://github.com/stm32duino/Arduino_Core_STM32/tree/main/variants/… Ничего сверх этого не утверждаем.
export interface BoardFact {
  /** Идентификатор платы в справочнике (reference/data) или null, если такой платы в справочнике ещё нет */
  board: string | null
  name: string
  chip: string
  led?: string
  button?: string
  /** Путь файла варианта в STM32duino (относительно variants/) */
  source: string
}

export const BOARD_FACTS: BoardFact[] = [
  { board: 'bluepill', name: 'Blue Pill (STM32F103C8T6)', chip: 'stm32f103c8', led: 'PC13', source: 'STM32F1xx/F103C8T_F103CB(T-U)/variant_PILL_F103Cx.h (PC13 «LED Bluepill», LED_BUILTIN = LED_GREEN = PC13)' },
  { board: 'blackpill-f411', name: 'Black Pill (WeAct STM32F411CEU6)', chip: 'stm32f411ce', led: 'PC13', button: 'PA0', source: 'STM32F4xx/F411C(C-E)(U-Y)/variant_BLACKPILL_F411CE.h (LED_BUILTIN = PC13, USER_BTN = PA0)' },
  { board: 'nucleo-f401re', name: 'NUCLEO-F401RE', chip: 'stm32f401re', led: 'PA5', button: 'PC13', source: 'STM32F4xx/F401R(B-C-D-E)T/variant_NUCLEO_F401RE.h (LED_GREEN = PA5, USER_BTN = PC13)' },
  { board: null, name: 'NUCLEO-F411RE', chip: 'stm32f411re', led: 'PA5', button: 'PC13', source: 'STM32F4xx/F411R(C-E)T/variant_NUCLEO_F411RE.h (LED_GREEN = PA5, USER_BTN = PC13)' },
  { board: null, name: 'NUCLEO-F446RE', chip: 'stm32f446re', led: 'PA5', button: 'PC13', source: 'STM32F4xx/F446R(C-E)T/variant_NUCLEO_F446RE.h (LED_GREEN = PA5, USER_BTN = PC13)' },
  { board: null, name: 'NUCLEO-F103RB', chip: 'stm32f103rb', led: 'PA5', button: 'PC13', source: 'STM32F1xx/F103R(8-B)T/variant_NUCLEO_F103RB.h (LED_GREEN = PA5, USER_BTN = PC13)' }
]
