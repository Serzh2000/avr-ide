// Юнит-тесты сборки Pro-режима: ключи gcc, план и планировщик, разбор .d / .map / size / сообщений gcc, генератор скрипта компоновки, экспорт.
import test from 'node:test'
import assert from 'node:assert/strict'
import { getChip } from '../../../shared/pro/chipdb'
import { defaultProject, memoryFromChip, presetByChip } from '../project/presets'
import { scaffoldFiles } from '../project/scaffold'
import { parseDiagnostics, relativeTo } from './diagnostics'
import { parseDepFile } from './depfile'
import { exportFiles } from './exportBuild'
import { archFlags, defaultFpu, flagsFor, langOf, splitExtra } from './flags'
import { needsCompile, needsLink, runPool } from './incremental'
import type { FsLike } from './incremental'
import { generateLinkerScript, linkRegions, regionName } from './linkerGen'
import { parseMap, parseMemoryUsage, parseSizeOutput, regionUsage, symbolFromSection, toMapReport } from './mapParse'
import { makePlan, sourceList } from './plan'
import type { BuildState } from './plan'

const proj = (chip: string, name = 'Blink') => defaultProject(name, presetByChip(chip)!)
const ctxOf = (chip: string, configuration = 'Debug') => ({ root: 'C:/work/My Project', project: proj(chip), configuration })

// ---------- flags ----------

test('ключи архитектуры: ядро, FPU и float-abi по проекту', () => {
  assert.deepEqual(archFlags(proj('STM32F103C8T6').target), ['-mcpu=cortex-m3', '-mthumb', '-mfloat-abi=soft'])
  assert.deepEqual(archFlags(proj('STM32F411RET6').target), ['-mcpu=cortex-m4', '-mthumb', '-mfpu=fpv4-sp-d16', '-mfloat-abi=hard'])
  const g4 = defaultProject('G4', presetByChip('STM32G474RET6')!)
  assert.deepEqual(archFlags(g4.target), ['-mcpu=cortex-m4', '-mthumb', '-mfpu=fpv4-sp-d16', '-mfloat-abi=hard'])
  assert.deepEqual(archFlags({ ...g4.target, floatAbi: 'softfp' }), ['-mcpu=cortex-m4', '-mthumb', '-mfpu=fpv4-sp-d16', '-mfloat-abi=softfp'])
  assert.deepEqual(archFlags({ ...g4.target, floatAbi: 'soft' }), ['-mcpu=cortex-m4', '-mthumb', '-mfloat-abi=soft'])
  assert.equal(defaultFpu('cortex-m7'), 'fpv5-d16')
  assert.equal(defaultFpu('cortex-m3'), undefined)
})

test('ключи конфигурации: оптимизация, -g, defines, макрос устройства, свои ключи', () => {
  const p = proj('STM32F103C8T6')
  p.configurations.Debug.extraFlags = ['-Wextra', '-Wl,--cref', '-flto', '-lm']
  const d = flagsFor(p, 'Debug', 'STM32F103xB')
  assert.ok(d.common.includes('-Og') && d.common.includes('-g3'))
  assert.ok(d.common.includes('-ffunction-sections') && d.common.includes('-fdata-sections') && d.common.includes('-Wall'))
  assert.deepEqual(d.defines, ['-DSTM32F103xB', '-DDEBUG'])
  assert.ok(d.common.includes('-Wextra') && d.common.includes('-flto'))
  assert.ok(!d.common.includes('-Wl,--cref') && !d.common.includes('-lm'), 'ключи компоновщика не уходят компилятору')
  assert.ok(d.link.includes('-Wl,--cref') && d.link.includes('-lm') && d.link.includes('-flto'))
  for (const k of ['--specs=nano.specs', '--specs=nosys.specs', '-Wl,--gc-sections', '-Wl,--print-memory-usage']) assert.ok(d.link.includes(k), k)
  const r = flagsFor(p, 'Release')
  assert.ok(r.common.includes('-Os') && !r.common.some((x) => /^-g\d?$/.test(x)))
  assert.deepEqual(r.defines, ['-DSTM32F103xB', '-DNDEBUG'])
  assert.throws(() => flagsFor(p, 'Нет'), /нет конфигурации/)
})

