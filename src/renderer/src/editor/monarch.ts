// Токенайзер «arduino»: C++ плюс отдельные классы токенов для констант, функций и объектов Arduino.
import type { languages } from 'monaco-editor'
import { BUILTIN_OBJECTS, CONSTANTS, KEYWORDS, TYPES } from './constants'

/** pro: C/C++ профессионального режима — без констант, функций и объектов Arduino. */
export function buildMonarch(functionNames: string[], opts: { pro?: boolean } = {}): languages.IMonarchLanguage {
  return {
    defaultToken: '',
    tokenPostfix: opts.pro ? '.c' : '.arduino',
    keywords: KEYWORDS,
    typeKeywords: TYPES,
    constants: opts.pro ? [] : CONSTANTS.map((c) => c.name),
    arduinoFunctions: opts.pro ? [] : functionNames,
    arduinoObjects: opts.pro ? [] : BUILTIN_OBJECTS,
    operators: ['=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=', '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%', '<<', '>>', '+=', '-=', '*=', '/=', '&=', '|=', '^=', '%=', '<<=', '>>=', '->'],
    symbols: /[=><!~?:&|+\-*/^%]+/,
    escapes: /\\(?:[abfnrtv\\"'?]|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8}|[0-7]{1,3})/,
    tokenizer: {
      root: [
        [/^\s*#\s*include\b/, { token: 'keyword.directive', next: '@include' }],
        [/^\s*#\s*\w+/, 'keyword.directive'],
        [/[A-Za-z_]\w*/, { cases: { '@typeKeywords': 'type', '@keywords': 'keyword', '@constants': 'constant.arduino', '@arduinoFunctions': 'support.function.arduino', '@arduinoObjects': 'support.class.arduino', '~[A-Z][A-Z0-9_]{2,}': 'constant.macro', '@default': 'identifier' } }],
        { include: '@whitespace' },
        [/[{}()[\]]/, '@brackets'],
        [/@symbols/, { cases: { '@operators': 'operator', '@default': '' } }],
        [/\d*\.\d+([eE][-+]?\d+)?[fFlL]?/, 'number.float'],
        [/0[xX][0-9a-fA-F']+[uUlL]*/, 'number.hex'],
        [/0[bB][01']+[uUlL]*/, 'number.binary'],
        [/\d[\d']*[uUlLfF]*/, 'number'],
        [/[;,.]/, 'delimiter'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, { token: 'string.quote', next: '@string' }],
        [/'[^\\']'/, 'string'],
        [/(')(@escapes)(')/, ['string', 'string.escape', 'string']],
        [/'/, 'string.invalid']
      ],
      include: [
        [/\s+/, ''],
        [/<[^>\n]*>/, { token: 'string.include', next: '@pop' }],
        [/"[^"\n]*"/, { token: 'string.include', next: '@pop' }],
        [/./, { token: '', next: '@pop' }]
      ],
      whitespace: [
        [/[ \t\r\n]+/, ''],
        [/\/\*/, 'comment', '@comment'],
        [/\/\/.*\\$/, 'comment', '@linecomment'],
        [/\/\/.*$/, 'comment']
      ],
      comment: [
        [/[^/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[/*]/, 'comment']
      ],
      linecomment: [
        [/.*\\$/, 'comment'],
        [/.*$/, 'comment', '@pop']
      ],
      string: [
        [/[^\\"]+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/"/, { token: 'string.quote', next: '@pop' }]
      ]
    }
  } as languages.IMonarchLanguage
}
