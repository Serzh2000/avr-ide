// Боковая панель «Платы и библиотеки»: поиск, установка, обновление, удаление; источники плат.
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { CoreInfo, LibInfo } from '../../../main/cli/types'
import type { CoreSearchResult, FoundCore } from '../../../main/boardsources/types'
import { confirmDialog } from '../shell/dialogs'
import { Icon } from '../shell/icons'
import { EmptyState, Spinner } from '../shell/kit'
import SetupCard from '../shell/SetupCard'
import GithubLibs from './GithubLibs'
import KitPanel from './KitPanel'
import SourcesPanel, { ProtoBadge } from './SourcesPanel'
import { connectSource, sourceOfCore, useSources } from './sourcesStore'
import { useUi } from '../shell/ui'
import { useBuild } from './useBuild'

type Mode = 'core' | 'lib'
type Source = 'arduino' | 'github'
type CoreSub = 'cores' | 'sources'

export default function ManagerPanel(): ReactNode {
  const status = useBuild((s) => s.status)
  const cores = useBuild((s) => s.cores)
  const libs = useBuild((s) => s.libs)
  const espUrls = useBuild((s) => s.espUrls)
  const busy = useBuild((s) => s.busy)
  const kind = useBuild((s) => s.kind)
  const progress = useBuild((s) => s.progress)
  const run = useBuild((s) => s.run)
  const cancel = useBuild((s) => s.cancel)
  const showBottom = useUi((s) => s.showBottom)
  const srcState = useSources((s) => s.state)
  const refreshSources = useSources((s) => s.refresh)
  const [mode, setMode] = useState<Mode>('core')
  const [source, setSource] = useState<Source>('arduino')
  const [sub, setSub] = useState<CoreSub>('cores')
  const [q, setQ] = useState('')
  const [results, setResults] = useState<{ libs: LibInfo[] } | null>(null)
  const [coreRes, setCoreRes] = useState<CoreSearchResult | null>(null)
  const [searching, setSearching] = useState(false)
  const [err, setErr] = useState('')
  const [target, setTarget] = useState<string>('')

  // Поиск с небольшой задержкой
  useEffect(() => {
    setErr('')
    const text = q.trim()
    const skip = !status?.found || !text || (mode === 'lib' && source === 'github') || (mode === 'core' && sub === 'sources')
    if (skip) { setResults(null); setCoreRes(null); setSearching(false); return }
    setSearching(true)
    let alive = true
    const t = setTimeout(async () => {
      if (mode === 'core') {
        const r = await window.api.boardsources.searchCores(text)
        if (!alive) return
        setSearching(false)
        if (!r.ok) { setErr(r.error); setCoreRes(null); return }
        setCoreRes(r.data)
        return
      }
      const r = await window.api.cli.searchLibs(text)
      if (!alive) return
      setSearching(false)
      if (!r.ok) { setErr(r.error); setResults(null); return }
      setResults({ libs: r.data })
    }, 400)
    return () => { alive = false; clearTimeout(t) }
  }, [q, mode, source, sub, status?.found])

  // Подписи «из какого источника ядро» берём из списка источников
  useEffect(() => { if (status?.found && mode === 'core') void refreshSources() }, [status?.found, mode, refreshSources])

  const instCores = useMemo(() => new Map((cores ?? []).map((c) => [c.id, c])), [cores])
  const instLibs = useMemo(() => new Map((libs ?? []).map((l) => [l.name, l])), [libs])

  const doOp = async (id: string, p: ReturnType<typeof window.api.cli.installCore>, k: 'core-install' | 'lib-install', label: string): Promise<void> => {
    setTarget(id)
    showBottom('output')
    await run(p, k, label)
    setTarget('')
  }

  const askRemove = async (what: string): Promise<boolean> =>
    (await confirmDialog({
      title: `Удалить «${what}»?`,
      message: 'Её можно будет установить снова, но потребуется интернет.',
      buttons: [{ id: 'del', label: 'Удалить', kind: 'danger' }, { id: 'cancel', label: 'Отмена' }]
    })) === 'del'

  const addEsp = async (): Promise<void> => {
    const a = await confirmDialog({
      title: 'Добавить адреса пакетов ESP?',
      message: 'В конфигурацию arduino-cli будут добавлены официальные адреса пакетов ESP8266 (arduino.esp8266.com) и ESP32 (espressif.github.io), затем обновится индекс. Существующие настройки не удаляются.',
      buttons: [{ id: 'ok', label: 'Добавить', kind: 'primary' }, { id: 'cancel', label: 'Отмена' }]
    })
    if (a !== 'ok') return
    showBottom('output')
    await run(window.api.cli.addEspUrls(), 'index-update', 'Добавление адресов и обновление индекса')
  }

  if (!status) return <div className="side-pad"><Spinner /> Проверяем arduino-cli…</div>
  if (!status.found) return <div className="side-pad"><SetupCard /></div>

  const libRows: LibInfo[] = results ? results.libs : [...(libs ?? [])].sort((a, b) => a.name.localeCompare(b.name))
  const showingInstalled = !results && !coreRes && !q.trim()
  const espMissing = espUrls && (!espUrls.esp8266 || !espUrls.esp32)
  const opLabel = busy && kind !== 'compile' && kind !== 'upload'
  const coresView = mode === 'core' && sub === 'cores'
  const installedRows: CoreInfo[] = [...(cores ?? [])].sort((a, b) => a.name.localeCompare(b.name))

  const coreRow = (c: FoundCore): ReactNode => {
    const inst = instCores.get(c.id)
    const upd = !!inst?.installed && !!c.latest && c.latest !== inst.installed
    const mine = target === c.id && busy
    const src = sourceOfCore(srcState?.sources, c.id)
    return (
      <div className="mgr-item" key={c.id}>
        <div className="mgr-main">
          <div className="mgr-name">{c.name}</div>
          <div className="mgr-meta">{c.id} · {inst?.installed ? `установлено ${inst.installed}` : c.latest ? `версия ${c.latest}` : ''}{upd ? ` → доступна ${c.latest}` : ''}</div>
          {showingInstalled && (
            <div className="mgr-src">{src ? `Источник: ${src.name}${src.connected ? '' : ' (не подключён — обновления недоступны)'}` : c.id.startsWith('arduino:') ? 'Источник: Arduino' : 'Источник: другой адрес'}</div>
          )}
        </div>
        <div className="mgr-btns">
          {mine ? <Spinner /> : !inst?.installed ? (
            <button className="btn small primary" disabled={busy} onClick={() => void doOp(c.id, window.api.cli.installCore(c.id), 'core-install', `Установка ${c.id}`)}>Установить</button>
          ) : (
            <>
              {upd && <button className="btn small" disabled={busy} onClick={() => void doOp(c.id, window.api.cli.upgradeCore(c.id), 'core-install', `Обновление ${c.id}`)}>Обновить</button>}
              <button className="icon-btn" title="Удалить ядро" disabled={busy} onClick={async () => { if (await askRemove(c.name)) await doOp(c.id, window.api.cli.uninstallCore(c.id), 'core-install', `Удаление ${c.id}`) }}><Icon name="trash" size={14} /></button>
            </>
          )}
        </div>
      </div>
    )
  }

  const noCoreResult = !!coreRes && coreRes.groups.length === 0 && coreRes.hits.length === 0

  return (
    <div className="mgr">
      <div className="side-pad no-bottom"><SetupCard /></div>
      <div className="seg" role="tablist">
        <button role="tab" aria-selected={mode === 'core'} className={mode === 'core' ? 'on' : ''} onClick={() => setMode('core')}>Платы</button>
        <button role="tab" aria-selected={mode === 'lib'} className={mode === 'lib' ? 'on' : ''} onClick={() => setMode('lib')}>Библиотеки</button>
      </div>
      {mode === 'lib' && (
        <div className="seg seg-sub" role="tablist" aria-label="Источник библиотек">
          <button role="tab" aria-selected={source === 'arduino'} className={source === 'arduino' ? 'on' : ''} onClick={() => setSource('arduino')}>Arduino</button>
          <button role="tab" aria-selected={source === 'github'} className={source === 'github' ? 'on' : ''} onClick={() => setSource('github')}>GitHub</button>
        </div>
      )}
      {mode === 'core' && (
        <div className="seg seg-sub" role="tablist" aria-label="Раздел плат">
          <button role="tab" aria-selected={sub === 'cores'} className={sub === 'cores' ? 'on' : ''} onClick={() => setSub('cores')}>Ядра</button>
          <button role="tab" aria-selected={sub === 'sources'} className={sub === 'sources' ? 'on' : ''} onClick={() => setSub('sources')}>Источники</button>
        </div>
      )}
      {!(mode === 'lib' && source === 'github') && <div className="side-search">
        <Icon name="search" size={14} />
        <input value={q} onChange={(e) => setQ(e.target.value)} spellCheck={false}
          placeholder={mode === 'core' ? (sub === 'sources' ? 'Найти источник: stm32, attiny, seeed…' : 'Найти ядро: esp32, avr, stm32…') : 'Найти библиотеку: ESPUI, DHT, Servo…'} aria-label="Поиск" />
        {q && <button className="icon-btn" title="Очистить поиск" onClick={() => setQ('')}><Icon name="x" size={13} /></button>}
        {searching && <Spinner />}
      </div>}
      {opLabel && (
        <div className="op-line">
          <div className="op-text"><Spinner /> <span className="grow">{progress?.label ?? 'Выполняется…'}{progress?.pct != null ? ` ${Math.round(progress.pct)}%` : ''}</span>
            <button className="link-btn" onClick={cancel}>Отмена</button></div>
          <div className={'bar thin' + (progress?.pct == null ? ' indeterminate' : '')}><div style={{ width: progress?.pct != null ? progress.pct + '%' : undefined }} /></div>
        </div>
      )}
      {coresView && espMissing && (
        <div className="note">
          Адреса пакетов ESP не добавлены — ядра ESP32/ESP8266 не найдутся при поиске. Их можно подключить и в разделе «Источники».
          <button className="link-btn" onClick={() => void addEsp()} disabled={busy}>Добавить…</button>
        </div>
      )}
      {mode === 'lib' && source === 'github' ? <GithubLibs /> : mode === 'core' && sub === 'sources' ? <SourcesPanel q={q} /> : <div className="mgr-list">
        {err && <div className="field-error pad">{err}</div>}
        {coresView && showingInstalled && <div className="mgr-sub">Установлено</div>}
        {coresView && showingInstalled && installedRows.map((c) => coreRow(c))}
        {coresView && showingInstalled && <KitPanel />}
        {coresView && coreRes && coreRes.groups.map((g) => (
          <div key={g.sourceId}>
            <div className="mgr-sub">{g.title}{g.url && <span className="mgr-sub-url" title={g.url}> · {g.url.startsWith('https:') ? '' : 'http · '}источник</span>}</div>
            {g.cores.map((c) => coreRow(c))}
          </div>
        ))}
        {coresView && coreRes && coreRes.hits.length > 0 && (
          <>
            <div className="mgr-sub">Есть в источниках, которые не подключены</div>
            {coreRes.hits.filter((h) => !h.source.connected).map((h) => (
              <div className="mgr-item" key={h.source.id}>
                <div className="mgr-main">
                  <div className="mgr-name">{h.source.name} <ProtoBadge https={h.source.https} /></div>
                  <div className="mgr-meta">{(h.matches.length ? h.matches.slice(0, 3).join(', ') : h.source.description)}{h.coreIds.every((id) => instCores.has(id)) ? ' · ядро уже установлено, но обновления недоступны' : ''}</div>
                </div>
                <div className="mgr-btns">
                  <button className="btn small primary" disabled={busy} onClick={() => void connectSource({ name: h.source.name, url: h.source.url, https: h.source.https })}>Подключить</button>
                </div>
              </div>
            ))}
          </>
        )}
        {mode === 'lib' && results && <div className="mgr-sub">Результаты поиска</div>}
        {mode === 'lib' && !results && !q.trim() && <div className="mgr-sub">Установлено</div>}
        {mode === 'lib' && libRows.map((l) => {
          const inst = instLibs.get(l.name)
          const upd = !!inst?.latest && !!inst.version && inst.latest !== inst.version
          const mine = target === l.name && busy
          return (
            <div className="mgr-item" key={l.name}>
              <div className="mgr-main">
                <div className="mgr-name">{l.name}</div>
                <div className="mgr-meta">{inst ? `установлена ${inst.version ?? ''}` : l.latest ? `версия ${l.latest}` : ''}{upd ? ` → доступна ${inst.latest}` : ''}</div>
                {l.sentence && <div className="mgr-desc">{l.sentence}</div>}
              </div>
              <div className="mgr-btns">
                {mine ? <Spinner /> : !inst ? (
                  <button className="btn small primary" disabled={busy} onClick={() => void doOp(l.name, window.api.cli.installLib(l.name), 'lib-install', `Установка ${l.name}`)}>Установить</button>
                ) : (
                  <>
                    {upd && <button className="btn small" disabled={busy} onClick={() => void doOp(l.name, window.api.cli.upgradeLib(l.name), 'lib-install', `Обновление ${l.name}`)}>Обновить</button>}
                    <button className="icon-btn" title="Удалить библиотеку" disabled={busy} onClick={async () => { if (await askRemove(l.name)) await doOp(l.name, window.api.cli.uninstallLib(l.name), 'lib-install', `Удаление ${l.name}`) }}><Icon name="trash" size={14} /></button>
                  </>
                )}
              </div>
            </div>
          )
        })}
        {!searching && !err && coresView && ((showingInstalled && installedRows.length === 0) || noCoreResult) && (
          <EmptyState icon="board"
            title={noCoreResult ? 'Ничего не найдено' : 'Ядра не установлены'}
            hint={noCoreResult ? 'Попробуйте другое слово: название чипа, платы или производителя. Нужного источника может не быть среди подключённых — загляните в раздел «Источники».' : 'Найдите нужное ядро в строке поиска выше или подключите источник плат в разделе «Источники».'}>
            <button className="btn small" onClick={() => setSub('sources')}>Открыть «Источники»</button>
          </EmptyState>
        )}
        {!searching && !err && mode === 'lib' && libRows.length === 0 && (
          <EmptyState icon="book" title={results ? 'Ничего не найдено' : 'Библиотеки не установлены'}
            hint={results ? 'Попробуйте другое слово, например название чипа или производителя.' : 'Введите название библиотеки в строке поиска выше.'} />
        )}
      </div>}
    </div>
  )
}
