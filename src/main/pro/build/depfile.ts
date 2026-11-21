// Разбор файлов зависимостей .d в формате make (gcc -MMD -MP): «цель: зависимость \ зависимость …».
const BS = '\\'

/** Список зависимостей первого правила; экранированные пробелы («\ ») и переносы строк обрабатываются. Фиктивные цели -MP (строки «файл:») игнорируются. */
export function parseDepFile(text: string): string[] {
  const joined = text.replace(/\\\r?\n/g, ' ')
  const first = joined.split(/\r?\n/).find((l) => l.trim().length > 0)
  if (!first) return []
  // Цель заканчивается первым двоеточием, за которым пробел или конец строки («C:/…» в пути — двоеточие перед «/»)
  let i = 0
  for (; i < first.length; i++) {
    const ch = first[i]
    if (ch === BS && first[i + 1] === ' ') { i++; continue }
    if (ch === ':' && (first[i + 1] === ' ' || first[i + 1] === undefined || first[i + 1] === '\t')) break
  }
  const rest = first.slice(i + 1)
  const deps: string[] = []
  let cur = ''
  for (let k = 0; k < rest.length; k++) {
    const ch = rest[k]
    if (ch === BS && rest[k + 1] === ' ') { cur += ' '; k++; continue }
    if (ch === ' ' || ch === '\t') { if (cur) { deps.push(cur); cur = '' } continue }
    cur += ch
  }
  if (cur) deps.push(cur)
  return deps
}
