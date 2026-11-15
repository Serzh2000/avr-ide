import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { buildPreviewHtml } from './core/index'
import frameUrl from './frame.html?url'
import { useWebDesigner } from './store'

const LOGICAL = { tablet: 768, mobile: 375 } as const

/** Живое превью: sandbox-iframe без allow-same-origin, WebSocket заменён моком (см. core/mock.ts). */
export function Preview(): ReactNode {
  const project = useWebDesigner((s) => s.project)
  const selected = useWebDesigner((s) => s.selected)
  const device = useWebDesigner((s) => s.device)
  const themeView = useWebDesigner((s) => s.themeView)
  const interactive = useWebDesigner((s) => s.interactive)
  const frame = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(0)
  const [gen, setGen] = useState(0)
  const docRef = useRef('')

  // пересборка с задержкой, чтобы не мигать при вводе
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const h = buildPreviewHtml(project)
        docRef.current = h
      } catch (e) {
        docRef.current = `<!DOCTYPE html><body style="font-family:sans-serif;padding:20px;color:#c00">Ошибка генерации: ${String((e as Error).message).replace(/</g, '&lt;')}</body>`
      }
      setGen((n) => n + 1)
    }, 150)
    return () => clearTimeout(t)
  }, [project])

  const send = (msg: unknown): void => {
    frame.current?.contentWindow?.postMessage(msg, '*')
  }

  useEffect(() => {
    const onMsg = (e: MessageEvent): void => {
      if (e.source !== frame.current?.contentWindow) return
      const m = e.data as { wd?: string; id?: string | null }
      if (m?.wd === 'select') useWebDesigner.getState().select(typeof m.id === 'string' ? m.id : null)
      else if (m?.wd === 'shell') frame.current?.contentWindow?.postMessage({ wd: 'doc', html: docRef.current }, '*')
      else if (m?.wd === 'ready') setReady((n) => n + 1)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  useEffect(() => {
    send({ wd: 'interactive', on: interactive })
    send({ wd: 'theme', mode: themeView })
    send({ wd: 'mark', id: selected })
  }, [ready, interactive, themeView, selected])

  // масштаб под доступное место: логический размер устройства вписывается в сцену
  const stage = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = stage.current
    if (!el) return
    const upd = (): void => setBox({ w: el.clientWidth, h: el.clientHeight })
    upd()
    const ro = new ResizeObserver(upd)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const PAD = 8
  const availW = Math.max(100, box.w - PAD * 2)
  const availH = Math.max(100, box.h - PAD * 2)
  const logicalW = device === 'desktop' ? availW : LOGICAL[device]
  const scale = Math.min(1, availW / logicalW)
  const logicalH = availH / scale
  const seg = <T extends string>(cur: T, v: T, label: string, set: (x: T) => void, title?: string): ReactNode => (
    <button key={v} className={`wd-seg${cur === v ? ' on' : ''}`} onClick={() => set(v)} title={title ?? label} aria-pressed={cur === v}>
      {label}
    </button>
  )
  const st = useWebDesigner.getState()
  return (
    <div className="wd-preview-wrap">
      <div className="wd-preview-bar">
        <div className="wd-segs" role="group" aria-label="Устройство">
          {seg(device, 'desktop', 'ПК', st.setDevice, 'Десктоп (на всю ширину)')}
          {seg(device, 'tablet', 'Планшет', st.setDevice, 'Планшет 768 px')}
          {seg(device, 'mobile', 'Телефон', st.setDevice, 'Телефон 375 px')}
        </div>
        <div className="wd-segs" role="group" aria-label="Тема превью">
          {seg(themeView, 'auto', 'Авто', st.setThemeView, 'Тема по системе')}
          {seg(themeView, 'light', '☀', st.setThemeView, 'Светлая тема страницы')}
          {seg(themeView, 'dark', '☾', st.setThemeView, 'Тёмная тема страницы')}
        </div>
        <div className="wd-segs" role="group" aria-label="Режим">
          <button className={`wd-seg${!interactive ? ' on' : ''}`} onClick={() => st.setInteractive(false)} title="Клик по превью выбирает блок" aria-pressed={!interactive}>Выбор</button>
          <button className={`wd-seg${interactive ? ' on' : ''}`} onClick={() => st.setInteractive(true)} title="Элементы работают (симуляция), клик не выбирает блок" aria-pressed={interactive}>Интерактив</button>
        </div>
      </div>
      <div className="wd-preview-stage" ref={stage}>
        <div className="wd-frame-box" style={{ width: logicalW * scale, height: availH }}>
          <iframe
            ref={frame}
            className="wd-frame"
            title="Превью страницы"
            style={{ width: logicalW, height: logicalH, transform: `scale(${scale})` }}
            sandbox="allow-scripts"
            key={gen}
            src={frameUrl}
          />
        </div>
      </div>
    </div>
  )
}
