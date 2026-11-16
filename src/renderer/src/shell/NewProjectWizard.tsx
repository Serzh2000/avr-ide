// Мастер «Создать проект»: шаг 1 — плата, шаг 2 — имя и папка.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { validateSketchName } from '../../../main/files/naming'
import { useBoardRows } from '../build/boardRows'
import type { BoardRow } from '../build/boardRows'
import { BASE_CORES, BOARD_PRESETS, GROUP_ORDER, coreOf, groupOf } from '../build/boards'
import type { BoardGroup } from '../build/boards'
import { installBaseCores, useSetup } from '../build/setup'
import { connectSource } from '../build/sourcesStore'
import { fmtBytes, installFromKit, packFor, packTime, useCores } from '../build/coresStore'
import type { CatalogHit } from '../../../main/boardsources/types'
import { useBuild } from '../build/useBuild'
import { Icon } from './icons'
import { Dialog, Spinner } from './kit'
import { useProject } from './project'
import { useUi } from './ui'

const PRESET_ORDER = new Map(BOARD_PRESETS.map((p, i) => [p.fqbn, i]))
const GROUP_LIMIT = 40
const coreLabel = (core: string): string => BASE_CORES.find((c) => c.id === core)?.label ?? core

/** Порядок в группе: сначала установленные, затем популярные, затем по алфавиту. */
function sortRows(a: BoardRow, b: BoardRow): number {
  if (a.installed !== b.installed) return a.installed ? -1 : 1
  const pa = PRESET_ORDER.get(a.fqbn) ?? 999
  const pb = PRESET_ORDER.get(b.fqbn) ?? 999
  return pa !== pb ? pa - pb : a.name.localeCompare(b.name, 'en', { numeric: true })
}

const GROUP_RANK: Record<string, number> = { ESP32: 0, ESP8266: 1, AVR: 2, 'Другие': 3 }

/** Плата по умолчанию: первая из установленных (в порядке показа в списке). */
function bestRow(rows: BoardRow[]): BoardRow | undefined {
  return rows.filter((r) => r.installed).sort((a, b) =>
    (GROUP_RANK[groupOf(a.fqbn)] - GROUP_RANK[groupOf(b.fqbn)]) || sortRows(a, b))[0]
}

function Steps({ step }: { step: 1 | 2 }): ReactNode {
  const item = (n: 1 | 2, label: string): ReactNode => (
    <li className={'wz-step' + (step === n ? ' on' : step > n ? ' done' : '')} aria-current={step === n ? 'step' : undefined}>
      <span className="wz-num">{step > n ? <Icon name="check" size={12} /> : n}</span>
      {label}
    </li>
  )
  return <ol className="wz-steps">{item(1, 'Плата')}<li className="wz-line" aria-hidden="true" />{item(2, 'Проект')}</ol>
}

