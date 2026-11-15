import type { ReactNode } from 'react'
import type { Issue } from '../core/index'
import { allIds } from '../core/index'
import { addCallbackStub } from '../sketch/integrate'
import { useUiBuilder } from '../store'
import { Icon } from './icons'
import { findElement, useBuilder } from './ctx'
import type { BuilderCtx } from './ctx'

export interface Fix {
  label: string
  run: () => void
}

function uniqueName(base: string, taken: Set<string>): string {
  let n = base
  let i = 2
  while (taken.has(n)) n = `${base}${i++}`
  return n
}

const BINDING_CODES = new Set([
  'bind-var-missing',
  'bind-var-unknown',
  'sketch-var-missing',
  'sketch-var-type',
  'sketch-var-const',
  'sketch-var-late',
  'bind-incompat',
  'bind-pin-missing',
  'sketch-pin-missing',
  'sketch-pin-unresolved',
  'bind-cb-missing',
  'bind-cb-name',
  'fn-clash-sketch',
  'fn-signature',
  'sel-int'
])
const PAGE_SETTINGS = /^(wifi-|update-ms|auth|html-title|pwm-)/

/** Кнопка «Исправить»/«Показать» для проблемы или null. */
export function fixFor(i: Issue, ctx: BuilderCtx): Fix | null {
  const st = useUiBuilder.getState()
  const p = st.project
  if (i.elementId) {
    const el = findElement(p, i.elementId)
    if (!el) return null
    const id = i.elementId
    if (i.code === 'fn-missing' && ctx.host && el.binding.kind === 'callback') {
      const fn = el.binding.fn
      return {
        label: 'Добавить функцию в скетч',
        run: () => {
          ctx.host?.replaceSketchCode(addCallbackStub(ctx.host.sketchCode, fn, el.type, el.label))
          st.showToast(`Функция ${fn}() добавлена в конец скетча`)
        }
      }
    }
    if (i.code === 'id-clash-sketch')
      return {
        label: 'Переименовать',
        run: () => st.renameElement(id, uniqueName(`${id}Ui`, allIds(p)))
      }
    if (i.code === 'sketch-var-late' && ctx.host && i.variable) {
      const line = ctx.sketch?.vars.find((v) => v.name === i.variable)?.line
      if (line) return { label: 'Перейти в код', run: () => ctx.host?.goToLine(line) }
    }
    if (BINDING_CODES.has(i.code))
      return {
        label: 'Выбрать',
        run: () => {
          st.reveal(id)
          st.requestFocus('binding')
        }
      }
    if (i.code === 'el-label')
      return {
        label: 'Показать',
        run: () => {
          st.reveal(id)
          st.requestFocus('label')
        }
      }
    return { label: 'Показать', run: () => st.reveal(id) }
  }
  if (i.tabId && i.code === 'id-clash-sketch') {
    const tab = i.tabId
    return { label: 'Переименовать', run: () => st.patchTab(tab, { id: uniqueName(`${tab}Ui`, allIds(p)) }) }
  }
  if (i.variable) {
    if (i.code === 'var-clash-sketch') {
      const sv = ctx.sketch?.vars.find((v) => v.name === i.variable)
      const mine = p.variables.find((v) => v.name === i.variable)
      if (sv && sv.type && mine && sv.type === mine.type) {
        const name = i.variable
        return { label: 'Использовать переменную из скетча', run: () => st.markExternal(name) }
      }
    }
    if (i.code === 'sketch-var-late' && ctx.host) {
      const line = ctx.sketch?.vars.find((v) => v.name === i.variable)?.line
      if (line) return { label: 'Перейти в код', run: () => ctx.host?.goToLine(line) }
    }
    return { label: 'К переменным', run: () => st.setBottom('variables') }
  }
  if (PAGE_SETTINGS.test(i.code)) return { label: 'Открыть настройки', run: () => st.setBottom('project') }
  if (i.code === 'theme-value' || i.code === 'theme-size') return { label: 'Открыть тему', run: () => st.setBottom('theme') }
  return null
}

export function IssueRow({ issue, compact }: { issue: Issue; compact?: boolean }): ReactNode {
  const ctx = useBuilder()
  const project = useUiBuilder((s) => s.project)
  const fix = fixFor(issue, ctx)
  const el = findElement(project, issue.elementId ?? null)
  return (
    <div className={`uib-issue ${issue.severity}${compact ? ' compact' : ''}`}>
      <span className="uib-issue-ico">
        <Icon name={issue.severity === 'error' ? 'error' : 'warn'} size={15} />
      </span>
      <div className="uib-issue-body">
        {el && !compact && (
          <div className="uib-issue-where">
            {el.label || el.id} <code>{el.id}</code>
          </div>
        )}
        <div className="uib-issue-text">{issue.message}</div>
      </div>
      {fix && (
        <button className="uib-btn small" onClick={fix.run}>
          {fix.label}
        </button>
      )}
    </div>
  )
}
