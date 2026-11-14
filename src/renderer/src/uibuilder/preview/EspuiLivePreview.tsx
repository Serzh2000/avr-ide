import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { UiProject } from '../core/index'
import { buildPreviewSrcdoc } from './srcdoc'
import frameUrl from './frame.html?url'

const WIDTHS: Array<{ id: string; title: string; px: number | null }> = [
  { id: 'full', title: 'На всю ширину', px: null },
  { id: 'phone', title: 'Телефон (390 px)', px: 390 },
  { id: 'tablet', title: 'Планшет (768 px)', px: 768 }
]

/** Ключ iframe: при изменении страницы iframe пересоздаётся (иначе таймеры старого фронта остались бы жить). */
function hashKey(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return `${s.length}:${h}`
}

interface Msg {
  kind: 'event' | 'error'
  text: string
}

/** Живое превью на оригинальном фронте ESPUI: изолированный iframe (sandbox без allow-same-origin) + мок устройства. */
export function EspuiLivePreview({ project }: { project: UiProject }): ReactNode {
  const [debounced, setDebounced] = useState(project)
  const [width, setWidth] = useState('full')
  const [log, setLog] = useState<Msg[]>([])
  const frame = useRef<HTMLIFrameElement>(null)
  const docRef = useRef('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(project), 350)
    return () => clearTimeout(t)
  }, [project])

  let srcdoc = ''
  let buildError: string | null = null
  try {
    srcdoc = buildPreviewSrcdoc(debounced)
  } catch (e) {
    buildError = e instanceof Error ? e.message : String(e)
  }
  docRef.current = srcdoc
  useEffect(() => {
    setLog([])
  }, [srcdoc])

  useEffect(() => {
    const onMsg = (e: MessageEvent): void => {
      const d = e.data as { espuiPreview?: boolean; kind?: string; text?: string } | null
      if (!d || d.espuiPreview !== true || e.source !== frame.current?.contentWindow) return
      if (d.kind === 'ready') {
        // оболочка frame.html загружена — отдаём ей документ (см. комментарий в frame.html)
        frame.current?.contentWindow?.postMessage({ espuiDoc: docRef.current }, '*')
        return
      }
      const m: Msg = { kind: d.kind === 'error' ? 'error' : 'event', text: String(d.text ?? '').slice(0, 300) }
      setLog((l) => [...l.slice(-19), m])
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  const px = WIDTHS.find((w) => w.id === width)?.px ?? null
  const last = log[log.length - 1]
  const errors = log.filter((m) => m.kind === 'error')

  return (
    <div className="uib-live">
      <div className="uib-live-bar">
        <span>Оригинальный фронтенд ESPUI, «устройство» — симуляция</span>
        <select className="uib-input" value={width} onChange={(e) => setWidth(e.target.value)} title="Ширина области просмотра">
          {WIDTHS.map((w) => (
            <option key={w.id} value={w.id}>
              {w.title}
            </option>
          ))}
        </select>
        <span className="uib-live-last" title={last?.text}>
          {last ? (last.kind === 'error' ? 'Ошибка в превью: ' : 'Событие: ') + last.text : 'Нажмите или подвигайте элемент — увидите команду устройству'}
        </span>
      </div>
      {(buildError || errors.length > 0) && (
        <div className="uib-live-err">{buildError ? `Не удалось собрать страницу: ${buildError}` : `Ошибка внутри превью: ${errors[errors.length - 1].text}`}</div>
      )}
      <div className="uib-live-stage">
        <iframe
          ref={frame}
          className="uib-live-frame"
          title="Живое превью ESPUI"
          sandbox="allow-scripts"
          key={hashKey(srcdoc)}
          src={frameUrl}
          style={px ? { width: px } : undefined}
        />
      </div>
    </div>
  )
}
