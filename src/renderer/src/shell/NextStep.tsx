// Кнопка «Дальше: …» — всегда показывает следующий разумный шаг и выполняет его одним кликом.
import type { ReactNode } from 'react'
import { useBuild } from '../build/useBuild'
import { coreOf, isEspPlatform, platformOf } from '../build/boards'
import { baseFqbn, platformOfFqbn, portPolicy } from '../../../main/cli/fqbn'
import { defaultsOf, useBoardOptions } from '../build/boardOptions'
import { runBuild } from './commands'
import { Icon } from './icons'
import { Button } from './kit'
import { currentBuildResult, explainFailure, nextStep, samePort, uploadPortIssue } from './guide'
import type { GuideAction, NextStep } from './guide'
import { isDirty, useProject } from './project'
import { openPageProblem, requestConnect, unlinkedKind, usePageLink } from './pageLink'
import { useUi } from './ui'
import { useProStore } from '../pro/proStore'

/** Выполняет действие подсказки (общее для кнопки «Дальше» и баннеров с объяснением ошибок). */
export function runGuide(a: GuideAction): void {
  const ui = useUi.getState()
  switch (a) {
    case 'cli': case 'cores': ui.set({ sideVisible: true, sideView: 'boards' }); break
    case 'libs': ui.set({ sideVisible: true, sideView: 'libs' }); break
    case 'pickBoard': ui.setPicker('board'); break
    case 'pickPort': ui.setPicker('port'); break
    case 'verify': void runBuild(false); break
    case 'upload': void runBuild(true); break
    case 'monitor': ui.showBottom('monitor'); break
    case 'problems': ui.showBottom('problems'); break
    case 'output': ui.showBottom('output'); break
    case 'linkUi': requestConnect('ui'); break
    case 'linkWeb': requestConnect('web'); break
    case 'openUi': openPageProblem('ui'); break
    case 'openWeb': openPageProblem('web'); break
  }
}

export function useNextStep(): NextStep | null {
  const found = useBuild((s) => s.status?.found)
  const busy = useBuild((s) => s.busy)
  const busyKind = useBuild((s) => s.kind)
  const result = useCurrentBuildResult()
  const problems = useBuild((s) => s.problems)
  const cores = useBuild((s) => s.cores)
  const ports = useBuild((s) => s.ports)
  const fqbn = useUi((s) => s.fqbn)
  const port = useUi((s) => s.port)
  const details = useBoardOptions((s) => s.byBoard[baseFqbn(fqbn)])
  const link = usePageLink((s) => unlinkedKind(s))
  const dirty = useProject((s) => Object.values(s.docs).some(isDirty))
  const coreMissing = !!fqbn && !!cores && !cores.some((c) => c.id === coreOf(fqbn))
  const policy = portPolicy(fqbn, defaultsOf(details?.state === 'ok' ? details.data : undefined))
  const portIssue = fqbn ? uploadPortIssue(fqbn, policy, port, ports) : null
  const monitorReady = result?.source ? ports.some((p) => samePort(p.address, port) && p.protocol === 'serial') : undefined
  return nextStep({
    found, busy, busyKind, fqbn, coreMissing, portProblem: !!portIssue, dirty, portIssue, monitorReady,
    bootsel: policy === 'optional' && !port && platformOfFqbn(fqbn) === 'rp2040',
    pageUnlinked: isEspPlatform(platformOf(fqbn)) ? link : null,
    result: result ? { kind: result.kind, ok: result.ok, cancelled: result.cancelled } : null,
    errors: problems.filter((p) => p.severity === 'error').length
  })
}

export function useCurrentBuildResult() {
  const result = useBuild((s) => s.result)
  const root = useProject((s) => s.root)
  const revision = useProject((s) => s.buildRevision)
  const fqbn = useUi((s) => s.fqbn)
  return currentBuildResult(result, root, fqbn, revision)
}

export default function NextStepButton({ className }: { className: string }): ReactNode {
  const step = useNextStep()
  if (!step) return null
  return (
    <button className={className} data-testid="next-step" title={step.title} onClick={() => runGuide(step.action)}>
      <span className="ns-label">Дальше:</span> <b>{step.text}</b> <Icon name="arrow" size={13} />
    </button>
  )
}

/** Баннер «что случилось и как исправить» после неудачной сборки или загрузки. */
export function FailHint(): ReactNode {
  const result = useCurrentBuildResult()
  const problems = useBuild((s) => s.problems)
  const log = useBuild((s) => s.log)
  const pro = useProStore((s) => s.proMode)
  // Подсказки про библиотеки и платы Arduino не относятся к проекту STM32
  if (pro || !result || result.ok || result.cancelled) return null
  const ex = explainFailure(problems.filter((p) => p.severity === 'error').map((p) => p.message), log)
  if (!ex) return null
  return (
    <div className="fail-hint" data-testid="fail-hint" role="status">
      <Icon name="info" size={16} />
      <span className="grow">{ex.text}</span>
      <Button size="sm" onClick={() => runGuide(ex.action)}>{ex.button}</Button>
    </div>
  )
}
