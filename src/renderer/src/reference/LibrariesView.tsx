import { useEffect, useMemo, useRef, useState } from 'react'
import type { LibExample, LibSymbol, ProjectLibrary } from '../contracts'
import { kindLabel, locationOf, lookupRef, searchRefs, shortSignature, type LibIndex, type LibRef } from '../libs/model'

interface Props {
  libs: ProjectLibrary[]
  index: LibIndex
  query: string
  loading: boolean
  error?: string
  /** Выбрать библиотеку/символ (например, по F1): nonce меняется при каждом запросе. */
  focus?: { word: string; nonce: number } | null
}

const symKey = (r: LibRef): string => `${r.lib.path}|${r.sym.header}:${r.sym.line}:${r.sym.kind}:${r.sym.name}:${r.sym.signature}`

function ownerKey(s: LibSymbol): string {
  return s.owner ? `${s.owner}::${s.name}` : s.name
}

function revealPath(p: string): void {
  try {
    const api = (window as unknown as { api?: { fs?: { reveal?: (p: string) => Promise<unknown> } } }).api
    void api?.fs?.reveal?.(p)
  } catch {
    /* вне Electron */
  }
}

export default function LibrariesView({ libs, index, query, loading, error, focus }: Props) {
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

  if (libs.length === 0) {
    return (
      <div className="ref-body">
        <div className="ref-empty lib-empty">
          {loading ? 'Загрузка библиотек…' : error ? `Не удалось получить библиотеки: ${error}` : (
            <>
              <b>В скетче нет подключённых библиотек.</b>
              <p>Добавьте <code>#include &lt;Библиотека.h&gt;</code> в скетч — здесь появятся классы, функции и константы установленных библиотек. Системные заголовки (Arduino.h, stdint.h) и «локальные» файлы скетча не учитываются.</p>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="ref-body">
      <div className="ref-list lib-list">
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
                {q && n ? <span className="ref-badge lib-match">найдено {n}</span> : null}
                {l.warnings?.length ? <span className="ref-badge lib-warn" title={l.warnings.join('\n')}>замечания</span> : null}
              </div>
            </div>
          )
        })}
        {loading && <div className="ref-empty">Обновление…</div>}
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

function SymRow({ r, highlight, showLib, onPick }: { r: LibRef; highlight: string | null; showLib?: boolean; onPick?: (r: LibRef) => void }) {
  const s = r.sym
  const key = symKey(r)
  return (
    <div className={'lib-sym' + (highlight === key ? ' hl' : '')} data-key={key} onClick={onPick ? () => onPick(r) : undefined}>
      <div className="lib-sym-head">
        <code className="lib-sig">{shortSignature(s)}</code>
        <span className="lib-kind">{kindLabel(s.kind)}</span>
        {s.access === 'protected' && <span className="lib-kind prot">protected</span>}
        {showLib && <span className="ref-badge lib-name">{r.lib.name}</span>}
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
        <span>Подключено: {lib.matchedIncludes.map((i) => <code key={i}>#include &lt;{i}&gt;</code>)}</span>
        <span className="lib-path" title={lib.path}>{lib.path}</span>
      </div>
      {lib.warnings && lib.warnings.length > 0 && (
        <div className="ref-warn"><b>Замечания разбора</b><ul>{lib.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></div>
      )}

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

      <h3 className="lib-h">Примеры ({lib.examples.length})</h3>
      {lib.examples.length === 0 && <div className="ref-empty">У библиотеки нет примеров</div>}
      {lib.examples.map((ex: LibExample) => (
        <div key={ex.path} className="lib-example">
          <span className="lib-ex-name">{ex.name}</span>
          <span className="lib-path" title={ex.path}>{ex.path}</span>
          <button className="lib-btn" type="button" onClick={() => revealPath(ex.path)} title="Показать файл в проводнике системы">Показать</button>
        </div>
      ))}

      <h3 className="lib-h">Разобранные заголовки ({lib.headers.length})</h3>
      <div className="lib-headers">{lib.headers.map((h) => <code key={h}>{h}</code>)}</div>
    </div>
  )
}

const ORDER: Record<string, number> = { constructor: 0, method: 1, variable: 2, constant: 3, enum: 4, enumValue: 5, typedef: 6, class: 7, struct: 7 }
function sortMembers(list: LibRef[]): LibRef[] {
  return [...list].sort((a, b) => (ORDER[a.sym.kind] ?? 9) - (ORDER[b.sym.kind] ?? 9) || a.sym.line - b.sym.line)
}
