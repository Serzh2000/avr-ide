// Сниппеты «регистровым способом» для Pro-режима. Имена регистров и битов зависят от семейства STM32 (у F1 порт настраивается через CRL/CRH,
// у остальных — MODER/PUPDR; тактирование порта лежит в разных регистрах RCC), поэтому набор строится по семейству проекта из базы чипов.
// Каждый вариант проверен компиляцией arm-none-eabi-gcc на настоящих заголовках CMSIS (см. regSnippets.test.ts); для семейства, которого нет
// в таблице, GPIO-сниппеты не предлагаются вовсе, а общие (SysTick, NVIC, ожидание) остаются.

export interface RegSnippet {
  prefix: string
  title: string
  /** Тело в синтаксисе сниппетов Monaco: ${1:значение}, $0. Повторное ${1:…} зеркалит поле. */
  body: string
  doc: string
}

interface GpioStyle {
  /** «crl»: F1 (CRL/CRH, MODE/CNF); «moder»: остальные */
  style: 'crl' | 'moder'
  /** Регистр RCC, где включается тактирование порта, и шаблон имени бита ({P} — буква порта) */
  enableReg: string
  enableBit: string
}

const GPIO: Record<string, GpioStyle> = {
  STM32F1: { style: 'crl', enableReg: 'APB2ENR', enableBit: 'RCC_APB2ENR_IOP{P}EN' },
  STM32F4: { style: 'moder', enableReg: 'AHB1ENR', enableBit: 'RCC_AHB1ENR_GPIO{P}EN' },
  STM32G4: { style: 'moder', enableReg: 'AHB2ENR', enableBit: 'RCC_AHB2ENR_GPIO{P}EN' }
}

export const gpioFamilies = (): string[] => Object.keys(GPIO)

/** Подстановка поля порта: «${1:C}» — первое поле сниппета; в тексте для компиляции берётся значение по умолчанию. */
const P = '${1:C}'
const N = '${2:13}'

