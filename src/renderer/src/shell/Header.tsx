import { useWorkspaceHeaderContext, WorkspaceHeaderActions, WorkspaceTitle } from './WorkspaceHeader'
import type { WorkspaceMenuAction } from './WorkspaceTools'
// Верхняя панель: проверка/загрузка, выбор платы и порта, быстрые действия.
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useBuild } from '../build/useBuild'
import { matchRow, useBoardRows } from '../build/boardRows'
import type { BoardRow } from '../build/boardRows'
import { useBoardDetails } from '../build/boardOptions'
import { baseFqbn, fqbnOptions } from '../../../main/cli/fqbn'
import { BoardOptionsForm } from './BoardOptions'
import { GROUP_ORDER, coreOf, groupOf } from '../build/boards'
import type { BoardGroup } from '../build/boards'
import { boardName, runBuild } from './commands'
import { Icon } from './icons'
import { Spinner, usePopoverClose } from './kit'
import NextStepButton from './NextStep'
import { useProject } from './project'
import { useUi } from './ui'

/** Определилась та же плата, что уже выбрана: выбранные параметры (способ загрузки, USB…) не сбрасываем. */
const keepOptions = (cur: string, next: string): string => (baseFqbn(cur) === baseFqbn(next) && Object.keys(fqbnOptions(next)).length === 0 ? cur : next)

function OptionsPopover({ onClose }: { onClose: () => void }): ReactNode {
  const fqbn = useUi((s) => s.fqbn)
  const set = useUi((s) => s.set)
  const ref = useRef<HTMLDivElement>(null)
  usePopoverClose(true, onClose, ref)
  return (
    <div className="popover options-pop" ref={ref} role="dialog" aria-label="Параметры платы" data-testid="options-pop">
      <div className="pop-head"><span className="grow">Параметры платы</span><button className="icon-btn" aria-label="Закрыть" onClick={onClose}><Icon name="x" size={14} /></button></div>
      <div className="bo-body"><BoardOptionsForm fqbn={fqbn} onChange={(next) => set({ fqbn: next })} /></div>
      <div className="bo-hint dim small">Параметры записываются в sketch.yaml проекта и подставляются при проверке и загрузке.</div>
    </div>
  )
}

function BoardPopover({ onClose, trigger }: { onClose: () => void; trigger: React.RefObject<HTMLButtonElement | null> }): ReactNode {
  const rows = useBoardRows()
  const fqbn = useUi((s) => s.fqbn)
  const set = useUi((s) => s.set)
  const notify = useUi((s) => s.notify)
  const showSide = useUi((s) => s.showSide)
  const ports = useBuild((s) => s.ports)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  usePopoverClose(true, onClose, ref, trigger)
  useEffect(() => { ref.current?.querySelector('input')?.focus() }, [])

  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean)
  const shown = rows.filter((r) => tokens.every((t) => (r.name + ' ' + r.fqbn).toLowerCase().includes(t)))
  const groups = GROUP_ORDER.map((g) => ({ g, items: shown.filter((r) => groupOf(r.fqbn) === g) })).filter((x) => x.items.length)
  const current = matchRow(rows, fqbn)?.fqbn
  const detected = ports.flatMap((p) => p.boards.filter((b) => b.fqbn).map((b) => ({ port: p.address, name: b.name, fqbn: b.fqbn! })))

  const pick = (r: BoardRow): void => {
    if (!r.installed) {
      notify(`Для платы «${r.name}» нужна поддержка плат (ядро ${coreOf(r.fqbn)}). Установите её в разделе «Платы».`)
      showSide('boards')
      onClose()
      return
    }
    set({ fqbn: r.fqbn, ...(baseFqbn(r.fqbn) !== baseFqbn(fqbn) ? { port: '' } : {}) })
    onClose()
  }

  return (
    <div className="popover board-pop" ref={ref} role="dialog" aria-label="Выбор платы">
      <div className="pop-search">
        <Icon name="search" size={14} />
        <input placeholder="Найти плату: uno, esp32, nodemcu…" value={q} onChange={(e) => setQ(e.target.value)} spellCheck={false} />
      </div>
      <div className="pop-list">
        {!q && detected.length > 0 && (
          <div className="pop-group">
            <div className="pop-group-title">Подключено</div>
            {detected.map((d) => (
              <button key={d.port} className="pop-item" onClick={() => { set({ fqbn: keepOptions(fqbn, d.fqbn), port: d.port }); onClose() }}>
                <Icon name="plug" size={14} /><span className="grow">{d.name}</span><span className="dim">{d.port}</span>
              </button>
            ))}
          </div>
        )}
        {groups.map(({ g, items }) => (
          <div className="pop-group" key={g}>
            <div className="pop-group-title">{g as BoardGroup}</div>
            {items.slice(0, q ? 80 : 40).map((r) => (
              <button key={r.fqbn} className={'pop-item' + (r.fqbn === current ? ' selected' : '') + (r.installed ? '' : ' muted')} onClick={() => pick(r)}
                title={r.installed ? r.fqbn : `Не установлена поддержка плат (ядро ${coreOf(r.fqbn)})`}>
                <span className="grow">{r.name}</span>
                {!r.installed && <span className="dim">не установлена</span>}
                {r.fqbn === current && <Icon name="check" size={14} />}
              </button>
            ))}
            {items.length > (q ? 80 : 40) && <div className="pop-more">Показаны первые {q ? 80 : 40} из {items.length} — уточните поиск</div>}
          </div>
        ))}
        {groups.length === 0 && <div className="pop-empty">Ничего не найдено. Нужной платы нет? Установите для неё поддержку плат в разделе «Платы».</div>}
      </div>
      <button className="pop-foot" onClick={() => { showSide('boards'); onClose() }}><Icon name="board" size={14} /> Установить поддержку плат…</button>
    </div>
  )
}

