// «Вставить в скетч» — общее окно для конструктора ESPUI и веб-дизайнера: что будет создано и изменено, diff, подтверждение.
// Без host (конструктор открыт вне IDE) показывает инструкцию «как подключить вручную».
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { UiBuilderHost } from '../contracts'
import { PAGE_SPECS, diffHunks, includeLineOf, lineDiff, otherKind, planIntegration } from '../uibuilder/sketch/integrate'
import type { PageKind } from '../uibuilder/sketch/integrate'
import { Icon } from '../uibuilder/ui/icons'
import { CopyButton } from '../uibuilder/ui/Panels'
import { Dialog } from './kit'
import { savePageJson, usePageLink } from './pageLink'

export interface PageInsertIds {
  dialog: string
  confirm: string
  result: string
  replace: string
}

export function PageInsertDialog({ kind, host, header, json, errorCount, errorsSlot, ids, extraLibs, onClose }: {
  kind: PageKind
  host: UiBuilderHost | undefined
  /** Содержимое заголовка, которое будет записано. */
  header: string
  /** Содержимое файла страницы (ui.json / web_design.json). */
  json: string
  errorCount: number
  errorsSlot?: ReactNode
  ids: PageInsertIds
  /** Подсказка о нужных библиотеках (для режима без IDE). */
  extraLibs: string
  onClose: () => void
}): ReactNode {
  const spec = PAGE_SPECS[kind]
  const other = PAGE_SPECS[otherKind(kind)]
  const [replace, setReplace] = useState(false)
  const [saveJson, setSaveJson] = useState(true)
  const [busy, setBusy] = useState(false)
  const [armed, setArmed] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const plan = useMemo(() => (host ? planIntegration(host.sketchCode, kind, { replaceOther: replace }) : null), [host?.sketchCode, kind, replace]) // eslint-disable-line react-hooks/exhaustive-deps
  const diff = useMemo(() => (plan && host ? diffHunks(lineDiff(host.sketchCode, plan.code), 2) : []), [plan, host?.sketchCode]) // eslint-disable-line react-hooks/exhaustive-deps
  const conflict = plan?.conflict ?? (replace ? { with: otherKind(kind), message: '' } : undefined)

  useEffect(() => {
    const k = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const apply = async (): Promise<void> => {
    if (!host || !plan || plan.conflict) return
    setBusy(true)
    if (saveJson && !await savePageJson(host.sketchDir, kind, json)) {
      setBusy(false)
      setResult({ ok: false, text: `Не удалось записать ${spec.json}. Скетч и заголовок не изменены.` })
      return
    }
    const path = await host.writeFile(spec.header, header)
    if (!path) {
      setBusy(false)
      setResult({ ok: false, text: `Не удалось записать ${spec.header}. Сохраните скетч (папка должна существовать) и повторите.` })
      return
    }
    if (host.sketchDir !== usePageLink.getState().root) { setBusy(false); return }
    if (plan.changed) host.replaceSketchCode(plan.code)
    usePageLink.getState().patch(kind, { header, touched: true })
    setBusy(false)
    setResult({
      ok: true,
      text: plan.changed
        ? 'Готово: страница подключена. Сохраните скетч и нажмите «Загрузить» — дальше код страницы обновляется сам.'
        : 'Готово: код страницы обновлён. Скетч уже подключён — менять его не пришлось.'
    })
  }

  return (
    <div className="uib-modal-back pl-scope" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <Dialog className="uib-modal" testid={ids.dialog} onClose={onClose}
        title={<><Icon name="insert" size={18} /> Вставить страницу в скетч</>}
        footerStart={<CopyButton text={header} />}
        footer={<>
          <button className="uib-btn" onClick={onClose}>
            {result?.ok ? 'Закрыть' : 'Отмена'}
          </button>
          {host && plan && !result?.ok && plan.conflict && (
            <button className="uib-btn primary" data-testid={ids.replace} onClick={() => setReplace(true)}>
              Заменить {other.title} этой страницей
            </button>
          )}
          {host && plan && !result?.ok && !plan.conflict && (
            <button className={'uib-btn primary' + (errorCount > 0 ? ' danger' : '')} data-testid={ids.confirm} disabled={busy} onClick={() => { if (errorCount > 0 && plan.changed && !armed) { setArmed(true); return } void apply() }}>
              {busy ? 'Записываю…' : plan.changed ? (errorCount > 0 ? (armed ? 'Да, вставить с ошибками' : 'Вставить, несмотря на ошибки') : 'Подтвердить и вставить') : `Обновить ${spec.header}`}
            </button>
          )}
        </>}>
        <div className="uib-modal-body">
          {armed && errorCount > 0 && (
            <div className="uib-note err" data-testid="uib-insert-armed">
              <Icon name="warn" size={14} />
              <span>Вы уверены? В файл попадёт <code>#error</code>: скетч не соберётся, пока ошибки не исправлены. Нажмите «Да, вставить с ошибками» ещё раз или вернитесь и исправьте модель.</span>
            </div>
          )}
          {errorCount > 0 && (
            <div className="uib-insert-errors" onClickCapture={(e) => (e.target as HTMLElement).closest('button') && setTimeout(onClose, 0)}>
              <div className="uib-note err">
                <Icon name="error" size={14} />
                <span>Ошибок в странице: {errorCount}. С ними скетч не соберётся — исправьте:</span>
              </div>
              {errorsSlot}
            </div>
          )}

          {host && plan ? (
            <>
              {plan.conflict && (
                <div className="uib-note err" data-testid="pl-conflict">
                  <Icon name="warn" size={14} />
                  <span>{plan.conflict.message}</span>
                </div>
              )}
              <p className="pl-summary">
                {!host.sketchDir ? <>Скетч ещё не сохранён: <b>сначала сохраните его</b>, чтобы файлам было куда лечь.</>
                  : plan.changed ? 'Подключим страницу к скетчу: запишем её код рядом со скетчем и добавим в скетч несколько строк.'
                  : plan.conflict ? null
                  : 'Скетч уже подключён — обновим только код страницы.'}
              </p>
              {plan.warnings.filter((w) => w !== plan.conflict?.message).map((w, i) => (
                <div key={i} className="uib-note warn">
                  <Icon name="warn" size={14} />
                  <span>{w}</span>
                </div>
              ))}
              <details className="uib-more-details">
                <summary>Подробности и изменения в скетче</summary>
                <ul className="uib-todo">
                  <li>
                    <Icon name="doc" size={14} /> <span>{host.sketchDir ? <>В папку скетча запишется <code>{spec.header}</code>{saveJson && <> и <code>{spec.json}</code> (по нему код обновляется сам)</>}.</> : <>Скетч ещё не сохранён: <b>сначала сохраните его</b>, чтобы файлам было куда лечь.</>}</span>
                  </li>
                  {plan.changes.map((c, i) => (
                    <li key={i}>
                      <Icon name="code" size={14} /> {c}
                    </li>
                  ))}
                  {plan.already.map((c, i) => (
                    <li key={`a${i}`} className="done">
                      <Icon name="ok" size={14} /> {c}
                    </li>
                  ))}
                </ul>
                <label className="uib-check">
                  <input type="checkbox" checked={saveJson} onChange={(e) => setSaveJson(e.target.checked)} />
                  <span>Сохранить также {spec.json}</span>
                </label>
                {plan.changed ? (
                  <pre className="uib-diff">
                    {diff.map((l, i) =>
                      l.kind === 'gap' ? (
                        <div key={i} className="gap">⋯ {l.count} строк без изменений ⋯</div>
                      ) : (
                        <div key={i} className={l.kind}>
                          <span className="sg">{l.kind === 'add' ? '+' : l.kind === 'del' ? '−' : ' '}</span>
                          {l.text || ' '}
                        </div>
                      )
                    )}
                  </pre>
                ) : plan.conflict ? (
                  <p className="uib-hint">Скетч пока не менялся: выберите, какая страница останется.</p>
                ) : (
                  <p className="uib-hint">Скетч менять не нужно — всё уже на месте.</p>
                )}
                <p className="uib-hint">{extraLibs}</p>
              </details>
              {conflict && replace && <p className="uib-hint">Подключение {other.title} будет убрано из скетча; файлы {other.header} и {other.json} останутся в папке.</p>}
            </>
          ) : (
            <>
              <h3>Как подключить вручную</h3>
              <ol className="uib-howto">
                <li>
                  Нажмите «Копировать код» и сохраните его в файл <code>{spec.header}</code> в папке вашего скетча (рядом с .ino).
                </li>
                <li>
                  В скетче <b>после объявления ваших переменных</b>, но до <code>setup()</code>, добавьте: <code>{includeLineOf(kind)}</code>
                </li>
                <li>
                  В конец <code>setup()</code> добавьте <code>{spec.setupCall}();</code>, а в <code>loop()</code> — <code>{spec.loopCall}();</code>
                </li>
                <li>Соберите и загрузите скетч. Адрес страницы появится в мониторе порта.</li>
              </ol>
              <p className="uib-hint">{extraLibs} Переменные скетча использовать можно — главное, чтобы include стоял ниже их объявления.</p>
            </>
          )}
          {result && (
            <div className={`uib-note ${result.ok ? 'ok' : 'err'}`} data-testid={ids.result}>
              <Icon name={result.ok ? 'ok' : 'error'} size={14} />
              <span>{result.text}</span>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  )
}
