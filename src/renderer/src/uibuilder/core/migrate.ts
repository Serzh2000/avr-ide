// Миграции формата ui.json. Каждая миграция поднимает версию на единицу и работает над «сырым» объектом.
import { UI_JSON_VERSION } from './types'

type Raw = Record<string, unknown>

export interface Migration {
  from: number
  to: number
  title: string
  apply: (raw: Raw) => void
}

function isObj(x: unknown): x is Raw {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

export const MIGRATIONS: Migration[] = [
  {
    from: 1,
    to: 2,
    title: 'v1 → v2: тема оформления, DNS captive portal, привязка «callback», стили и группы элементов',
    apply: (raw) => {
      // Тема: у v1 проектов её не было — ставим «родную» (CSS не генерируется, вывод не меняется).
      if (!isObj(raw.theme)) raw.theme = { preset: 'default', vars: {} }
      // Настройки: dnsCaptive по умолчанию выключен (поведение v1 сохраняется).
      const set = isObj(raw.settings) ? raw.settings : {}
      if (typeof set.dnsCaptive !== 'boolean') set.dnsCaptive = false
      raw.settings = set
      // Элементы v1 не имели ни стилей, ни групп, ни callback-привязки — ничего переписывать не нужно:
      // отсутствующие поля читаются как значения по умолчанию.
    }
  }
]

export interface MigrationResult {
  raw: Raw
  from: number
  to: number
  /** Что было сделано (для показа пользователю). */
  notes: string[]
}

/** Применяет цепочку миграций от версии `from` до текущей. Возвращает null, если цепочка прерывается. */
export function migrateRaw(raw: Raw, from: number): MigrationResult | null {
  const notes: string[] = []
  let v = from
  while (v < UI_JSON_VERSION) {
    const m = MIGRATIONS.find((x) => x.from === v)
    if (!m) return null
    m.apply(raw)
    notes.push(m.title)
    v = m.to
  }
  raw.version = v
  return { raw, from, to: v, notes }
}
