// Источник библиотек «GitHub»: каталог репозиториев, выбор версии (тег / ветка), установка из zip.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { LibInfo } from '../../../main/cli/types'
import type { CatalogEntry, RefKind, RefList } from '../../../main/libsource/types'
import { confirmDialog, promptDialog } from '../shell/dialogs'
import { Icon } from '../shell/icons'
import { EmptyState, Spinner } from '../shell/kit'
import { useUi } from '../shell/ui'
import { initGithub, useGh } from './githubStore'
import { useBuild } from './useBuild'

const PAGE = 100
const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const folderOf = (p?: string): string => (p ? (p.split(/[\\/]/).filter(Boolean).pop() ?? '') : '')

const fmtDate = (ms: number): string =>
  new Date(ms).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** Установлена ли библиотека: по имени из индекса Arduino либо по имени папки (= имя репозитория). */
function findInstalled(e: CatalogEntry, libs: LibInfo[] | null): LibInfo | undefined {
  if (!libs) return undefined
  const byName = e.inIndex ? norm(e.name) : ''
  const byRepo = norm(e.repo)
  return libs.find((l) => (byName && norm(l.name) === byName) || norm(folderOf(l.installDir)) === byRepo || norm(l.name) === byRepo)
}

const CONSENT_TEXT =
  'Библиотека будет скачана прямо из репозитория GitHub и установлена из zip-архива, в обход проверенного индекса Arduino. ' +
  'Её код не проверялся ни Arduino, ни этим приложением: он может содержать ошибки или вредоносные части. ' +
  'Ставьте только то, чему доверяете.\n\n' +
  'Для этого приложение включает в arduino-cli режим «небезопасной установки» (library.enable_unsafe_install) — только на время установки, ' +
  'в вашем конфиге arduino-cli ничего не меняется. Согласие запоминается; его можно отозвать внизу списка.'

