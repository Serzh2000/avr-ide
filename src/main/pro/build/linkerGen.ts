// Генератор скрипта компоновки GNU ld по карте памяти проекта (target.memory из avride.project.json, а она — из базы чипов).
// Раскладка стандартная для STM32 (как в примерах STM32Cube): таблица векторов, код, константы, .data с загрузкой из Flash, .bss,
// резерв под кучу и стек. Имена символов (_estack, _sidata, _sdata, _edata, _sbss, _ebss) — те, что ожидают файлы startup_*.s из CMSIS ST.
import type { ProTarget } from '../project/types'

export interface LinkRegion { name: string; origin: number; length: number; attr: string; section?: string }

const num = (s: string): number => Number.parseInt(s, 16)
const hex = (n: number): string => '0x' + n.toString(16).toUpperCase().padStart(8, '0')

/** Имя области ld: латиница в верхнем регистре; CCM-память называем CCMRAM, как в примерах ST. */
export function regionName(name: string, taken: string[]): string {
  let n = /ccm/i.test(name) ? 'CCMRAM' : name.toUpperCase().replace(/[^A-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'RAM2'
  if (/^\d/.test(n)) n = 'R' + n
  let k = 2
  const base = n
  while (taken.includes(n)) n = base + k++
  return n
}

/** Области памяти для ld: FLASH, RAM и дополнительные (CCMRAM, SRAM2, …). */
export function linkRegions(m: ProTarget['memory']): LinkRegion[] {
  const out: LinkRegion[] = [
    { name: 'FLASH', origin: num(m.flash.origin), length: m.flash.size, attr: 'rx' },
    { name: 'RAM', origin: num(m.ram.origin), length: m.ram.size, attr: 'xrw' }
  ]
  for (const e of m.extra ?? []) {
    const name = regionName(e.name, out.map((r) => r.name))
    out.push({ name, origin: num(e.origin), length: e.size, attr: 'xrw', section: '.' + name.toLowerCase() })
  }
  return out
}

export interface LinkerOptions { chip: string; stack?: number; heap?: number }

export function generateLinkerScript(m: ProTarget['memory'], opt: LinkerOptions): string {
  const regions = linkRegions(m)
  const stack = opt.stack ?? 0x400
  const heap = opt.heap ?? 0x200
  const mem = regions.map((r) => `  ${r.name.padEnd(8)} (${r.attr}) : ORIGIN = ${hex(r.origin)}, LENGTH = ${r.length}`).join('\n')
  const extra = regions.filter((r) => r.section).map((r) => `
  /* Своя память «${r.name}»: переменные с __attribute__((section("${r.section}"))) */
  ${r.section} :
  {
    . = ALIGN(4);
    *(${r.section})
    *(${r.section}*)
    . = ALIGN(4);
  } >${r.name} AT> FLASH
`).join('')
  return `/* Скрипт компоновки для ${opt.chip}: создан AVR IDE по карте памяти avride.project.json.
 * Область FLASH = ${hex(regions[0].origin)} + ${regions[0].length} байт, RAM = ${hex(regions[1].origin)} + ${regions[1].length} байт.
 * Файл можно править вручную: IDE его не перезаписывает, пока вы не запросите «Создать скрипт заново». */

ENTRY(Reset_Handler)

/* Вершина стека — конец RAM */
_estack = ORIGIN(RAM) + LENGTH(RAM);

/* Минимальные размеры кучи и стека: если не помещаются в RAM, компоновщик выдаст ошибку */
_Min_Heap_Size = ${hex(heap)};
_Min_Stack_Size = ${hex(stack)};

MEMORY
{
${mem}
}

SECTIONS
{
  /* Таблица векторов прерываний — в начале Flash */
  .isr_vector :
  {
    . = ALIGN(4);
    KEEP(*(.isr_vector))
    . = ALIGN(4);
  } >FLASH

  /* Код программы */
  .text :
  {
    . = ALIGN(4);
    *(.text)
    *(.text*)
    *(.glue_7)
    *(.glue_7t)
    *(.eh_frame)

    KEEP (*(.init))
    KEEP (*(.fini))

    . = ALIGN(4);
    _etext = .;
  } >FLASH

  /* Константы */
  .rodata :
  {
    . = ALIGN(4);
    *(.rodata)
    *(.rodata*)
    . = ALIGN(4);
  } >FLASH

  .ARM.extab (READONLY) :
  {
    . = ALIGN(4);
    *(.ARM.extab* .gnu.linkonce.armextab.*)
    . = ALIGN(4);
  } >FLASH

  .ARM (READONLY) :
  {
    . = ALIGN(4);
    __exidx_start = .;
    *(.ARM.exidx*)
    __exidx_end = .;
    . = ALIGN(4);
  } >FLASH

  .preinit_array (READONLY) :
  {
    . = ALIGN(4);
    PROVIDE_HIDDEN (__preinit_array_start = .);
    KEEP (*(.preinit_array*))
    PROVIDE_HIDDEN (__preinit_array_end = .);
    . = ALIGN(4);
  } >FLASH

  .init_array (READONLY) :
  {
    . = ALIGN(4);
    PROVIDE_HIDDEN (__init_array_start = .);
    KEEP (*(SORT(.init_array.*)))
    KEEP (*(.init_array*))
    PROVIDE_HIDDEN (__init_array_end = .);
    . = ALIGN(4);
  } >FLASH

  .fini_array (READONLY) :
  {
    . = ALIGN(4);
    PROVIDE_HIDDEN (__fini_array_start = .);
    KEEP (*(SORT(.fini_array.*)))
    KEEP (*(.fini_array*))
    PROVIDE_HIDDEN (__fini_array_end = .);
    . = ALIGN(4);
  } >FLASH

  /* Начальные значения .data лежат во Flash; startup копирует их в RAM */
  _sidata = LOADADDR(.data);

  .data :
  {
    . = ALIGN(4);
    _sdata = .;
    *(.data)
    *(.data*)
    *(.RamFunc)
    *(.RamFunc*)

    . = ALIGN(4);
    _edata = .;
  } >RAM AT> FLASH
${extra}
  /* Обнуляемые переменные */
  .bss :
  {
    . = ALIGN(4);
    _sbss = .;
    __bss_start__ = _sbss;
    *(.bss)
    *(.bss*)
    *(COMMON)

    . = ALIGN(4);
    _ebss = .;
    __bss_end__ = _ebss;
  } >RAM

  /* Резерв под кучу и стек: проверка, что они помещаются в RAM */
  ._user_heap_stack :
  {
    . = ALIGN(8);
    PROVIDE ( end = . );
    PROVIDE ( _end = . );
    . = . + _Min_Heap_Size;
    . = . + _Min_Stack_Size;
    . = ALIGN(8);
  } >RAM

  .ARM.attributes 0 : { *(.ARM.attributes) }
}
`
}
