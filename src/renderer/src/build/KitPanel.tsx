// Раздел «Комплект» панели «Платы»: пакеты ядер, которые можно установить без интернета.
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import type { PackInfo } from '../../../main/cores/types'
import { Icon } from '../shell/icons'
import { Spinner, Button } from '../shell/kit'
import { useUi } from '../shell/ui'
import { fmtBytes, installFromKit, packTime, useCores } from './coresStore'
import { useBuild } from './useBuild'

function Row({ p, busy, mine }: { p: PackInfo; busy: boolean; mine: boolean }): ReactNode {
  const where = p.origin === 'bundled' ? 'встроен в IDE' : p.where
  let meta = ''
  let action: ReactNode = null
  if (p.status === 'installed') {
    meta = `Установлено ${p.installedVersion}`
  } else if (p.status === 'newer') {
    meta = `Установлена более новая версия ${p.installedVersion}`
  } else if (p.status === 'ready' || p.status === 'upgrade') {
    meta = (p.status === 'upgrade' ? `Установлено ${p.installedVersion}, в комплекте ${p.version}` : `Версия ${p.version}`) + ` · ${fmtBytes(p.bytes)} · ${packTime(p)}`
    action = mine ? <Spinner /> : (
      <Button variant="primary" size="sm" data-testid="kit-install" disabled={busy} onClick={() => void installFromKit(p)}>
        {p.status === 'upgrade' ? 'Обновить из комплекта' : 'Установить'}
      </Button>
    )
  } else {
    meta = p.error ?? ''
  }
  return (
    <div className="mgr-item" data-testid="kit-pack" data-id={p.id} data-status={p.status}>
      <div className="mgr-main">
        <div className="mgr-name">{p.status === 'invalid' || p.status === 'archive' ? p.title : `${p.title} ${p.version}`}</div>
        <div className={'mgr-meta' + (p.status === 'invalid' ? ' kit-bad' : '')}>{meta}</div>
        <div className="mgr-src" title={where}>{p.status === 'installed' || p.status === 'newer' ? where : (p.status === 'invalid' || p.status === 'archive' ? where : `Нужно свободного места: около ${fmtBytes(p.diskNeed)} · ${where}`)}</div>
      </div>
      <div className="mgr-btns">{p.status === 'installed' ? <span className="kit-ok"><Icon name="check" size={14} /></span> : action}</div>
    </div>
  )
}

export default function KitPanel(): ReactNode {
  const state = useCores((s) => s.state)
  const loading = useCores((s) => s.loading)
  const refresh = useCores((s) => s.refresh)
  const busy = useBuild((s) => s.busy)
  const installing = useCores((s) => s.installing)
  const notify = useUi((s) => s.notify)
  useEffect(() => { void refresh() }, [refresh])
  if (!state) return null

  const packs = state.packs
  const addFolder = async (): Promise<void> => {
    const r = await window.api.cores.addFolder()
    if (!r.ok) notify(r.error)
    else if (r.data) await refresh()
  }
  return (
    <div data-testid="kit-section">
      <div className="mgr-sub">Комплект (без интернета)</div>
      {packs.length === 0 && (
        <div className="note-pad dim small">
          Пакеты ядер не найдены. Положите папку <code>AVR-IDE-core-…</code> рядом с установщиком или в «Загрузки» либо укажите папку вручную.
        </div>
      )}
      {packs.map((p) => <Row key={p.key} p={p} busy={busy} mine={installing === p.key} />)}
      <div className="kit-actions">
        <button className="link-btn" onClick={() => void addFolder()}>Указать папку с пакетом…</button>
        <button className="link-btn" onClick={() => void refresh()} disabled={loading}>{loading ? 'Ищу…' : 'Обновить список'}</button>
      </div>
      <div className="note-pad dim small">Обновить установленные ядра можно обычным способом — кнопкой «Обновить» в списке выше (нужен интернет).</div>
    </div>
  )
}