export default function GithubLibs(): ReactNode {
  const status = useGh((s) => s.status)
  const refreshing = useGh((s) => s.refreshing)
  const progress = useGh((s) => s.progress)
  const errors = useGh((s) => s.refreshErrors)
  const result = useGh((s) => s.lastResult)
  const loadStatus = useGh((s) => s.loadStatus)
  const refresh = useGh((s) => s.refresh)
  const setResult = useGh((s) => s.setResult)
  const libs = useBuild((s) => s.libs)
  const busy = useBuild((s) => s.busy)
  const run = useBuild((s) => s.run)
  const showBottom = useUi((s) => s.showBottom)

  const [q, setQ] = useState('')
  const [items, setItems] = useState<CatalogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [searching, setSearching] = useState(false)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [target, setTarget] = useState('')
  const [rev, setRev] = useState(0) // перезапуск поиска после смены каталога / своего списка
  const seq = useRef(0)

  useEffect(() => { initGithub(); void loadStatus() }, [loadStatus])

  const loaded = !!status?.loaded || (status?.custom ?? 0) > 0

  // Поиск с небольшой задержкой; первая страница заменяет список
  useEffect(() => {
    if (!loaded) { setItems([]); setTotal(0); return }
    const my = ++seq.current
    setSearching(true)
    const t = setTimeout(async () => {
      const r = await window.api.libsource.search(q, 0, PAGE)
      if (my !== seq.current) return
      setSearching(false)
      if (!r.ok) { setErr(r.error); return }
      setErr('')
      setItems(r.data.items)
      setTotal(r.data.total)
    }, q ? 180 : 0)
    return () => clearTimeout(t)
  }, [q, loaded, rev, status?.registryAt, status?.indexAt])

  const more = async (): Promise<void> => {
    const r = await window.api.libsource.search(q, items.length, PAGE)
    if (r.ok) { setItems((x) => [...x, ...r.data.items]); setTotal(r.data.total) }
  }

  const askConsent = useCallback(async (): Promise<boolean> => {
    if (status?.consent) return true
    const a = await confirmDialog({
      title: 'Установка с GitHub: подтвердите риск',
      message: CONSENT_TEXT,
      buttons: [{ id: 'ok', label: 'Понимаю, разрешить', kind: 'primary' }, { id: 'cancel', label: 'Отмена' }]
    })
    if (a !== 'ok') return false
    await window.api.libsource.setConsent(true)
    await loadStatus()
    return true
  }, [status?.consent, loadStatus])

  const install = async (e: CatalogEntry, kind: RefKind, ref?: string): Promise<void> => {
    if (!(await askConsent())) return
    setTarget(e.id)
    setResult(null)
    showBottom('output')
    const [owner, repo] = e.id.split('/')
    await run(window.api.libsource.install(owner, repo, kind, ref), 'lib-install', `Установка ${e.id} с GitHub`)
    setTarget('')
  }

  const installDeps = async (names: string[]): Promise<void> => {
    showBottom('output')
    await run(window.api.libsource.installDeps(names), 'lib-install', 'Установка зависимостей')
    // Обновим вывод «что ещё не хватает»
    if (result) setResult({ ...result, depends: result.depends.map((d) => (names.includes(d.name) ? { ...d, installed: true } : d)) })
  }

  const addCustom = async (): Promise<void> => {
    const v = await promptDialog({
      title: 'Добавить репозиторий в свой список',
      label: 'Ссылка на репозиторий GitHub или «владелец/репозиторий»',
      okLabel: 'Добавить',
      validate: (s) => (s.trim() ? null : 'Введите адрес.')
    })
    if (v === null) return
    const r = await window.api.libsource.addCustom(v.trim())
    if (!r.ok) { setErr(r.error); return }
    setErr('')
    await loadStatus()
    setQ(r.data.id)
    setRev((x) => x + 1)
    setOpen(r.data.id)
  }

  const removeCustom = async (e: CatalogEntry): Promise<void> => {
    await window.api.libsource.removeCustom(e.owner, e.repo)
    await loadStatus()
    setRev((x) => x + 1)
  }

  const setToken = async (): Promise<void> => {
    const v = await promptDialog({
      title: 'Токен GitHub',
      label: 'Необязательно. Токен увеличивает лимит запросов к API GitHub с 60 до 5000 в час. Хранится в зашифрованном виде и не попадает в журнал. Права не нужны.',
      okLabel: 'Сохранить',
      validate: (s) => (/^[A-Za-z0-9_]{20,255}$/.test(s.trim()) ? null : 'Токен выглядит некорректно.')
    })
    if (v === null) return
    const r = await window.api.libsource.setToken(v.trim())
    if (!r.ok) setErr(r.error)
    await loadStatus()
  }

  const revoke = async (): Promise<void> => {
    await window.api.libsource.setConsent(false)
    await loadStatus()
  }

  const missing = useMemo(() => result?.depends.filter((d) => !d.installed) ?? [], [result])

  return (
    <div className="gh">
      <div className="gh-head">
        {status === null ? <span className="dim"><Spinner /> Загрузка…</span> : (
          <span className="dim gh-date">
            {status.loaded
              ? <>Каталог: {status.total.toLocaleString('ru-RU')} репозиториев · обновлён {fmtDate(Math.max(status.registryAt, status.indexAt))}</>
              : 'Каталог ещё не загружен'}
          </span>
        )}
        <button className="icon-btn" title="Обновить каталог" aria-label="Обновить каталог" disabled={refreshing} onClick={() => void refresh()}>
          {refreshing ? <Spinner /> : <Icon name="refresh" size={14} />}
        </button>
        <button className="icon-btn" title="Добавить свой репозиторий" aria-label="Добавить свой репозиторий" onClick={() => void addCustom()}><Icon name="plus" size={14} /></button>
      </div>

      {refreshing && <div className="note">{progress || 'Обновление каталога…'}</div>}
      {!refreshing && errors.length > 0 && (
        <div className="gh-warn">
          <Icon name="warn" size={14} />
          <div>
            {status?.loaded ? 'Каталог обновить не удалось — работаем по сохранённой копии.' : 'Каталог загрузить не удалось.'}
            {errors.map((e, i) => <div key={i} className="gh-err-line">{e}</div>)}
          </div>
        </div>
      )}

      {loaded && (
        <div className="side-search">
          <Icon name="search" size={14} />
          <input value={q} onChange={(e) => setQ(e.target.value)} spellCheck={false} aria-label="Поиск по каталогу GitHub"
            placeholder="Название, автор, описание или owner/repo" />
          {q && <button className="icon-btn" title="Очистить поиск" onClick={() => setQ('')}><Icon name="x" size={13} /></button>}
          {searching && <Spinner />}
        </div>
      )}

      {result && (
        <div className={'gh-result ' + (result.ok ? 'ok' : 'bad')} role="status">
          <div className="gh-result-title">
            <Icon name={result.ok ? 'check' : 'error'} size={14} />
            <span className="grow">{result.ok
              ? <>Установлено: <b>{result.name ?? `${result.owner}/${result.repo}`}</b>{result.version ? ` ${result.version}` : ''}</>
              : <>Не удалось установить {result.owner}/{result.repo}. Подробности — во вкладке «Вывод».</>}</span>
            <button className="icon-btn" title="Скрыть" onClick={() => setResult(null)}><Icon name="x" size={12} /></button>
          </div>
          {result.warnings.map((w, i) => <div key={i} className="gh-result-line">{w}</div>)}
          {result.ok && missing.length > 0 && (
            <div className="gh-result-line">
              Нужны другие библиотеки, которых нет: <b>{missing.map((d) => d.name + (d.constraint ? ` (${d.constraint})` : '')).join(', ')}</b>. Без них скетч может не собраться.
              <div><button className="btn small" disabled={busy} onClick={() => void installDeps(missing.map((d) => d.name))}>Установить недостающие из индекса Arduino</button></div>
            </div>
          )}
          {result.ok && result.depends.length > 0 && missing.length === 0 && <div className="gh-result-line">Все зависимости ({result.depends.map((d) => d.name).join(', ')}) уже установлены.</div>}
        </div>
      )}

      <div className="mgr-list">
        {err && <div className="field-error pad">{err}</div>}
        {!loaded && status && (
          <EmptyState icon="download" title="Каталог GitHub не загружен"
            hint="Загрузим список репозиториев из реестра Arduino и описания из индекса библиотек (около 60 МБ трафика, один раз; потом работает без сети).">
            <button className="btn primary" disabled={refreshing} onClick={() => void refresh()}>Загрузить каталог</button>
          </EmptyState>
        )}
        {loaded && items.map((e) => (
          <GhItem key={e.id} e={e} open={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)}
            installed={findInstalled(e, libs)} busy={busy} mine={target === e.id && busy}
            onInstall={(k, r) => void install(e, k, r)} onRemove={() => void removeCustom(e)} />
        ))}
        {loaded && items.length > 0 && items.length < total && (
          <div className="gh-more"><button className="btn small" onClick={() => void more()}>Показать ещё (осталось {(total - items.length).toLocaleString('ru-RU')})</button></div>
        )}
        {loaded && !searching && items.length === 0 && !err && (
          <EmptyState icon="book" title="Ничего не найдено" hint="Попробуйте другое слово, часть названия или «владелец/репозиторий». Своего репозитория в списке нет — добавьте его кнопкой «+» сверху." />
        )}
        {loaded && total > 0 && <div className="gh-count dim">Найдено: {total.toLocaleString('ru-RU')}</div>}

        <details className="gh-foot">
          <summary>Настройки GitHub</summary>
          <div className="gh-set">
            <div>Установка напрямую с GitHub: <b>{status?.consent ? 'разрешена' : 'не разрешена'}</b>
              {status?.consent && <button className="link-btn" onClick={() => void revoke()}>отозвать согласие</button>}</div>
            <div>Токен GitHub: <b>{status?.hasToken ? 'задан' : 'не задан'}</b>
              <button className="link-btn" onClick={() => void setToken()}>{status?.hasToken ? 'заменить' : 'указать'}</button>
              {status?.hasToken && <button className="link-btn" onClick={async () => { await window.api.libsource.setToken(null); await loadStatus() }}>удалить</button>}
            </div>
            <div className="dim">Токен нужен только если список версий не загружается из-за лимита запросов (60 в час без токена).</div>
          </div>
        </details>
      </div>
    </div>
  )
}

