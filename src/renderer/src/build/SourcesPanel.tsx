// Раздел «Источники» во вкладке «Платы»: проверенные адреса пакетов плат, свой адрес, подключение и отключение.
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Ide2Import, SourceView, UrlCheck } from '../../../main/boardsources/types'
import { Icon } from '../shell/icons'
import { EmptyState, Spinner, Button, Chip } from '../shell/kit'
import { connectSource, disconnectSource, useSources } from './sourcesStore'
import { useBuild } from './useBuild'

export function ProtoBadge({ https }: { https: boolean }): ReactNode {
  // https — норма и не требует внимания; помечаем только незашифрованные адреса
  return https ? null : <Chip tone="warn" title="Адрес по http: без шифрования"><Icon name="warn" size={10} /> http</Chip>
}

function matches(s: SourceView, tokens: string[]): boolean {
  if (!tokens.length) return true
  const hay = `${s.name} ${s.maintainer} ${s.description} ${s.url} ${s.cores.map((c) => c.id + ' ' + c.name).join(' ')}`.toLowerCase()
  return tokens.every((t) => hay.includes(t))
}

function SourceCard({ s, busy, onConnect, onDisconnect }: { s: SourceView; busy: boolean; onConnect: () => void; onDisconnect: () => void }): ReactNode {
  const [open, setOpen] = useState(false)
  return (
    <div className={'src-row' + (open ? ' open' : '')}>
      <div className="src-row-line">
        <button className="src-row-main" aria-expanded={open} onClick={() => setOpen(!open)} title={open ? 'Свернуть' : 'Подробнее: платы, адрес, кто поддерживает'}>
          <span className="src-name">{s.name}{!s.https && <> <ProtoBadge https={false} /></>}</span>
          <span className="src-desc">{s.description}</span>
        </button>
        <div className="src-row-act">
          {s.connected
            ? <span className="src-state" title="Подключён" aria-label="Подключён"><Icon name="check" size={15} /></span>
            : <button className="icon-btn src-add-btn" disabled={busy} onClick={onConnect} title={`Подключить «${s.name}»`} aria-label={`Подключить ${s.name}`}><Icon name="plus" size={16} /></button>}
        </div>
      </div>
      {open && (
        <div className="src-more">
          <div className="src-meta">
            {s.maintainer && <span title="Кто поддерживает источник">{s.maintainer}</span>}
            {s.platformsCount > 0 && <span>платформ: {s.platformsCount}</span>}
            {s.verifiedAt && <span title="Когда адрес последний раз проверен: скачан и разобран индекс">проверен {s.verifiedAt}</span>}
            {s.kind === 'custom' && <span>свой адрес</span>}
          </div>
          {s.cores.length > 0 && (
            <div className="src-cores">
              {s.cores.map((c) => <div key={c.id} className="src-core"><b>{c.name}</b><span className="dim"> · {c.id}{c.latest ? ` · ${c.latest}` : ''}</span></div>)}
            </div>
          )}
          <div className="src-url dim small" title={s.url}>{s.url}</div>
          {s.connected && <button className="link-btn src-off" disabled={busy} onClick={onDisconnect}>Отключить источник</button>}
        </div>
      )}
    </div>
  )
}

function CheckResult({ c, busy, onConnect, onClose }: { c: UrlCheck; busy: boolean; onConnect: () => void; onClose: () => void }): ReactNode {
  const list = c.summary.platforms
  const shown = list.slice(0, 8)
  return (
    <div className="src-check">
      <div className="src-check-title"><Icon name="check" size={14} /> Найдено платформ: {list.length}</div>
      <ul className="src-check-list">
        {shown.map((p) => <li key={p.id}><b>{p.name}</b> <span className="dim">{p.id} · {p.latest}{p.boards.length ? ` · плат: ${p.boards.length}` : ''}</span></li>)}
        {list.length > shown.length && <li className="dim">…и ещё {list.length - shown.length}</li>}
      </ul>
      <div className="src-meta">
        {c.summary.maintainers.length > 0 && <span>{c.summary.maintainers.join(', ')}</span>}
        <span>индекс {(c.size / 1024).toFixed(c.size > 102400 ? 0 : 1)} КБ</span>
        <ProtoBadge https={c.https} />
      </div>
      {!c.https && <div className="src-warn"><Icon name="warn" size={13} /> Адрес без шифрования (http): файлы могут быть подменены по дороге.</div>}
      {c.alreadyConnected
        ? <div className="dim small">Этот адрес уже подключён.</div>
        : <div className="src-warn soft"><Icon name="info" size={13} /> Ядра из сторонних источников ставят код на ваш компьютер. Подключайте только то, чему доверяете.</div>}
      <div className="src-actions">
        {!c.alreadyConnected && <Button variant="primary" size="sm" disabled={busy} onClick={onConnect}>Подключить…</Button>}
        <Button size="sm" onClick={onClose}>Закрыть</Button>
      </div>
    </div>
  )
}


