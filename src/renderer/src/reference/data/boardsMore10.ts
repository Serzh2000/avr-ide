// Платы пятой волны: STM32 Nucleo-64 (F411RE, F446RE, F103RB, L053R8, L476RG, G474RE) и Nucleo-32 G431KB.
// Соответствие Arduino ↔ порт — из файлов variant_NUCLEO_*.cpp/.h ядра STM32duino (проверено в этой сессии), функции выводов — из PeripheralPins.c (stm32FuncsMore.ts).
import type { BoardEntry, PinInfo } from '../types'
import { stm32FuncsMore } from './stm32FuncsMore'

type Chip = 'f411re' | 'f446re' | 'f103rb' | 'l053r8' | 'l476rg' | 'g474re' | 'g431kb'
const mk = (chip: Chip, name: string, notes?: string, extra: string[] = [], special?: PinInfo['special']): PinInfo => ({
  label: name, gpio: null, code: name, functions: ['GPIO', ...(stm32FuncsMore[chip][name] ?? []), ...extra], notes, special
})
const pw = (label: string, kind: NonNullable<PinInfo['kind']>, notes: string): PinInfo => ({ label, gpio: null, functions: [], notes, kind })
const GND = (extra = ''): PinInfo => pw('GND', 'gnd', 'Земля (общий провод).' + extra)
const NC = (n = 'Не подключён (резервируется).'): PinInfo => pw('NC', 'nc', n)

const SRC = (path: string): string => `https://github.com/stm32duino/Arduino_Core_STM32/tree/main/variants/${path}`
const UM = 'https://www.st.com/resource/en/user_manual/um1724-stm32-nucleo64-boards-mb1136-stmicroelectronics.pdf'

interface N64 { id: string; name: string; chip: Chip; mcu: string; family: string; osc: [string, string]; pb11: boolean; vcp: string; d01?: [string, string]; extraNote?: string }

