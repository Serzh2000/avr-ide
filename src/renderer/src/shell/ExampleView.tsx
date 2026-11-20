// Предпросмотр примера в основной области (вкладка только для чтения) и «Открыть как проект».
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { create } from 'zustand'
import type { ExamplePreview } from '../../../main/examples/scan'
import { validateSketchName } from '../../../main/files/naming'
import { promptDialog } from './dialogs'
import { Icon } from './icons'
import { Button, Spinner } from './kit'
import { pickMainFile, isStub } from './exampleFile'
import { useProject } from './project'

interface PickState { sel: { id: string; lib: string; name: string } | null }
export const useExamplePick = create<PickState>(() => ({ sel: null }))

/** Выбирает пример и открывает (или обновляет) вкладку предпросмотра. */
export function showExample(id: string, lib: string, name: string): void {
  useExamplePick.setState({ sel: { id, lib, name } })
  useProject.getState().openPanel('example')
}

/** Копирует пример в папку скетчей и открывает как новый проект (спрашивает имя). */
export async function openExampleAsProject(id: string, label: string): Promise<void> {
  const sug = await window.api.examples.suggestName(id, label)
  let name = sug.ok ? sug.data : 'Example'
  let msg = 'Пример скопируется в вашу папку скетчей и откроется как новый проект. Оригинал не изменится.'
  for (;;) {
    const v = await promptDialog({ title: 'Открыть как проект', label: msg, value: name, okLabel: 'Открыть', validate: validateSketchName })
    if (v === null) return
    const e = await useProject.getState().openExample(id, v)
    if (e === null || e === 'cancel') return
    name = v
    msg = e
  }
}

export default function ExampleView(): ReactNode {
  const sel = useExamplePick((s) => s.sel)
  const [p, setP] = useState<ExamplePreview | null>(null)
  const [err, setErr] = useState('')
  const [file, setFile] = useState(0)
  const id = sel?.id
  useEffect(() => {
    if (!id) return
    let live = true
    setP(null); setErr(''); setFile(0)
    void window.api.examples.preview(id).then((r) => {
      if (!live) return
      if (r.ok) { setP(r.data); setFile(pickMainFile(r.data.files)) } else setErr(r.error)
    })
    return () => { live = false }
  }, [id])

  if (!sel) return <div className="ex-preview"><div className="ex-pre-wait dim">Выберите пример в списке слева.</div></div>
  const label = sel.lib + ' / ' + sel.name
  const f = p?.files[file]
  const mainIdx = p ? pickMainFile(p.files) : 0
  return (
    <div className="ex-preview" data-testid="ex-preview">
      <div className="ex-pre-head">
        <div className="ex-pre-info">
          <h2 className="ex-pre-title" title={label}>{sel.name}</h2>
          <p className="ex-pre-note"><Icon name="info" size={14} /> Пример из библиотеки «{sel.lib}». Копия откроется как новый проект, оригинал не меняется. Здесь — только просмотр.</p>
        </div>
        <Button variant="primary" size="lg" data-testid="ex-open" disabled={!p?.files.length} onClick={() => void openExampleAsProject(sel.id, label)} title="Копирует пример в папку скетчей и открывает его (Enter в списке — то же)">Открыть как проект…</Button>
      </div>
      {err && <div className="field-error pad">{err}</div>}
      {!p && !err && <div className="ex-pre-wait"><Spinner /> Загружаю…</div>}
      {p && p.files.length > 1 && (
        <div className="ex-files" role="tablist" aria-label="Файлы примера">
          {p.files.map((x, i) => (
            <button key={x.name} role="tab" aria-selected={i === file} className={i === file ? 'on' : ''} onClick={() => setFile(i)}
              title={isStub(x) ? 'Заглушка: подключает другой файл, настоящий код — в нём' : i === mainIdx ? 'Основной код примера' : undefined}>
              {x.name}{isStub(x) ? ' · заглушка' : i === mainIdx ? ' · основной код' : ''}
            </button>
          ))}
        </div>
      )}
      {f && <pre className="ex-code" tabIndex={0} aria-label={'Код ' + f.name}>{f.content}{f.cut ? '\n… файл показан не полностью' : ''}</pre>}
    </div>
  )
}
