// Строка состояния «страница ↔ скетч» для полосы контекста конструкторов.
import type { ReactNode } from 'react'
import type { PageKind } from '../uibuilder/sketch/integrate'
import { checkPage } from './commands'
import { Icon } from './icons'
import { pageLinkState } from './pageGen'
import { usePageLink } from './pageLink'

const SHORT = { off: 'Не подключено', ok: 'Подключено', stale: 'Код устарел' } as const
const TEXT = {
  off: 'Не подключено к скетчу',
  ok: 'Подключено, код актуален',
  stale: 'Подключено, код устарел'
} as const

export function PageLinkChip({ kind, connected, liveHeader, onConnect, onUpdate, testid }: {
  kind: PageKind
  /** Заголовок подключён в тексте скетча (по живому тексту редактора). */
  connected: boolean
  /** Заголовок, который получится из страницы прямо сейчас. */
  liveHeader: string | null
  onConnect: () => void
  onUpdate: () => void
  testid: string
}): ReactNode {
  const disk = usePageLink((s) => s[kind].header)
  const st = pageLinkState(connected, disk, liveHeader)
  return (
    <span className={`pl-chip ${st}`} data-testid={testid} data-state={st}>
      <Icon name={st === 'ok' ? 'check' : st === 'stale' ? 'refresh' : 'plug'} size={13} />
      <span className="pl-chip-t" title={st === 'off' ? 'Страница ещё не добавлена в скетч: нажмите «Подключить»' : st === 'stale' ? 'Сгенерированный файл отличается от страницы: он обновится сам перед «Проверить»/«Загрузить» или по кнопке' : 'Файл страницы совпадает с тем, что в конструкторе'}><span className="pl-t-full">{TEXT[st]}</span><span className="pl-t-short">{SHORT[st]}</span></span>
      {st === 'off' && <button className="pl-chip-btn" data-testid={`${testid}-connect`} onClick={onConnect}>Подключить</button>}
      {st === 'stale' && <button className="pl-chip-btn" data-testid={`${testid}-update`} onClick={onUpdate}>Обновить</button>}
      {st !== 'off' && <button className="pl-chip-btn pl-check" data-testid={`${testid}-check`} onClick={() => void checkPage(kind)} title="Собрать скетч вместе со страницей (плата не нужна) и показать ошибки в «Проблемах»">Проверить страницу</button>}
    </span>
  )
}
