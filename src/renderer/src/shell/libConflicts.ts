// Разбор вывода arduino-cli на конфликты библиотек: две библиотеки с одним заголовком, копия библиотеки внутри
// проекта поверх установленной («multiple definition … first defined here»), несовместимая архитектура.
// Чистые функции без обращения к окну/диску: вызывать с текстом журнала сборки (русские и английские сообщения).

export interface DuplicateHeader {
  header: string
  /** Папка выбранной библиотеки */
  used: string
  /** Папки отброшенных */
  notUsed: string[]
}

export interface DuplicateDefinition {
  /** Папки двух копий кода (каталог файла: обычно корень src библиотеки или папка внутри проекта) */
  a: string
  b: string
  symbols: string[]
}

export interface ArchWarning { library: string; declared: string; board: string }

export interface LibConflictReport {
  duplicates: DuplicateHeader[]
  definitions: DuplicateDefinition[]
  arch: ArchWarning[]
}

export interface LibConflictBanner {
  title: string
  text: string
  /** Папки для кнопки «Открыть папку» (первая — главная) */
  folders: string[]
}

const BS = String.fromCharCode(92)
const norm = (p: string): string => p.trim().split(BS).join('/').replace(/\/+$/, '')
const dirOf = (p: string): string => { const n = norm(p); const i = n.lastIndexOf('/'); return i > 0 ? n.slice(0, i) : n }

/** Находит в журнале сборки все признаки конфликта библиотек. */
export function parseLibConflicts(log: string): LibConflictReport {
  const duplicates = new Map<string, DuplicateHeader>()
  const lines = log.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    // «Multiple libraries were found for "X.h"» / «Несколько библиотек найдено для "X.h"», дальше Used / Not used
    const m = /(?:Multiple libraries were found for|Несколько библиотек найдено для|Найдено несколько библиотек для)\s+["«]([^"»]+)["»]/.exec(lines[i])
    if (!m) continue
    const d: DuplicateHeader = { header: m[1], used: '', notUsed: [] }
    for (let j = i + 1; j < lines.length && j <= i + 12; j++) {
      const u = /^\s*(?:Used|Используется|Использована):\s*(.+?)\s*$/.exec(lines[j])
      const n = /^\s*(?:Not used|Не используется|Не использована):\s*(.+?)\s*$/.exec(lines[j])
      if (u) d.used = u[1]
      else if (n) d.notUsed.push(n[1])
      else if (lines[j].trim() !== '') break
    }
    if (d.used || d.notUsed.length) duplicates.set(d.header, d)
  }

  const defs = new Map<string, DuplicateDefinition>()
  const ext = '(?:c|cc|cpp|cxx|h|hpp|ino)'
  const re = new RegExp('(\\S[^\\n]*?\\.' + ext + '):(\\d+): multiple definition of [`\']([^\']+)\'; ([^\\n]+?\\.' + ext + '):(\\d+): first defined here', 'gi')
  for (const m of log.matchAll(re)) {
    // перед путём у ld бывает «…ld.exe: » и объектный файл «….o:»
    const a = dirOf(m[1].replace(/^.*ld(?:\.exe)?:\s+/, '').replace(/^.*\.o:(?=[A-Za-z]:|\/)/, ''))
    // после «; » идёт «объект.o:путь»
    const b = dirOf(m[4].replace(/^.*\.o:(?=[A-Za-z]:|[\\/])/, ''))
    if (a === b) continue
    const key = [a, b].sort().join('|')
    const e = defs.get(key) ?? { a, b, symbols: [] }
    if (e.symbols.length < 3 && !e.symbols.includes(m[3])) e.symbols.push(m[3])
    defs.set(key, e)
  }

  const arch: ArchWarning[] = []
  const head = /(?:WARNING|ВНИМАНИЕ|ПРЕДУПРЕЖДЕНИЕ):\s*(?:library|библиотека)\s+(.+?)\s+(?:claims to run on|должна запускаться на|заявляет о работе на)/i
  for (const line of lines) {
    const h = head.exec(line)
    if (!h) continue
    // архитектуры стоят в квадратных скобках, а в некоторых переводах — в круглых (тогда «(s)», «(ах)» пропускаем)
    let groups = [...line.matchAll(/\[([^\]]+)\]/g)].map((x) => x[1])
    if (groups.length < 2) groups = [...line.matchAll(/\(([a-z0-9_, ]{3,})\)/gi)].map((x) => x[1]).filter((x) => !/^-?ах$/i.test(x))
    if (groups.length >= 2 && !arch.some((x) => x.library === h[1])) arch.push({ library: h[1], declared: groups[0], board: groups[1] })
  }

  return { duplicates: [...duplicates.values()], definitions: [...defs.values()], arch }
}

/**
 * Понятное сообщение для панели «Проблемы» или null, если конфликтов нет.
 * sketchDir — папка проекта: копии кода внутри неё считаются «локальными».
 */
export function describeLibConflicts(report: LibConflictReport, sketchDir?: string): LibConflictBanner | null {
  const sk = sketchDir ? norm(sketchDir).toLowerCase() : ''
  const inSketch = (p: string): boolean => !!sk && (norm(p).toLowerCase() + '/').startsWith(sk + '/')

  const local = report.definitions.find((d) => inSketch(d.a) || inSketch(d.b))
  if (local) {
    const mine = inSketch(local.a) ? local.a : local.b
    const other = mine === local.a ? local.b : local.a
    const rel = norm(mine).slice(sk.length + 1)
    return {
      title: 'Копия библиотеки внутри проекта дублирует установленную',
      text: `Один и тот же код подключён дважды: из установленной библиотеки (${norm(other)}) и из папки проекта (${rel}). `
        + `Компоновщик не знает, какой копией пользоваться (multiple definition, например ${local.symbols[0]}). `
        + 'Оставьте одну: удалите папку из проекта или удалите библиотеку на вкладке «Библиотеки».',
      folders: [norm(mine), norm(other)]
    }
  }
  const def = report.definitions[0]
  if (def) {
    return {
      title: 'Одна библиотека установлена в двух папках',
      text: `Одинаковый код найден в «${norm(def.a)}» и «${norm(def.b)}» (например, ${def.symbols[0]}). Оставьте одну копию, вторую удалите.`,
      folders: [def.a, def.b]
    }
  }
  const dup = report.duplicates.find((d) => d.notUsed.length)
  if (dup) {
    const n = report.duplicates.length
    return {
      title: n > 1 ? `Несколько библиотек с одинаковым заголовком (${n})` : `Несколько библиотек для «${dup.header}»`,
      text: `Для «${dup.header}» выбрана ${norm(dup.used)}, не используются: ${dup.notUsed.map(norm).join('; ')}. `
        + 'Если собирается не та библиотека, удалите лишнюю или обновите её: версии с разным API дают ошибки сборки.',
      folders: [dup.used, ...dup.notUsed].filter(Boolean)
    }
  }
  const a = report.arch[0]
  if (a) {
    return {
      title: 'Библиотека заявлена для другой платы',
      text: `«${a.library}» рассчитана на ${a.declared}, а выбранная плата работает на ${a.board}. Сборка может завершиться ошибкой: найдите версию для этой платы.`,
      folders: []
    }
  }
  return null
}

/** Короткий вызов: разобрать журнал и сразу получить сообщение. */
export function libConflictBanner(log: string, sketchDir?: string): LibConflictBanner | null {
  return describeLibConflicts(parseLibConflicts(log), sketchDir)
}
