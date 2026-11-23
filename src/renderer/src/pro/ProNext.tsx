// Кнопка «Дальше: …» в строке состояния Pro-режима.
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../shell/icons'
import { useBuild } from '../build/useBuild'
import { useUi } from '../shell/ui'
import { useProBuild } from './buildStore'
import { openBottom, useHw } from './hwStore'
import { proNextStep } from './proGuide'
import type { ProGuideAction } from './proGuide'
import { runProAction, useProStore } from './proStore'

function run(a: ProGuideAction): void {
  if (a === 'hw') openBottom('hw')
  else if (a === 'output') useUi.getState().showBottom('output')
  else if (a === 'debug') {
    const st = useHw.getState().debug.status
    if (st === 'off') void runProAction('debug')
    else openBottom('debug')
  } else void runProAction(a)
}

export default function ProNext({ className }: { className: string }): ReactNode {
  const project = useProStore((s) => s.project)
  const config = useProStore((s) => s.config)
  const building = useBuild((s) => s.busy && s.kind === 'compile')
  const lastBuild = useProBuild((s) => s.last)
  const { probes, probesLoaded, tools, flash, debug, kind, prefs } = useHw()
  const [artifact, setArtifact] = useState<{ project: typeof project; config: string; lastBuild: typeof lastBuild; found: boolean } | null>(null)
  useEffect(() => {
    if (!project) return
    let alive = true
    const tick = (): void => {
      void window.api.pro.targetInfo(config).then((r) => {
        if (alive) setArtifact({ project, config, lastBuild, found: r.ok && !!r.data.elf })
      }, () => {
        if (alive) setArtifact({ project, config, lastBuild, found: false })
      })
    }
    tick()
    const t = setInterval(tick, 4000)
    return () => { alive = false; clearInterval(t) }
  }, [project, config, lastBuild])
  const hasElf = artifact?.project === project && artifact.config === config && artifact.lastBuild === lastBuild && artifact.found
  const step = proNextStep({
    hasProject: !!project, programmer: kind, openocd: tools ? !!tools.openocd : null, probesLoaded, probeCount: probes.filter((p) => p.kind === kind).length,
    driverMissing: (() => { const mine = probes.filter((p) => p.kind === kind); return (mine.find((p) => p.id === prefs.probeId) ?? mine[0])?.driver === 'missing' })(), hasElf, building, flashed: flash.status === 'ok', flashBusy: flash.status === 'running', debug: debug.status
  })
  if (!step) return null
  return (
    <button className={className} data-testid="pro-next-step" data-action={step.action} title={step.title} onClick={() => run(step.action)}>
      <span className="ns-label">Дальше:</span> <b>{step.text}</b> <Icon name="arrow" size={13} />
    </button>
  )
}
