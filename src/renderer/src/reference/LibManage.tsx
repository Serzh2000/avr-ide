// Справочник «Библиотеки»: управление установленной библиотекой (обновить, удалить, старые копии)
// и каталог Arduino — описание библиотеки до установки.
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { CatalogLibrary } from '../../../main/libs/catalog'
import type { ShadowedLibrary } from '../../../main/libs/shadowing'
import type { ProjectLibrary } from '../contracts'
import { useBuild } from '../build/useBuild'
import { confirmDialog } from '../shell/dialogs'
import { Button, Skeleton } from '../shell/kit'
import { useUi } from '../shell/ui'

type Op = ReturnType<typeof window.api.cli.installLib>

/** Запуск установки/удаления с выводом в «Вывод»; true — успешно. */
export async function runLibOp(p: Op, label: string): Promise<boolean> {
  useUi.getState().showBottom('output')
  const done = await useBuild.getState().run(p, 'lib-install', label)
  return !!done && done.code === 0 && !done.cancelled
}

async function askRemove(name: string, extra?: string): Promise<boolean> {
  return (await confirmDialog({
    title: `Удалить «${name}»?`,
    message: (extra ? extra + ' ' : '') + 'Библиотеку можно будет установить снова, но потребуется интернет.',
    buttons: [{ id: 'del', label: 'Удалить', kind: 'danger' }, { id: 'cancel', label: 'Отмена' }]
  })) === 'del'
}

const cmpVersion = new Intl.Collator('en', { numeric: true }).compare

/** Действия над установленной библиотекой + предупреждение о старых копиях, мешающих сборке. */
export function LibActions({ lib, location, onChanged, reveal }: { lib: ProjectLibrary; location: 'user' | 'platform'; onChanged: () => void; reveal: (p: string) => void }): ReactNode {
  const busy = useBuild((s) => s.busy)
  const [latest, setLatest] = useState<string | null>(null)
  const [shadow, setShadow] = useState<ShadowedLibrary[]>([])
  useEffect(() => {
    let live = true
    setLatest(null)
    void window.api.libs.catalogEntry(lib.name).then((r) => { if (live && r.ok && r.data) setLatest(r.data.version) })
    void window.api.libs.shadowed().then((r) => { if (live && r.ok) setShadow(r.data) })
    return () => { live = false }
  }, [lib.name, lib.version])

  const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()
  const asOld = shadow.find((s) => s.others.some((o) => same(o.dir, lib.path)))
  const asNew = shadow.find((s) => same(s.preferred.dir, lib.path))
  const canUpdate = location === 'user' && latest && lib.version && cmpVersion(latest, lib.version) > 0

  const remove = async (name: string, extra?: string): Promise<void> => {
    if (!(await askRemove(name, extra))) return
    if (await runLibOp(window.api.cli.uninstallLib(name), `Удаление ${name}`)) onChanged()
  }

  return (
    <>
      <div className="lib-actions">
        {canUpdate && <Button size="sm" variant="primary" disabled={busy} data-testid="lib-update" onClick={async () => { if (await runLibOp(window.api.cli.upgradeLib(lib.name), `Обновление ${lib.name}`)) onChanged() }}>Обновить до {latest}</Button>}
        <Button size="sm" disabled={busy} onClick={() => reveal(lib.path)}>В папке</Button>
        {location === 'user'
          ? <Button size="sm" disabled={busy} data-testid="lib-remove" onClick={() => void remove(lib.name)}>Удалить</Button>
          : <span className="dim lib-actions-note">Входит в ядро платы — удаляется вместе с ним.</span>}
      </div>
      {asOld && (
        <div className="ref-warn" data-testid="lib-shadow-old">
          <b>Старая копия мешает сборке.</b> Она перехватывает <code>#include &lt;{asOld.header}&gt;</code> у {asOld.preferred.name} {asOld.preferred.version}. IDE при сборке берёт актуальную версию, но другие программы (Arduino IDE) возьмут эту.
          <div className="lib-actions"><Button size="sm" variant="primary" disabled={busy} onClick={() => void remove(lib.name, 'Это старая несовместимая копия.')}>Удалить старую копию</Button></div>
        </div>
      )}
      {asNew && (
        <div className="ref-warn" data-testid="lib-shadow-new">
          <b>Есть старые копии с тем же заголовком:</b> {asNew.others.map((o) => `${o.name}${o.version ? ' ' + o.version : ''}`).join(', ')}. При сборке в IDE они не используются, но могут ломать сборку в других программах.
          <div className="lib-actions">{asNew.others.map((o) => <Button key={o.dir} size="sm" disabled={busy} onClick={() => void remove(o.name, 'Это старая несовместимая копия.')}>Удалить {o.name}{o.version ? ' ' + o.version : ''}</Button>)}</div>
        </div>
      )}
    </>
  )
}