export function regSnippets(family: string | null | undefined): RegSnippet[] {
  const out: RegSnippet[] = []
  const g = family ? GPIO[family.toUpperCase()] : undefined
  if (g) {
    const bit = g.enableBit.replace('{P}', P)
    const clock = `RCC->${g.enableReg} |= ${bit};\n(void)RCC->${g.enableReg};   // дождаться включения тактирования`
    if (g.style === 'crl') {
      out.push({
        prefix: 'gpio_out', title: 'Вывод порта — выход (регистры)',
        body: `${clock}\n{\n\tconst uint32_t pin = ${N};\n\tvolatile uint32_t *cr = (pin < 8u) ? &GPIO${P}->CRL : &GPIO${P}->CRH;\n\tconst uint32_t sh = (pin & 7u) * 4u;\n\t*cr = (*cr & ~(0xFu << sh)) | (0x2u << sh);   // MODE = 10 (выход 2 МГц), CNF = 00 (двухтактный)\n}\n$0`,
        doc: 'F1: порт настраивается через CRL (выводы 0–7) и CRH (8–15). Включает тактирование порта, режим выхода 2 МГц, двухтактный.'
      })
      out.push({
        prefix: 'gpio_in', title: 'Вывод порта — вход с подтяжкой к питанию (регистры)',
        body: `${clock}\n{\n\tconst uint32_t pin = ${N};\n\tvolatile uint32_t *cr = (pin < 8u) ? &GPIO${P}->CRL : &GPIO${P}->CRH;\n\tconst uint32_t sh = (pin & 7u) * 4u;\n\t*cr = (*cr & ~(0xFu << sh)) | (0x8u << sh);   // MODE = 00 (вход), CNF = 10 (подтяжка)\n\tGPIO${P}->BSRR = (1u << pin);                  // ODR = 1: подтяжка к питанию\n}\n$0`,
        doc: 'F1: вход с подтяжкой. Направление подтяжки задаёт бит ODR: здесь к питанию.'
      })
    } else {
      out.push({
        prefix: 'gpio_out', title: 'Вывод порта — выход (регистры)',
        body: `${clock}\nGPIO${P}->MODER = (GPIO${P}->MODER & ~(3u << (${N}u * 2u))) | (1u << (${N}u * 2u));   // MODER = 01: выход\n$0`,
        doc: 'Включает тактирование порта и переводит вывод в режим выхода. Тип выхода по умолчанию — двухтактный (OTYPER = 0).'
      })
      out.push({
        prefix: 'gpio_in', title: 'Вывод порта — вход с подтяжкой к питанию (регистры)',
        body: `${clock}\nGPIO${P}->MODER &= ~(3u << (${N}u * 2u));                                                  // MODER = 00: вход\nGPIO${P}->PUPDR = (GPIO${P}->PUPDR & ~(3u << (${N}u * 2u))) | (1u << (${N}u * 2u));   // PUPDR = 01: подтяжка к питанию\n$0`,
        doc: 'Включает тактирование порта, вход с подтяжкой к питанию.'
      })
    }
    out.push({ prefix: 'gpio_set', title: 'Вывод в «1» (BSRR)', body: `GPIO${P}->BSRR = (1u << ${N}u);$0`, doc: 'Атомарная установка бита порта через BSRR.' })
    out.push({ prefix: 'gpio_reset', title: 'Вывод в «0» (BSRR)', body: `GPIO${P}->BSRR = (1u << (${N}u + 16u));$0`, doc: 'Атомарный сброс бита порта через старшую половину BSRR.' })
    out.push({ prefix: 'gpio_toggle', title: 'Переключить вывод (ODR)', body: `GPIO${P}->ODR ^= (1u << ${N}u);$0`, doc: 'Чтение-изменение-запись ODR: не атомарно относительно прерываний.' })
    out.push({ prefix: 'gpio_read', title: 'Прочитать вход (IDR)', body: `if (GPIO${P}->IDR & (1u << ${N}u)) {\n\t$0\n}`, doc: 'Проверка уровня на входе через IDR.' })
  }
  out.push({
    prefix: 'systick_1ms', title: 'Системный таймер 1 мс (SysTick_Config)',
    body: 'if (SysTick_Config(SystemCoreClock / 1000u) != 0u) {\n\twhile (1) {\n\t}   // счётчик не помещается в 24 бита\n}\n$0',
    doc: 'Настраивает SysTick на прерывание раз в миллисекунду от частоты ядра SystemCoreClock. Нужен обработчик SysTick_Handler (сниппет systick_handler).'
  })
  out.push({
    prefix: 'systick_handler', title: 'Обработчик SysTick со счётчиком миллисекунд',
    body: 'volatile uint32_t ms_ticks;\n\nvoid SysTick_Handler(void)\n{\n\tms_ticks++;\n}\n\nvoid delay_ms(uint32_t ms)\n{\n\tconst uint32_t start = ms_ticks;\n\twhile ((ms_ticks - start) < ms) {\n\t}\n}\n$0',
    doc: 'Счётчик миллисекунд и ожидание на его основе. Для работы нужен SysTick_Config (сниппет systick_1ms).'
  })
  out.push({
    prefix: 'nvic_enable', title: 'Разрешить прерывание в NVIC',
    body: 'NVIC_SetPriority(${1:USART1_IRQn}, ${2:1});\nNVIC_EnableIRQ(${1:USART1_IRQn});\n$0',
    doc: 'Приоритет и разрешение прерывания. Имя вектора (…_IRQn) берётся из заголовка устройства.'
  })
  out.push({
    prefix: 'critical_section', title: 'Критическая секция (запрет прерываний)',
    body: 'const uint32_t primask = __get_PRIMASK();\n__disable_irq();\n$0\n__set_PRIMASK(primask);',
    doc: 'Запрещает прерывания и затем восстанавливает прежнее состояние маски.'
  })
  return out
}

/** Текст сниппета как обычный код: поля заменяются значениями по умолчанию (для проверки компиляцией). */
export function expandSnippet(body: string): string {
  return body.replace(/\$\{\d+:([^}]*)\}/g, '$1').replace(/\$\d+/g, '')
}
