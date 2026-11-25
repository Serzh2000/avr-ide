import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../shell/icons'
import { EmptyState, Button } from '../shell/kit'
import { FailHint, runGuide } from '../shell/NextStep'
import { BuildBanner } from '../shell/BuildTimer'
import { useBuild } from './useBuild'
import { useProStore } from '../pro/proStore'
import { runProBuild } from '../pro/buildStore'

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
  const pro = useProStore((s) => s.proMode)
  const log = useBuild((s) => s.log)
  const busy = useBuild((s) => s.busy)
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
      <BuildBanner />
      <FailHint />
      {log ? (
        <pre className="log" ref={box} onScroll={(e) => {
          const el = e.currentTarget
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
        }}>
          {lines.map((l, i) => <div key={i} className={'ln ' + classify(l)}>{l || ' '}</div>)}
        </pre>
      ) : busy ? (
        <div className="panel-empty">Жду вывод… Если сборка долгая, это нормально: компилятор пишет в журнал по мере работы.</div>
      ) : (
        pro ? <EmptyState icon="terminal" title="Здесь появится ход сборки" hint="Сборка запускает arm-none-eabi-gcc: компиляция каждого файла, компоновка и размер программы. Ошибки попадут во вкладку «Проблемы».">
          <Button data-testid="output-build" onClick={() => void runProBuild()}>Собрать (Ctrl+B)</Button>
        </EmptyState>
        : <EmptyState icon="terminal" title="Здесь появится ход сборки" hint="Проверка собирает скетч без загрузки и находит ошибки. Это безопасно — плата не изменится.">
          <Button onClick={() => runGuide('verify')}>Проверить (Ctrl+B)</Button>
        </EmptyState>
      )}
    </div>
  )
}
