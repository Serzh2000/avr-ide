// Баннер «Проблемы с библиотеками»: конфликты («найдено несколько библиотек») и несовместимые архитектуры — по выводу сборки.
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useBuild } from '../build/useBuild'
import { Icon } from './icons'
import { Button } from './kit'
import { libConflictBanner } from './libConflicts'
import { useProject } from './project'
import { useUi } from './ui'

export function LibDiagBanner(): ReactNode {
  const result = useBuild((s) => s.result)
  const log = useBuild((s) => s.log)
  const root = useProject((s) => s.root)
  // Разбираем журнал только после неудачной сборки: при успехе предупреждения библиотек шумом не показываем
  const banner = useMemo(() => (result && !result.ok && !result.cancelled ? libConflictBanner(log, root ?? undefined) : null), [result, log, root])
  if (!banner) return null
  const reveal = (p: string) => (): void => { void window.api.app.revealPath(p) }
  const openLibs = (): void => useUi.getState().set({ sideVisible: true, sideView: 'libs' })
  return (
    <div className="stack lib-diag" data-testid="lib-diag" role="status">
      <div className="card warn">
        <div className="card-title"><Icon name="warn" size={16} /> {banner.title}</div>
        <p className="small">{banner.text}</p>
        {banner.folders.map((p) => <div className="lib-path" key={p}><code title={p}>{p}</code><Button size="sm" onClick={reveal(p)}>Открыть папку</Button></div>)}
        <p className="small dim">Мы ничего не удаляем сами: уберите лишнюю копию вручную.</p>
        <div className="card-actions"><Button size="sm" onClick={openLibs}>Библиотеки: обновить или удалить</Button></div>
      </div>
    </div>
  )
}