/** Под списком: состояние ядра выбранной платы и установка прямо здесь. */
function CoreStrip({ sel }: { sel: BoardRow | null }): ReactNode {
  const status = useBuild((s) => s.status)
  const cores = useBuild((s) => s.cores)
  const espUrls = useBuild((s) => s.espUrls)
  const busy = useBuild((s) => s.busy)
  const progress = useBuild((s) => s.progress)
  const cancel = useBuild((s) => s.cancel)
  const recheck = useBuild((s) => s.recheck)
  const log = useBuild((s) => s.log)
  const { running, steps, error } = useSetup()
  const notify = useUi((s) => s.notify)
  const packs = useCores((s) => s.state?.packs)
  const refreshPacks = useCores((s) => s.refresh)
  useEffect(() => { void refreshPacks() }, [refreshPacks])
  // Состояние проверки показывает скелетон списка плат; отдельной строки внизу нет
  if (!sel) return null
  if (!status || (status.found && cores === null)) return null

  const core = coreOf(sel.fqbn)
  const isEsp = !!BASE_CORES.find((c) => c.id === core)?.esp
  const urlsKnown = core === 'esp32:esp32' ? espUrls?.esp32 : core === 'esp8266:esp8266' ? espUrls?.esp8266 : true
  const needConsent = isEsp && !urlsKnown

  if (!status.found) {
    return (
      <div className="wz-core warn">
        <div className="wz-core-text">
          <b>Не найден arduino-cli</b> — установить ядро сейчас нельзя. Проект всё равно можно создать, а ядро поставить позже.
        </div>
        <button className="btn small" onClick={async () => {
          const r = await window.api.cli.pickPath()
          if (!r.ok) notify(r.error)
          else if (r.data) await recheck()
        }}>Указать путь…</button>
      </div>
    )
  }

  if (sel.installed && !running && !steps.some((s) => s.status === 'run')) {
    return <div className="wz-core ok" data-testid="wz-core" data-state="installed"><Icon name="check" size={15} /> Ядро «{coreLabel(core)}» установлено — плата готова к работе.</div>
  }

  const pack = packFor(packs, core)
  const pct = progress?.pct
  const failed = !running && !!error
  const tail = failed ? log.trim().split(/\r?\n/).slice(-5).join('\n') : ''
  return (
    <div className="wz-core accent" data-testid="wz-core" data-state={running ? 'installing' : failed ? 'failed' : 'missing'}>
      {!running && pack && (
        <div className="wz-core-row" data-testid="wz-kit">
          <div className="wz-core-text">
            Для платы «{sel.name}» нужно ядро <b>{coreLabel(core)}</b>. Его можно установить <b>из комплекта, без интернета</b>: версия {pack.version}, {packTime(pack)}, понадобится около {fmtBytes(pack.diskNeed)} свободного места.
            {isEsp && !urlsKnown && <span className="dim"> В настройки arduino-cli будет добавлен официальный адрес пакетов ({core === 'esp32:esp32' ? 'ESP32' : 'ESP8266'}), чтобы ядро потом обновлялось из менеджера.</span>}
          </div>
          <div className="wz-core-btns">
            <button className="btn primary" data-testid="wz-install-pack" disabled={busy} onClick={() => void installFromKit(pack)}>
              <Icon name="download" size={15} /> Установить из комплекта (без интернета)
            </button>
            <button className="btn" data-testid="wz-install-core" disabled={busy} onClick={() => void installBaseCores([core], needConsent)}>Скачать из интернета</button>
          </div>
        </div>
      )}
      {!running && !pack && (
        <div className="wz-core-row">
          <div className="wz-core-text">
            Для платы «{sel.name}» нужно установить ядро <b>{coreLabel(core)}</b>. Потребуется интернет, загрузка может занять несколько минут.
            {core === 'esp32:esp32' && <span className="dim" data-testid="wz-kit-hint"> Пакет ядра ESP32 (≈ 1,9 ГБ) можно положить рядом с установщиком — тогда он установится без интернета. <button className="link-btn" onClick={async () => { const r = await window.api.cores.addFolder(); if (!r.ok) notify(r.error); else if (r.data) await refreshPacks() }}>Указать папку с пакетом…</button></span>}
            {needConsent && <span className="dim"> Для этого в настройки arduino-cli будут добавлены официальные адреса пакетов ESP — нажимая кнопку, вы на это соглашаетесь.</span>}
          </div>
          <button className="btn primary" data-testid="wz-install-core" disabled={busy} onClick={() => void installBaseCores([core], needConsent)}>
            <Icon name="download" size={15} /> Установить ядро
          </button>
        </div>
      )}
      {steps.length > 0 && (
        <ul className="steps">
          {steps.map((s) => (
            <li key={s.id} className={'step ' + s.status}>
              <span className="step-ico">{s.status === 'run' ? <Spinner /> : s.status === 'ok' ? <Icon name="check" size={14} /> : s.status === 'fail' ? <Icon name="x" size={14} /> : <span className="dot" />}</span>
              {s.label}
            </li>
          ))}
        </ul>
      )}
      {running && (
        <>
          <div className={'bar' + (pct == null ? ' indeterminate' : '')}><div style={{ width: pct != null ? pct + '%' : undefined }} /></div>
          <div className="wz-core-row"><span className="dim small">{progress?.label ?? 'Выполняется…'}{pct != null ? ` ${Math.round(pct)}%` : ''}</span><button className="btn small" onClick={cancel}>Отмена</button></div>
        </>
      )}
      {failed && <div className="field-error">{error}</div>}
      {failed && tail && <pre className="wz-log">{tail}</pre>}
    </div>
  )
}

/**
 * Если по запросу в списке нет плат, но они есть в проверенном источнике, — предлагаем подключить источник
 * и сразу поставить ядро (с тем же согласием, что и в панели «Платы»).
 */
