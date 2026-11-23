// Инструменты, открываемые вкладками в рабочей области.
import type { ReactNode } from 'react'
import { useBuild } from '../build/useBuild'
import MonitorPanel from '../build/MonitorPanel'
import PlotterPanel from '../build/PlotterPanel'
import OutputPanel from '../build/OutputPanel'
import { Icon } from './icons'
import { EmptyState } from './kit'
import { FailHint } from './NextStep'
import { LibDiagBanner } from './LibDiag'
import { baseName } from './problems'
import { useProblems } from './useProblems'
import { useProject } from './project'
import type { UtilityTab } from './ui'
import { useProStore } from '../pro/proStore'
import DebugPanel from '../pro/DebugPanel'
import SwoPanel from '../pro/SwoPanel'
import SizePanel from '../pro/SizePanel'
import ProPortBar from '../pro/ProPortBar'

function ProblemsPanel(): ReactNode {
  const pro = useProStore((s) => s.proMode)
  const problems = useProblems()
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
      <div className="problems-wrap">
        <LibDiagBanner />
        <EmptyState icon={result?.ok ? 'check' : 'info'} title={result ? (result.ok ? 'Проблем не найдено' : 'Нет разобранных ошибок') : 'Проблем нет'}
          hint={result ? (result.ok ? 'Последняя сборка прошла без замечаний.' : 'Подробности — во вкладке «Вывод».') : (pro ? 'Ошибки и предупреждения компилятора появятся здесь после сборки (Ctrl+B).' : 'Ошибки и предупреждения компилятора появятся здесь после проверки (Ctrl+B).')} />
      </div>
    )
  }
  return (
    <div className="problems-wrap">
    <FailHint />
    <LibDiagBanner />
    <div className="problems" role="list">
      {problems.map((p, i) => (
        <button key={i} role="listitem" data-testid="problem" className="problem" disabled={!p.file}
          onClick={() => p.file && void openFile(p.file, { line: p.line, column: p.column })}
          title={p.file ? `${p.message}\nПерейти к ${baseName(p.file)}:${p.line}` : p.message}>
          <span className={'sev ' + p.severity}><Icon name={p.severity === 'error' ? 'error' : p.severity === 'warning' ? 'warn' : 'info'} size={14} /></span>
          <span className="problem-msg">{p.message}</span>
          <span className="problem-loc">{p.file ? `${rel(p.file)}:${p.line}:${p.column}` : ''}</span>
        </button>
      ))}
    </div>
    </div>
  )
}

export default function UtilityPanel({ tab }: { tab: UtilityTab }): ReactNode {
  const pro = useProStore((s) => s.proMode)
  const content = {
    output: () => <OutputPanel />,
    problems: () => <ProblemsPanel />,
    monitor: () => <>{pro && <ProPortBar />}<MonitorPanel /></>,
    plotter: () => <PlotterPanel />,
    size: () => <SizePanel />,
    debug: () => <DebugPanel />,
    swo: () => <SwoPanel />
  }
  return <section className="utility-content" data-testid={'utility-' + tab}>{content[tab]()}</section>
}
