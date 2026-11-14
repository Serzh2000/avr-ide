import { useCallback, useEffect, useState } from 'react'
import type { PortInfo } from '../../../main/cli/types'
import { BOARD_PRESETS } from './boards'
import type { BuildState } from './useBuild'

interface Props {
  b: BuildState
  fqbn: string
  setFqbn: (v: string) => void
  port: string
  setPort: (v: string) => void
  onVerify: () => void
  onUpload: () => void
}

export default function BuildToolbar({ b, fqbn, setFqbn, port, setPort, onVerify, onUpload }: Props) {
  const [ports, setPorts] = useState<PortInfo[]>([])
  const found = b.status?.found

  const refresh = useCallback(async () => {
    const r = await window.api.cli.boards()
    if (r.ok) {
      setPorts(r.data)
      if (r.data.length && !r.data.some((p) => p.address === port)) setPort(r.data[0].address)
    } else if (!r.notFound) b.append(`error: ${r.error}\n`)
  }, [port, setPort, b])

  useEffect(() => { if (found) void refresh() }, [found]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <span className="sep" />
      <select value={fqbn} onChange={(e) => setFqbn(e.target.value)} title="Плата">
        {BOARD_PRESETS.map((p) => <option key={p.fqbn} value={p.fqbn}>{p.name}</option>)}
      </select>
      <select value={port} onChange={(e) => setPort(e.target.value)} title="Порт">
        {ports.length === 0 && <option value="">нет портов</option>}
        {ports.map((p) => (
          <option key={p.address} value={p.address}>
            {p.address}{p.boards[0] ? ` (${p.boards[0].name})` : ''}
          </option>
        ))}
      </select>
      <button onClick={refresh} disabled={!found} title="Обновить список портов">↻</button>
      <button onClick={onVerify} disabled={b.busy || !found}>Verify</button>
      <button onClick={onUpload} disabled={b.busy || !found || !port}>Upload</button>
      <button onClick={b.cancel} disabled={!b.busy}>Cancel</button>
      {b.status && !found && <span className="warn-text" title={b.status.help}>arduino-cli не найден</span>}
    </>
  )
}
