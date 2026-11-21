// Выбор COM-порта для «Монитора порта» в Pro-режиме (в Arduino-режиме порт выбирается в шапке). Скорость и запуск — в самом мониторе.
// Монитор работает через arduino-cli (общий с режимом Arduino поток данных monitorStore).
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../shell/icons'
import { Select } from '../shell/kit'
import { useUi } from '../shell/ui'
import { useBuild } from '../build/useBuild'
import { useMonitor } from '../build/monitorStore'
import { useHw } from './hwStore'

export default function ProPortBar(): ReactNode {
  const port = useUi((s) => s.port)
  const setPort = useUi((s) => s.set)
  const ports = useBuild((s) => s.ports)
  const found = useBuild((s) => s.status?.found)
  const running = useMonitor((s) => s.running)
  const probes = useHw((s) => s.probes)
  useEffect(() => { void useBuild.getState().refreshPorts() }, [])
  const vcp = probes.some((p) => p.vcp)
  return (
    <div className="panel-actions pro-portbar" data-testid="pro-portbar">
      <label className="inline-field">Порт
        <Select className="small" value={port} disabled={running} data-testid="pro-port-select" onChange={(e) => setPort({ port: e.target.value })} title="COM-порт, на который плата отправляет текст (UART). На Nucleo это виртуальный COM-порт ST-Link">
          <option value="">— выберите порт —</option>
          {ports.map((p) => <option key={p.address} value={p.address}>{p.address}{p.label ? ` · ${p.label}` : ''}</option>)}
          {port && !ports.some((p) => p.address === port) && <option value={port}>{port}</option>}
        </Select>
      </label>
      <button className="icon-btn" title="Обновить список портов" aria-label="Обновить список портов" onClick={() => void useBuild.getState().refreshPorts()}><Icon name="refresh" size={14} /></button>
      {found === false && <span className="dim">Для монитора нужен arduino-cli (ставится в режиме Arduino).</span>}
      {found !== false && vcp && !port && <span className="dim">У ST-Link есть виртуальный COM-порт: выберите «STMicroelectronics STLink Virtual COM Port».</span>}
    </div>
  )
}