const nucleo64 = (c: N64): BoardEntry => {
  const arduino: Record<string, string> = {
    PA3: 'D0', PA2: 'D1', PA10: 'D2', PB3: 'D3', PB5: 'D4', PB4: 'D5', PB10: 'D6', PA8: 'D7', PA9: 'D8', PC7: 'D9', PB6: 'D10', PA7: 'D11', PA6: 'D12', PA5: 'D13', PB9: 'D14', PB8: 'D15',
    PA0: 'A0', PA1: 'A1', PA4: 'A2', PB0: 'A3', PC1: 'A4', PC0: 'A5'
  }
  if (c.d01) { delete arduino.PA3; delete arduino.PA2; arduino[c.d01[0]] = 'D1'; arduino[c.d01[1]] = 'D0' }
  const spec: Record<string, { extra?: string[]; notes?: string; special?: PinInfo['special'] }> = {
    PA2: { extra: [`${c.vcp} TX (VCP ST-LINK)`], notes: `Соединён с виртуальным COM-портом ST-LINK: Serial по умолчанию (PIN_SERIAL_TX = PA2).` },
    PA3: { extra: [`${c.vcp} RX (VCP ST-LINK)`], notes: `Виртуальный COM-порт ST-LINK (PIN_SERIAL_RX = PA3).` },
    PA5: { extra: ['LED_BUILTIN (LD2)'], notes: 'Зелёный светодиод LD2 (STM32duino: LED_GREEN = LED_BUILTIN = PA5).' },
    PC13: { extra: ['B1 USER (кнопка)'], notes: 'Синяя кнопка B1 USER (STM32duino: USER_BTN = PC13).' },
    PA13: { extra: ['SWDIO'], notes: 'Данные SWD (подключены к ST-LINK). Не занимать — пропадёт отладка/прошивка.' },
    PA14: { extra: ['SWCLK'], notes: 'Такт SWD (подключён к ST-LINK). Не занимать.' },
    PA11: { special: 'usb', notes: 'USB D− (на плате USB-разъёма нет — вывод только на Morpho).' },
    PA12: { special: 'usb', notes: 'USB D+ (на плате USB-разъёма нет — вывод только на Morpho).' }
  }
  const names = ['PA0', 'PA1', 'PA2', 'PA3', 'PA4', 'PA5', 'PA6', 'PA7', 'PA8', 'PA9', 'PA10', 'PA11', 'PA12', 'PA13', 'PA14', 'PA15',
    'PB0', 'PB1', 'PB2', 'PB3', 'PB4', 'PB5', 'PB6', 'PB7', 'PB8', 'PB9', 'PB10', ...(c.pb11 ? ['PB11'] : []), 'PB12', 'PB13', 'PB14', 'PB15',
    'PC0', 'PC1', 'PC2', 'PC3', 'PC4', 'PC5', 'PC6', 'PC7', 'PC8', 'PC9', 'PC10', 'PC11', 'PC12', 'PC13', 'PC14', 'PC15', 'PD2', ...c.osc]
  const pins: PinInfo[] = names.map((n) => {
    const s = spec[n] ?? {}
    const a = arduino[n]
    const notes = [a ? `Arduino ${a}.` : '', s.notes ?? ''].filter(Boolean).join(' ')
    return mk(c.chip, n, notes || undefined, s.extra ?? [], s.special)
  })
  pins.push(
    pw('NRST', 'reset', 'Сброс (RESET на CN6/CN7): низкий уровень — перезапуск; дублирует чёрную кнопку B2 RESET.'),
    pw('BOOT0', 'power', 'Вход BOOT0 (Morpho CN7-7).'), pw('IOREF', 'ref', 'Опорное напряжение логики платы (3.3 В) для шилдов Arduino.'),
    pw('3V3', 'power', 'Выход стабилизатора 3.3 В.'), pw('5V', 'power', 'Шина 5 В: выход (от USB ST-LINK / VIN / E5V). Питание платы отсюда не подавать.'),
    pw('VIN', 'power', 'Вход внешнего питания 7–12 В (Arduino-совместимо).'), pw('E5V', 'power', 'Вход внешнего 5 В (перемычка JP5 в положении E5V).'),
    pw('U5V', 'power', '5 В от USB ST-LINK.'), pw('VDD', 'power', 'VDD микроконтроллера (3.3 В), CN7-5.'), pw('AVDD', 'ref', 'Питание аналоговой части / опора АЦП (CN5, CN10-7).'),
    pw('AGND', 'gnd', 'Земля аналоговой части (CN10-32).'), pw('VBAT', 'power', 'Питание батарейного домена (CN7-33).'), GND(' Несколько выводов GND соединены.'), NC()
  )
  return {
    id: c.id, name: `Nucleo-64 ${c.name}`, mcu: c.mcu, platform: 'stm32',
    pins,
    electrical: { logic: 'Логика 3.3 В. VDD = 3.3 В.', current: 'См. даташит микроконтроллера.', supply: 'USB ST-LINK (5 В), VIN 7–12 В или E5V 5 В; выбор перемычкой JP5' },
    specs: [
      ['Разъёмы', 'Arduino Uno V3 (CN5, CN6, CN8, CN9) + ST Morpho (CN7, CN10, по 2 × 19)'],
      ['ST-LINK', `отладка/прошивка по USB, виртуальный COM-порт (${c.vcp}: PA2/PA3)`],
      ['Светодиод', 'LD2 = PA5 (D13)'], ['Кнопки', 'B1 USER = PC13, B2 RESET']
    ],
    notes: [
      `Соответствие Arduino ↔ порт — из variant_NUCLEO_${c.name.replace('NUCLEO-', '')}.cpp/.h ядра STM32duino: D0–D15 и A0–A5 по цоколёвке, как у NUCLEO-F401RE${c.d01 ? ', кроме D0/D1' : ''}. Функции выводов (ADC, ШИМ, I2C, SPI, UART) — из PeripheralPins.c того же ядра. ` + `Каталог ядра: ${c.family}.`,
      `Порядок выводов Arduino-разъёмов (CN5: D15…D8, CN9: D7…D0, CN6: NC, IOREF, NRST, 3V3, 5V, GND, GND, VIN, CN8: A0…A5) и Morpho (CN7, CN10) принят таким же, как у NUCLEO-F401RE: набор выводов на Morpho в файлах ядра у всех этих плат совпадает по составу${c.osc[0] === 'PH0' ? '' : `, вместо PH0/PH1 — ${c.osc[0]}/${c.osc[1]}`}. Не подтверждено по руководству UM1724 (страница st.com не открылась): положение отдельных Morpho-выводов${c.pb11 ? '' : ' (вывод CN10-18 — NC: у этого кристалла нет PB11)'}.`,
      c.d01 ? `Особенность: на этой плате по variant-файлу D1 = ${c.d01[0]}, D0 = ${c.d01[1]} (не PA2/PA3), а Serial по умолчанию — виртуальный COM-порт на PA2/PA3.` : `Serial по умолчанию — ${c.vcp} на PA2/PA3 (виртуальный COM-порт ST-LINK).`,
      c.extraNote ?? 'Размер платы (реальной) 70 × 82.5 мм; на схеме масштаб ×1.7 для читаемости подписей. Положение деталей на рендере приблизительное; светодиод LD2 — PA5, кнопка B1 — PC13.'
    ].filter(Boolean)
  }
}

