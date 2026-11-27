import { useEffect, useMemo, useRef, useState } from 'react'
import type { LibExample, LibSymbol, ProjectLibrary } from '../contracts'
import { kindLabel, locationOf, lookupRef, searchRefs, shortSignature, type LibIndex, type LibRef } from '../libs/model'
import { Chip, Skeleton } from '../shell/kit'
import { showExample } from '../shell/ExampleView'
import { useUi } from '../shell/ui'
import { libsQueryOptions } from '../libs/store'

interface Props {
  libs: ProjectLibrary[]
  index: LibIndex
  query: string
  loading: boolean
  error?: string
  /** Выбрать библиотеку/символ (например, по F1): nonce меняется при каждом запросе. */
  focus?: { word: string; nonce: number } | null
  narrow?: boolean
}

const symKey = (r: LibRef): string => `${r.lib.path}|${r.sym.header}:${r.sym.line}:${r.sym.kind}:${r.sym.name}:${r.sym.signature}`

function ownerKey(s: LibSymbol): string {
  return s.owner ? `${s.owner}::${s.name}` : s.name
}

function revealPath(p: string): void {
  void window.api?.app?.revealPath(p).then((ok) => { if (!ok) useUi.getState().notify('Файл примера не найден на диске.', { kind: 'error' }) })
}

/** Открывает пример библиотеки во вкладке предпросмотра (оттуда — «Открыть как проект»). */
async function openLibExample(lib: ProjectLibrary, ex: LibExample): Promise<void> {
  const r = await window.api.examples.idForPath(ex.path)
  if (r.ok && r.data) { showExample(r.data, lib.name, ex.name); return }
  useUi.getState().notify(r.ok ? 'Этот пример лежит вне папок библиотек Arduino — откройте его через «В папке».' : r.error, { kind: 'error' })
}

interface InstalledLib { name: string; version?: string; sentence?: string; path: string; location: 'user' | 'platform' }
const describeCache = new Map<string, ProjectLibrary | null>()

/** Справочник по любой установленной библиотеке: список и описание выбранной (с кэшем). */
function useInstalled(active: boolean, path: string | null): { list: InstalledLib[] | null; detail: ProjectLibrary | null | undefined; error?: string } {
  const [list, setList] = useState<InstalledLib[] | null>(null)
  const [detail, setDetail] = useState<ProjectLibrary | null | undefined>(undefined)
  const [error, setError] = useState<string | undefined>()
  const opts = libsQueryOptions()
  useEffect(() => {
    if (!active) return
    let live = true
    void window.api.libs.installed(opts).then((r) => {
      if (!live) return
      if (r.ok) { setList(r.data); setError(undefined) } else setError(r.error)
    })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, opts.fqbn])
  useEffect(() => {
    if (!active || !path) { setDetail(undefined); return }
    const key = path + '|' + (opts.fqbn ?? '')
    if (describeCache.has(key)) { setDetail(describeCache.get(key)); return }
    setDetail(undefined)
    let live = true
    void window.api.libs.describe(path, opts).then((r) => {
      if (!live) return
      if (r.ok) { describeCache.set(key, r.data); setDetail(r.data) } else { setDetail(null); setError(r.error) }
    })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, path, opts.fqbn])
  return { list, detail, error }
}