function PortPopover({ onClose, trigger }: { onClose: () => void; trigger?: React.RefObject<HTMLButtonElement | null> }): ReactNode {
  const ports = useBuild((s) => s.ports)
  const found = useBuild((s) => s.status?.found)
  const refresh = useBuild((s) => s.refreshPorts)
  const port = useUi((s) => s.port)
  const set = useUi((s) => s.set)
  const ref = useRef<HTMLDivElement>(null)
  usePopoverClose(true, onClose, ref, trigger)
  const finish = (): void => { onClose(); trigger?.current?.focus() }
  const [spin, setSpin] = useState(false)
  const doRefresh = async (): Promise<void> => { setSpin(true); await refresh(); setSpin(false) }
  useEffect(() => { void doRefresh() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="popover port-pop" ref={ref} role="dialog" aria-label="Выбор порта">
      <div className="pop-head">
        <span className="grow">Порт</span>
        <button className="icon-btn" title="Обновить список портов" onClick={() => void doRefresh()}>{spin ? <Spinner /> : <Icon name="refresh" size={14} />}</button>
      </div>
      <div className="pop-list">
        {ports.map((p) => (
          <button key={p.address} className={'pop-item' + (p.address === port ? ' selected' : '')}
            onClick={() => {
              set({ port: p.address })
              finish()
            }}>
            <Icon name="plug" size={14} />
            <span className="grow">{p.address}{p.boards[0] ? <span className="dim"> · {p.boards[0].name}</span> : p.label && p.label !== p.address ? <span className="dim"> · {p.label}</span> : null}</span>
            {p.address === port && <Icon name="check" size={14} />}
          </button>
        ))}
        {ports.length === 0 && (
          <div className="pop-empty">
            {found ? 'Порты не найдены. Подключите плату USB-кабелем (для платы нужен кабель с данными, а не только питание) и нажмите «Обновить».' : 'arduino-cli не найден — список портов недоступен.'}
          </div>
        )}
      </div>
      {port && <button className="pop-foot" data-testid="clear-upload-port" onClick={() => { set({ port: '' }); finish() }}><Icon name="x" size={14} /> Снять выбор порта</button>}
    </div>
  )
}

export default function Header(): ReactNode {
  const boardTrigger = useRef<HTMLButtonElement>(null)
  const portTrigger = useRef<HTMLButtonElement>(null)
  const busy = useBuild((s) => s.busy)
  const kind = useBuild((s) => s.kind)
  const progress = useBuild((s) => s.progress)
  const found = useBuild((s) => s.status?.found)
  const cancel = useBuild((s) => s.cancel)
  const ports = useBuild((s) => s.ports)
  const cores = useBuild((s) => s.cores)
  const { fqbn, port, picker, setPicker } = useUi()
  const { toolLabel, canFocusTool } = useWorkspaceHeaderContext()
  const compact = !!toolLabel
  const details = useBoardDetails(fqbn)
  const hasOptions = details?.state === 'ok' && details.data.options.length > 0
  const changed = Object.keys(fqbnOptions(fqbn)).length
  const coreMissing = !!cores && !cores.some((c) => c.id === coreOf(fqbn || 'x:y:z'))
  const portOnline = !!port && ports.some((p) => p.address === port)
  const boardLabel = fqbn ? boardName(fqbn) : 'Выберите плату'
  const portLabel = port ? (portOnline ? port : port + ' (не найден)') : 'Нет порта'
  const buildKind = kind === 'compile' || kind === 'upload'

  const projectActions: WorkspaceMenuAction[] = compact ? [
    { id: 'verify', title: 'Проверить скетч', icon: 'check', run: () => void runBuild(false), disabled: !found || busy },
    { id: 'upload', title: 'Загрузить скетч на плату', icon: 'arrow', run: () => void runBuild(true), disabled: !found || busy },
    ...(busy ? [{ id: 'cancel', title: 'Остановить операцию', icon: 'stop', run: cancel } as const] : []),
    { id: 'board', title: 'Выбрать плату…', icon: 'board', run: () => setPicker('board') },
    ...(hasOptions ? [{ id: 'options', title: 'Параметры платы…', icon: 'sliders', run: () => setPicker('options') } as const] : []),
    { id: 'port', title: 'Выбрать порт…', icon: 'plug', run: () => setPicker('port') }
  ] : []

  return (
    <header className="header" data-testid="header" data-context={compact ? 'tool' : 'editor'}>
      {!compact && <>
      <div className="hdr-group">
        {(() => {
          const verifying = busy && kind === 'compile'
          const uploading = busy && kind === 'upload'
          const offHint = found === false ? 'Недоступно: arduino-cli не найден — см. раздел «Платы»' : ''
          return (
            <>
              <button className="hbtn" data-testid="hdr-verify" onClick={() => void runBuild(false)} disabled={!found || busy} aria-busy={verifying}
                title={offHint || (verifying ? 'Идёт проверка…' : 'Проверить: компилировать скетч без загрузки (Ctrl+B)')} aria-label="Проверить">
                {verifying ? <Spinner /> : <Icon name="check" size={16} />} <span className="hlabel">{verifying ? 'Проверка…' : 'Проверить'}</span>
              </button>
              <button className="hbtn primary" data-testid="hdr-upload" onClick={() => void runBuild(true)} disabled={!found || busy} aria-busy={uploading}
                title={offHint || (uploading ? 'Идёт загрузка…' : 'Загрузить скетч на плату (Ctrl+U)')} aria-label="Загрузить">
                {uploading ? <Spinner /> : <Icon name="arrow" size={16} />} <span className="hlabel">{uploading ? 'Загрузка…' : 'Загрузить'}</span>
              </button>
              {busy && (
                <button className="hbtn stop" onClick={cancel} title="Остановить текущую операцию" aria-label="Остановить">
                  <Icon name="stop" size={14} fill /> <span className="hlabel">Остановить</span>
                </button>
              )}
            </>
          )
        })()}
        {busy && (
          <span className="hdr-progress" title={progress?.label}>
            <Spinner /> <span>{buildKind || progress ? progress?.label : 'Выполняется…'}</span>
          </span>
        )}
      </div>

      <div className="hdr-group chips">
        <div className="chip-wrap">
          <button ref={boardTrigger} data-testid="hdr-board" className={'chip' + (picker === 'board' ? ' open' : '')} onClick={() => setPicker(picker === 'board' ? null : 'board')}
            title={fqbn ? `Плата: ${boardLabel}. Нажмите, чтобы выбрать другую` : boardLabel}>
            <Icon name="board" size={14} />
            <span className="chip-label">{boardLabel}</span>
            {coreMissing && <span className="chip-warn" title="Не установлена поддержка этой платы (ядро) — раздел «Платы»"><Icon name="warn" size={13} /></span>}
            <Icon name="chevD" size={12} />
          </button>
          {picker === 'board' && <BoardPopover trigger={boardTrigger} onClose={() => setPicker(null)} />}
        </div>
        {hasOptions && (
          <div className="chip-wrap">
            <button data-testid="hdr-options" className={'chip chip-icon' + (picker === 'options' ? ' open' : '')} onClick={() => setPicker(picker === 'options' ? null : 'options')}
              title="Параметры платы: способ загрузки, USB, частота…" aria-label="Параметры платы">
              <Icon name="sliders" size={14} />
              <span className="chip-label hlabel">Параметры{changed ? ` · ${changed}` : ''}</span>
            </button>
            {picker === 'options' && <OptionsPopover onClose={() => setPicker(null)} />}
          </div>
        )}
        <div className="chip-wrap">
          <button ref={portTrigger} data-testid="hdr-port" className={'chip' + (picker === 'port' ? ' open' : '')} onClick={() => setPicker(picker === 'port' ? null : 'port')}
            title={`${portLabel}. Нажмите, чтобы выбрать порт`}>
            <Icon name="plug" size={14} />
            {port && <span className={'port-dot' + (portOnline ? ' on' : '')} aria-hidden="true" />}
            <span className="chip-label">{portLabel}</span>
            <Icon name="chevD" size={12} />
          </button>
          {picker === 'port' && <PortPopover trigger={portTrigger} onClose={() => setPicker(null)} />}
        </div>
      </div>

      <NextStepButton className="next-step" />
      </>}
      <WorkspaceTitle toolLabel={toolLabel} />
      <WorkspaceHeaderActions compact={compact} canFocusTool={canFocusTool} projectActions={projectActions}>
        {compact && picker && (
          <div className="workspace-picker">
            {picker === 'board' && <BoardPopover trigger={boardTrigger} onClose={() => setPicker(null)} />}
            {picker === 'options' && <OptionsPopover onClose={() => setPicker(null)} />}
            {picker === 'port' && <PortPopover onClose={() => setPicker(null)} />}
          </div>
        )}
      </WorkspaceHeaderActions>
    </header>
  )
}
