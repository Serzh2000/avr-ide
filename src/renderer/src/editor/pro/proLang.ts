// Языки Pro-режима для Monaco: C/C++ без Arduino («avr-c»), ассемблер GNU as для ARM, скрипты компоновщика (ld), карта компоновки (.map).
import type { languages } from 'monaco-editor'
import * as monaco from 'monaco-editor'
import { buildMonarch } from '../monarch'

export const LANG_C = 'avr-c'
export const LANG_ASM = 'avr-asm'
export const LANG_LD = 'avr-ld'
export const LANG_MAP = 'avr-map'

// Мнемоники Thumb/Thumb-2 (Cortex-M): базовые имена; к ним допускаются суффикс S, условие и .N/.W
const BASE = ['adc', 'add', 'adr', 'and', 'asr', 'b', 'bfc', 'bfi', 'bic', 'bkpt', 'bl', 'blx', 'bx', 'cbnz', 'cbz', 'clrex', 'clz', 'cmn', 'cmp', 'cpsid', 'cpsie', 'dmb', 'dsb', 'eor', 'isb', 'it', 'ite', 'itt', 'itee', 'itet', 'itte', 'ittt', 'ldm', 'ldmia', 'ldmdb', 'ldr', 'ldrb', 'ldrd', 'ldrex', 'ldrexb', 'ldrexh', 'ldrh', 'ldrsb', 'ldrsh', 'lsl', 'lsr', 'mla', 'mls', 'mov', 'movs', 'movt', 'movw', 'mrs', 'msr', 'mul', 'mvn', 'neg', 'nop', 'orn', 'orr', 'pld', 'pop', 'push', 'qadd', 'qsub', 'rbit', 'rev', 'rev16', 'revsh', 'ror', 'rrx', 'rsb', 'sbc', 'sbfx', 'sdiv', 'sev', 'smlal', 'smull', 'ssat', 'stm', 'stmia', 'stmdb', 'str', 'strb', 'strd', 'strex', 'strexb', 'strexh', 'strh', 'sub', 'svc', 'sxtb', 'sxth', 'tbb', 'tbh', 'teq', 'tst', 'ubfx', 'udiv', 'umlal', 'umull', 'usat', 'uxtb', 'uxth', 'vabs', 'vadd', 'vcmp', 'vcvt', 'vdiv', 'vldr', 'vmla', 'vmov', 'vmrs', 'vmsr', 'vmul', 'vneg', 'vpop', 'vpush', 'vsqrt', 'vstr', 'vsub', 'wfe', 'wfi', 'yield']
const COND = 'eq|ne|cs|hs|cc|lo|mi|pl|vs|vc|hi|ls|ge|lt|gt|le|al'
const MNEMONIC = `^(?:${BASE.join('|')})(?:s)?(?:${COND})?(?:\\.[nw])?(?:\\.[fu]?\\d+)?$`

const DIRECTIVES = ['syntax', 'cpu', 'fpu', 'arch', 'thumb', 'thumb_func', 'arm', 'global', 'globl', 'weak', 'weakref', 'type', 'size', 'section', 'text', 'data', 'bss', 'word', 'hword', 'short', 'byte', 'ascii', 'asciz', 'string', 'space', 'skip', 'fill', 'align', 'balign', 'p2align', 'equ', 'equiv', 'set', 'macro', 'endm', 'if', 'ifdef', 'ifndef', 'else', 'endif', 'include', 'incbin', 'ltorg', 'pool', 'code', 'eabi_attribute', 'file', 'ident', 'extern', 'comm', 'lcomm', 'org', 'rept', 'endr', 'irp', 'purgem', 'fnstart', 'fnend', 'cantunwind', 'inst', 'inst.n', 'inst.w']

