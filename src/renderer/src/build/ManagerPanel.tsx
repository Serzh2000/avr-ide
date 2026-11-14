import { useCallback, useEffect, useState } from 'react'
import type { CoreInfo, LibInfo } from '../../../main/cli/types'
import type { BuildState } from './useBuild'

/** Простой менеджер ядер и библиотек. Прогресс установки идёт в нижнюю панель «Вывод». */
export default function ManagerPanel({ b, onShowLog }: { b: BuildState; onShowLog: () => void }) {
  const [mode, setMode] = useState<'core' | 'lib'>('core')
  const [q, setQ] = useState('')
  const [cores, setCores] = useState<CoreInfo[]>([])
  const [libs, setLibs] = useState<LibInfo[]>([])
  const [installedCores, setInstalledCores] = useState<Record<string, string>>({})
  const [installedLibs, setInstalledLibs] = useState<Record<string, string>>({})
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const refreshInstalled = useCallback(async () => {
    if (!b.status?.found) return
    const [c, l] = await Promise.all([window.api.cli.cores(), window.api.cli.installedLibs()])
    if (c.ok) setInstalledCores(Object.fromEntries(c.data.map((x) => [x.id, x.installed ?? ''])))
    if (l.ok) setInstalledLibs(Object.fromEntries(l.data.map((x) => [x.name, x.version ?? ''])))
  }, [b.status?.found])

  useEffect(() => { void refreshInstalled() }, [refreshInstalled, b.lastDone])

  const search = async (): Promise<void> => {
    setErr(''); setLoading(true)
    if (mode === 'core') {
      const r = await window.api.cli.searchCores(q)
      if (r.ok) setCores(r.data); else setErr(r.error)
    } else {
      const r = await window.api.cli.searchLibs(q)
      if (r.ok) setLibs(r.data); else setErr(r.error)
    }
    setLoading(false)
  }

  const install = async (kind: 'core' | 'lib', id: string): Promise<void> => {
    onShowLog()
    await b.run(kind === 'core' ? window.api.cli.installCore(id) : window.api.cli.installLib(id))
  }

  if (b.status && !b.status.found) return <div className="panel-body"><pre className="log"><div className="ln error">{b.status.help}</div></pre></div>

  return (
    <div className="panel-body">
      <div className="panel-actions">
        <select value={mode} onChange={(e) => setMode(e.target.value as 'core' | 'lib')}>
          <option value="core">Ядра (платформы)</option>
          <option value="lib">Библиотеки</option>
        </select>
        <input className="grow" value={q} placeholder={mode === 'core' ? 'esp32, avr… (пусто — все)' : 'Поиск библиотеки'}
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void search() }} />
        <button onClick={search} disabled={loading}>Найти</button>
        {mode === 'core' && <>
          <button disabled={b.busy} onClick={() => { onShowLog(); void b.run(window.api.cli.updateIndex()) }}>Обновить индекс</button>
          <button disabled={b.busy} title="Добавит в конфиг arduino-cli URL пакетов ESP8266 и ESP32 и обновит индекс"
            onClick={() => { onShowLog(); void b.run(window.api.cli.addEspUrls()) }}>Добавить ESP-URL</button>
        </>}
      </div>
      {err && <div className="ln error" style={{ padding: '4px 10px' }}>{err}</div>}
      <div className="list">
        {mode === 'core'
          ? (cores.length ? cores : Object.keys(installedCores).map((id) => ({ id, name: id, installed: installedCores[id] } as CoreInfo))).map((c) => (
            <div className="row" key={c.id}>
              <span className="grow"><b>{c.name}</b> <i>{c.id}</i> {installedCores[c.id] !== undefined ? `установлено ${installedCores[c.id]}` : c.latest ? `v${c.latest}` : ''}</span>
              <button disabled={b.busy} onClick={() => install('core', c.id)}>{installedCores[c.id] !== undefined ? 'Обновить' : 'Установить'}</button>
            </div>))
          : (libs.length ? libs : Object.keys(installedLibs).map((name) => ({ name, version: installedLibs[name] } as LibInfo))).map((l) => (
            <div className="row" key={l.name}>
              <span className="grow"><b>{l.name}</b> {installedLibs[l.name] !== undefined ? `установлена ${installedLibs[l.name]}` : l.latest ? `v${l.latest}` : ''}<br /><small>{l.sentence}</small></span>
              <button disabled={b.busy} onClick={() => install('lib', l.name)}>{installedLibs[l.name] !== undefined ? 'Обновить' : 'Установить'}</button>
            </div>))}
      </div>
    </div>
  )
}
