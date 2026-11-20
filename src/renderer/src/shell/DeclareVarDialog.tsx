// «Создать переменную в скетче»: имя, тип, начальное значение → diff → объявление добавляется в .ino выше подключения страницы.
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { UiBuilderHost } from '../contracts'
import { diffHunks, lineDiff, planDeclareVariable } from '../uibuilder/sketch/integrate'
import type { VarCType } from '../uibuilder/sketch/integrate'
import { identProblem } from '../uibuilder/core/index'
import { Icon } from '../uibuilder/ui/icons'
import { Dialog, Select } from './kit'

const TYPES: VarCType[] = ['bool', 'int', 'float', 'String']

export interface DeclaredVar {
  name: string
  type: VarCType
  init: string
}

function initProblem(type: VarCType, init: string): string | null {
  const s = init.trim()
  if (!s) return null
  if (type === 'bool' && s !== 'true' && s !== 'false') return 'Для bool допустимо true или false'
  if (type === 'int' && !/^-?\d+$/.test(s)) return 'Для int нужно целое число'
  if (type === 'float' && !Number.isFinite(Number(s))) return 'Для float нужно число'
  return null
}

export function DeclareVarDialog({ host, name: name0, type: type0, allowed, taken, onCreate, onClose }: {
  host: UiBuilderHost
  name: string
  type: VarCType
  /** Какие типы подходят элементу (остальные в списке недоступны). */
  allowed?: VarCType[]
  /** Имена, занятые на странице (в скетче проверяет сам планировщик). */
  taken?: Set<string>
  onCreate: (v: DeclaredVar) => void
  onClose: () => void
}): ReactNode {
  const [name, setName] = useState(name0)
  const [type, setType] = useState<VarCType>(type0)
  const [init, setInit] = useState('')
  const plan = useMemo(() => planDeclareVariable(host.sketchCode, name, type, init), [host.sketchCode, name, type, init])
  const diff = useMemo(() => (plan.changed ? diffHunks(lineDiff(host.sketchCode, plan.code), 2) : []), [plan, host.sketchCode])
  const prob = identProblem(name) ?? (taken?.has(name) ? `имя «${name}» уже занято на странице` : null) ?? plan.warnings[0] ?? null
  const iprob = initProblem(type, init)
  useEffect(() => {
    const k = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  const ok = !prob && !iprob && plan.changed
  const submit = (): void => {
    if (!ok) return
    host.replaceSketchCode(plan.code)
    onCreate({ name, type, init })
  }
  return (
    <div className="uib-modal-back pl-scope pl-fixed" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <Dialog className="uib-modal" testid="declare-var-dialog" onClose={onClose}
        title={<><Icon name="plus" size={18} /> Создать переменную в скетче</>}
        footer={<>
          <button className="uib-btn" onClick={onClose}>Отмена</button>
          <button className="uib-btn primary" data-testid="declare-var-confirm" disabled={!ok} onClick={submit}>Добавить в скетч и связать</button>
        </>}>
        <form className="uib-modal-body" onSubmit={(e) => { e.preventDefault(); submit() }}>
          <label className="uib-field-label" htmlFor="declare-var-name">Имя</label>
          <input id="declare-var-name" className={`uib-input mono${prob ? ' bad' : ''}`} value={name} onChange={(e) => setName(e.target.value)} autoFocus spellCheck={false} aria-label="Имя переменной" />
          {prob && <div className="uib-field-error">{prob}</div>}
          <div className="uib-grid2">
            <div>
              <label className="uib-field-label">Тип</label>
              <Select className="uib-select" value={type} onChange={(e) => setType(e.target.value as VarCType)} aria-label="Тип переменной">
                {TYPES.map((t) => (
                  <option key={t} value={t} disabled={!!allowed?.length && !allowed.includes(t)}>{t}{allowed?.length && !allowed.includes(t) ? ' — не подходит' : ''}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="uib-field-label">Начальное значение</label>
              <input className={`uib-input mono${iprob ? ' bad' : ''}`} value={init} onChange={(e) => setInit(e.target.value)} placeholder={type === 'bool' ? 'false' : type === 'String' ? '' : '0'} aria-label="Начальное значение" />
            </div>
          </div>
          {iprob && <div className="uib-field-error">{iprob}</div>}
          <h3>Изменения в скетче</h3>
          {plan.changed ? (
            <pre className="uib-diff">
              {diff.map((l, i) =>
                l.kind === 'gap' ? (
                  <div key={i} className="gap">⋯ {l.count} строк без изменений ⋯</div>
                ) : (
                  <div key={i} className={l.kind}>
                    <span className="sg">{l.kind === 'add' ? '+' : l.kind === 'del' ? '−' : ' '}</span>
                    {l.text || ' '}
                  </div>
                )
              )}
            </pre>
          ) : (
            <p className="uib-hint">{plan.already[0] ?? 'Скетч не изменится.'}</p>
          )}
          <p className="uib-hint">Объявление встанет выше подключения страницы и выше <code>setup()</code>, чтобы страница и ваш код видели одну и ту же переменную.</p>
        </form>
      </Dialog>
    </div>
  )
}
