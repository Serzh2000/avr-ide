import { useEffect, useRef } from 'react'

type Kind = 'error' | 'warn' | 'note' | 'info' | 'plain'

/** Классификация строки лога компилятора/arduino-cli для подсветки. */
function classify(line: string): Kind {
  if (/\b(fatal error|error)\b\s*:|^error\b|Ошибка|Failed|failed|undefined reference|Error during|collect2:/i.test(line)) return 'error'
  if (/\bwarning\s*:/i.test(line)) return 'warn'
  if (/\bnote\s*:/i.test(line)) return 'note'
  if (/^\$ |^---|Sketch uses|Global variables|Done|Installed|Downloaded|Готово/.test(line)) return 'info'
  return 'plain'
}

export default function OutputPanel({ log, onClear }: { log: string; onClear: () => void }) {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [log])
  const lines = log.split(/\r?\n/)
  return (
    <div className="panel-body">
      <div className="panel-actions"><button onClick={onClear}>Очистить</button></div>
      <pre className="log">
        {lines.map((l, i) => <div key={i} className={'ln ' + classify(l)}>{l || ' '}</div>)}
        <div ref={end} />
      </pre>
    </div>
  )
}
