// Кнопка «Дальше: …» в строке состояния Pro-режима.
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../shell/icons'
import { useUi } from '../shell/ui'
import { openBottom, useHw } from './hwStore'
import { proNextStep } from './proGuide'
import type { ProGuideAction } from './proGuide'
import { runProAction, useProStore } from './proStore'

function run(a: ProGuideAction): void {
  const ui = useUi.getState()
  if (a === 'hw') openBottom('hw')
  else if (a === 'debug' || a === 'debugHelp') {
    const st = useHw.getState().debug.status
    if (st === 'off') void runProAction('debug')
    else openBottom('debug')
  } else void runProAction(a)
}

export default function ProNext({ className }: { className: string }): ReactNode {
  const project = useProStore((s) => s.project)
  const config = useProStore((s) => s.config)
  const { probes, probesLoaded, tools, flash, debug, kind, prefs } = useHw()
  const [hasElf, setHasElf] = useState(false)
  useEffect(() => {
    if (!project) return
    let alive = true
    const tick = (): void => { void window.api.pro.targetInfo(config).then((r) => { if (alive && r.ok) setHasElf(!!r.data.elf) }) }
    tick()
    const t = setInterval(tick, 4000)
    return () => { alive = false; clearInterval(t) }
  }, [project, config])
  const step = proNextStep({
    hasProject: !!project, programmer: kind, openocd: tools ? !!tools.openocd : null, probesLoaded, probeCount: probes.filter((p) => p.kind === kind).length,
    driverMissing: (() => { const mine = probes.filter((p) => p.kind === kind); return (mine.find((p) => p.id === prefs.probeId) ?? mine[0])?.driver === 'missing' })(), hasElf, flashed: flash.status === 'ok', flashBusy: flash.status === 'running', debug: debug.status
  })
  if (!step) return null
  return (
    <button className={className} data-testid="pro-next-step" data-action={step.action} title={step.title} onClick={() => run(step.action)}>
      <span className="ns-label">Дальше:</span> <b>{step.text}</b> <Icon name="arrow" size={13} />
    </button>
  )
}
