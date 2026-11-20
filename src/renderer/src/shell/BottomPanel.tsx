// Нижняя панель: Вывод, Проблемы, Монитор порта.
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useBuild } from '../build/useBuild'
import MonitorPanel from '../build/MonitorPanel'
import PlotterPanel from '../build/PlotterPanel'
import OutputPanel from '../build/OutputPanel'
import { Icon } from './icons'
import { EmptyState } from './kit'
import { FailHint } from './NextStep'
import { baseName } from './problems'
import { useProject } from './project'
import { useUi } from './ui'
import type { BottomTab } from './ui'

function ProblemsPanel(): ReactNode {
  const problems = useBuild((s) => s.problems)
  const result = useBuild((s) => s.result)
  const root = useProject((s) => s.root)
  const openFile = useProject((s) => s.openFile)
  const rel = (f: string): string => {
    const n = f.replace(/\\/g, '/')
    const r = root?.replace(/\\/g, '/')
    return r && n.toLowerCase().startsWith(r.toLowerCase() + '/') ? n.slice(r.length + 1) : baseName(f)
  }
  if (!problems.length) {
    return (
      <EmptyState icon={result?.ok ? 'check' : 'info'} title={result ? (result.ok ? 'Проблем не найдено' : 'Нет разобранных ошибок') : 'Проблем нет'}
        hint={result ? (result.ok ? 'Последняя сборка прошла без замечаний.' : 'Подробности — во вкладке «Вывод».') : 'Ошибки и предупреждения компилятора появятся здесь после проверки (Ctrl+B).'} />
    )
  }
  return (
    <div className="problems-wrap">
    <FailHint />
    <div className="problems" role="list">
      {problems.map((p, i) => (
        <button key={i} role="listitem" data-testid="problem" className="problem" disabled={!p.file}
          onClick={() => p.file && void openFile(p.file, { line: p.line, column: p.column })}
          title={p.file ? `Перейти к ${baseName(p.file)}:${p.line}` : 'Ошибка без привязки к файлу'}>
          <span className={'sev ' + p.severity}><Icon name={p.severity === 'error' ? 'error' : p.severity === 'warning' ? 'warn' : 'info'} size={14} /></span>
          <span className="problem-msg">{p.message}</span>
          <span className="problem-loc">{p.file ? `${rel(p.file)}:${p.line}:${p.column}` : ''}</span>
        </button>
      ))}
    </div>
    </div>
  )
}

const TABS: { id: BottomTab; label: string }[] = [
  { id: 'output', label: 'Вывод' },
  { id: 'problems', label: 'Проблемы' },
  { id: 'monitor', label: 'Монитор порта' },
  { id: 'plotter', label: 'Плоттер' }
]

export default function BottomPanel(): ReactNode {
  const tab = useUi((s) => s.bottomTab)
  const set = useUi((s) => s.set)
  const toggle = useUi((s) => s.toggleBottom)
  const problems = useBuild((s) => s.problems)
  const errors = problems.filter((p) => p.severity === 'error').length
  const [monitorSeen, setMonitorSeen] = useState(tab === 'monitor')
  const [plotSeen, setPlotSeen] = useState(tab === 'plotter')
  useEffect(() => { if (tab === 'monitor') setMonitorSeen(true); if (tab === 'plotter') setPlotSeen(true) }, [tab])
  return (
    <section className="bottom" aria-label="Нижняя панель">
      <div className="btabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" data-testid={'btab-' + t.id} aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => set({ bottomTab: t.id })}>
            {t.label}
            {t.id === 'problems' && problems.length > 0 && <span className={'badge' + (errors ? ' err' : '')}>{problems.length}</span>}
          </button>
        ))}
        <span className="grow" />
        <button className="icon-btn" title="Свернуть панель (Ctrl+`)" onClick={toggle}><Icon name="chevD" size={15} /></button>
      </div>
      <div className="bbody">
        <div className="bpane" hidden={tab !== 'output'}><OutputPanel /></div>
        <div className="bpane" hidden={tab !== 'problems'}><ProblemsPanel /></div>
        {monitorSeen && <div className="bpane" hidden={tab !== 'monitor'}><MonitorPanel /></div>}
        {plotSeen && <div className="bpane" hidden={tab !== 'plotter'}><PlotterPanel /></div>}
      </div>
    </section>
  )
}