type Ide2State = { s: 'idle' } | { s: 'busy' } | { s: 'ok'; c: UrlCheck } | { s: 'err'; e: string }

/** Импорт адресов из настроек Arduino IDE 2: список → проверка каждого адреса → подключение только по кнопке и подтверждению. */
function Ide2Block(): ReactNode {
  const busy = useBuild((s) => s.busy)
  const refresh = useSources((s) => s.refresh)
  const [data, setData] = useState<Ide2Import | null>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [st, setSt] = useState<Record<string, Ide2State>>({})

  const load = async (): Promise<void> => {
    setLoading(true); setErr(''); setSt({})
    const r = await window.api.boardsources.ide2Urls()
    setLoading(false)
    if (r.ok) setData(r.data)
    else setErr(r.error)
  }
  const check = async (url: string): Promise<void> => {
    setSt((x) => ({ ...x, [url]: { s: 'busy' } }))
    const r = await window.api.boardsources.check(url)
    setSt((x) => ({ ...x, [url]: r.ok ? { s: 'ok', c: r.data } : { s: 'err', e: r.error } }))
  }
  const checkAll = async (): Promise<void> => {
    for (const u of data?.urls ?? []) if (u.valid && !u.alreadyConnected && st[u.url]?.s !== 'ok') await check(u.url)
  }
  const connect = async (url: string, c: UrlCheck): Promise<void> => {
    const ok = await connectSource({ name: c.summary.maintainers[0] ?? new URL(c.url).hostname, url: c.url, https: c.https })
    if (ok) { await refresh(); await load() }
  }

  if (!data) {
    return (
      <div className="src-custom">
        <Button size="sm" disabled={loading} onClick={() => void load()} title="Читает настройки Arduino IDE 2 (только чтение): ничего не подключается, пока вы сами не нажмёте «Подключить»">
          {loading ? <Spinner /> : <Icon name="download" size={13} />} Импортировать из Arduino IDE 2
        </Button>
        {err && <div className="field-error" role="alert">{err}</div>}
      </div>
    )
  }
  return (
    <div className="src-custom">
      <div className="src-check">
        <div className="src-check-title ide2-title"><Icon name="download" size={14} /> Адреса из Arduino IDE 2</div>
        {!data.found && <div className="dim small">Файл настроек Arduino IDE 2 не найден: <span className="path-wrap">{data.path}</span>. Возможно, программа не установлена или вы ещё не добавляли свои адреса.</div>}
        {data.found && data.urls.length === 0 && <div className="dim small">В настройках Arduino IDE 2 нет дополнительных адресов.</div>}
        {data.urls.map((u) => {
          const x = st[u.url] ?? { s: 'idle' }
          return (
            <div key={u.url} className="ide2-item">
              <div className="ide2-url" title={u.url}>{u.catalogName ? <b>{u.catalogName}</b> : null}<span className="dim small path-wrap">{u.url}</span></div>
              {!u.valid && <div className="field-error">{u.error}</div>}
              {u.alreadyConnected && <div className="src-state"><Icon name="check" size={12} /> уже подключён</div>}
              {x.s === 'err' && <div className="field-error">{x.e}</div>}
              {x.s === 'ok' && <div className="dim small">Платформ: {x.c.summary.platforms.length}{x.c.summary.maintainers.length ? ' · ' + x.c.summary.maintainers.join(', ') : ''} · <ProtoBadge https={x.c.https} /></div>}
              {u.valid && !u.alreadyConnected && (
                <div className="src-actions">
                  {x.s === 'ok'
                    ? <Button variant="primary" size="sm" disabled={busy} onClick={() => void connect(u.url, x.c)}>Подключить…</Button>
                    : <Button size="sm" disabled={x.s === 'busy'} onClick={() => void check(u.url)}>{x.s === 'busy' ? <Spinner /> : null} Проверить</Button>}
                </div>
              )}
            </div>
          )
        })}
        <div className="src-actions">
          {data.urls.some((u) => u.valid && !u.alreadyConnected) && <Button size="sm" onClick={() => void checkAll()}>Проверить все</Button>}
          <Button size="sm" onClick={() => setData(null)}>Закрыть</Button>
        </div>
        <div className="dim small src-hint">Адрес проверяется (скачивается индекс), подключается только после вашего подтверждения.</div>
      </div>
    </div>
  )
}