function SourceHints({ q }: { q: string }): ReactNode {
  const cores = useBuild((s) => s.cores)
  const busy = useBuild((s) => s.busy)
  const progress = useBuild((s) => s.progress)
  const cancel = useBuild((s) => s.cancel)
  const found = useBuild((s) => !!s.status?.found)
  const log = useBuild((s) => s.log)
  const [hits, setHits] = useState<CatalogHit[]>([])
  const [mine, setMine] = useState('')
  const [failed, setFailed] = useState<string | null>(null)

  useEffect(() => {
    const text = q.trim()
    if (!found || text.length < 2) { setHits([]); return }
    let alive = true
    const t = setTimeout(async () => {
      const r = await window.api.boardsources.catalogSearch(text)
      if (alive && r.ok) setHits(r.data)
    }, 350)
    return () => { alive = false; clearTimeout(t) }
  }, [q, found, cores])

  const have = new Set((cores ?? []).map((c) => c.id))
  // Показываем только то, чего ещё нет среди установленных ядер
  const todo = hits.map((h) => ({ h, core: h.coreIds.find((id) => !have.has(id)) })).filter((x) => x.core).slice(0, 3)
  if (todo.length === 0 && !failed) return null

  const go = async (h: CatalogHit, core: string): Promise<void> => {
    setFailed(null); setMine(h.source.id)
    const ok = await connectSource({ name: h.source.name, url: h.source.url, https: h.source.https }, core, { openOutput: false })
    setMine('')
    if (!ok && !useBuild.getState().lastDone?.cancelled) setFailed('Не удалось подключить источник или установить ядро. Подробности — во вкладке «Вывод».')
  }
  const tail = failed ? log.trim().split(/\r?\n/).slice(-4).join('\n') : ''
  return (
    <div className="wz-src" aria-label="Источники плат">
      <div className="wz-src-title">Есть в источниках плат</div>
      {todo.map(({ h, core }) => (
        <div className="wz-src-item" key={h.source.id}>
          <div className="grow">
            <div className="wz-src-name">{h.source.name} {!h.source.https && <span className="src-badge warn"><Icon name="warn" size={10} /> http</span>}</div>
            <div className="dim small">{mine === h.source.id && busy ? (progress?.label ?? 'Выполняется…') + (progress?.pct != null ? ' ' + Math.round(progress.pct) + '%' : '') : h.matches.length ? h.matches.slice(0, 3).join(', ') : h.source.description}</div>
          </div>
          {mine === h.source.id && busy
            ? <span className="dim small wz-src-run"><Spinner /> <button className="link-btn" onClick={cancel}>Отмена</button></span>
            : <button className="btn small primary" disabled={busy} onClick={() => void go(h, core as string)}>
              {h.source.connected ? 'Установить ядро' : 'Подключить источник и установить ядро'}
            </button>}
        </div>
      ))}
      {failed && <div className="field-error">{failed}</div>}
      {failed && tail && <pre className="wz-log">{tail}</pre>}
    </div>
  )
}