/** Каталог Arduino: поиск по локальному индексу и описание до установки. */
export function LibCatalog({ query, installed, onOpenInstalled, seg, narrow }: { query: string; installed: Map<string, string>; onOpenInstalled: (name: string) => void; seg: ReactNode; narrow?: boolean }): ReactNode {
  const busy = useBuild((s) => s.busy)
  const [res, setRes] = useState<CatalogLibrary[] | null | undefined>(undefined)
  const [err, setErr] = useState<string | undefined>()
  const [pick, setPick] = useState<string | null>(null)
  const q = query.trim()
  useEffect(() => {
    if (q.length < 2) { setRes(undefined); return }
    let live = true
    const t = setTimeout(() => {
      void window.api.libs.catalogSearch(q).then((r) => {
        if (!live) return
        if (r.ok) { setRes(r.data); setErr(undefined) } else { setRes([]); setErr(r.error) }
      })
    }, 250)
    return () => { live = false; clearTimeout(t) }
  }, [q])

  const list = res ?? []
  const cur = list.find((l) => l.name === pick) ?? list[0] ?? null
  const have = cur ? installed.get(cur.name.toLowerCase()) : undefined

  const install = async (lib: CatalogLibrary): Promise<void> => {
    if (await runLibOp(window.api.cli.installLib(lib.name), `Установка ${lib.name}`)) {
      useUi.getState().notify(`Библиотека «${lib.name}» установлена.`, { kind: 'ok', action: { label: 'Открыть в справочнике', run: () => onOpenInstalled(lib.name) } })
    }
  }

  return (
    <div className={'ref-body ref-libs' + (narrow ? ' narrow' : '')}>
      <div className="ref-list lib-list">
        {seg}
        {q.length < 2 && <div className="ref-empty">Введите в поиске сверху название, заголовок (<code>DHT.h</code>) или задачу: «servo», «oled», «mqtt».</div>}
        {q.length >= 2 && res === undefined && <Skeleton rows={6} label="Ищу в каталоге Arduino…" />}
        {res === null && <div className="ref-empty">Каталог библиотек ещё не скачан. Откройте панель «Библиотеки» слева — она скачает его при первом поиске.</div>}
        {err && <div className="ref-empty">{err}</div>}
        {res && res.length === 0 && !err && <div className="ref-empty">В каталоге нет «{q}»</div>}
        {list.map((l) => (
          <div key={l.name} className={'ref-card' + (cur && l.name === cur.name ? ' selected' : '')} onClick={() => setPick(l.name)} data-testid="lib-catalog-item">
            <div className="ref-card-name">{l.name}<span className="lib-ver"> {l.version}</span></div>
            {l.sentence && <div className="ref-card-desc">{l.sentence}</div>}
            {installed.has(l.name.toLowerCase()) && <div className="ref-card-meta"><span className="ref-cat">установлена {installed.get(l.name.toLowerCase())}</span></div>}
          </div>
        ))}
      </div>
      <div className="ref-detail">
        {cur && (
          <div data-testid="lib-catalog-detail">
            <h2 className="ref-title">{cur.name}<span className="lib-ver"> {cur.version}</span></h2>
            {cur.sentence && <p className="lib-sentence">{cur.sentence}</p>}
            <div className="lib-actions">
              {have
                ? <><span className="dim">Установлена версия {have}.</span><Button size="sm" variant="primary" onClick={() => onOpenInstalled(cur.name)}>Функции и примеры</Button></>
                : <Button size="sm" variant="primary" disabled={busy} data-testid="lib-install" onClick={() => void install(cur)}>Установить {cur.version}</Button>}
              {cur.website && <Button size="sm" onClick={() => void window.api.libs.openWebsite(cur.name)}>Сайт</Button>}
            </div>
            {cur.paragraph && cur.paragraph !== cur.sentence && <p className="lib-paragraph">{cur.paragraph}</p>}
            <dl className="lib-facts">
              {cur.author && <><dt>Автор</dt><dd>{cur.author}</dd></>}
              {cur.category && <><dt>Категория</dt><dd>{cur.category}</dd></>}
              <dt>Платы</dt><dd>{cur.architectures.length === 0 || cur.architectures.includes('*') ? 'любые' : cur.architectures.join(', ')}</dd>
              {cur.providesIncludes?.length ? <><dt>Подключение</dt><dd>{cur.providesIncludes.map((h) => <code key={h}>#include &lt;{h}&gt;</code>)}</dd></> : null}
              {cur.dependencies.length > 0 && <><dt>Зависит от</dt><dd>{cur.dependencies.join(', ')} <span className="dim">(поставятся сами)</span></dd></>}
              <dt>Версии</dt><dd>{cur.versions.join(', ')}</dd>
            </dl>
            {!have && <p className="dim lib-catalog-note">Функции, классы и примеры появятся здесь после установки — они берутся из файлов библиотеки.</p>}
          </div>
        )}
      </div>
    </div>
  )
}
