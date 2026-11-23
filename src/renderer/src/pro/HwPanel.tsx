// Состояния прошивки и установка OpenOCD для мастера и отладчика.
import type { ReactNode } from 'react'
import { Icon } from '../shell/icons'
import { Button } from '../shell/kit'
import { useUi } from '../shell/ui'
import { useProStore } from './proStore'
import { useHw } from './hwStore'
import { KIND_TEXTS } from '../../../shared/pro/programmers'
import type { FlashError } from '../../../main/pro/openocd/logParse'
import './hw.css'

const mb = (n: number): string => (n / 1048576).toFixed(1).replace('.', ',') + ' МБ'

export const TOOL_SOURCE: Record<string, string> = { env: 'переменная окружения', custom: 'указано вручную', ide: 'установлено через IDE', cubeide: 'из STM32CubeIDE', xpack: 'xPack', path: 'из PATH' }

export function ErrorCard({ e, onRetry }: { e: FlashError; onRetry?: () => void }): ReactNode {
  const act = useHw.getState()
  const kind = act.kind
  const main = e.kind === 'no-openocd' ? { label: 'Установить OpenOCD', run: () => { useUi.getState().showBottom('hw'); void act.planInstall() } }
    : e.kind === 'no-probe' || e.kind === 'no-driver' ? { label: 'Проверить программатор снова', run: () => void act.refreshProbes() }
    : e.kind === 'read-protected' ? { label: 'Стереть всю память…', run: () => void act.eraseAll(useProStore.getState().config) }
    : onRetry ? { label: 'Повторить', run: onRetry } : null
  return (
    <div className="hw-card err" role="alert" data-testid="hw-error" data-kind={e.kind}>
      <div className="hw-card-title"><Icon name="error" size={15} /> {e.title}</div>
      <p className="hw-card-text">{e.hint}</p>
      {e.kind === 'no-driver' && (
        <ol className="hw-steps" data-testid="hw-driver-steps">
          {KIND_TEXTS[kind].driverSteps.map((s) => <li key={s}>{s}</li>)}
        </ol>
      )}
      {main && <div className="hw-card-actions"><Button variant="primary" size="sm" onClick={main.run} data-testid="hw-error-action">{main.label}</Button></div>}
    </div>
  )
}

export function InstallCard(): ReactNode {
  const ins = useHw((s) => s.install)
  const planInstall = useHw((s) => s.planInstall)
  const cancel = useHw((s) => s.cancelInstall)
  const confirm = useHw((s) => s.confirmInstall)
  if (ins.status === 'planning') return <div className="hw-card" data-testid="hw-install-planning"><div className="hw-card-title">Проверяю, что будет скачано…</div></div>
  if (ins.status === 'confirm' && ins.plan) {
    const p = ins.plan
    return (
      <div className="hw-card" data-testid="hw-install-confirm-card">
        <div className="hw-card-title"><Icon name="download" size={15} /> Установить OpenOCD?</div>
        <dl className="hw-kv">
          <dt>Файл</dt><dd>{p.file}</dd>
          <dt>Размер</dt><dd>{mb(p.size)}</dd>
          <dt>Источник</dt><dd>{p.source}</dd>
          <dt>Лицензия</dt><dd>{p.license}</dd>
          <dt>SHA-256</dt><dd className="mono">{p.sha256.slice(0, 16)}…{p.sha256.slice(-8)}</dd>
        </dl>
        <p className="hw-card-text">Архив скачивается в папку данных приложения, сверяется с контрольной суммой и распаковывается. Больше ничего не устанавливается.</p>
        <div className="hw-card-actions">
          <Button variant="primary" size="sm" onClick={() => void confirm()} data-testid="hw-install-confirm">Скачать и установить</Button>
          <Button size="sm" onClick={cancel}>Отмена</Button>
        </div>
      </div>
    )
  }
  if (ins.status === 'running') {
    const f = ins.total ? Math.min(1, (ins.done ?? 0) / ins.total) : 0
    return (
      <div className="hw-card" data-testid="hw-install-running">
        <div className="hw-card-title">Установка OpenOCD: {Math.round(f * 100)}%</div>
        <div className="hw-bar"><i style={{ width: f * 100 + '%' }} /></div>
      </div>
    )
  }
  if (ins.status === 'error') return <ErrorCard e={{ kind: 'unknown', title: 'Не удалось установить OpenOCD', hint: ins.error ?? '' }} onRetry={() => void planInstall()} />
  return null
}
