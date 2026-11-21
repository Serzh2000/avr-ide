// Чтение и запись avride.project.json: разбор текста (JSON → миграции → проверка) и стабильная сериализация.
import { migrateProject } from './migrate'
import type { MigrationTable } from './migrate'
import { SCHEMA_VERSION } from './types'
import type { Issue, ProProject } from './types'
import { validateProject } from './validate'

export type ParseResult =
  | { ok: true; project: ProProject; warnings: Issue[]; migratedFrom: number | null }
  | { ok: false; errors: Issue[]; warnings: Issue[] }

export function parseProjectText(text: string, table?: MigrationTable, latest?: number): ParseResult {
  let raw: unknown
  try { raw = JSON.parse(text.replace(/^﻿/, '')) } catch (e) {
    return { ok: false, errors: [{ path: '', message: 'Файл проекта не разобрать как JSON: ' + (e as Error).message }], warnings: [] }
  }
  const m = migrateProject(raw, table, latest)
  if (!m.ok) return { ok: false, errors: [{ path: 'schemaVersion', message: m.error }], warnings: [] }
  const v = validateProject(m.raw)
  return v.ok ? { ok: true, project: v.project, warnings: v.warnings, migratedFrom: m.from !== m.to ? m.from : null } : v
}

const ORDER_TOP = ['schemaVersion', 'name', 'target', 'sources', 'includes', 'defines', 'linkerScript', 'startupFile', 'svd', 'configurations', 'toolchain', 'programmer']
const ORDER_TARGET = ['vendor', 'family', 'chip', 'board', 'core', 'fpu', 'floatAbi', 'clock', 'memory']
const ORDER_CFG = ['optimization', 'debugLevel', 'defines', 'extraFlags']

const sortKeys = (o: Record<string, unknown>, order: string[]): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  for (const k of order) if (o[k] !== undefined) out[k] = o[k]
  for (const k of Object.keys(o)) if (!(k in out) && o[k] !== undefined) out[k] = o[k]
  return out
}

/** Текст файла: фиксированный порядок полей, отступ 2 пробела, перевод строки в конце — удобно для git. */
export function serializeProject(p: ProProject): string {
  const cfgs: Record<string, unknown> = {}
  const names = Object.keys(p.configurations)
  for (const n of ['Debug', 'Release', ...names.filter((x) => x !== 'Debug' && x !== 'Release')]) cfgs[n] = sortKeys({ ...p.configurations[n] }, ORDER_CFG)
  const top = sortKeys({ ...p, schemaVersion: SCHEMA_VERSION, target: sortKeys({ ...p.target }, ORDER_TARGET), configurations: cfgs }, ORDER_TOP)
  return JSON.stringify(top, null, 2) + '\n'
}