export function asmMonarch(): languages.IMonarchLanguage {
  return {
    defaultToken: '',
    tokenPostfix: '.asm',
    ignoreCase: true,
    tokenizer: {
      root: [
        [/^\s*#\s*(?:include|define|undef|if|ifdef|ifndef|else|elif|endif|pragma|error)\b/, { token: 'keyword.directive', next: '@cppline' }],
        [/\/\*/, 'comment', '@comment'],
        [/(?:@|\/\/).*$/, 'comment'],
        [/^\s*[A-Za-z_.$][\w.$]*(?=\s*:)/, 'entity.label'],
        [/^\s*\d+(?=\s*:)/, 'entity.label'],
        [/\.[A-Za-z_][\w.]*/, { cases: { [`~^\\.(?:${DIRECTIVES.join('|').replace(/\./g, '\\.')})$`]: 'keyword', '@default': 'keyword' } }],
        [/\b(?:r(?:1[0-5]|[0-9])|sp|lr|pc|ip|fp|sl|sb|xpsr|apsr|ipsr|epsr|primask|basepri|faultmask|control|msp|psp|[sdq](?:[0-9]|[12][0-9]|3[01]))\b/i, 'variable.register'],
        [/[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)?/, { cases: { [`~${MNEMONIC}`]: 'keyword.mnemonic', '@default': 'identifier' } }],
        [/#?-?0[xX][0-9a-fA-F]+/, 'number.hex'],
        [/#?-?0[bB][01]+/, 'number.binary'],
        [/#?-?\d+/, 'number'],
        [/"([^"\\]|\\.)*"/, 'string'],
        [/'(\\.|[^\\'])'/, 'string'],
        [/[{}()[\]]/, '@brackets'],
        [/[,=!<>+\-*/|&^~%:#]/, 'delimiter']
      ],
      cppline: [
        [/\/\*/, 'comment', '@comment'],
        [/\/\/.*$/, { token: 'comment', next: '@pop' }],
        [/"[^"]*"|<[^>]*>/, 'string.include'],
        [/[A-Za-z_]\w*/, 'identifier'],
        [/\d[\w.]*/, 'number'],
        [/$/, { token: '', next: '@pop' }],
        [/./, '']
      ],
      comment: [
        [/[^/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[/*]/, 'comment']
      ]
    }
  } as languages.IMonarchLanguage
}

const LD_KEYWORDS = ['ENTRY', 'MEMORY', 'SECTIONS', 'PROVIDE', 'PROVIDE_HIDDEN', 'HIDDEN', 'KEEP', 'ALIGN', 'ORIGIN', 'LENGTH', 'AT', 'NOLOAD', 'FILL', 'INCLUDE', 'INPUT', 'OUTPUT', 'OUTPUT_FORMAT', 'OUTPUT_ARCH', 'SEARCH_DIR', 'GROUP', 'ASSERT', 'DEFINED', 'SORT', 'SORT_BY_NAME', 'SORT_BY_ALIGNMENT', 'SIZEOF', 'ADDR', 'LOADADDR', 'EXTERN', 'PHDRS', 'FLAGS', 'BYTE', 'SHORT', 'LONG', 'QUAD', 'CONSTANT', 'MAX', 'MIN', 'ONLY_IF_RO', 'ONLY_IF_RW', 'DATA_SEGMENT_ALIGN', 'DATA_SEGMENT_END', 'ALIGNOF', 'SIZEOF_HEADERS', 'EXCLUDE_FILE', 'COMMON', 'TARGET', 'STARTUP', 'NEXT', 'OVERLAY', 'REGION_ALIAS', 'ASCII', 'LOG2CEIL', 'CREATE_OBJECT_SYMBOLS', 'CONSTRUCTORS']

export function ldMonarch(): languages.IMonarchLanguage {
  return {
    defaultToken: '',
    tokenPostfix: '.ld',
    keywords: LD_KEYWORDS,
    tokenizer: {
      root: [
        [/\/\*/, 'comment', '@comment'],
        [/\/\/.*$/, 'comment'],
        [/\.(?=\s*[=+\-*/]|\s*;|\s*\))/, 'keyword'],
        [/\.[A-Za-z_][\w.*]*/, 'type'],
        [/[A-Za-z_][\w.]*/, { cases: { '@keywords': 'keyword', '~^_[\\w]+$': 'constant.macro', '~^[A-Z][A-Z0-9_]+$': 'constant.macro', '@default': 'identifier' } }],
        [/0[xX][0-9a-fA-F]+[KMkm]?/, 'number.hex'],
        [/\d+[KMkm]?/, 'number'],
        [/"[^"]*"/, 'string'],
        [/\*|\?/, 'operator'],
        [/[{}()[\]]/, '@brackets'],
        [/[=<>!+\-/%&|^~:;,]+/, 'delimiter']
      ],
      comment: [
        [/[^/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[/*]/, 'comment']
      ]
    }
  } as languages.IMonarchLanguage
}

export function mapMonarch(): languages.IMonarchLanguage {
  return {
    defaultToken: '',
    tokenPostfix: '.map',
    tokenizer: {
      root: [
        [/^(?:Memory Configuration|Linker script and memory map|Discarded input sections|Allocating common symbols|Archive member included[^\n]*|Cross Reference Table|Name\s+Origin\s+Length\s+Attributes)/, 'keyword'],
        [/^\s*(?:LOAD|START GROUP|END GROUP|OUTPUT)\b.*$/, 'comment'],
        [/^\.[\w.*-]+/, 'type'],
        [/^ \.[\w.*-]+/, 'type'],
        [/0x[0-9a-fA-F]+/, 'number.hex'],
        [/\b\d+\b/, 'number'],
        [/[A-Za-z]:[\\/][^\s]*|(?:\.\.?\/|\/)[^\s]*\.(?:o|a|c|s|S|ld)\b/, 'string'],
        [/[\w./\\-]+\.(?:o|a|obj)\b(?:\([\w./-]+\))?/, 'string'],
        [/\*\([^)]*\)|\*fill\*/, 'comment'],
        [/[A-Za-z_][\w$]*/, 'identifier'],
        [/[=()[\]]/, 'delimiter']
      ]
    }
  } as languages.IMonarchLanguage
}

let registered = false

/** Регистрирует Pro-языки; вызывается один раз из setupMonaco. cppConfig — общая языковая конфигурация C-подобных языков. */
export function registerProLanguages(cppConfig: languages.LanguageConfiguration): void {
  if (registered) return
  registered = true
  monaco.languages.register({ id: LANG_C, aliases: ['C/C++ (Pro)'] })
  monaco.languages.setLanguageConfiguration(LANG_C, cppConfig)
  monaco.languages.setMonarchTokensProvider(LANG_C, buildMonarch([], { pro: true }))

  monaco.languages.register({ id: LANG_ASM, extensions: ['.s', '.S', '.asm'], aliases: ['ARM Assembler'] })
  monaco.languages.setLanguageConfiguration(LANG_ASM, {
    comments: { lineComment: '@', blockComment: ['/*', '*/'] },
    brackets: [['(', ')'], ['[', ']'], ['{', '}']],
    autoClosingPairs: [{ open: '(', close: ')' }, { open: '[', close: ']' }, { open: '{', close: '}' }, { open: '"', close: '"', notIn: ['string', 'comment'] }]
  })
  monaco.languages.setMonarchTokensProvider(LANG_ASM, asmMonarch())

  monaco.languages.register({ id: LANG_LD, extensions: ['.ld', '.lds'], aliases: ['Linker Script'] })
  monaco.languages.setLanguageConfiguration(LANG_LD, {
    comments: { blockComment: ['/*', '*/'] },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [{ open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' }, { open: '"', close: '"', notIn: ['string'] }, { open: '/*', close: ' */', notIn: ['string'] }]
  })
  monaco.languages.setMonarchTokensProvider(LANG_LD, ldMonarch())

  monaco.languages.register({ id: LANG_MAP, extensions: ['.map'], aliases: ['Linker Map'] })
  monaco.languages.setMonarchTokensProvider(LANG_MAP, mapMonarch())
}
