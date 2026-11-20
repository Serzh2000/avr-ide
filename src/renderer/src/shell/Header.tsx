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

const TOOL_TITLES: Record<string, string> = { ref: 'Справочник', ui: 'Конструктор ESPUI', web: 'Веб-дизайнер', settings: 'Настройки' }

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

function BoardPopover({ onClose }: { onClose: () => void }): ReactNode {
  const rows = useBoardRows()
  const fqbn = useUi((s) => s.fqbn)
  const set = useUi((s) => s.set)
  const notify = useUi((s) => s.notify)
  const showSide = useUi((s) => s.showSide)
  const ports = useBuild((s) => s.ports)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  usePopoverClose(true, onClose, ref)
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
    set({ fqbn: r.fqbn })
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

function PortPopover({ onClose }: { onClose: () => void }): ReactNode {
  const ports = useBuild((s) => s.ports)
  const found = useBuild((s) => s.status?.found)
  const refresh = useBuild((s) => s.refreshPorts)
  const port = useUi((s) => s.port)
  const set = useUi((s) => s.set)
  const ref = useRef<HTMLDivElement>(null)
  usePopoverClose(true, onClose, ref)
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
              const b = p.boards.find((x) => x.fqbn)
              set(b?.fqbn ? { port: p.address, fqbn: keepOptions(useUi.getState().fqbn, b.fqbn) } : { port: p.address })
              onClose()
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
    </div>
  )
}

export default function Header(): ReactNode {
  const busy = useBuild((s) => s.busy)
  const kind = useBuild((s) => s.kind)
  const progress = useBuild((s) => s.progress)
  const found = useBuild((s) => s.status?.found)
  const cancel = useBuild((s) => s.cancel)
  const ports = useBuild((s) => s.ports)
  const cores = useBuild((s) => s.cores)
  const { fqbn, port, picker, setPicker, set, notify } = useUi()
  const toggleSide = useUi((s) => s.toggleSide)
  const toggleBottom = useUi((s) => s.toggleBottom)
  const sideVisible = useUi((s) => s.sideVisible)
  const bottomVisible = useUi((s) => s.bottomVisible)
  const setPalette = useUi((s) => s.setPalette)
  const name = useProject((s) => s.name)
  const toolMode = useProject((s) => { const k = s.tabs.find((t) => t.id === s.activeId)?.kind; return k === 'ref' || k === 'ui' || k === 'web' })
  const fullscreen = useUi((s) => s.fullscreen)
  const setFullscreen = useUi((s) => s.setFullscreen)
  const crumb = useProject((s) => {
    const t = s.tabs.find((x) => x.id === s.activeId)
    if (!t) return ''
    if (t.kind === 'file') return t.path ? t.path.split(/[\\/]/).pop() ?? '' : ''
    return TOOL_TITLES[t.kind] ?? ''
  })
  const hasMain = useProject((s) => !!s.mainFile)
  const seen = useRef<Set<string> | null>(null)

  // Автоопределение: новая плата на порту выбирается сама
  useEffect(() => {
    const now = new Set(ports.map((p) => p.address))
    const prev = seen.current
    seen.current = now
    const withBoard = ports.find((p) => p.boards.some((b) => b.fqbn) && (!prev || !prev.has(p.address)))
    if (withBoard) {
      const b = withBoard.boards.find((x) => x.fqbn)!
      const st = useUi.getState()
      if (prev || !st.port || !now.has(st.port)) {
        set({ port: withBoard.address, fqbn: keepOptions(st.fqbn, b.fqbn!) })
        if (prev && performance.now() > 6000) notify(`Обнаружена плата ${b.name} на ${withBoard.address}`)
      }
    } else if (ports.length) {
      const st = useUi.getState()
      if (!st.port || !now.has(st.port)) set({ port: (ports.find((p) => p.protocol === 'serial') ?? ports[0]).address })
    }
  }, [ports]) // eslint-disable-line react-hooks/exhaustive-deps

  const details = useBoardDetails(fqbn)
  const hasOptions = details?.state === 'ok' && details.data.options.length > 0
  const changed = Object.keys(fqbnOptions(fqbn)).length
  const coreMissing = !!cores && !cores.some((c) => c.id === coreOf(fqbn || 'x:y:z'))
  const portOnline = !!port && ports.some((p) => p.address === port)
  const buildKind = kind === 'compile' || kind === 'upload'

  return (
    <header className="header" data-testid="header">
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
          <button data-testid="hdr-board" className={'chip' + (picker === 'board' ? ' open' : '')} onClick={() => setPicker(picker === 'board' ? null : 'board')} title="Выбрать плату">
            <Icon name="board" size={14} />
            <span className="chip-label">{fqbn ? boardName(fqbn) : 'Выберите плату'}</span>
            {coreMissing && <span className="chip-warn" title="Не установлена поддержка этой платы (ядро) — раздел «Платы»"><Icon name="warn" size={13} /></span>}
            <Icon name="chevD" size={12} />
          </button>
          {picker === 'board' && <BoardPopover onClose={() => setPicker(null)} />}
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
          <button data-testid="hdr-port" className={'chip' + (picker === 'port' ? ' open' : '')} onClick={() => setPicker(picker === 'port' ? null : 'port')} title="Выбрать порт, к которому подключена плата">
            <Icon name="plug" size={14} />
            {port && <span className={'port-dot' + (portOnline ? ' on' : '')} aria-hidden="true" />}
            <span className="chip-label">{port ? (portOnline ? port : port + ' (не найден)') : 'Нет порта'}</span>
            <Icon name="chevD" size={12} />
          </button>
          {picker === 'port' && <PortPopover onClose={() => setPicker(null)} />}
        </div>
      </div>

      <NextStepButton className="next-step" />
      <div className="hdr-mid">
        <div className="hdr-title" data-testid="hdr-title" title={name ? `Проект: ${name}` : undefined}>{name}</div>
        {crumb && <span className="hdr-crumb" data-testid="hdr-crumb" title="Что сейчас открыто">{crumb}</span>}
      </div>

      <div className="hdr-group right">
        {toolMode && (
          <button className={'icon-btn' + (fullscreen ? ' on' : '')} title={fullscreen ? 'Выйти из полноэкранного режима (Esc)' : 'Во весь экран: скрыть всё, кроме вкладки'} aria-label="Во весь экран"
            onClick={() => setFullscreen(!fullscreen)}><Icon name="collapse" size={16} /></button>
        )}
        <button className="icon-btn" title="Закрыть проект — вернуться на стартовый экран" aria-label="Закрыть проект" data-testid="hdr-close-project" onClick={() => void useProject.getState().closeProject()}><Icon name="home" size={16} /></button>
        <span className="hdr-sep" aria-hidden="true" />
        <button className="icon-btn" data-testid="hdr-help" title="Справка: где что находится, горячие клавиши, тур" aria-label="Справка" onClick={() => useUi.getState().setHelp(true)}><Icon name="info" size={16} /></button>
        <button className="icon-btn" title="Командная палитра: любое действие по названию (Ctrl+Shift+P)" onClick={() => setPalette('commands')}><Icon name="command" size={16} /></button>
        <button className={'icon-btn' + (sideVisible ? ' on' : '')} title="Боковая панель (Ctrl+\)" onClick={toggleSide}><Icon name="sidebar" size={16} /></button>
        <button className={'icon-btn' + (bottomVisible ? ' on' : '')} title="Нижняя панель (Ctrl+`)" onClick={toggleBottom}><Icon name="panelBottom" size={16} /></button>
      </div>
    </header>
  )
}
