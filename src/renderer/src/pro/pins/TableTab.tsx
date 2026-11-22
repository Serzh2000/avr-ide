// Вкладка «Таблица выводов»: все выводы корпуса с ролью, функцией, меткой и параметрами; клик по строке открывает вывод на схеме.
import { useState } from 'react'
import type { ReactNode } from 'react'
import { isAnalogSignal, ROLE_LABEL } from '../../../../shared/pro/pinconfig/model'
import type { PinsConfig } from '../../../../shared/pro/pinconfig/types'
import { Chip } from '../../shell/kit'
import type { PinsModel } from './pinsModel'
import { usePins } from './pinsStore'

const PULL: Record<string, string> = { up: 'подтяжка вверх', down: 'подтяжка вниз' }

export default function TableTab({ model, cfg }: { model: PinsModel; cfg: PinsConfig }): ReactNode {
  const select = usePins((s) => s.select)
  const setTab = usePins((s) => s.setTab)
  const [onlyUsed, setOnlyUsed] = useState(false)
  const [q, setQ] = useState('')
  const rows = model.pkg.pins.filter((r) => r[2] === 'io').filter((r) => {
    const used = (model.usage.get(r[1])?.length ?? 0) > 0 || !!cfg.pins[r[1]]?.label
    if (onlyUsed && !used) return false
    if (q && !`${r[1]} ${cfg.pins[r[1]]?.label ?? ''} ${(model.usage.get(r[1]) ?? []).map((u) => (u.kind === 'af' ? u.signal : '')).join(' ')}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  })
  const used = model.pkg.pins.filter((r) => r[2] === 'io' && (model.usage.get(r[1])?.length ?? 0) > 0).length
  return (
    <div className="tb" data-testid="pins-table">
      <div className="tb-bar">
        <input className="input" type="search" placeholder="Найти вывод, метку или функцию…" aria-label="Найти в таблице" value={q} onChange={(e) => setQ(e.target.value)} data-testid="pins-table-search" />
        <label className="ck-check"><input type="checkbox" checked={onlyUsed} onChange={(e) => setOnlyUsed(e.target.checked)} /> только занятые</label>
        <span className="dim small">Занято {used} из {model.pkg.pins.filter((r) => r[2] === 'io').length}</span>
      </div>
      <div className="tb-scroll">
        <table className="tb-table">
          <thead><tr><th>Вывод</th><th>№</th><th>Роль</th><th>Функция</th><th>Метка</th><th>Параметры</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const name = r[1]
              const u = model.usage.get(name) ?? []
              const pc = cfg.pins[name]
              const bad = model.conflicts.has(name)
              const first = u[0]
              const role = !first ? '—' : first.kind === 'gpio' ? `GPIO: ${ROLE_LABEL[first.role]}` : first.kind === 'osc' ? 'Генератор' : isAnalogSignal(first.signal) ? 'Аналог' : 'Периферия'
              const fn = u.map((x) => (x.kind === 'af' ? x.signal : x.kind === 'osc' ? x.signal : '')).filter(Boolean).join(', ')
              const params = [pc?.pull && PULL[pc.pull], pc?.otype === 'od' && 'открытый сток', pc?.initial === 'high' && 'старт: 1', pc?.edge && first?.kind === 'gpio' && first.role === 'exti' ? `фронт: ${pc.edge}` : ''].filter(Boolean).join(', ')
              return (
                <tr key={name} className={bad ? 'bad' : ''} data-testid="pins-row" data-pin={name} data-used={u.length ? '1' : '0'} tabIndex={0}
                  onClick={() => { select({ kind: 'pin', pin: name }); setTab('pinout') }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { select({ kind: 'pin', pin: name }); setTab('pinout') } }}>
                  <td className="mono"><b>{name}</b></td>
                  <td className="dim">{r[0]}</td>
                  <td>{bad ? <Chip tone="warn">конфликт</Chip> : role}</td>
                  <td className="mono">{fn || <span className="dim">—</span>}</td>
                  <td className="mono">{pc?.label ?? <span className="dim">—</span>}</td>
                  <td className="dim small">{params}</td>
                </tr>
              )
            })}
            {rows.length === 0 && <tr><td colSpan={6} className="dim pc-empty">Ничего не найдено.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
