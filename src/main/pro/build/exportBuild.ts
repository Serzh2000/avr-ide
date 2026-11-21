// Экспорт проекта в Makefile и CMakeLists.txt: пользователь может собирать вне IDE (GNU make или CMake + Ninja/Make).
// Ключи те же, что у встроенного сборщика (flags.ts); пути относительные от корня проекта, компилятор — arm-none-eabi-gcc из PATH.
import { debugFlag, flagsFor, langOf, optimizationFlag, splitExtra } from './flags'
import type { ProProject } from '../project/types'

export interface ExportInput {
  project: ProProject
  /** Все исходники (относительные пути с «/»), без startup — он добавляется отдельно */
  sources: string[]
  deviceDefine?: string
}

export const EXPORT_FILES = ['Makefile', 'CMakeLists.txt'] as const

const HEADER = '# Создан AVR IDE (профессиональный режим) из avride.project.json. Не правьте вручную: IDE перезапишет файл при повторном экспорте.\n'

function sourcesOf(i: ExportInput): string[] {
  const out: string[] = []
  for (const f of [i.project.startupFile, ...i.sources]) if (langOf(f) && !out.includes(f)) out.push(f)
  return out
}

const q = (s: string): string => (/[\s"'$#&|;<>()`\\]/.test(s) ? `"${s.replace(/(["\\$`])/g, '\\$1')}"` : s)

export function makefileText(i: ExportInput): string {
  const { project } = i
  const base = flagsFor(project, 'Debug', i.deviceDefine)
  const srcs = sourcesOf(i)
  const hasCpp = srcs.some((s) => langOf(s) === 'cpp')
  const cfgNames = Object.keys(project.configurations)
  const cfgBlocks = cfgNames.map((n, idx) => {
    const c = project.configurations[n]
    const { compile, link } = splitExtra(c.extraFlags)
    const g = debugFlag(c)
    const lines = [
      `OPT = ${optimizationFlag(c)}`,
      `DBG = ${g ?? ''}`,
      `CFG_DEFS = ${c.defines.map((d) => '-D' + d).join(' ')}`,
      `CFG_CFLAGS = ${compile.map(q).join(' ')}`,
      `CFG_LDFLAGS = ${link.map(q).join(' ')}`
    ]
    return `${idx === 0 ? 'ifeq' : 'else ifeq'} ($(CONFIG),${n})\n${lines.join('\n')}`
  })
  const defs = [...(i.deviceDefine ? [i.deviceDefine] : []), ...project.defines].filter((d, k, a) => a.indexOf(d) === k).map((d) => '-D' + d)
  return `${HEADER.replace(/^# /, '# ')}# Сборка:  make            (конфигурация Debug)
#           make CONFIG=Release
#           make clean
# Нужны: GNU make и arm-none-eabi-gcc в PATH (или make PREFIX=/путь/к/bin/arm-none-eabi-).

TARGET  = ${project.name}
CONFIG ?= Debug
PREFIX ?= arm-none-eabi-
BUILD   = build/$(CONFIG)

CC      = $(PREFIX)gcc
CXX     = $(PREFIX)g++
OBJCOPY = $(PREFIX)objcopy
SIZE    = $(PREFIX)size

ARCH    = ${base.arch.join(' ')}
DEFS    = ${defs.join(' ')}
INCS    = ${project.includes.map((x) => '-I' + q(x)).join(' ')}
LDSCRIPT = ${project.linkerScript}

${cfgBlocks.join('\n')}
else
$(error Неизвестная конфигурация $(CONFIG): ${cfgNames.join(', ')})
endif

COMMON  = $(ARCH) $(DEFS) $(CFG_DEFS) $(INCS) $(OPT) $(DBG) -ffunction-sections -fdata-sections -Wall $(CFG_CFLAGS)
CFLAGS  = $(COMMON) ${base.c.join(' ')} -MMD -MP
CXXFLAGS = $(COMMON) ${base.cpp.join(' ')} -MMD -MP
ASFLAGS = $(COMMON) -x assembler-with-cpp -MMD -MP
LDFLAGS = $(ARCH) -T$(LDSCRIPT) -Wl,-Map=$(BUILD)/$(TARGET).map,--cref ${base.link.join(' ')} $(CFG_LDFLAGS)

SRCS = ${srcs.map(q).join(' \\\n       ')}
OBJS = $(addprefix $(BUILD)/obj/,$(addsuffix .o,$(SRCS)))
LINK = ${hasCpp ? '$(CXX)' : '$(CC)'}

all: $(BUILD)/$(TARGET).elf $(BUILD)/$(TARGET).bin $(BUILD)/$(TARGET).hex
\t$(SIZE) $(BUILD)/$(TARGET).elf

$(BUILD)/obj/%.c.o: %.c
\t@mkdir -p $(dir $@)
\t$(CC) $(CFLAGS) -c $< -o $@

$(BUILD)/obj/%.cpp.o: %.cpp
\t@mkdir -p $(dir $@)
\t$(CXX) $(CXXFLAGS) -c $< -o $@

$(BUILD)/obj/%.s.o: %.s
\t@mkdir -p $(dir $@)
\t$(CC) $(ASFLAGS) -c $< -o $@

$(BUILD)/obj/%.S.o: %.S
\t@mkdir -p $(dir $@)
\t$(CC) $(ASFLAGS) -c $< -o $@

$(BUILD)/$(TARGET).elf: $(OBJS) $(LDSCRIPT)
\t$(LINK) $(OBJS) $(LDFLAGS) -Wl,--start-group -lc -lm -Wl,--end-group -o $@

$(BUILD)/%.bin: $(BUILD)/%.elf
\t$(OBJCOPY) -O binary $< $@

$(BUILD)/%.hex: $(BUILD)/%.elf
\t$(OBJCOPY) -O ihex $< $@

clean:
\trm -rf build/$(CONFIG)

.PHONY: all clean
-include $(OBJS:.o=.d)
`
}

export function cmakeText(i: ExportInput): string {
  const { project } = i
  const base = flagsFor(project, 'Debug', i.deviceDefine)
  const srcs = sourcesOf(i)
  const hasCpp = srcs.some((s) => langOf(s) === 'cpp')
  const defs = [...(i.deviceDefine ? [i.deviceDefine] : []), ...project.defines].filter((d, k, a) => a.indexOf(d) === k)
  const cfg = Object.entries(project.configurations)
  const perCfg = (pick: (c: ProProject['configurations'][string]) => string[]): string =>
    cfg.map(([n, c]) => { const v = pick(c); return v.length ? `    $<$<CONFIG:${n}>:${v.join(';')}>` : '' }).filter(Boolean).join('\n')
  const cc = (c: ProProject['configurations'][string]): string[] => [optimizationFlag(c), ...(debugFlag(c) ? [debugFlag(c)!] : []), ...splitExtra(c.extraFlags).compile]
  const ld = (c: ProProject['configurations'][string]): string[] => splitExtra(c.extraFlags).link
  const cfgDefs = perCfg((c) => c.defines.map((d) => d))
  return `${HEADER}# Сборка:  cmake -S . -B build/cmake -G Ninja -DCMAKE_BUILD_TYPE=Debug
#           cmake --build build/cmake
# Нужны: CMake 3.20+, Ninja или make и arm-none-eabi-gcc в PATH.
cmake_minimum_required(VERSION 3.20)

set(CMAKE_SYSTEM_NAME Generic)
set(CMAKE_SYSTEM_PROCESSOR arm)
set(CMAKE_C_COMPILER arm-none-eabi-gcc)
set(CMAKE_CXX_COMPILER arm-none-eabi-g++)
set(CMAKE_ASM_COMPILER arm-none-eabi-gcc)
set(CMAKE_OBJCOPY arm-none-eabi-objcopy)
set(CMAKE_SIZE arm-none-eabi-size)
set(CMAKE_TRY_COMPILE_TARGET_TYPE STATIC_LIBRARY)
if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Debug)
endif()

project(${project.name} C ${hasCpp ? 'CXX ' : ''}ASM)
set(TARGET \${PROJECT_NAME}.elf)

add_executable(\${TARGET}
${srcs.map((s) => '    ' + s).join('\n')}
)

target_include_directories(\${TARGET} PRIVATE
${project.includes.map((x) => '    ' + x).join('\n')}
)

target_compile_definitions(\${TARGET} PRIVATE
${defs.map((d) => '    ' + d).join('\n')}
${cfgDefs}
)

set(ARCH ${base.arch.join(' ')})
separate_arguments(ARCH_LIST UNIX_COMMAND "\${ARCH}")

target_compile_options(\${TARGET} PRIVATE
    \${ARCH_LIST}
    -ffunction-sections -fdata-sections -Wall
    $<$<COMPILE_LANGUAGE:C>:${base.c.join(';')}>
    $<$<COMPILE_LANGUAGE:CXX>:${base.cpp.join(';')}>
    $<$<COMPILE_LANGUAGE:ASM>:-x;assembler-with-cpp>
${perCfg(cc)}
)

target_link_options(\${TARGET} PRIVATE
    \${ARCH_LIST}
    -T\${CMAKE_SOURCE_DIR}/${project.linkerScript}
    -Wl,-Map=\${PROJECT_NAME}.map,--cref
    ${base.link.join('\n    ')}
${perCfg(ld)}
)
target_link_libraries(\${TARGET} PRIVATE -Wl,--start-group c m -Wl,--end-group)
set_target_properties(\${TARGET} PROPERTIES LINK_DEPENDS \${CMAKE_SOURCE_DIR}/${project.linkerScript})

add_custom_command(TARGET \${TARGET} POST_BUILD
    COMMAND \${CMAKE_OBJCOPY} -O binary $<TARGET_FILE:\${TARGET}> \${PROJECT_NAME}.bin
    COMMAND \${CMAKE_OBJCOPY} -O ihex $<TARGET_FILE:\${TARGET}> \${PROJECT_NAME}.hex
    COMMAND \${CMAKE_SIZE} $<TARGET_FILE:\${TARGET}>
)
`
}

export function exportFiles(i: ExportInput): Record<(typeof EXPORT_FILES)[number], string> {
  return { Makefile: makefileText(i), 'CMakeLists.txt': cmakeText(i) }
}