function BoardStep({ sel, setSel }: { sel: string; setSel: (f: string) => void }): ReactNode {
  const rows = useBoardRows()
  const status = useBuild((s) => s.status)
  const cores = useBuild((s) => s.cores)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { input.current?.focus() }, [])

  const loading = !status || (status.found && cores === null)
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean)
  const shown = rows.filter((r) => tokens.every((t) => (r.name + ' ' + r.fqbn).toLowerCase().includes(t)))
  const groups = useMemo(() => {
    const gs = GROUP_ORDER.map((g) => ({ g, items: shown.filter((r) => groupOf(r.fqbn) === g).sort(sortRows) })).filter((x) => x.items.length)
    // Группы с установленными ядрами — выше; внутри каждой — порядок ESP32, ESP8266, AVR, Другие
    const order: BoardGroup[] = ['ESP32', 'ESP8266', 'AVR', 'Другие']
    return gs.sort((a, b) => {
      const ia = a.items.some((r) => r.installed) ? 0 : 1
      const ib = b.items.some((r) => r.installed) ? 0 : 1
      return ia !== ib ? ia - ib : order.indexOf(a.g) - order.indexOf(b.g)
    })
  }, [shown])
  const selRow = rows.find((r) => r.fqbn === sel) ?? null

  return (
    <>
      <div className="wz-search">
        <Icon name="search" size={15} />
        <input ref={input} data-testid="wz-search" placeholder="Найти плату: uno, esp32, nodemcu…" value={q} onChange={(e) => setQ(e.target.value)} spellCheck={false} aria-label="Поиск платы" />
        {q && <button className="icon-btn" title="Очистить" onClick={() => setQ('')}><Icon name="x" size={13} /></button>}
      </div>
      <div className="wz-list" role="listbox" aria-label="Платы">
        {loading && (
          <div className="wz-skel" aria-busy="true" aria-label="Загружаю список плат и проверяю установленные ядра">
            {[62, 48, 70, 55, 66, 44, 58].map((w, i) => <div key={i} className="wz-skel-row"><i style={{ width: w + '%' }} /></div>)}
            <div className="wz-skel-note dim small"><Spinner /> Загружаю список плат и проверяю ядра…</div>
          </div>
        )}
        {!loading && groups.map(({ g, items }) => {
          const expanded = open.has(g) || !!q
          const list = expanded ? items : items.slice(0, GROUP_LIMIT)
          return (
            <div key={g} className="wz-group">
              <div className="wz-group-title">{g}</div>
              {list.map((r) => (
                <button key={r.fqbn} role="option" data-testid="wz-board" data-fqbn={r.fqbn} data-installed={r.installed} aria-selected={r.fqbn === sel} className={'wz-board' + (r.fqbn === sel ? ' on' : '') + (r.installed ? '' : ' muted')}
                  onClick={() => setSel(r.fqbn)} title={r.fqbn}>
                  <span className="grow">{r.name}</span>
                  {!r.installed && <span className="wz-tag">нужно установить ядро</span>}
                  {r.fqbn === sel && <Icon name="check" size={15} />}
                </button>
              ))}
              {!expanded && items.length > GROUP_LIMIT && (
                <button className="wz-more" onClick={() => setOpen(new Set([...open, g]))}>Показать все ({items.length})</button>
              )}
            </div>
          )
        })}
        {!loading && groups.length === 0 && <div className="wz-empty">Ничего не найдено. Попробуйте другое слово, например «esp32» или «uno».</div>}
      </div>
      <SourceHints q={q} />
      <CoreStrip sel={selRow} />
    </>
  )
}

function NameStep({ board, name, setName, touch, parent, base, pickFolder, error, checking, onEnter }: {
  board: string; name: string; setName: (v: string) => void; touch: () => void; parent: string; base: string
  pickFolder: () => void; error: string | null; checking: boolean; onEnter: () => void
}): ReactNode {
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { input.current?.focus(); input.current?.select() }, [])
  const shownName = name || '…'
  const sep = base.includes('\\') ? '\\' : '/'
  return (
    <div className="wz-name">
      <div className="form-row">
        <label className="form-label" htmlFor="wz-name">Имя проекта</label>
        <div className="form-field">
          <input id="wz-name" data-testid="wz-name" ref={input} className={'input' + (error ? ' invalid' : '')} value={name} spellCheck={false} autoComplete="off"
            aria-invalid={!!error} aria-describedby="wz-name-msg"
            onChange={(e) => { setName(e.target.value); touch() }} onKeyDown={(e) => { if (e.key === 'Enter') onEnter() }} />
        </div>
        <div id="wz-name-msg" data-testid="wz-name-msg" className={'form-hint' + (error ? ' err' : '')} role={error ? 'alert' : undefined}>
          {error ?? (checking ? 'Проверяю…' : 'Латинские буквы, цифры, «_» и «-». Это имя папки и главного файла.')}
        </div>
      </div>

      <div className="form-row">
        <div className="form-label">Где создать</div>
        <div className="loc-row">
          <code className="loc" title={parent || base}>{parent || base || '…'}</code>
          <button className="btn small" onClick={pickFolder}>Изменить…</button>
        </div>
      </div>

      <div className="wz-tree" aria-label="Что будет создано">
        <div className="wz-tree-title">Будет создано</div>
        <div className="wz-node"><Icon name="folder" size={15} /><span>{shownName}</span></div>
        <div className="wz-node l1"><Icon name="file" size={14} /><span>{shownName}.ino</span><span className="dim">пустой скетч с setup() и loop()</span></div>
        <div className="wz-node l1"><Icon name="file" size={14} /><span>sketch.yaml</span><span className="dim">плата: {board}</span></div>
        <div className="wz-path dim small" title={(parent || base) + sep + name}>{(parent || base) + sep + shownName}</div>
      </div>
    </div>
  )
}