export default function LibrariesView({ libs, index, query, loading, error, focus, narrow }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [highlight, setHighlight] = useState<string | null>(null)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const bodyRef = useRef<HTMLDivElement>(null)

  const lib = libs.find((l) => l.path === selected) ?? libs[0]
  const q = query.trim()

  // переход по F1: выбрать библиотеку символа и подсветить его
  useEffect(() => {
    if (!focus?.word) return
    const r = lookupRef(index, focus.word)
    if (!r) return
    setSelected(r.lib.path)
    setHighlight(symKey(r))
    if (r.sym.owner) setOpen((o) => new Set(o).add(`${r.lib.path}|${r.sym.owner}`))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce])

  useEffect(() => {
    if (!highlight) return
    const el = bodyRef.current?.querySelector(`[data-key="${CSS.escape(highlight)}"]`)
    el?.scrollIntoView({ block: 'center' })
  }, [highlight, selected, q, open])

  const matches = useMemo(() => (q ? searchRefs(index, q, 300) : []), [index, q])
  const countByLib = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of matches) m.set(r.lib.path, (m.get(r.lib.path) ?? 0) + 1)
    return m
  }, [matches])

  const [mode, setMode] = useState<'sketch' | 'all'>(libs.length ? 'sketch' : 'all')
  const [pick, setPick] = useState<string | null>(null)
  const inst = useInstalled(mode === 'all', pick)
  // F1 по символу ищет в библиотеках скетча
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (focus?.word) setMode('sketch') }, [focus?.nonce])

  const seg = (
    <div className="seg lib-mode">
      <button type="button" className={mode === 'sketch' ? 'on' : ''} onClick={() => setMode('sketch')} data-testid="lib-mode-sketch">В скетче{libs.length ? ` (${libs.length})` : ''}</button>
      <button type="button" className={mode === 'all' ? 'on' : ''} onClick={() => setMode('all')} data-testid="lib-mode-all">Все установленные</button>
    </div>
  )

  if (mode === 'all') {
    const ql = q.toLowerCase()
    const shown = (inst.list ?? []).filter((l) => !ql || l.name.toLowerCase().includes(ql) || (l.sentence ?? '').toLowerCase().includes(ql))
    const cur = pick && shown.some((l) => l.path === pick) ? pick : shown[0]?.path ?? null
    const detail = cur === pick ? inst.detail : undefined
    return (
      <div className={'ref-body ref-libs' + (narrow ? ' narrow' : '')}>
        <div className="ref-list lib-list">
          {seg}
          {!inst.list && !inst.error && <Skeleton rows={6} label="Читаю установленные библиотеки…" />}
          {inst.error && !inst.list && <div className="ref-empty">Не удалось получить список: {inst.error}</div>}
          {inst.list && shown.length === 0 && <div className="ref-empty">{q ? `Нет библиотек по запросу «${q}»` : 'Библиотеки не установлены'}</div>}
          {shown.map((l) => (
            <div key={l.path} className={'ref-card' + (l.path === cur ? ' selected' : '')} onClick={() => setPick(l.path)} data-testid="lib-installed">
              <div className="ref-card-name">{l.name}{l.version && <span className="lib-ver"> {l.version}</span>}</div>
              {l.sentence && <div className="ref-card-desc">{l.sentence}</div>}
              {l.location === 'platform' && <div className="ref-card-meta"><span className="ref-cat">из ядра платы</span></div>}
            </div>
          ))}
        </div>
        <div className="ref-detail" ref={bodyRef}>
          <InstalledDetail cur={cur} pick={pick} setPick={setPick} detail={detail} open={open} setOpen={setOpen} />
        </div>
      </div>
    )
  }

  if (libs.length === 0) {
    return (
      <div className={'ref-body ref-libs' + (narrow ? ' narrow' : '')}>
        <div className="ref-list lib-list">{seg}</div>
        <div className="ref-detail">
          <div className="ref-empty-state lib-empty">
            {loading ? 'Загрузка библиотек…' : error ? `Не удалось получить библиотеки: ${error}` : (
              <>
                <b>В скетче нет подключённых библиотек.</b>
                <p>Добавьте <code>#include &lt;Библиотека.h&gt;</code> в скетч или откройте любую библиотеку во вкладке «Все установленные».</p>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={'ref-body ref-libs' + (narrow ? ' narrow' : '')}>
      <div className="ref-list lib-list">
        {seg}
        {libs.map((l) => {
          const n = countByLib.get(l.path)
          return (
            <div key={l.path} className={'ref-card' + (lib && l.path === lib.path ? ' selected' : '') + (q && !n ? ' dim' : '')} onClick={() => setSelected(l.path)}>
              <div className="ref-card-name">
                {l.name}
                {l.version && <span className="lib-ver"> {l.version}</span>}
              </div>
              {l.sentence && <div className="ref-card-desc">{l.sentence}</div>}
              <div className="ref-card-meta">
                <span className="ref-cat">{l.symbols.length} символов</span>
                {q && n ? <Chip className="ref-badge lib-match">найдено {n}</Chip> : null}
                {l.warnings?.length ? <Chip className="ref-badge lib-warn" title={l.warnings.join('\n')}>замечания</Chip> : null}
              </div>
            </div>
          )
        })}
        {loading && <Skeleton rows={5} label="Обновляю список библиотек…" />}
      </div>
      <div className="ref-detail" ref={bodyRef}>
        {q ? (
          <Results refs={matches} q={q} highlight={highlight} onPick={(r) => { setSelected(r.lib.path) }} showLib />
        ) : lib ? (
          <LibDetail lib={lib} open={open} setOpen={setOpen} highlight={highlight} />
        ) : null}
      </div>
    </div>
  )
}

function InstalledDetail({ cur, pick, setPick, detail, open, setOpen }: { cur: string | null; pick: string | null; setPick: (p: string) => void; detail: ProjectLibrary | null | undefined; open: Set<string>; setOpen: (f: (o: Set<string>) => Set<string>) => void }) {
  useEffect(() => { if (cur && cur !== pick) setPick(cur) }, [cur, pick, setPick])
  if (!cur) return null
  if (detail === null) return <div className="ref-empty">Не удалось разобрать заголовки библиотеки.</div>
  if (!detail) return <Skeleton rows={6} label="Разбираю заголовки…" />
  return <LibDetail lib={detail} open={open} setOpen={setOpen} highlight={null} />
}

function SymRow({ r, highlight, showLib, onPick }: { r: LibRef; highlight: string | null; showLib?: boolean; onPick?: (r: LibRef) => void }) {
  const s = r.sym
  const key = symKey(r)
  return (
    <div className={'lib-sym' + (highlight === key ? ' hl' : '')} data-key={key} onClick={onPick ? () => onPick(r) : undefined}>
      <div className="lib-sym-head">
        <code className="lib-sig">{shortSignature(s)}</code>
        <span className="lib-kind">{kindLabel(s.kind)}</span>
        {s.access === 'protected' && <span className="lib-kind prot">protected</span>}
        {showLib && <Chip className="ref-badge lib-name">{r.lib.name}</Chip>}
      </div>
      {s.doc && <div className="lib-doc">{s.doc}</div>}
      <div className="lib-loc">{locationOf(r)}</div>
    </div>
  )
}

function Results({ refs, q, highlight, onPick, showLib }: { refs: LibRef[]; q: string; highlight: string | null; onPick: (r: LibRef) => void; showLib?: boolean }) {
  if (refs.length === 0) return <div className="ref-empty">В библиотеках проекта нет «{q}»</div>
  return (
    <div>
      <h3 className="lib-h">Найдено в библиотеках проекта: {refs.length}{refs.length >= 300 ? '+' : ''}</h3>
      {refs.map((r) => (
        <SymRow key={symKey(r)} r={r} highlight={highlight} showLib={showLib} onPick={onPick} />
      ))}
    </div>
  )
}

function LibDetail({ lib, open, setOpen, highlight }: { lib: ProjectLibrary; open: Set<string>; setOpen: (f: (o: Set<string>) => Set<string>) => void; highlight: string | null }) {
  const refs = useMemo(() => lib.symbols.filter((s) => s.access !== 'private').map((sym): LibRef => ({ lib, sym })), [lib])
  const groups = useMemo(() => {
    const classes = refs.filter((r) => r.sym.kind === 'class' || r.sym.kind === 'struct')
    const funcs = refs.filter((r) => r.sym.kind === 'function')
    const consts = refs.filter((r) => !r.sym.owner && (r.sym.kind === 'macro' || r.sym.kind === 'constant'))
    const enums = refs.filter((r) => r.sym.kind === 'enum')
    const types = refs.filter((r) => r.sym.kind === 'typedef' && !r.sym.owner)
    const vars = refs.filter((r) => r.sym.kind === 'variable' && !r.sym.owner)
    return { classes, funcs, consts, enums, types, vars }
  }, [refs])
  const toggle = (k: string): void =>
    setOpen((o) => {
      const n = new Set(o)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })

  return (
    <div>
      <h2 className="ref-title">{lib.name}{lib.version && <span className="lib-ver"> {lib.version}</span>}</h2>
      {lib.sentence && <p className="lib-sentence">{lib.sentence}</p>}
      <div className="lib-meta">
        {lib.author && <span>Автор: {lib.author}</span>}
        {lib.matchedIncludes.length > 0 && <span>Подключение: {lib.matchedIncludes.map((i) => <code key={i}>#include &lt;{i}&gt;</code>)}</span>}
        <span className="lib-path" title={lib.path}>{lib.path}</span>
      </div>
      {lib.warnings && lib.warnings.length > 0 && (
        <div className="ref-warn"><b>Замечания разбора</b><ul>{lib.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></div>
      )}

      {lib.examples.length > 0 && <>
      <h3 className="lib-h">Примеры ({lib.examples.length})</h3>
      {lib.examples.map((ex: LibExample) => (
        <div key={ex.path} className="lib-example" title={ex.path} data-testid="lib-example">
          <button className="lib-ex-name link-btn" type="button" onClick={() => void openLibExample(lib, ex)}>{ex.name}</button>
          <span className="lib-ex-sp" />
          <button className="lib-btn" type="button" onClick={() => void openLibExample(lib, ex)} data-testid="lib-example-open">Открыть</button>
          <button className="lib-btn" type="button" onClick={() => revealPath(ex.path)} title="Показать файл в проводнике">В папке</button>
        </div>
      ))}

      </>}

      {groups.classes.length > 0 && <h3 className="lib-h">Классы и структуры ({groups.classes.length})</h3>}
      {groups.classes.map((c) => {
        const k = `${lib.path}|${ownerKey(c.sym)}`
        const own = refs.filter((m) => m.sym.owner === ownerKey(c.sym))
        const members = open.has(k) ? own : []
        const count = own.length
        return (
          <div key={symKey(c)} className="lib-class">
            <div className="lib-class-head" onClick={() => toggle(k)}>
              <span className="lib-caret">{open.has(k) ? '▾' : '▸'}</span>
              <SymRow r={c} highlight={highlight} />
              <span className="lib-count">{count}</span>
            </div>
            {open.has(k) && (
              <div className="lib-members">
                {sortMembers(members).map((m) => <SymRow key={symKey(m)} r={m} highlight={highlight} />)}
                {members.length === 0 && <div className="ref-empty">Публичных членов нет</div>}
              </div>
            )}
          </div>
        )
      })}

      {groups.funcs.length > 0 && <h3 className="lib-h">Функции ({groups.funcs.length})</h3>}
      {groups.funcs.map((r) => <SymRow key={symKey(r)} r={r} highlight={highlight} />)}

      {groups.enums.length > 0 && <h3 className="lib-h">Перечисления ({groups.enums.length})</h3>}
      {groups.enums.map((e) => {
        const vals = refs.filter((r) => r.sym.kind === 'enumValue' && (r.sym.owner === e.sym.name || r.sym.returns === e.sym.name))
        return (
          <div key={symKey(e)} className="lib-class">
            <SymRow r={e} highlight={highlight} />
            {vals.length > 0 && <div className="lib-enum-values">{vals.map((v) => <code key={symKey(v)} className={'lib-val' + (highlight === symKey(v) ? ' hl' : '')} data-key={symKey(v)} title={v.sym.doc ?? ''}>{v.sym.signature}</code>)}</div>}
          </div>
        )
      })}

      {groups.consts.length > 0 && <h3 className="lib-h">Константы и макросы ({groups.consts.length})</h3>}
      {groups.consts.map((r) => <SymRow key={symKey(r)} r={r} highlight={highlight} />)}

      {groups.types.length > 0 && <h3 className="lib-h">Типы ({groups.types.length})</h3>}
      {groups.types.map((r) => <SymRow key={symKey(r)} r={r} highlight={highlight} />)}

      {groups.vars.length > 0 && <h3 className="lib-h">Глобальные объекты и переменные ({groups.vars.length})</h3>}
      {groups.vars.map((r) => <SymRow key={symKey(r)} r={r} highlight={highlight} />)}

      <h3 className="lib-h">Разобранные заголовки ({lib.headers.length})</h3>
      <div className="lib-headers">{lib.headers.map((h) => <code key={h}>{h}</code>)}</div>
    </div>
  )
}

const ORDER: Record<string, number> = { constructor: 0, method: 1, variable: 2, constant: 3, enum: 4, enumValue: 5, typedef: 6, class: 7, struct: 7 }
function sortMembers(list: LibRef[]): LibRef[] {
  return [...list].sort((a, b) => (ORDER[a.sym.kind] ?? 9) - (ORDER[b.sym.kind] ?? 9) || a.sym.line - b.sym.line)
}
