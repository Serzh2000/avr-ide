import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { serializeProject } from '../core/index'
import { diffHunks, lineDiff, planIntegration } from '../sketch/integrate'
import { useUiBuilder } from '../store'
import { Icon } from './icons'
import { useBuilder } from './ctx'
import { CopyButton } from './Panels'
import { IssueRow } from './Issues'

/** «Вставить в скетч»: что будет создано и изменено, diff, подтверждение. Без host — инструкция и копирование. */
export function InsertDialog({ onClose }: { onClose: () => void }): ReactNode {
  const ctx = useBuilder()
  const host = ctx.host
  const project = useUiBuilder((s) => s.project)
  const errs = ctx.issues.filter((i) => i.severity === 'error')
  const plan = useMemo(() => (host ? planIntegration(host.sketchCode) : null), [host?.sketchCode]) // eslint-disable-line react-hooks/exhaustive-deps
  const diff = useMemo(() => (plan && host ? diffHunks(lineDiff(host.sketchCode, plan.code), 2) : []), [plan, host?.sketchCode]) // eslint-disable-line react-hooks/exhaustive-deps
  const [saveJson, setSaveJson] = useState(true)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    const k = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const apply = async (): Promise<void> => {
    if (!host || !plan) return
    setBusy(true)
    const path = await host.writeFile('ui_generated.h', ctx.code)
    if (!path) {
      setBusy(false)
      setResult({ ok: false, text: 'Не удалось записать ui_generated.h. Сохраните скетч (папка должна существовать) и повторите.' })
      return
    }
    if (saveJson) await host.writeFile('ui.json', serializeProject(project))
    if (plan.changed) host.replaceSketchCode(plan.code)
    setBusy(false)
    setResult({
      ok: true,
      text: plan.changed
        ? `Готово: ui_generated.h записан (${path}), в скетч добавлены строки. Не забудьте сохранить скетч и нажать «Проверить/Загрузить».`
        : `Готово: ui_generated.h обновлён (${path}). Скетч уже подключён — менять его не пришлось.`
    })
  }

  return (
    <div className="uib-modal-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="uib-modal" role="dialog" aria-modal="true" aria-labelledby="uib-ins-title">
        <header>
          <h2 id="uib-ins-title">
            <Icon name="insert" size={18} /> Вставить страницу в скетч
          </h2>
          <button className="uib-icon-btn" onClick={onClose} aria-label="Закрыть">
            <Icon name="close" size={16} />
          </button>
        </header>
        <div className="uib-modal-body">
          {errs.length > 0 && (
            <div className="uib-insert-errors" onClickCapture={(e) => (e.target as HTMLElement).closest('button') && setTimeout(onClose, 0)}>
              <div className="uib-note err">
                <Icon name="error" size={14} />
                <span>В модели {errs.length} ошибок — в файле будет <code>#error</code>, скетч не соберётся. Исправьте их:</span>
              </div>
              {errs.slice(0, 4).map((i, n) => (
                <IssueRow key={n} issue={i} />
              ))}
            </div>
          )}

          {host && plan ? (
            <>
              <h3>Что будет сделано</h3>
              <ul className="uib-todo">
                <li>
                  <Icon name="doc" size={14} /> {host.sketchDir ? <>В папке скетча будет записан <code>ui_generated.h</code> (если он есть — заменится).</> : <>Скетч ещё не сохранён: <b>сначала сохраните его</b>, чтобы файлу было куда лечь.</>}
                </li>
                {saveJson && (
                  <li>
                    <Icon name="doc" size={14} /> Рядом сохранится <code>ui.json</code> — ваша страница для дальнейшего редактирования.
                  </li>
                )}
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
              {plan.warnings.map((w, i) => (
                <div key={i} className="uib-note warn">
                  <Icon name="warn" size={14} />
                  <span>{w}</span>
                </div>
              ))}
              <label className="uib-check">
                <input type="checkbox" checked={saveJson} onChange={(e) => setSaveJson(e.target.checked)} />
                <span>Сохранить также ui.json</span>
              </label>
              <h3>Изменения в скетче</h3>
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
              ) : (
                <p className="uib-hint">Скетч менять не нужно — всё уже на месте.</p>
              )}
            </>
          ) : (
            <>
              <h3>Как подключить вручную</h3>
              <ol className="uib-howto">
                <li>
                  Нажмите «Копировать код» и сохраните его в файл <code>ui_generated.h</code> в папке вашего скетча (рядом с .ino).
                </li>
                <li>
                  В скетче <b>после объявления ваших переменных</b>, но до <code>setup()</code>, добавьте: <code>#include "ui_generated.h"</code>
                </li>
                <li>
                  В конец <code>setup()</code> добавьте <code>ui_setup();</code>, а в <code>loop()</code> — <code>ui_loop();</code>
                </li>
                <li>Соберите и загрузите скетч. Адрес страницы появится в мониторе порта.</li>
              </ol>
              <p className="uib-hint">Нужны библиотеки: ESPUI, ESPAsyncWebServer и {ctx.code.includes('ESPAsyncTCP') ? 'ESPAsyncTCP' : 'AsyncTCP'}. Переменные скетча использовать можно — главное, чтобы include стоял ниже их объявления.</p>
            </>
          )}
          {result && (
            <div className={`uib-note ${result.ok ? 'ok' : 'err'}`} data-testid="uib-insert-result">
              <Icon name={result.ok ? 'ok' : 'error'} size={14} />
              <span>{result.text}</span>
            </div>
          )}
        </div>
        <footer>
          <CopyButton text={ctx.code} />
          <div className="uib-spacer" />
          <button className="uib-btn" onClick={onClose}>
            {result?.ok ? 'Закрыть' : 'Отмена'}
          </button>
          {host && plan && !result?.ok && (
            <button className="uib-btn primary" data-testid="uib-insert-confirm" disabled={busy || !host.sketchDir && false} onClick={apply}>
              {busy ? 'Записываю…' : plan.changed ? 'Подтвердить и вставить' : 'Обновить ui_generated.h'}
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
