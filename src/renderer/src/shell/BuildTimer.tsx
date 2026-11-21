// Таймер «Сборка идёт 0:42», пояснение про первую сборку и крупная кнопка «Остановить».
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useBuild } from '../build/useBuild'
import { useProStore } from '../pro/proStore'
import { FIRST_BUILD_HINT, fmtElapsed, isLongFirstBuild } from './buildTime'
import { Icon } from './icons'
import { Button, Spinner } from './kit'

/** Сколько секунд идёт текущая операция (0, если ничего не идёт). Обновляется раз в секунду. */
export function useElapsed(): number {
  const startedAt = useBuild((s) => s.startedAt)
  const [, tick] = useState(0)
  useEffect(() => {
    if (!startedAt) return
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [startedAt])
  return startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0
}

/** Короткая подпись для строки состояния: «0:42». */
export function ElapsedText(): ReactNode {
  const sec = useElapsed()
  return <>{fmtElapsed(sec)}</>
}

/** Плашка над журналом во время сборки или загрузки. */
export function BuildBanner(): ReactNode {
  const busy = useBuild((s) => s.busy)
  const kind = useBuild((s) => s.kind)
  const progress = useBuild((s) => s.progress)
  const cancel = useBuild((s) => s.cancel)
  const sec = useElapsed()
  const pro = useProStore((s) => s.proMode)
  if (!busy || (kind !== 'compile' && kind !== 'upload')) return null
  // Подсказка про «первую сборку ядра» относится к Arduino; у проекта STM32 ядра нет
  const long = !pro && isLongFirstBuild(sec, progress?.label)
  return (
    <div className="build-banner" data-testid="build-banner" role="status">
      <Spinner />
      <div className="grow">
        <div><b>{kind === 'upload' ? 'Сборка и загрузка идут' : 'Сборка идёт'} {fmtElapsed(sec)}</b>{progress?.label ? ' · ' + progress.label : ''}</div>
        {long && <div className="dim small" data-testid="first-build-hint">{FIRST_BUILD_HINT}</div>}
      </div>
      <Button variant="danger" onClick={cancel} data-testid="build-stop"><Icon name="stop" size={13} fill /> Остановить</Button>
    </div>
  )
}