export default function SourcesPanel({ q }: { q: string }): ReactNode {
  const state = useSources((s) => s.state)
  const loading = useSources((s) => s.loading)
  const error = useSources((s) => s.error)
  const refresh = useSources((s) => s.refresh)
  const busy = useBuild((s) => s.busy)
  const [url, setUrl] = useState('')
  const [checking, setChecking] = useState(false)
  const [checkErr, setCheckErr] = useState('')
  const [check, setCheck] = useState<UrlCheck | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  useEffect(() => { void refresh() }, [refresh])

  const tokens = useMemo(() => q.toLowerCase().split(/\s+/).filter(Boolean), [q])
  const all = state?.sources ?? []
  const shown = all.filter((s) => matches(s, tokens))
  const connected = shown.filter((s) => s.connected)
  const available = shown.filter((s) => !s.connected)

  const doCheck = async (): Promise<void> => {
    setCheckErr(''); setCheck(null)
    if (!url.trim()) { setCheckErr('Вставьте адрес файла индекса, например …/package_имя_index.json.'); return }
    setChecking(true)
    const r = await window.api.boardsources.check(url.trim())
    setChecking(false)
    if (r.ok) setCheck(r.data)
    else setCheckErr(r.error)
  }

  const connectChecked = async (): Promise<void> => {
    if (!check) return
    const name = check.summary.maintainers[0] ?? new URL(check.url).hostname
    const ok = await connectSource({ name, url: check.url, https: check.https })
    if (ok) { setCheck(null); setUrl('') }
  }

  return (
    <div className="mgr-list src-list">
      {loading && !state && <div className="side-pad"><Spinner /> Читаю настройки arduino-cli…</div>}
      {error && <div className="field-error pad">{error}</div>}

      {connected.length > 0 && <div className="mgr-sub">Подключены · {connected.length}</div>}
      {connected.map((s) => (
        <SourceCard key={s.id} s={s} busy={busy} onConnect={() => void connectSource({ name: s.name, url: s.url, https: s.https })}
          onDisconnect={() => void disconnectSource({ name: s.name, url: s.url })} />
      ))}
      {available.length > 0 && <div className="mgr-sub">Каталог · {available.length}</div>}
      {available.map((s) => (
        <SourceCard key={s.id} s={s} busy={busy} onConnect={() => void connectSource({ name: s.name, url: s.url, https: s.https })}
          onDisconnect={() => void disconnectSource({ name: s.name, url: s.url })} />
      ))}
      {state && shown.length === 0 && (
        <EmptyState icon="plug" title="Нет подходящих источников" hint="Попробуйте другое слово: производитель, чип или плата. Своего адреса в каталоге нет — добавьте его ниже." />
      )}

      <details className="src-add" open={addOpen} onToggle={(e) => setAddOpen((e.currentTarget as HTMLDetailsElement).open)}>
        <summary>Свой адрес или импорт из Arduino IDE 2</summary>
        <div className="src-custom">
          <div className="src-custom-row">
            <input className={'input' + (checkErr ? ' invalid' : '')} value={url} spellCheck={false} autoComplete="off" aria-label="Свой адрес источника"
              placeholder="https://…/package_имя_index.json" aria-invalid={!!checkErr}
              onChange={(e) => { setUrl(e.target.value); setCheckErr(''); setCheck(null) }} onKeyDown={(e) => { if (e.key === 'Enter') void doCheck() }} />
            <Button size="sm" disabled={checking || !url.trim()} onClick={() => void doCheck()}>{checking ? <Spinner /> : null} Проверить</Button>
          </div>
          {checkErr && <div className="field-error" role="alert">{checkErr}</div>}
          {!check && !checkErr && !checking && <div className="dim small src-hint">Адрес сначала проверяется: скачивается список и показывается, что в нём есть. Подключается только по вашей кнопке.</div>}
          {check && <CheckResult c={check} busy={busy} onConnect={() => void connectChecked()} onClose={() => setCheck(null)} />}
        </div>
        <Ide2Block />
        {state?.configPath && <div className="src-conf dim small" title="Файл настроек arduino-cli, куда записываются адреса">Адреса хранятся в настройках arduino-cli: {state.configPath}</div>}
      </details>
    </div>
  )
}
