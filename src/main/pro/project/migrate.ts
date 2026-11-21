// Миграции формата avride.project.json: цепочка «версия N → N+1». Сейчас существует только версия 1,
// но цепочка уже работает: когда схема изменится, достаточно добавить функцию в MIGRATIONS и поднять SCHEMA_VERSION.
import { SCHEMA_VERSION } from './types'

export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>
/** Ключ — версия, ИЗ которой переходим; результат — данные следующей версии (schemaVersion выставляет сам runner). */
export type MigrationTable = Record<number, Migration>

export const MIGRATIONS: MigrationTable = {}

export type MigrateResult = { ok: true; raw: Record<string, unknown>; from: number; to: number } | { ok: false; error: string }

export function migrateProject(raw: unknown, table: MigrationTable = MIGRATIONS, latest: number = SCHEMA_VERSION): MigrateResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, error: 'Файл проекта должен быть JSON-объектом.' }
  let cur = raw as Record<string, unknown>
  const v = cur['schemaVersion']
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) return { ok: false, error: 'В файле проекта нет поля schemaVersion (целое число от 1).' }
  if (v > latest) return { ok: false, error: `Проект создан более новой версией AVR IDE (схема ${v}, эта версия понимает до ${latest}). Обновите приложение.` }
  for (let n = v; n < latest; n++) {
    const step = table[n]
    if (!step) return { ok: false, error: `Нет миграции схемы ${n} → ${n + 1}.` }
    cur = { ...step(cur), schemaVersion: n + 1 }
  }
  return { ok: true, raw: cur, from: v, to: latest }
}