test('splitExtra и langOf', () => {
  assert.deepEqual(splitExtra(['-O3', '-Wl,-u,foo', '-lnosys', '-mfpu=x']), { compile: ['-O3', '-mfpu=x'], link: ['-Wl,-u,foo', '-lnosys', '-mfpu=x'] })
  assert.equal(langOf('a/b.c'), 'c')
  assert.equal(langOf('x.cpp'), 'cpp')
  assert.equal(langOf('startup.s'), 'asm')
  assert.equal(langOf('startup.S'), 'asm')
  assert.equal(langOf('x.h'), null)
  assert.equal(langOf('Makefile'), null)
})

// ---------- plan ----------

test('план: startup первым, дубликаты убраны, заголовки отброшены', () => {
  const l = sourceList(['src/main.c', 'src/util.h', 'startup/s.s', 'src/a.cpp', 'src/main.c'], 'startup/s.s')
  assert.deepEqual(l, ['startup/s.s', 'src/main.c', 'src/a.cpp'])
})

test('план: команды компиляции и компоновки, пути с пробелами, C++ → g++', () => {
  const ctx = ctxOf('STM32F411RET6')
  const p = makePlan({ ctx, sources: ['src/main.c', 'src/x.cpp', 'startup/startup_stm32f411xe.s'], deviceDefine: 'STM32F411xE', bin: 'C:\\gcc\\bin' })
  assert.equal(p.jobs.length, 3)
  const c = p.jobs.find((j) => j.src === 'src/main.c')!
  assert.equal(c.tool, 'C:/gcc/bin/arm-none-eabi-gcc')
  assert.ok(c.args.includes('-DSTM32F411xE') && c.args.includes('-std=gnu11') && c.args.includes('-MMD') && c.args.includes('-mfloat-abi=hard'))
  assert.ok(c.args.includes('-IC:/work/My Project/include'))
  assert.ok(c.args.includes('C:/work/My Project/src/main.c'))
  assert.equal(c.obj, 'build/Debug/obj/src/main.c.o')
  const cpp = p.jobs.find((j) => j.src === 'src/x.cpp')!
  assert.equal(cpp.tool, 'C:/gcc/bin/arm-none-eabi-g++')
  assert.ok(cpp.args.includes('-fno-exceptions'))
  const asm = p.jobs.find((j) => j.lang === 'asm')!
  assert.ok(asm.args.includes('assembler-with-cpp'))
  assert.equal(p.link.tool, 'C:/gcc/bin/arm-none-eabi-g++')
  assert.ok(p.link.cpp && p.link.args.some((a) => a.startsWith('@')) && p.link.args.includes('-T'))
  assert.match(p.link.rspText, /^"build\/Debug\/obj\/startup\//)
  assert.ok(p.link.args.includes('build/Debug/Blink.elf') && p.link.args.includes('@build/Debug/objects.rsp'), 'при компоновке пути относительные (кириллица в корне проекта)')
  assert.equal(p.link.elf, 'build/Debug/Blink.elf')
  assert.equal(p.outDir, 'build/Debug')
  // другой набор ключей → другой хэш команды
  const r = makePlan({ ctx: ctxOf('STM32F411RET6', 'Release'), sources: ['src/main.c'], bin: 'C:\\gcc\\bin' })
  assert.notEqual(r.jobs[0].sig, makePlan({ ctx, sources: ['src/main.c'], bin: 'C:\\gcc\\bin' }).jobs[0].sig)
  assert.equal(makePlan({ ctx, sources: ['src/main.c'] }).jobs[0].tool, 'arm-none-eabi-gcc')
})

// ---------- .d и инкрементальность ----------

test('depfile: пробелы, переносы, фиктивные цели -MP, диск в пути', () => {
  const t = 'build/Debug/obj/src/main.c.o: C:/p/My\\ Project/src/main.c \\\n C:/p/My\\ Project/include/a.h \\\n /usr/include/x.h\n\nC:/p/My\\ Project/include/a.h:\n'
  assert.deepEqual(parseDepFile(t), ['C:/p/My Project/src/main.c', 'C:/p/My Project/include/a.h', '/usr/include/x.h'])
  assert.deepEqual(parseDepFile('C:/o/main.o: C:/src/main.c C:/src/a.h\n'), ['C:/src/main.c', 'C:/src/a.h'])
  assert.deepEqual(parseDepFile(''), [])
})

function fakeFs(files: Record<string, { t: number; text?: string }>): FsLike {
  return { mtime: async (r) => files[r]?.t ?? null, readText: async (r) => files[r]?.text ?? null }
}
const absToRel = (p: string): string | null => (p.startsWith('/w/') ? p.slice(3) : null)

test('инкрементальность: что пересобирается и почему', async () => {
  const plan = makePlan({ ctx: { ...ctxOf('STM32F103C8T6'), root: '/w' }, sources: ['src/main.c'], deviceDefine: 'STM32F103xB' })
  const job = plan.jobs.find((j) => j.src === 'src/main.c')!
  const state: BuildState = { v: 1, sigs: { [job.obj]: job.sig } }
  const objs = Object.fromEntries(plan.jobs.map((j) => [j.obj, { t: 100 }]))
  const base = { ...objs, [job.obj]: { t: 100 }, [job.src]: { t: 50 }, [job.dep]: { t: 100, text: `x.o: /w/${job.src} /w/include/a.h /usr/lib/gcc/stdio.h\n` }, 'include/a.h': { t: 60 } }
  assert.equal((await needsCompile(job, state, fakeFs(base), absToRel)).need, false)
  assert.match((await needsCompile(job, state, fakeFs({ ...base, [job.obj]: undefined as never }), absToRel)).why, /нет объектного/)
  assert.equal((await needsCompile(job, state, fakeFs({ ...base, [job.src]: { t: 200 } }), absToRel)).need, true)
  assert.match((await needsCompile(job, state, fakeFs({ ...base, 'include/a.h': { t: 300 } }), absToRel)).why, /a\.h/)
  assert.equal((await needsCompile(job, { v: 1, sigs: {} }, fakeFs(base), absToRel)).need, true, 'ключи изменились')
  assert.equal((await needsCompile(job, state, fakeFs({ ...base, [job.dep]: undefined as never }), absToRel)).need, true, 'нет .d')
  assert.equal((await needsCompile(job, state, fakeFs({ ...base, 'include/a.h': undefined as never }), absToRel)).need, true, 'заголовок исчез')
  // компоновка
  const link = { ...state, link: plan.link.sig }
  const fs = fakeFs({ ...base, [plan.link.elf]: { t: 150 }, [plan.linkerScript]: { t: 10 } })
  assert.equal(await needsLink(plan, link, false, fs), false)
  assert.equal(await needsLink(plan, link, true, fs), true)
  assert.equal(await needsLink(plan, { ...link, link: 'x' }, false, fs), true)
  assert.equal(await needsLink(plan, link, false, fakeFs({ ...base, [plan.link.elf]: { t: 150 }, [plan.linkerScript]: { t: 400 } })), true, 'скрипт новее')
  assert.equal(await needsLink(plan, link, false, fakeFs({ ...base, [job.obj]: { t: 999 }, [plan.link.elf]: { t: 150 }, [plan.linkerScript]: { t: 10 } })), true, 'объект новее ELF')
})

test('пул: параллелизм ограничен, после неудачи новые не стартуют, отмена', async () => {
  let active = 0
  let peak = 0
  const r = await runPool([1, 2, 3, 4, 5, 6, 7, 8], 3, async () => { active++; peak = Math.max(peak, active); await new Promise((x) => setTimeout(x, 5)); active--; return true })
  assert.equal(r.ok, 8)
  assert.ok(peak <= 3 && peak >= 2, 'пик ' + peak)
  const started: number[] = []
  const f = await runPool([1, 2, 3, 4, 5, 6], 1, async (n) => { started.push(n); return n !== 2 })
  assert.deepEqual(started, [1, 2])
  assert.equal(f.failed, 1)
  assert.equal(f.notStarted, 4)
  const ac = new AbortController()
  ac.abort()
  assert.equal((await runPool([1, 2], 2, async () => true, ac.signal)).notStarted, 2)
})

// ---------- диагностика gcc ----------

test('диагностика: ошибки, предупреждения, пути проекта, линкер, переполнение области', () => {
  const root = 'C:/work/My Project'
  const text = [
    'C:/work/My Project/src/main.c: In function \'main\':',
    'C:/work/My Project/src/main.c:12:5: error: \'x\' undeclared (first use in this function)',
    'C:\\work\\My Project\\src\\util.c:3:1: warning: unused variable \'y\' [-Wunused-variable]',
    'C:/work/My Project/include/a.h:7:3: note: declared here',
    'C:/work/My Project/src/main.c:12:5: error: \'x\' undeclared (first use in this function)',
    'main.c.o: in function `main\':',
    'C:/work/My Project/src/main.c:20: undefined reference to `foo\'',
    'arm-none-eabi/bin/ld.exe: region `FLASH\' overflowed by 1234 bytes',
    'collect2.exe: error: ld returned 1 exit status',
    'fatal error: no input files'
  ].join('\n')
  const d = parseDiagnostics(text, root)
  assert.deepEqual(d[0], { severity: 'error', message: "'x' undeclared (first use in this function)", file: 'src/main.c', line: 12, column: 5 })
  assert.equal(d[1].file, 'src/util.c')
  assert.equal(d[1].severity, 'warning')
  assert.equal(d[2].severity, 'note')
  assert.equal(d[2].file, 'include/a.h')
  assert.equal(d.filter((x) => x.message.startsWith("'x'")).length, 1, 'повтор схлопнут')
  assert.ok(d.some((x) => /undefined reference to `foo'/.test(x.message) && x.line === 20))
  assert.ok(d.some((x) => /FLASH переполнена на 1234 байт/.test(x.message)))
  assert.ok(d.some((x) => /Компоновщик: ld returned 1/.test(x.message)))
  assert.ok(d.some((x) => x.message === 'no input files'))
  assert.equal(relativeTo('C:\\a\\b', 'c:/A/b/x/y.c'), 'x/y.c')
  assert.equal(relativeTo('C:/a', 'D:/z.c'), 'D:/z.c')
})

// ---------- скрипт компоновки ----------

test('скрипт компоновки: F103C8 — FLASH и RAM, символы startup, куча и стек', () => {
  const ld = generateLinkerScript(proj('STM32F103C8T6').target.memory, { chip: 'STM32F103C8T6' })
  assert.match(ld, /FLASH\s+\(rx\) : ORIGIN = 0x08000000, LENGTH = 65536/)
  assert.match(ld, /RAM\s+\(xrw\) : ORIGIN = 0x20000000, LENGTH = 20480/)
  for (const s of ['ENTRY(Reset_Handler)', '_estack = ORIGIN(RAM) + LENGTH(RAM)', '_sidata = LOADADDR(.data)', '_sdata = .', '_edata = .', '_sbss = .', '_ebss = .', '._user_heap_stack', 'KEEP(*(.isr_vector))', '>RAM AT> FLASH', '_Min_Stack_Size = 0x00000400']) assert.ok(ld.includes(s), s)
  assert.doesNotMatch(ld, /CCMRAM/)
})

test('скрипт компоновки: G474RE и F407VG с CCM, H743ZI с банками Flash и AXI-RAM', () => {
  const g4 = memoryFromChip(getChip('stm32g474re')!)
  assert.deepEqual(g4.flash, { origin: '0x08000000', size: 524288 })
  assert.deepEqual(g4.ram, { origin: '0x20000000', size: 96 * 1024 }, 'SRAM1 + SRAM2 слиты')
  assert.deepEqual(g4.extra, [{ name: 'CCMSRAM', origin: '0x10000000', size: 32768 }])
  const ld = generateLinkerScript(g4, { chip: 'STM32G474RET6' })
  assert.match(ld, /CCMRAM\s+\(xrw\) : ORIGIN = 0x10000000, LENGTH = 32768/)
  assert.match(ld, /\.ccmram :/)
  const f4 = memoryFromChip(getChip('stm32f407vg')!)
  assert.equal(f4.ram.size, 128 * 1024)
  assert.equal(f4.extra?.[0].size, 64 * 1024)
  const h7 = memoryFromChip(getChip('stm32h743zi')!)
  assert.deepEqual(h7.flash, { origin: '0x08000000', size: 2 * 1024 * 1024 }, 'два банка по 1 МБ слиты')
  assert.equal(h7.ram.origin, '0x24000000')
  assert.equal(h7.ram.size, 512 * 1024)
  assert.ok((h7.extra ?? []).some((e) => /DTCM/.test(e.name)))
  assert.deepEqual(linkRegions(g4).map((r) => r.name), ['FLASH', 'RAM', 'CCMRAM'])
  assert.equal(regionName('SRAM2', ['FLASH', 'RAM']), 'SRAM2')
  assert.equal(regionName('RAM', ['FLASH', 'RAM']), 'RAM2')
  assert.equal(regionName('SRAM1-3 (D2)', []), 'SRAM1_3_D2')
})

// ---------- .map и size ----------

const MAP = `Memory Configuration

Name             Origin             Length             Attributes
FLASH            0x08000000         0x00010000         xr
RAM              0x20000000         0x00005000         xrw
*default*        0x00000000         0xffffffff

Linker script and memory map

LOAD C:/p/build/Debug/obj/startup/s.s.o
                0x20005000                        _estack = (ORIGIN (RAM) + LENGTH (RAM))

.isr_vector     0x08000000      0x10c
                0x08000000                        . = ALIGN (0x4)
 *(.isr_vector)
 .isr_vector    0x08000000      0x10c C:/p/My Project/build/Debug/obj/startup/s.s.o
                0x08000000                g_pfnVectors

.text           0x0800010c      0x148
 *(.text*)
 .text.__do_global_dtors_aux
                0x0800010c       0x24 C:/gcc/lib/crtbegin.o
 .text.main     0x08000130       0x48 C:/p/My Project/build/Debug/obj/src/main.c.o
                0x08000130                main
 .text.startup.big_init
                0x08000178       0x90 C:/p/My Project/build/Debug/obj/src/main.c.o
 .text          0x08000208       0x50 C:/gcc/libc_nano.a(lib_a-init.o)
                0x08000208                __libc_init_array

.data           0x20000000       0x10 load address 0x080002a0
 *(.data*)
 .data.counter  0x20000000       0x10 C:/p/My Project/build/Debug/obj/src/main.c.o

.bss            0x20000010       0x1c load address 0x080002b0
 .bss.buffer    0x20000010       0x1c C:/p/My Project/build/Debug/obj/src/main.c.o
 COMMON         0x2000002c        0x4 C:/p/My Project/build/Debug/obj/src/main.c.o
 *fill*         0x20000030        0x4

._user_heap_stack
                0x20000030      0x604 load address 0x080002b0
 *fill*         0x20000030      0x604

.debug_info     0x00000000      0x439
 .debug_info    0x00000000      0x439 C:/p/x.o

Cross Reference Table

Symbol                                            File
main                                              C:/p/main.o
`

test('карта: области, секции, адреса загрузки, входные секции', () => {
  const m = parseMap(MAP)
  assert.deepEqual(m.regions, [{ name: 'FLASH', origin: 0x08000000, length: 0x10000 }, { name: 'RAM', origin: 0x20000000, length: 0x5000 }])
  assert.deepEqual(m.sections.map((s) => s.name), ['.isr_vector', '.text', '.data', '.bss', '._user_heap_stack'])
  const data = m.sections.find((s) => s.name === '.data')!
  assert.equal(data.origin, 0x20000000)
  assert.equal(data.size, 0x10)
  assert.equal(data.lma, 0x080002a0)
  const names = m.inputs.map((i) => i.name)
  assert.ok(names.includes('main') && names.includes('counter') && names.includes('buffer') && names.includes('big_init') && names.includes('__do_global_dtors_aux'))
  assert.ok(names.includes('.text (lib_a-init)') || names.includes('.text (libc_nano.a(lib_a-init.o))') || names.some((n) => n.startsWith('.text (')))
  assert.equal(m.inputs.find((i) => i.name === 'main')!.size, 0x48)
  assert.ok(m.inputs.find((i) => i.file.includes('My Project')), 'путь с пробелом читается целиком')
  assert.equal(symbolFromSection('.rodata.str1.4', 'x.o'), 'str1.4')
  assert.equal(symbolFromSection('.text', 'C:/a/lib.a(init.o)'), '.text (lib.a(init.o))')
})

test('карта: использование областей (NOBITS не считаются во Flash) и отчёт', () => {
  const m = parseMap(MAP)
  const u = regionUsage(m, m.regions)
  const flash = u.find((r) => r.name === 'FLASH')!
  assert.equal(flash.used, 0x10c + 0x148 + 0x10, 'vector + text + загрузочный образ .data')
  assert.equal(flash.overflow, false)
  const ram = u.find((r) => r.name === 'RAM')!
  assert.equal(ram.used, 0x10 + 0x1c + 0x604)
  assert.equal(regionUsage(m, [{ name: 'F', origin: 0x08000000, length: 100 }])[0].overflow, true)
  const rep = toMapReport(m, m.regions, 3)
  assert.equal(rep.topSymbols.length, 3)
  assert.ok(rep.topSymbols[0].size >= rep.topSymbols[1].size)
  assert.equal(rep.sections.find((s) => s.name === '.data')!.region, 'RAM')
  assert.equal(rep.sections.find((s) => s.name === '.text')!.region, 'FLASH')
})

test('вывод size и таблица использования памяти ld', () => {
  const s = parseSizeOutput('   text\t   data\t    bss\t    dec\t    hex\tfilename\n    604\t      0\t   1568\t   2172\t    87c\tbuild/Debug/Blink.elf\n', { flashTotal: 65536, ramTotal: 20480 })!
  assert.deepEqual(s, { textBytes: 604, dataBytes: 0, bssBytes: 1568, flashUsed: 604, ramUsed: 1568, flashTotal: 65536, ramTotal: 20480 })
  assert.equal(parseSizeOutput('ошибка', { flashTotal: 1, ramTotal: 1 }), null)
  const u = parseMemoryUsage('Memory region         Used Size  Region Size  %age Used\n           FLASH:         604 B        64 KB      0.92%\n             RAM:        1568 B        20 KB      7.66%\n          CCMRAM:           2 KB        32 KB      6.25%\n')
  assert.deepEqual(u, { FLASH: 604, RAM: 1568, CCMRAM: 2048 })
})

// ---------- экспорт ----------

test('экспорт: Makefile и CMakeLists из проекта', () => {
  const project = proj('STM32G474RET6', 'My_App')
  project.configurations.Release.extraFlags = ['-flto', '-Wl,--no-warn-rwx-segments']
  const f = exportFiles({ project, sources: ['src/main.c', 'src/x.cpp', 'drivers/CMSIS/Device/ST/STM32G4xx/Source/system_stm32g4xx.c'], deviceDefine: 'STM32G474xx' })
  const mk = f['Makefile']
  assert.match(mk, /^# Создан AVR IDE/)
  for (const s of ['TARGET  = My_App', 'ARCH    = -mcpu=cortex-m4 -mthumb -mfpu=fpv4-sp-d16 -mfloat-abi=hard', '-DSTM32G474xx', 'ifeq ($(CONFIG),Debug)', 'else ifeq ($(CONFIG),Release)', 'OPT = -Os', 'OPT = -Og', 'DBG = -g3', 'LDSCRIPT = linker/STM32G474RET6_FLASH.ld', 'LINK = $(CXX)', 'startup/startup_stm32g474xx.s', '--specs=nano.specs', '$(BUILD)/obj/%.c.o: %.c', '-include $(OBJS:.o=.d)']) assert.ok(mk.includes(s), s)
  assert.ok(/\n\t\$\(CC\) \$\(CFLAGS\) -c/.test(mk), 'в рецептах табуляция')
  const cm = f['CMakeLists.txt']
  for (const s of ['cmake_minimum_required', 'project(My_App C CXX ASM)', 'CMAKE_SYSTEM_NAME Generic', 'startup/startup_stm32g474xx.s', '$<$<CONFIG:Release>:-Os;-flto>', '$<$<CONFIG:Debug>:DEBUG>', 'target_link_options', 'objcopy', '-T${CMAKE_SOURCE_DIR}/linker/STM32G474RET6_FLASH.ld']) assert.ok(cm.includes(s), s)
  // обычный проект без C++
  assert.match(exportFiles({ project: proj('STM32F103C8T6'), sources: ['src/main.c'] })['Makefile'], /LINK = \$\(CC\)/)
})

test('мастер: проекты из базы чипов собираются в корректную структуру, F3/L1/G4 получают свой тактовый блок', () => {
  for (const chip of ['STM32G474RET6', 'STM32L476RGT6', 'STM32F303RET6', 'STM32L152RET6', 'STM32G431KBT6']) {
    const p = presetByChip(chip)!
    assert.ok(p, chip)
    const files = scaffoldFiles('X', p, 'blink')
    const src = files['src/main.c']
    assert.match(src, p.series === 'F3' || p.series === 'L1' ? /RCC->AHBENR \|= RCC_AHBENR_GPIO/ : /RCC->AHB2ENR \|= RCC_AHB2ENR_GPIO/, chip)
    assert.match(files[`linker/${chip}_FLASH.ld`], /MEMORY/)
    const json = JSON.parse(files['avride.project.json']) as { defines: string[]; sources: string[]; includes: string[]; target: { memory: { ram: { origin: string } } } }
    assert.ok(json.defines[0] === getChip(chip.toLowerCase().replace(/[a-z]\d$/, ''))!.files.define)
    assert.ok(json.includes.includes('drivers/CMSIS/Include'))
    assert.ok(json.sources.some((s) => s.startsWith('drivers/CMSIS/Device/ST/STM32')))
  }
})
