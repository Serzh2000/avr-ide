import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { buildPreviewHtml } from './core/index'
import frameUrl from './frame.html?url'
import { useWebDesigner } from './store'

const WIDTHS = { desktop: '100%', tablet: '768px', mobile: '375px' } as const

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

  const w = WIDTHS[device]
  return (
    <div className="wd-preview-wrap">
      <div className="wd-preview-bar">
        <span className="wd-dim">Превью</span>
        {(['desktop', 'tablet', 'mobile'] as const).map((d) => (
          <button key={d} className={`wd-seg${device === d ? ' on' : ''}`} onClick={() => useWebDesigner.getState().setDevice(d)}>
            {d === 'desktop' ? 'Десктоп' : d === 'tablet' ? 'Планшет' : 'Телефон'}
          </button>
        ))}
        <span className="wd-sep" />
        {(['auto', 'light', 'dark'] as const).map((t) => (
          <button key={t} className={`wd-seg${themeView === t ? ' on' : ''}`} onClick={() => useWebDesigner.getState().setThemeView(t)}>
            {t === 'auto' ? 'Тема: авто' : t === 'light' ? 'Светлая' : 'Тёмная'}
          </button>
        ))}
        <span className="wd-sep" />
        <button
          className={`wd-seg${interactive ? ' on' : ''}`}
          onClick={() => useWebDesigner.getState().setInteractive(!interactive)}
          title="В режиме интерактива элементы работают (симуляция), клик не выбирает блок"
        >
          {interactive ? 'Интерактив' : 'Выбор блоков'}
        </button>
      </div>
      <div className="wd-preview-stage">
        <iframe
          ref={frame}
          className="wd-frame"
          title="Превью страницы"
          style={{ width: w }}
          sandbox="allow-scripts"
          key={gen}
          src={frameUrl}
        />
      </div>
    </div>
  )
}