const NUC64 = (c: Omit<N64, 'extraNote'>): BoardEntry => nucleo64(c)

const g431 = (n: string, notes: string, extra: string[] = [], special?: PinInfo['special']): PinInfo => mk('g431kb', n, notes, extra, special)
const nucleoG431: BoardEntry = {
  id: 'nucleo-g431kb', name: 'Nucleo-32 NUCLEO-G431KB', mcu: 'STM32G431KBT6', platform: 'stm32',
  pins: [
    g431('PA10', 'Arduino D0 (RX).', ['USART1 RX (Serial1)']), g431('PA9', 'Arduino D1 (TX).', ['USART1 TX (Serial1)']), g431('PA12', 'Arduino D2.', [], 'usb'),
    g431('PB0', 'Arduino D3.'), g431('PB7', 'Arduino D4; I2C1 SDA (PIN_WIRE_SDA).'), g431('PA15', 'Arduino D5; I2C SCL (PIN_WIRE_SCL = PA15)'),
    g431('PB6', 'Arduino D6.'), g431('PF0', 'Arduino D7.'), g431('PF1', 'Arduino D8.'), g431('PA8', 'Arduino D9.'),
    g431('PA11', 'Arduino D10.', [], 'usb'), g431('PB5', 'Arduino D11.'), g431('PB4', 'Arduino D12.'),
    g431('PB8', 'Arduino D13 и зелёный светодиод LD2 (LED_BUILTIN = PB8 при SB7 замкнутой, SB6 разомкнутой; иначе D13 = PB3 — по комментарию в variant-файле).', ['LED_BUILTIN (LD2)']),
    g431('PA0', 'Arduino A0.'), g431('PA1', 'Arduino A1.'), g431('PA3', 'Arduino A2 (VCP RX при SB12 замкнутой).', ['USART2 RX']), g431('PA4', 'Arduino A3.'),
    g431('PA5', 'Arduino A4 (SPI SCK; также соединён с PB7 при SB3 замкнутой).'), g431('PA6', 'Arduino A5 (также соединён с PA15 при SB2 замкнутой).'),
    g431('PA7', 'Arduino A6 (SPI MOSI).'), g431('PA2', 'Arduino A7 (VCP TX ST-LINK при SB1 замкнутой).', ['USART2 TX (VCP ST-LINK)']),
    pw('NRST', 'reset', 'Сброс (RESET на CN3/CN4): низкий уровень — перезапуск.'), pw('AREF', 'ref', 'Опорное напряжение АЦП (CN4 «REF»).'),
    pw('3V3', 'power', 'Выход стабилизатора 3.3 В.'), pw('5V', 'power', 'Шина 5 В (от USB ST-LINK / VIN).'), pw('VIN', 'power', 'Вход внешнего питания (Arduino-Nano-совместимо).'), GND()
  ],
  electrical: { logic: 'Логика 3.3 В.', current: 'См. даташит STM32G431.', supply: 'USB ST-LINK (5 В) или VIN' },
  specs: [['Форм-фактор', 'Arduino Nano (2 × 15 выводов, шаг 2.54 мм, ряды 15.24 мм)'], ['ST-LINK', 'отладка/прошивка по USB, виртуальный COM-порт (PA2/PA3)'], ['Светодиод', 'LD2 = PB8 (D13)']],
  notes: [
    'Соответствие Arduino ↔ порт — из variant_NUCLEO_G431KB.cpp/.h ядра STM32duino (digitalPin[]: D0 = PA10, D1 = PA9, D2 = PA12, D3 = PB0, D4 = PB7, D5 = PA15, D6 = PB6, D7 = PF0, D8 = PF1, D9 = PA8, D10 = PA11, D11 = PB5, D12 = PB4, D13 = PB8; A0…A7 = PA0, PA1, PA3, PA4, PA5, PA6, PA7, PA2). Функции выводов — PeripheralPins.c.',
    'Не подтверждено: порядок выводов по разъёмам CN3/CN4 принят таким же, как у NUCLEO-L432KC (форм-фактор Nano: ряд «CN3» — D1, D0, RST, GND, D2…D12, ряд «CN4» — VIN, GND, RST, 5V, A7…A0, REF, 3V3, D13) — руководство UM1956 не открывалось.',
    'Кнопка пользователя у платы отсутствует (USER_BTN не определён в variant-файле), есть только RESET. Положение деталей на рендере приблизительное.'
  ]
}

