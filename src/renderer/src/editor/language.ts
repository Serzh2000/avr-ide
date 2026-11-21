// Язык файла по расширению. Чистая функция (без Monaco) — легко тестировать.

export type FileLanguage = 'cpp' | 'json' | 'markdown' | 'css' | 'html' | 'javascript' | 'plaintext' | 'asm' | 'ld' | 'map' | 'xml'

const BY_EXT: Record<string, FileLanguage> = {
  ino: 'cpp',
  pde: 'cpp',
  h: 'cpp',
  hpp: 'cpp',
  hh: 'cpp',
  c: 'cpp',
  cc: 'cpp',
  cpp: 'cpp',
  cxx: 'cpp',
  tpp: 'cpp',
  json: 'json',
  md: 'markdown',
  markdown: 'markdown',
  css: 'css',
  html: 'html',
  htm: 'html',
  js: 'javascript',
  mjs: 'javascript',
  txt: 'plaintext',
  s: 'asm',
  asm: 'asm',
  ld: 'ld',
  lds: 'ld',
  map: 'map',
  svd: 'xml',
  xml: 'xml'
}

export function languageForPath(filePath: string | null | undefined): FileLanguage {
  if (!filePath) return 'cpp' // несохранённый скетч — это .ino
  const name = filePath.split(/[\\/]/).pop() ?? ''
  const dot = name.lastIndexOf('.')
  if (dot < 0) return 'plaintext'
  return BY_EXT[name.slice(dot + 1).toLowerCase()] ?? 'plaintext'
}

/** Идентификатор языка в Monaco: C/C++ подсвечивается собственным токенайзером «arduino». */
export function monacoLanguageId(lang: FileLanguage, pro = false): string {
  if (lang === 'cpp') return pro ? 'avr-c' : 'arduino'
  if (lang === 'asm' || lang === 'ld' || lang === 'map') return 'avr-' + lang
  return lang
}

export function isCppPath(filePath: string | null | undefined): boolean {
  return languageForPath(filePath) === 'cpp'
}