function Wizard(): ReactNode {
  const close = (): void => useUi.getState().setWizard(false)
  const rows = useBoardRows()
  const curFqbn = useUi((s) => s.fqbn)
  const [step, setStep] = useState<1 | 2>(1)
  const [fqbn, setFqbnState] = useState(curFqbn || 'arduino:avr:uno')
  const [chosen, setChosen] = useState(false)
  const setFqbn = (f: string): void => { setChosen(true); setFqbnState(f) }
  // Пока пользователь не выбирал сам: если прошлая плата без ядра — предлагаем первую из установленных
  useEffect(() => {
    if (chosen) return
    const cur = rows.find((r) => r.fqbn === fqbn)
    if (cur?.installed) return
    const best = bestRow(rows)
    if (best) setFqbnState(best.fqbn)
  }, [rows, chosen, fqbn])
  const [name, setName] = useState('')
  const [touched, setTouched] = useState(false)
  const [parent, setParent] = useState('')
  const [base, setBase] = useState('')
  const [remote, setRemote] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  const boardTitle = rows.find((r) => r.fqbn === fqbn)?.name ?? fqbn

  // Папка по умолчанию и первое предложение имени
  const suggest = async (dir?: string): Promise<void> => {
    const nm = await window.api.project.suggestName(dir)
    if (alive.current && nm.ok) setName(nm.data)
  }
  useEffect(() => {
    void (async () => {
      const sb = await window.api.project.sketchbook()
      if (sb.ok && alive.current) setBase(sb.data)
      await suggest(undefined)
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const local = name ? validateSketchName(name) : step === 2 ? 'Введите имя проекта.' : null
  // Занятость папки проверяет main (после небольшой паузы при вводе)
  useEffect(() => {
    setRemote(null)
    if (step !== 2 || !name || validateSketchName(name)) { setChecking(false); return }
    setChecking(true)
    let ok = true
    const t = setTimeout(async () => {
      const r = await window.api.project.checkName(name, parent || undefined)
      if (!ok) return
      setChecking(false)
      setRemote(r.ok ? r.data : r.error)
    }, 200)
    return () => { ok = false; clearTimeout(t) }
  }, [name, parent, step])

  const nameError = local ?? remote
  const canCreate = !!name && !nameError && !checking && !busy

  const pickFolder = async (): Promise<void> => {
    const r = await window.api.project.pickFolder()
    if (!r.ok) { setErr(r.error); return }
    if (!r.data) return
    setParent(r.data)
    if (!touched) await suggest(r.data)
  }

  const create = async (): Promise<void> => {
    if (!canCreate) return
    setBusy(true); setErr(null)
    const e = await useProject.getState().createProject(name, parent || undefined, fqbn)
    // Оболочка при открытии проекта перерисовывается (мастер размонтируется) — закрываем независимо от этого
    if (!e) { close(); return }
    if (!alive.current) return
    setBusy(false)
    setErr(e)
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) close() }}
      onKeyDown={(e) => { if (e.key === 'Escape' && !busy) { e.stopPropagation(); close() } }}>
      <Dialog className="wizard" testid="wizard" title="Создать проект" ariaLabel="Создать проект" center={<Steps step={step} />} onClose={close} closeDisabled={busy}
        footerStart={<span className="dim small">{step === 1 ? '' : <>Плата: <b>{boardTitle}</b></>}</span>}
        footer={<>
          <button className="btn" data-testid="wz-back" onClick={step === 1 ? close : () => setStep(1)} disabled={busy}>{step === 1 ? 'Отмена' : 'Назад'}</button>
          {step === 1 ? (
            <button className="btn primary" data-testid="wz-next" onClick={() => setStep(2)} disabled={!fqbn}>Далее</button>
          ) : (
            <button className="btn primary" data-testid="wz-create" onClick={() => void create()} disabled={!canCreate}>{busy ? <Spinner /> : null} Создать</button>
          )}
        </>}>
        <div className="wz-body-in">
          {step === 1 ? (
            <BoardStep sel={fqbn} setSel={setFqbn} />
          ) : (
            <NameStep board={boardTitle} name={name} setName={setName} touch={() => { setTouched(true); setErr(null) }} parent={parent} base={base}
              pickFolder={() => void pickFolder()} error={nameError} checking={checking} onEnter={() => void create()} />
          )}
          {err && <div className="field-error">{err}</div>}
        </div>
      </Dialog>
    </div>
  )
}

export default function NewProjectWizard(): ReactNode {
  const open = useUi((s) => s.wizard)
  return open ? <Wizard /> : null
}