export const moreBoards10: BoardEntry[] = [
  NUC64({ id: 'nucleo-f411re', name: 'NUCLEO-F411RE', chip: 'f411re', mcu: 'STM32F411RET6', family: 'STM32F4xx/F411R(C-E)T', osc: ['PH0', 'PH1'], pb11: false, vcp: 'USART2' }),
  NUC64({ id: 'nucleo-f446re', name: 'NUCLEO-F446RE', chip: 'f446re', mcu: 'STM32F446RET6', family: 'STM32F4xx/F446R(C-E)T', osc: ['PH0', 'PH1'], pb11: false, vcp: 'USART2' }),
  NUC64({ id: 'nucleo-f103rb', name: 'NUCLEO-F103RB', chip: 'f103rb', mcu: 'STM32F103RBT6', family: 'STM32F1xx/F103R(8-B)T', osc: ['PD0', 'PD1'], pb11: true, vcp: 'USART2' }),
  NUC64({ id: 'nucleo-l053r8', name: 'NUCLEO-L053R8', chip: 'l053r8', mcu: 'STM32L053R8T6', family: 'STM32L0xx/L052R(6-8)T_L053R(6-8)T_L063R8T', osc: ['PH0', 'PH1'], pb11: true, vcp: 'USART2' }),
  NUC64({ id: 'nucleo-l476rg', name: 'NUCLEO-L476RG', chip: 'l476rg', mcu: 'STM32L476RGT6', family: 'STM32L4xx/L475R(C-E-G)T_L476R(C-E-G)T_L486RGT', osc: ['PH0', 'PH1'], pb11: true, vcp: 'USART2' }),
  NUC64({ id: 'nucleo-g474re', name: 'NUCLEO-G474RE', chip: 'g474re', mcu: 'STM32G474RET6', family: 'STM32G4xx/G473R(B-C)T_G473RETx(Z)_G474R(B-C-E)T_G483RET_G484RET', osc: ['PF0', 'PF1'], pb11: true, vcp: 'LPUART1', d01: ['PC4', 'PC5'] }),
  nucleoG431
]

export const moreSources10: Record<string, string[]> = {
  'nucleo-f411re': [SRC('STM32F4xx/F411R(C-E)T'), UM],
  'nucleo-f446re': [SRC('STM32F4xx/F446R(C-E)T'), UM],
  'nucleo-f103rb': [SRC('STM32F1xx/F103R(8-B)T'), UM],
  'nucleo-l053r8': [SRC('STM32L0xx/L052R(6-8)T_L053R(6-8)T_L063R8T'), UM],
  'nucleo-l476rg': [SRC('STM32L4xx/L475R(C-E-G)T_L476R(C-E-G)T_L486RGT'), UM],
  'nucleo-g474re': [SRC('STM32G4xx/G473R(B-C)T_G473RETx(Z)_G474R(B-C-E)T_G483RET_G484RET'), UM],
  'nucleo-g431kb': [SRC('STM32G4xx/G431K(6-8-B)(T-U)_G441KB(T-U)')]
}
