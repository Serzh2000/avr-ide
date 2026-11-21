// Мастер «Новый проект» в профессиональном режиме: чип/плата, имя, папка, шаблон — всё на одном экране.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { validateSketchName } from '../../../main/files/naming'
import { PRO_PRESETS } from '../../../main/pro/project/presets'
import { PRO_TEMPLATES } from '../../../main/pro/project/scaffold'
import type { ProTemplate } from '../../../main/pro/project/scaffold'
import { Icon } from '../shell/icons'
import { Button, Dialog, Field, Spinner } from '../shell/kit'
import { useProject } from '../shell/project'
import { useUi } from '../shell/ui'
import { useProBuild } from './buildStore'
import './pro.css'

const KB = (n: number): string => `${n / 1024} КБ`

function Wizard(): ReactNode {
  const close = (): void => useUi.getState().setWizard(false)
  const [chip, setChip] = useState(PRO_PRESETS[0].chip)
  const [q, setQ] = useState('')
  const [name, setName] = useState('')
  const [template, setTemplate] = useState<ProTemplate>('blink')
  const [parent, setParent] = useState('')
  const [base, setBase] = useState('')
  const [remote, setRemote] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const alive = useRef(true)
  const touched = useRef(false)
  useEffect(() => () => { alive.current = false }, [])

  // Папка по умолчанию и первое свободное имя
  const suggest = async (dir?: string): Promise<void> => {
    for (let i = 1; i < 50; i++) {
      const nm = i === 1 ? 'stm32_project' : `stm32_project${i}`
      const r = await window.api.project.checkName(nm, dir)
      if (!alive.current || touched.current) return
      if (r.ok && r.data === null) { setName(nm); return }
    }
  }
  useEffect(() => {
    void (async () => {
      const sb = await window.api.project.sketchbook()
      if (sb.ok && alive.current) setBase(sb.data)
      await suggest(undefined)
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const local = name ? validateSketchName(name) : 'Введите имя проекта.'
  useEffect(() => {
    setRemote(null)
    if (!name || validateSketchName(name)) { setChecking(false); return }
    setChecking(true)
    let ok = true
    const t = setTimeout(async () => {
      const r = await window.api.project.checkName(name, parent || undefined)
      if (!ok) return
      setChecking(false)
      setRemote(r.ok ? r.data : r.error)
    }, 200)
    return () => { ok = false; clearTimeout(t) }
  }, [name, parent])

  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean)
  const shown = useMemo(() => PRO_PRESETS.filter((p) => tokens.every((t) => (p.chip + ' ' + p.board + ' ' + p.family).toLowerCase().includes(t))), [q]) // eslint-disable-line react-hooks/exhaustive-deps
  const sel = PRO_PRESETS.find((p) => p.chip === chip)!
  const nameError = name ? (local ?? remote) : null
  const canCreate = !!name && !local && !remote && !checking && !busy

  const pickFolder = async (): Promise<void> => {
    const r = await window.api.project.pickFolder()
    if (!r.ok) { setErr(r.error); return }
    if (!r.data) return
    setParent(r.data)
    if (!touched.current) await suggest(r.data)
  }

  const create = async (): Promise<void> => {
    if (!canCreate) return
    setBusy(true); setErr(null)
    const project = useProject.getState()
    if (!(await project.confirmDiscard())) { setBusy(false); return }
    const r = await window.api.pro.create(name, parent || undefined, chip, template)
    if (!r.ok) { if (alive.current) { setBusy(false); setErr(r.error) } return }
    await project.openRecent(r.data.root)
    await useProject.getState().openFile(r.data.mainFile)
    close()
    // Файлов CMSIS ещё нет в кэше: предлагаем скачать сразу (с подтверждением), чтобы проект собирался
    if (r.data.needsSupport) {
      const s = await window.api.pro.support()
      if (s.ok && !s.data.installed) useProBuild.getState().setDialog({ kind: 'support', status: s.data })
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) close() }}
      onKeyDown={(e) => { if (e.key === 'Escape' && !busy) { e.stopPropagation(); close() } }}>
      <Dialog className="wizard step2 pro-wizard" testid="pro-wizard" title="Новый проект STM32" ariaLabel="Новый проект STM32" onClose={close} closeDisabled={busy}
        footerStart={<span className="dim small">Профессиональный режим · ST-Link, SWD</span>}
        footer={<>
          <Button data-testid="wz-back" onClick={close} disabled={busy}>Отмена</Button>
          <Button variant="primary" data-testid="wz-create" onClick={() => void create()} disabled={!canCreate}>{busy ? <Spinner /> : null} Создать</Button>
        </>}>
        <div className="pro-wz">
          <div className="wz-search">
            <Icon name="search" size={15} />
            <input data-testid="pro-wz-search" placeholder="Найти чип или плату: F103, Nucleo, Black Pill…" value={q} onChange={(e) => setQ(e.target.value)} spellCheck={false} aria-label="Поиск чипа или платы" />
            {q && <button className="icon-btn" title="Очистить" aria-label="Очистить" onClick={() => setQ('')}><Icon name="x" size={13} /></button>}
          </div>
          <div className="pro-wz-list" role="listbox" aria-label="Чипы и платы">
            {shown.map((p) => (
              <button key={p.chip} role="option" data-testid="pro-wz-chip" data-chip={p.chip} aria-selected={p.chip === chip} className={'wz-board' + (p.chip === chip ? ' on' : '')} onClick={() => setChip(p.chip)}>
                <span className="pro-wz-chip">{p.chip}</span>
                <span className="grow dim small">{p.board} · Flash {KB(p.flashBytes)} · RAM {KB(p.ramBytes)}</span>
                {p.chip === chip && <Icon name="check" size={15} />}
              </button>
            ))}
            {shown.length === 0 && <div className="wz-empty">Ничего не найдено. Попробуйте «F103», «F4» или «Nucleo».</div>}
          </div>
          <div className="pro-wz-note dim small">Другие чипы появятся вместе с базой чипов. Объёмы памяти из даташитов ST.</div>

          <Field label="Имя проекта" hint="Латинские буквы, цифры, «_» и «-». Это имя папки." error={nameError ?? undefined}>
            <input data-testid="wz-name" className={'input' + (nameError ? ' invalid' : '')} value={name} spellCheck={false} autoComplete="off" aria-invalid={!!nameError}
              onChange={(e) => { touched.current = true; setName(e.target.value); setErr(null) }} onKeyDown={(e) => { if (e.key === 'Enter') void create() }} />
          </Field>
          <Field label="Шаблон" hint={PRO_TEMPLATES.find((t) => t.id === template)?.hint}>
            <div className="pro-seg" role="group" aria-label="Шаблон">
              {PRO_TEMPLATES.map((t) => <button key={t.id} data-testid={'pro-tpl-' + t.id} aria-pressed={template === t.id} className={template === t.id ? 'on' : ''} onClick={() => setTemplate(t.id)}>{t.title}</button>)}
            </div>
          </Field>
          <div className="form-row">
            <div className="form-label">Где создать</div>
            <div className="loc-row">
              <code className="loc" title={parent || base}>{parent || base || '…'}</code>
              <Button size="sm" onClick={() => void pickFolder()}>Изменить…</Button>
            </div>
          </div>
          <div className="wz-tree pro-wz-tree" aria-label="Что будет создано">
            <div className="wz-tree-title">Будет создано</div>
            <div className="pro-wz-files dim small" data-testid="pro-wz-preview">
              {name || '…'}: avride.project.json · src/main.c · include/ · startup/ · linker/ · drivers/CMSIS/ · .gitignore · README.md
            </div>
            <div className="dim small">{sel.chip}: {sel.board}, ядро {sel.core}, Flash {KB(sel.flashBytes)}, RAM {KB(sel.ramBytes)}</div>
          </div>
          {err && <div className="field-error">{err}</div>}
        </div>
      </Dialog>
    </div>
  )
}

export default function ProNewProjectWizard(): ReactNode {
  const open = useUi((s) => s.wizard)
  return open ? <Wizard /> : null
}
