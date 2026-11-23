// Строка состояния: плата, порт, версия arduino-cli, итог сборки, позиция курсора, кодировка.
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useBuild } from '../build/useBuild'
import { useBoardOptions, explicitSummary } from '../build/boardOptions'
import { boardName } from './commands'
import { Icon } from './icons'
import { Spinner } from './kit'
import NextStepButton, { useCurrentBuildResult } from './NextStep'
import { ElapsedText } from './BuildTimer'
import { useProject } from './project'
import { useUi } from './ui'
import { useProStore } from '../pro/proStore'
import ProNext from '../pro/ProNext'
import { useProblems } from './useProblems'

const kb = (n: number): string => (n >= 1024 ? (n / 1024).toFixed(1) + ' КБ' : n + ' Б')

/** Подпись языка по расширению файла (в Pro нет «C++» для .s и .ld). */
function langOf(p: string): string {
  const e = (p.split(/[\/]/).pop() ?? "").split(".").pop()?.toLowerCase() ?? ""
  if (e === 'c') return 'C'
  if (e === 'h') return 'C/C++ (заголовок)'
  if (e === 's' || e === 'asm') return 'Ассемблер'
  if (e === 'ld' || e === 'lds') return 'Скрипт компоновщика'
  if (e === 'json') return 'JSON'
  if (e === 'md') return 'Markdown'
  if (e === 'yaml' || e === 'yml') return 'YAML'
  if (e === 'txt') return 'Текст'
  return 'C++'
}

export default function StatusBar(): ReactNode {
  const pro = useProStore((s) => s.proMode)
  const fqbn = useUi((s) => s.fqbn)
  const port = useUi((s) => s.port)
  const cursor = useUi((s) => s.cursor)
  const setPicker = useUi((s) => s.setPicker)
  const showBottom = useUi((s) => s.showBottom)
  const showSide = useUi((s) => s.showSide)
  const status = useBuild((s) => s.status)
  const busy = useBuild((s) => s.busy)
  const kind = useBuild((s) => s.kind)
  const progress = useBuild((s) => s.progress)
  const result = useCurrentBuildResult()
  const problems = useProblems()
  const cores = useBuild((s) => s.cores)
  const tab = useProject((s) => s.tabs.find((t) => t.id === s.activeId))
  const content = useProject((s) => (tab?.path ? s.docs[tab.path]?.content : undefined))
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t) }, [])

  const errors = problems.filter((p) => p.severity === 'error').length
  const warns = problems.filter((p) => p.severity === 'warning').length
  const isFile = tab?.kind === 'file'
  const eol = content?.includes('\r\n') ? 'CRLF' : 'LF'
  const det = useBoardOptions((s) => s.byBoard[fqbn.split(':').slice(0, 3).join(':')])
  // Модель (pnum) уже видна в названии платы
  const opts = fqbn ? explicitSummary(fqbn, det?.state === 'ok' ? det.data : undefined).filter((o) => !(o.id === 'pnum' && det?.state === 'ok')) : []
  const optsText = opts.map((o) => o.value).join(' · ')
  const optsTitle = opts.map((o) => `${o.label}: ${o.value}`).join('\n')
  const core = cores?.find((c) => fqbn.startsWith(c.id + ':'))

  let state: ReactNode = <span className="sb-dim sb-ready">Готов</span>
  if (busy) {
    const pct = progress?.pct
    state = (
      <span className="sb-item" title={kind === 'compile' || kind === 'upload' ? 'Идёт сборка' : 'Выполняется операция'}>
        <Spinner /> {progress?.label ?? 'Выполняется…'}{pct != null ? ` ${Math.round(pct)}%` : ''} · <ElapsedText />
      </span>
    )
  } else if (result) {
    const sz = result.size
    state = result.cancelled ? (
      <span className="sb-item">Сборка отменена</span>
    ) : result.ok ? (
      <button className="sb-btn" onClick={() => showBottom('output')} title="Показать вывод сборки">
        <Icon name="check" size={13} /> {result.kind === 'upload' ? 'Загружено' : 'Собрано'}
        {pro ? (sz?.flash ? ` · Flash ${kb(sz.flash.used)} (${sz.flash.pct}%)` : '') : (sz?.flash ? ` · ${kb(sz.flash.used)} (${sz.flash.pct}%)` : '')}
        {pro ? (sz?.ram ? ` · RAM ${kb(sz.ram.used)} (${sz.ram.pct}%)` : '') : (sz?.ram ? ` · ОЗУ ${sz.ram.pct}%` : '')}
      </button>
    ) : (
      <button className="sb-btn" onClick={() => showBottom(errors ? 'problems' : 'output')} title="Показать ошибки">
        <Icon name="error" size={13} /> Ошибка сборки
      </button>
    )
  }

  return (
    <footer className="statusbar" data-testid="statusbar">
      <div className="sb-left" data-testid="sb-left">
        {!pro && <button className="sb-btn sb-md" onClick={() => setPicker('board')} title="Выбрать плату">
          <Icon name="board" size={13} /> {fqbn ? boardName(fqbn) : 'Плата не выбрана'}
        </button>}
        {!pro && opts.length > 0 && (
          <button className="sb-btn sb-md sb-opts" data-testid="sb-options" onClick={() => setPicker('options')} title={'Параметры платы:\n' + optsTitle}>
            <Icon name="sliders" size={13} /> {optsText}
          </button>
        )}
        {!pro && <button className="sb-btn sb-md" onClick={() => setPicker('port')} title="Выбрать порт">
          <Icon name="plug" size={13} /> {port || 'Нет порта'}
        </button>}
        <button className="sb-btn" onClick={() => showBottom('problems')} title="Ошибки и предупреждения проекта">
          <Icon name="error" size={13} /> {errors} <Icon name="warn" size={13} /> {warns}
        </button>
        <span className="sb-sep" />
        {state}
        {!busy && !pro && <NextStepButton className="sb-btn sb-next" />}
        {pro && <ProNext className="sb-btn sb-next" />}
      </div>
      <div className="sb-right">
        {!pro && <button className="sb-btn sb-sm" onClick={() => showSide('boards')}
          title={status?.found ? `arduino-cli ${status.version ?? ''} (${status.path ?? ''})` : 'arduino-cli не найден — нажмите для диагностики'}>
          {status === null ? 'arduino-cli…' : status.found ? `arduino-cli ${status.version ?? ''}` : '⚠ arduino-cli не найден'}
          {core?.installed ? ` · ядро ${core.installed}` : ''}
        </button>}
        {isFile && (
          <>
            <span className="sb-item" title="Строка и столбец курсора">Стр {cursor.line}, стлб {cursor.col}</span>
            <span className="sb-item sb-sm" title="Кодировка файла">UTF-8</span>
            <span className="sb-item sb-sm" title="Символ конца строки">{eol}</span>
            <span className="sb-item sb-sm" title="Язык">{langOf(tab?.path ?? '')}</span>
          </>
        )}
      </div>
    </footer>
  )
}
