// Все ссылки блока на переменные: привязка, шаблоны {имя} в таблице/списке, переменные формы WiFi.
import { parseRows, templateVars } from './sanitize'
import type { Block } from './types'

export interface VarRef {
  name: string
  toUi: boolean
  fromUi: boolean
  /** Откуда ссылка: binding — привязка блока; token — {имя} в тексте; prop — поле свойств. */
  source: 'binding' | 'token' | 'prop'
  /** Для prop: какое свойство и какой тип нужен. */
  prop?: 'varSsid' | 'varPass' | 'varSave'
}

export function tableTemplates(b: Block): string[] {
  if (b.type === 'table') return parseRows(b.props.rows).flat()
  if (b.type === 'list') return String(b.props.rows ?? '').split(/\r?\n/).filter((l) => l.trim() !== '')
  return []
}

export function blockVarRefs(b: Block): VarRef[] {
  const out: VarRef[] = []
  const bd = b.binding
  if (bd.kind === 'var')
    out.push({ name: bd.variable, toUi: bd.direction !== 'fromUi', fromUi: bd.direction !== 'toUi', source: 'binding' })
  for (const t of tableTemplates(b)) for (const n of templateVars(t)) out.push({ name: n, toUi: true, fromUi: false, source: 'token' })
  if (b.type === 'wifisetup') {
    for (const p of ['varSsid', 'varPass', 'varSave'] as const) {
      const n = b.props[p]
      if (n) out.push({ name: n, toUi: false, fromUi: true, source: 'prop', prop: p })
    }
  }
  return out
}
