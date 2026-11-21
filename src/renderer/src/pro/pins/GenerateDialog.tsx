// «Сгенерировать код»: что будет создано и изменено (файлы, сохранённые блоки USER CODE, предупреждения), diff для main.c и подтверждение.
// Тот же порядок, что у «Вставить в скетч»: сначала показываем всё, пишем только после подтверждения.
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { PinsPlanDto } from '../../../../main/pro/pinconfig/ipc'
import { planMainInsert } from '../../../../shared/pro/pinconfig/gen/index'
import { hasErrors } from '../../../../shared/pro/pinconfig/validate'
import { diffHunks, lineDiff } from '../../uibuilder/sketch/integrate'
import { Button, Chip, Dialog } from '../../shell/kit'
import { Icon } from '../../shell/icons'
import { useProject } from '../../shell/project'
import { useUi } from '../../shell/ui'
import { findNode } from '../ProProjectPanel'
import { usePins } from './pinsStore'

const STATUS: Record<string, { text: string; tone?: 'ok' | 'warn' | 'accent' }> = { new: { text: 'новый', tone: 'ok' }, changed: { text: 'обновится', tone: 'accent' }, same: { text: 'без изменений' } }

export default function GenerateDialog({ onClose }: { onClose: () => void }): ReactNode {
  const cfg = usePins((s) => s.cfg)!
  const pinsState = usePins((s) => s.state)!
  const tree = useProject((s) => s.tree)
  const docs = useProject((s) => s.docs)
  const [plan, setPlan] = useState<PinsPlanDto | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [withMain, setWithMain] = useState(true)
  const [result, setResult] = useState<{ ok: boolean; text: string; files: string[] } | null>(null)

  useEffect(() => {
    let live = true
    void (async () => {
      await usePins.getState().flush()
      const r = await window.api.pins.plan(cfg)
      if (!live) return
      if (r.ok) setPlan(r.data); else setErr(r.error)
    })()
    return () => { live = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // main.c: берём текст из редактора, если файл открыт (там могут быть несохранённые правки), иначе с диска
  const mainNode = useMemo(() => (pinsState.main ? findNode(tree, pinsState.main.path) : null), [tree, pinsState.main])
  const mainText = mainNode && docs[mainNode.path] ? docs[mainNode.path].content : pinsState.main?.content ?? null
  const mainPlan = useMemo(() => (mainText === null ? null : planMainInsert(mainText)), [mainText])
  const diff = useMemo(() => (mainPlan?.changed && mainText !== null ? diffHunks(lineDiff(mainText, mainPlan.code), 2) : []), [mainPlan, mainText])

  useEffect(() => {
    const k = (e: KeyboardEvent): void => { if (e.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose, busy])

  const apply = async (): Promise<void> => {
    if (!plan?.ok) return
    setBusy(true)
    const r = await window.api.pins.generate(cfg)
    if (!r.ok) { setBusy(false); setResult({ ok: false, text: r.error, files: [] }); return }
    const written = [...r.data.written]
    let mainNote = ''
    if (withMain && mainPlan?.changed && mainNode) {
      // вкладку не переключаем: файл открыт в редакторе — меняем его текст там, иначе пишем на диск
      const p = useProject.getState()
      if (p.docs[mainNode.path]) { p.setContent(mainNode.path, mainPlan.code); await p.saveFile(mainNode.path) }
      else await window.api.fs.write(mainNode.path, mainPlan.code)
      written.push(pinsState.main!.path)
      mainNote = ' В main.c добавлены #include "board.h" и вызов board_init().'
    }
    await useProject.getState().refreshTree()
    await useProject.getState().syncFromDisk()
    setBusy(false)
    setResult({ ok: true, text: `Готово: записано файлов — ${written.length}.${mainNote}${r.data.unchanged.length ? ` Без изменений: ${r.data.unchanged.length}.` : ''}`, files: written })
    useUi.getState().notify(`Код сгенерирован из avride.pins.json (${written.length} файл.).`, { kind: 'ok' })
  }

  const issues = plan?.issues.filter((i) => i.severity !== 'info') ?? []
  const foreign = plan?.files.filter((f) => f.foreign && f.status !== 'same') ?? []
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <Dialog className="pc-gen" testid="pins-gen" title="Сгенерировать код" icon="code" ariaLabel="Сгенерировать код" onClose={onClose} closeDisabled={busy}
        footer={<>
          <Button onClick={onClose} disabled={busy}>{result?.ok ? 'Закрыть' : 'Отмена'}</Button>
          {!result?.ok && (!plan || plan.ok) && <Button variant="primary" data-testid="pins-gen-confirm" loading={busy} disabled={!plan?.ok} onClick={() => void apply()}>Записать файлы</Button>}
        </>}>
        {!plan && !err && <p className="dim">Готовлю план…</p>}
        {err && <div className="pc-note err"><Icon name="error" size={14} /><span>{err}</span></div>}
        {plan && !plan.ok && (
          <div className="pc-note err" data-testid="pins-gen-blocked"><Icon name="error" size={14} /><span>{plan.blocked}</span></div>
        )}
        {plan && !plan.ok && hasErrors(plan.issues) && (
          <ul className="pc-gen-list">{plan.issues.filter((i) => i.severity === 'error').map((i, k) => <li key={k}><Icon name="error" size={13} /> {i.message}</li>)}</ul>
        )}
        {plan?.ok && (
          <>
            <p className="dim small">Режим: {cfg.mode === 'hal' ? 'HAL' : 'регистры CMSIS'}. Файлы помечены «сгенерировано»; свой код пишите только в блоках <code>USER CODE BEGIN … END</code> — при повторной генерации они сохраняются.</p>
            <h3>Файлы</h3>
            <ul className="pc-gen-files" data-testid="pins-gen-files">
              {plan.files.map((f) => (
                <li key={f.path} data-testid="pins-gen-file" data-path={f.path} data-status={f.status}>
                  <Icon name="file" size={14} /> <span className="mono">{f.path}</span>
                  <Chip tone={STATUS[f.status].tone}>{STATUS[f.status].text}</Chip>
                  {f.keptBlocks.length > 0 && <span className="dim small">сохранены ваши блоки: {f.keptBlocks.join(', ')}</span>}
                  {f.orphanBlocks.length > 0 && <Chip tone="warn" title="Блока больше нет в шаблоне — код перенесён в конец файла">блоков перенесено: {f.orphanBlocks.length}</Chip>}
                </li>
              ))}
            </ul>
            {foreign.length > 0 && (
              <div className="pc-note warn" data-testid="pins-gen-foreign"><Icon name="warn" size={14} /><span>Файлы {foreign.map((f) => f.path).join(', ')} уже есть и созданы не AVR IDE: они будут перезаписаны. Сделайте копию, если там нужный код.</span></div>
            )}
            {plan.dirWarnings.map((w, k) => <div key={k} className="pc-note warn"><Icon name="warn" size={14} /><span>{w}</span></div>)}
            {issues.map((i, k) => <div key={k} className="pc-note warn"><Icon name="warn" size={14} /><span>{i.message}</span></div>)}
            {plan.notes.map((n, k) => <div key={k} className={'pc-note ' + (n.severity === 'warning' ? 'warn' : '')}><Icon name={n.severity === 'warning' ? 'warn' : 'info'} size={14} /><span>{n.text}</span></div>)}
            <h3>Файл main.c</h3>
            {mainPlan === null && <p className="dim small">В проекте нет src/main.c: добавьте <code>#include "board.h"</code> и вызов <code>board_init();</code> в свою функцию main вручную.</p>}
            {mainPlan && !mainPlan.changed && <p className="dim small" data-testid="pins-gen-main-same">{mainPlan.reason ?? 'main.c менять не нужно.'}</p>}
            {mainPlan?.changed && (
              <>
                <label className="ck-check"><input type="checkbox" checked={withMain} onChange={(e) => setWithMain(e.target.checked)} data-testid="pins-gen-main" /> Вставить <code>board_init();</code> первой строкой main() и подключить <code>board.h</code></label>
                {withMain && (
                  <pre className="pc-diff" data-testid="pins-gen-diff">
                    {diff.map((l, i) => l.kind === 'gap'
                      ? <div key={i} className="gap">⋯ {l.count} строк без изменений ⋯</div>
                      : <div key={i} className={l.kind}><span className="sg">{l.kind === 'add' ? '+' : l.kind === 'del' ? '−' : ' '}</span>{l.text || ' '}</div>)}
                  </pre>
                )}
              </>
            )}
          </>
        )}
        {result && (
          <div className={'pc-note ' + (result.ok ? 'ok' : 'err')} data-testid="pins-gen-result"><Icon name={result.ok ? 'check' : 'error'} size={14} /><span>{result.text}</span></div>
        )}
      </Dialog>
    </div>
  )
}
