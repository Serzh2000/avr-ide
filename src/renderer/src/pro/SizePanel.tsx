// Вкладка «Размер» нижней панели: использование Flash и RAM (по данным компоновщика), секции, самые большие символы последней сборки.
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { BuildReportDto } from '../../../main/pro/build/types'
import { useBuild } from '../build/useBuild'
import { EmptyState, Button, Skeleton, Tabs } from '../shell/kit'
import { useProject } from '../shell/project'
import { runExportBuild, runProBuild, fmtKb, useProBuild } from './buildStore'
import { useProStore } from './proStore'
import './build.css'

type View = 'regions' | 'sections' | 'symbols'

const hex = (n: number): string => '0x' + n.toString(16).toUpperCase().padStart(8, '0')
const tone = (pct: number, over: boolean): 'ok' | 'warn' | 'err' => (over || pct >= 100 ? 'err' : pct >= 85 ? 'warn' : 'ok')

function Meter({ name, used, total, pct, overflow, origin }: { name: string; used: number; total: number; pct: number; overflow: boolean; origin: number }): ReactNode {
  const t = tone(pct, overflow)
  return (
    <div className={'pb-meter ' + t} data-testid="size-region" data-region={name}>
      <div className="pb-meter-head">
        <b>{name}</b>
        <span className="pb-num">{fmtKb(used)} из {fmtKb(total)}</span>
        <span className="pb-pct">{pct}%{overflow ? ' · переполнение' : t === 'warn' ? ' · почти заполнено' : ''}</span>
      </div>
      <div className="pb-track" role="meter" aria-label={`${name}: занято ${pct}%`} aria-valuenow={Math.min(100, pct)} aria-valuemin={0} aria-valuemax={100}><div style={{ width: Math.min(100, Math.max(pct > 0 ? 1 : 0, pct)) + '%' }} /></div>
      <div className="pb-meter-sub dim small">{hex(origin)}</div>
    </div>
  )
}

function Regions({ r }: { r: BuildReportDto }): ReactNode {
  return (
    <div className="pb-regions">
      {r.regions.map((x) => <Meter key={x.name} name={x.name} used={x.used} total={x.length} pct={x.pct} overflow={x.overflow} origin={x.origin} />)}
      <p className="dim small pb-foot">Цифры компоновщика: в RAM входит резерв под кучу и стек (_Min_Heap_Size + _Min_Stack_Size). Сумма Flash — код, константы и начальные значения переменных.</p>
    </div>
  )
}

function Sections({ r }: { r: BuildReportDto }): ReactNode {
  return (
    <table className="pb-table" data-testid="size-sections">
      <thead><tr><th>Секция</th><th>Область</th><th className="num">Адрес</th><th className="num">Размер</th></tr></thead>
      <tbody>{r.map.sections.map((s) => <tr key={s.name + s.origin}><td className="mono">{s.name}</td><td>{s.region ?? '—'}</td><td className="num mono">{hex(s.origin)}</td><td className="num mono">{s.size} Б</td></tr>)}</tbody>
    </table>
  )
}

function Symbols({ r }: { r: BuildReportDto }): ReactNode {
  const root = useProject((s) => s.root)
  const short = (f?: string): string => {
    if (!f) return ''
    const n = f.replace(/\\/g, '/')
    const rr = root?.replace(/\\/g, '/')
    if (rr && n.toLowerCase().startsWith(rr.toLowerCase() + '/')) return n.slice(rr.length + 1).replace(/^build\/[^/]+\/obj\//, '').replace(/\.o$/, '')
    const m = /([^/]+\.a)\(([^)]+)\)/.exec(n)
    return m ? `${m[1]} (${m[2]})` : n.split('/').pop() ?? n
  }
  return (
    <table className="pb-table" data-testid="size-symbols">
      <thead><tr><th>Символ</th><th>Секция</th><th>Файл</th><th className="num">Размер</th></tr></thead>
      <tbody>{r.map.topSymbols.slice(0, 25).map((s, i) => <tr key={i}><td className="mono" title={s.name}>{s.name}</td><td className="mono">{s.section}</td><td className="dim" title={s.file}>{short(s.file)}</td><td className="num mono">{s.size} Б</td></tr>)}</tbody>
    </table>
  )
}

export default function SizePanel(): ReactNode {
  const project = useProStore((s) => s.project)
  const config = useProStore((s) => s.config)
  const report = useProBuild((s) => s.report)
  const reportError = useProBuild((s) => s.reportError)
  const busy = useBuild((s) => s.busy && s.kind === 'compile')
  const [view, setView] = useState<View>('regions')
  useEffect(() => { if (project && !useProBuild.getState().report) void useProBuild.getState().loadReport() }, [project, config])

  if (!project) return <div className="panel-body"><EmptyState icon="chart" title="Нет проекта STM32" hint="Размер программы показывается для проекта профессионального режима." /></div>
  if (busy && !report) return <div className="panel-body"><Skeleton rows={4} label="Идёт сборка" /></div>
  if (!report) {
    return (
      <div className="panel-body" data-testid="size-empty">
        <EmptyState icon="chart" title="Размер появится после сборки" hint={reportError && !/ещё нет/.test(reportError) ? reportError : `Для конфигурации ${config} образ ещё не собран. После сборки здесь будут Flash и RAM, секции и самые большие функции.`}>
          <Button variant="primary" data-testid="size-build" onClick={() => void runProBuild()}>Собрать (Ctrl+B)</Button>
        </EmptyState>
      </div>
    )
  }
  const when = report.at ? new Date(report.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''
  const over = report.regions.some((x) => x.overflow)
  return (
    <div className="panel-body pb-size" data-testid="size-panel">
      <div className="panel-actions">
        <span className="grow dim">{project.name} · {report.configuration}{when ? ` · собрано в ${when}` : ''}{over ? ' · есть переполнение' : ''}</span>
        <Tabs label="Вид отчёта" value={view} onChange={setView} items={[{ id: 'regions', label: 'Области' }, { id: 'sections', label: 'Секции' }, { id: 'symbols', label: 'Символы' }]} />
        <Button size="sm" data-testid="size-export" title="Создать Makefile и CMakeLists.txt, чтобы собирать вне IDE" onClick={() => void runExportBuild()}>Экспорт сборки</Button>
      </div>
      <div className="pb-size-body">
        {view === 'regions' && <Regions r={report} />}
        {view === 'sections' && <Sections r={report} />}
        {view === 'symbols' && <Symbols r={report} />}
      </div>
    </div>
  )
}
