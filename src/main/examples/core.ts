// Чистые функции примеров (без fs и Electron — тестируются напрямую).

/** Подходит ли библиотека к архитектуре платы: «*» — любая, список через запятую без учёта регистра. */
export function archMatches(architectures: readonly string[], arch: string): boolean {
  if (!architectures.length) return true
  const a = arch.toLowerCase()
  return architectures.some((x) => x === '*' || x.toLowerCase() === a)
}

/** «avr, esp32» → ['avr','esp32']; пусто или нет поля → ['*'] (как делает arduino-cli). */
export function parseArchitectures(v: string | undefined): string[] {
  const list = (v ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return list.length ? list : ['*']
}

/** Из fqbn (vendor:arch:board) — архитектура и ядро. */
export function coreOfFqbn(fqbn: string): { core: string; arch: string } | null {
  const p = fqbn.split(':')
  return p.length >= 2 && p[0] && p[1] ? { core: p[0] + ':' + p[1], arch: p[1] } : null
}

/** Имя примера для показа: путь внутри examples, «/» → « / » (вложенные папки категорий). */
export const exampleLabel = (rel: string): string => rel.split('/').join(' / ')

/** Имя нового проекта по умолчанию из имени примера: латиница, цифры, «_»; начинается не с дефиса. */
export function projectNameFromExample(name: string): string {
  const last = name.split(' / ').pop() ?? name
  let s = last.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^[-_]+/, '').replace(/_+$/, '')
  if (!s) s = 'Example'
  return s.slice(0, 50)
}

/** Первое свободное имя: base, base_2, base_3… */
export function freeName(base: string, taken: (n: string) => boolean): string {
  if (!taken(base)) return base
  for (let i = 2; i < 1000; i++) if (!taken(`${base}_${i}`)) return `${base}_${i}`
  return base + '_' + Date.now()
}

/** Главный .ino примера: файл с именем папки, иначе первый по алфавиту. */
export function pickMainIno(folder: string, inos: readonly string[]): string | null {
  if (!inos.length) return null
  const want = folder.toLowerCase() + '.ino'
  return inos.find((n) => n.toLowerCase() === want) ?? [...inos].sort()[0]
}

/** Как называется файл в копии: главный .ino получает имя проекта. */
export function targetFileName(file: string, mainIno: string | null, projectName: string): string {
  return mainIno !== null && file === mainIno ? projectName + '.ino' : file
}
