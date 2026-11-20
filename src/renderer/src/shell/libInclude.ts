// Подсказка «добавьте #include» после установки библиотеки. Данные — provides_includes из arduino-cli (library.properties).

/** Строка #include для заголовка. */
export const includeLine = (header: string): string => `#include <${header}>`

/** Уже есть #include этого заголовка (в любой форме: <X.h> или "X.h"). */
export function hasInclude(code: string, header: string): boolean {
  const esc = header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp('^\\s*#\\s*include\\s*[<"]' + esc + '[>"]', 'm').test(code)
}

/** Вставляет #include после последнего существующего #include, иначе после ведущих комментариев/пустых строк в начале файла. */
export function insertInclude(code: string, header: string): string {
  if (hasInclude(code, header)) return code
  const eol = code.includes('\r\n') ? '\r\n' : '\n'
  const lines = code.split(/\r?\n/)
  let at = -1
  lines.forEach((l, i) => { if (/^\s*#\s*include\b/.test(l)) at = i })
  if (at < 0) {
    at = 0
    while (at < lines.length && (/^\s*\/\//.test(lines[at]) || lines[at].trim() === '')) at++
    lines.splice(at, 0, includeLine(header), '')
  } else {
    lines.splice(at + 1, 0, includeLine(header))
  }
  return lines.join(eol)
}
