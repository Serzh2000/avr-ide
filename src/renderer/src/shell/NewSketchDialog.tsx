// Диалог «Новый скетч»: шаблон, имя (= имя папки и .ino), место.
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useProject } from './project'
import { useUi } from './ui'

const NAME_RE = /^[A-Za-z0-9_][A-Za-z0-9_-]{0,62}$/
const GROUPS: Record<string, string> = { basic: 'Универсальные', esp32: 'ESP32', esp8266: 'ESP8266' }

export default function NewSketchDialog(): ReactNode {
  const req = useUi((s) => s.newSketch)
  const close = (): void => useUi.getState().setNewSketch(null)
  const templates = useProject((s) => s.templates)
  const [tpl, setTpl] = useState('blink')
  const [name, setName] = useState('')
  const [parent, setParent] = useState<string | undefined>(undefined)
  const [base, setBase] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!req) return
    setTpl(req.template ?? 'blink'); setErr(null); setParent(undefined)
    void (async () => {
      const [sb, nm] = await Promise.all([window.api.project.sketchbook(), window.api.project.suggestName()])
      if (sb.ok) setBase(sb.data)
      if (nm.ok) setName(nm.data)
      setTimeout(() => { input.current?.focus(); input.current?.select() }, 0)
    })()
  }, [req])

  if (!req) return null

  const valid = NAME_RE.test(name)
  const create = async (): Promise<void> => {
    if (!valid) { setErr('Имя: латинские буквы, цифры, «_» и «-», не с дефиса. Оно же станет именем папки и файла .ino.'); return }
    setBusy(true)
    const e = await useProject.getState().createSketch(tpl, name, parent)
    setBusy(false)
    if (e) setErr(e)
    else close()
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}
      onKeyDown={(e) => { if (e.key === 'Escape') close() }}>
      <div className="modal wide" role="dialog" aria-modal="true" aria-label="Новый скетч">
        <h2>Новый скетч</h2>
        <div className="field-label">Шаблон</div>
        <div className="tpl-pick">
          {(['basic', 'esp32', 'esp8266'] as const).map((g) => {
            const list = templates.filter((t) => t.group === g)
            return list.length ? (
              <div key={g} className="tpl-group">
                <div className="tpl-group-title">{GROUPS[g]}</div>
                {list.map((t) => (
                  <button key={t.id} className={'tpl-opt' + (tpl === t.id ? ' on' : '')} onClick={() => setTpl(t.id)}>
                    <span className="tpl-name">{t.name}</span><span className="tpl-desc">{t.description}</span>
                  </button>
                ))}
              </div>
            ) : null
          })}
        </div>
        <label className="field-label" htmlFor="sk-name">Имя скетча</label>
        <input id="sk-name" ref={input} className={'input' + (name && !valid ? ' invalid' : '')} value={name} spellCheck={false}
          onChange={(e) => { setName(e.target.value); setErr(null) }} onKeyDown={(e) => { if (e.key === 'Enter') void create() }} />
        <div className="field-label">Где создать</div>
        <div className="loc-row">
          <code className="loc" title={parent ?? base}>{(parent ?? base) || '…'}</code>
          <button className="btn small" onClick={async () => { const r = await window.api.project.pickFolder(); if (r.ok && r.data) setParent(r.data) }}>Обзор…</button>
        </div>
        <div className="dim small">Будет создана папка «{name || '…'}» с файлом «{name || '…'}.ino» — так требует Arduino.</div>
        {err && <div className="field-error">{err}</div>}
        <div className="modal-actions">
          <button className="btn primary" onClick={() => void create()} disabled={busy}>Создать</button>
          <button className="btn" onClick={close}>Отмена</button>
        </div>
      </div>
    </div>
  )
}