function GhItem(p: {
  e: CatalogEntry
  open: boolean
  onToggle: () => void
  installed?: LibInfo
  busy: boolean
  mine: boolean
  onInstall: (kind: RefKind, ref?: string) => void
  onRemove: () => void
}): ReactNode {
  const { e } = p
  const [refs, setRefs] = useState<RefList | null>(null)
  const [refErr, setRefErr] = useState('')
  const [pick, setPick] = useState('') // «tag:1.0.0» | «default»

  useEffect(() => {
    if (!p.open || refs || refErr) return
    let alive = true
    void window.api.libsource.refs(e.owner, e.repo).then((r) => {
      if (!alive) return
      if (!r.ok) { setRefErr(r.error); setPick('default'); return }
      setRefs(r.data)
      setPick(r.data.tags[0] ? 'tag:' + r.data.tags[0] : 'default')
    })
    return () => { alive = false }
  }, [p.open, refs, refErr, e.owner, e.repo])

  const choose = (): { kind: RefKind; ref?: string } => {
    if (pick.startsWith('tag:')) return { kind: 'tag', ref: pick.slice(4) }
    return { kind: 'default' }
  }
  const branch = refs?.defaultBranch

  return (
    <div className={'gh-item' + (p.open ? ' open' : '')}>
      <div className="gh-row" role="button" tabIndex={0} aria-expanded={p.open} onClick={p.onToggle}
        onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); p.onToggle() } }}>
        <div className="mgr-main">
          <div className="mgr-name">{e.name}</div>
          <div className="mgr-meta">
            {e.name !== e.id && <>{e.id} · </>}
            {p.installed ? `установлена ${p.installed.version ?? ''}`.trim() : e.latest ? `в индексе ${e.latest}` : null}
            {!e.inIndex && <span className="gh-badge warn" title="Нет в индексе библиотек Arduino — код не проверялся">не проверено Arduino</span>}
          </div>
          {e.sentence && !p.open && <div className="mgr-desc">{e.sentence}</div>}
        </div>
        <div className="gh-badges">
          {e.custom && <span className="gh-badge mine" title="Из вашего списка">мой</span>}
          {p.installed && <span className="gh-badge inst" title={`Установлена версия ${p.installed.version ?? '?'}`}>✓</span>}
        </div>
      </div>
      {p.open && (
        <div className="gh-detail">
          {e.sentence && <p className="gh-sentence">{e.sentence}</p>}
          <div className="gh-meta dim">
            {e.author && <span>Автор: {e.author}</span>}
            {e.category && <span>Категория: {e.category}</span>}
            {e.latest && <span>В индексе Arduino: {e.latest}</span>}
          </div>
          <div className="gh-warn small">
            <Icon name="warn" size={13} />
            <div>{e.inIndex
              ? 'Установка идёт напрямую из GitHub, а не из проверенного индекса Arduino. Версия может отличаться от индексной.'
              : 'Не проверено Arduino: этого репозитория нет в индексе библиотек. Код скачивается как есть — доверяйте только знакомым авторам.'}</div>
          </div>
          {p.installed && <div className="gh-installed"><Icon name="check" size={13} /> Сейчас установлена версия {p.installed.version ?? '(неизвестно)'}. Установка выбранной версии заменит её.</div>}
          <label className="field-label" htmlFor={'v-' + e.id}>Версия</label>
          {!refs && !refErr ? <div className="dim"><Spinner /> Получаем список версий…</div> : (
            <select id={'v-' + e.id} className="select gh-select" value={pick} onChange={(ev) => setPick(ev.target.value)} disabled={p.busy}>
              {(refs?.tags ?? []).map((t, i) => <option key={t} value={'tag:' + t}>{t}{i === 0 ? ' (последний тег)' : ''}</option>)}
              <option value="default">{branch ? `ветка ${branch}` : 'ветка по умолчанию'} — последняя, может быть нестабильна</option>
            </select>
          )}
          {refErr && <div className="field-error">{refErr}<div className="dim">Можно установить ветку по умолчанию.</div></div>}
          {refs && refs.tags.length === 0 && <div className="dim gh-hint">У репозитория нет тегов (релизов) — доступна только последняя ветка.</div>}
          {refs?.note && <div className="dim gh-hint">{refs.note}</div>}
          <div className="gh-actions">
            {p.mine ? <span className="dim"><Spinner /> Установка…</span> : (
              <button className="btn small primary" disabled={p.busy || !pick} onClick={() => { const c = choose(); p.onInstall(c.kind, c.ref) }}>
                {p.installed ? 'Переустановить' : 'Установить'}
              </button>
            )}
            <button className="btn small" onClick={() => void window.api.libsource.openRepo(e.owner, e.repo)}><Icon name="external" size={12} /> GitHub</button>
            {e.custom && <button className="btn small" onClick={p.onRemove}>Убрать из списка</button>}
          </div>
        </div>
      )}
    </div>
  )
}
