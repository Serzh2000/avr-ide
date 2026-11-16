// Раздел «Источники» во вкладке «Платы»: проверенные адреса пакетов плат, свой адрес, подключение и отключение.
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { SourceView, UrlCheck } from '../../../main/boardsources/types'
import { Icon } from '../shell/icons'
import { EmptyState, Spinner } from '../shell/kit'
import { connectSource, disconnectSource, useSources } from './sourcesStore'
import { useBuild } from './useBuild'

export function ProtoBadge({ https }: { https: boolean }): ReactNode {
  return https
    ? <span className="src-badge ok" title="Адрес по https: соединение зашифровано"><Icon name="check" size={10} /> https</span>
    : <span className="src-badge warn" title="Адрес по http: без шифрования"><Icon name="warn" size={10} /> http</span>
}

function matches(s: SourceView, tokens: string[]): boolean {
  if (!tokens.length) return true
  const hay = `${s.name} ${s.maintainer} ${s.description} ${s.url} ${s.cores.map((c) => c.id + ' ' + c.name).join(' ')}`.toLowerCase()
  return tokens.every((t) => hay.includes(t))
}

function SourceCard({ s, busy, onConnect, onDisconnect }: { s: SourceView; busy: boolean; onConnect: () => void; onDisconnect: () => void }): ReactNode {
  const [open, setOpen] = useState(false)
  return (
    <div className={'src-card' + (s.connected ? ' on' : '')}>
      <div className="src-head">
        <div className="src-title">
          <span className="src-name">{s.name}</span>
          <ProtoBadge https={s.https} />
        </div>
        {s.connected && <span className="src-state"><Icon name="check" size={12} /> подключён</span>}
      </div>
      <div className="src-desc">{s.description}</div>
      <div className="src-meta">
        {s.platformsCount > 0 && <span>платформ: {s.platformsCount}</span>}
        {s.maintainer && <span title="Кто поддерживает источник">{s.maintainer}</span>}
        {s.verifiedAt && <span title="Когда адрес последний раз проверен: скачан и разобран индекс">проверен {s.verifiedAt}</span>}
        {s.kind === 'custom' && <span>свой адрес</span>}
      </div>
      <div className="src-actions">
        {s.connected
          ? <button className="btn small" disabled={busy} onClick={onDisconnect}>Отключить</button>
          : <button className="btn small primary" disabled={busy} onClick={onConnect}>Подключить</button>}
        {s.cores.length > 0 && (
          <button className="link-btn" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Скрыть ядра' : 'Какие ядра'}</button>
        )}
      </div>
      {open && (
        <div className="src-cores">
          {s.cores.map((c) => <div key={c.id} className="src-core"><b>{c.name}</b><span className="dim"> · {c.id}{c.latest ? ` · ${c.latest}` : ''}</span></div>)}
          <div className="src-url dim small" title={s.url}>{s.url}</div>
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
        {!c.alreadyConnected && <button className="btn small primary" disabled={busy} onClick={onConnect}>Подключить…</button>}
        <button className="btn small" onClick={onClose}>Закрыть</button>
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
    <div className="mgr-list">
      <div className="src-intro">
        Источник — это адрес списка плат стороннего производителя. Подключите нужный, и ядра из него появятся в поиске.
      </div>

      <div className="mgr-sub">Свой адрес</div>
      <div className="src-custom">
        <div className="src-custom-row">
          <input className={'input' + (checkErr ? ' invalid' : '')} value={url} spellCheck={false} autoComplete="off" aria-label="Свой адрес источника"
            placeholder="https://…/package_имя_index.json" aria-invalid={!!checkErr}
            onChange={(e) => { setUrl(e.target.value); setCheckErr(''); setCheck(null) }} onKeyDown={(e) => { if (e.key === 'Enter') void doCheck() }} />
          <button className="btn small" disabled={checking || !url.trim()} onClick={() => void doCheck()}>{checking ? <Spinner /> : null} Проверить</button>
        </div>
        {checkErr && <div className="field-error" role="alert">{checkErr}</div>}
        {!check && !checkErr && !checking && <div className="dim small src-hint">Сначала адрес проверяется: скачивается индекс и показывается, что в нём есть. В настройки ничего не пишется.</div>}
        {check && <CheckResult c={check} busy={busy} onConnect={() => void connectChecked()} onClose={() => setCheck(null)} />}
      </div>

      {loading && !state && <div className="side-pad"><Spinner /> Читаю настройки arduino-cli…</div>}
      {error && <div className="field-error pad">{error}</div>}

      {connected.length > 0 && <div className="mgr-sub">Подключены ({connected.length})</div>}
      {connected.map((s) => (
        <SourceCard key={s.id} s={s} busy={busy} onConnect={() => void connectSource({ name: s.name, url: s.url, https: s.https })}
          onDisconnect={() => void disconnectSource({ name: s.name, url: s.url })} />
      ))}
      {available.length > 0 && <div className="mgr-sub">Проверенный каталог ({available.length})</div>}
      {available.map((s) => (
        <SourceCard key={s.id} s={s} busy={busy} onConnect={() => void connectSource({ name: s.name, url: s.url, https: s.https })}
          onDisconnect={() => void disconnectSource({ name: s.name, url: s.url })} />
      ))}
      {state?.configPath && <div className="src-conf dim small" title="Файл настроек arduino-cli, куда записываются адреса">Адреса хранятся в настройках arduino-cli: {state.configPath}</div>}
      {state && shown.length === 0 && (
        <EmptyState icon="plug" title="Нет подходящих источников" hint="Попробуйте другое слово: название производителя, чипа или платы. Своего адреса в каталоге нет — вставьте его в поле выше." />
      )}
    </div>
  )
}
