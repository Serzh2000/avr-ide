// Имена проектов: проверка и автопредложение. Без Node-модулей — используется и в main, и в renderer.

/** Имя скетча Arduino: буквы, цифры, _ и -, не с дефиса, до 63 символов. */
export const SKETCH_NAME_RE = /^[A-Za-z0-9_][A-Za-z0-9_-]{0,62}$/
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

/** Понятное сообщение об ошибке имени или null, если имя подходит. */
export function validateSketchName(name: string): string | null {
  if (!name) return 'Введите имя проекта.'
  if (name.length > 63) return 'Имя слишком длинное — не более 63 символов.'
  if (/^-/.test(name)) return 'Имя не может начинаться с дефиса.'
  if (/[^\x00-\x7f]/.test(name)) return 'Используйте только латинские буквы: русские буквы в имени не подходят для Arduino.'
  if (/\s/.test(name)) return 'Уберите пробелы: вместо них можно использовать «_».'
  if (!SKETCH_NAME_RE.test(name)) return 'Допустимы латинские буквы, цифры, «_» и «-».'
  if (RESERVED.test(name)) return 'Это имя зарезервировано Windows — выберите другое.'
  return null
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/** Имя вида sketch_nov15a (как в Arduino IDE); taken(name) — занято ли уже. */
export function suggestSketchName(taken: (name: string) => boolean, now: Date = new Date()): string {
  const base = `sketch_${MONTHS[now.getMonth()]}${String(now.getDate()).padStart(2, '0')}`
  for (let c = 97; c <= 122; c++) {
    const n = base + String.fromCharCode(c)
    if (!taken(n)) return n
  }
  for (let i = 1; i < 1000; i++) if (!taken(base + i)) return base + i
  return base + Date.now()
}
