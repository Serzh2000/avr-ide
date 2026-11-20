import type { ReactNode } from 'react'
import { serializeUiPage } from '../../shell/pageGen'
import { useUiBuilder } from '../store'
import { PageInsertDialog } from '../../shell/PageInsertDialog'
import { useBuilder } from './ctx'
import { IssueRow } from './Issues'

/** «Вставить в скетч» для ESPUI: общее окно (shell/PageInsertDialog) с данными этого конструктора. */
export function InsertDialog({ onClose }: { onClose: () => void }): ReactNode {
  const ctx = useBuilder()
  const project = useUiBuilder((s) => s.project)
  const errs = ctx.issues.filter((i) => i.severity === 'error')
  return (
    <PageInsertDialog
      kind="ui"
      host={ctx.host}
      header={ctx.code}
      json={serializeUiPage(project, ctx.ledcApi)}
      errorCount={errs.length}
      errorsSlot={errs.slice(0, 4).map((i, n) => <IssueRow key={n} issue={i} />)}
      ids={{ dialog: 'uib-insert-dialog', confirm: 'uib-insert-confirm', result: 'uib-insert-result', replace: 'uib-insert-replace' }}
      extraLibs={`Нужны библиотеки: ESPUI, ESPAsyncWebServer и ${ctx.code.includes('ESPAsyncTCP') ? 'ESPAsyncTCP' : 'AsyncTCP'}.`}
      onClose={onClose}
    />
  )
}
