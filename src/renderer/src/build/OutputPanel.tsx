import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../shell/icons'
import { FailHint } from '../shell/NextStep'
import { useBuild } from './useBuild'

type Kind = 'error' | 'warn' | 'note' | 'info' | 'plain'

/** Классификация строки лога компилятора/arduino-cli для подсветки. */
function classify(line: string): Kind {
  if (/\b(fatal error|error)\b\s*:|^error\b|Ошибка|Failed|failed|undefined reference|Error during|collect2:/i.test(line)) return 'error'
  if (/\bwarning\s*:/i.test(line)) return 'warn'
  if (/\bnote\s*:/i.test(line)) return 'note'
  if (/^\$ |^---|^===|Sketch uses|Global variables|Done|Installed|Downloaded|Готово/.test(line)) return 'info'
  return 'plain'
}

export default function OutputPanel(): ReactNode {
  const log = useBuild((s) => s.log)
  const clear = useBuild((s) => s.clear)
  const box = useRef<HTMLPreElement>(null)
  const stick = useRef(true)

  useEffect(() => {
    const el = box.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [log])

  const lines = log.split(/\r?\n/)
  return (
    <div className="panel-body">
      <div className="panel-actions">
        <span className="grow dim">Журнал сборки и установки</span>
        <button className="icon-btn" title="Очистить вывод" onClick={clear}><Icon name="trash" size={14} /></button>
      </div>
      <FailHint />
      {log ? (
        <pre className="log" ref={box} onScroll={(e) => {
          const el = e.currentTarget
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
        }}>
          {lines.map((l, i) => <div key={i} className={'ln ' + classify(l)}>{l || ' '}</div>)}
        </pre>
      ) : (
        <div className="panel-empty">Здесь появится вывод сборки и загрузки. Нажмите «Проверить» (Ctrl+B), чтобы скомпилировать скетч.</div>
      )}
    </div>
  )
}
