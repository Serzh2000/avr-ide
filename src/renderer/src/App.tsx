import { useState } from 'react'
import Editor from './Editor'
import BuildToolbar from './build/BuildToolbar'
import OutputPanel from './build/OutputPanel'
import MonitorPanel from './build/MonitorPanel'
import ManagerPanel from './build/ManagerPanel'
import { useBuild } from './build/useBuild'
import { BOARD_PRESETS } from './build/boards'
import UiBuilder from './uibuilder/UiBuilder'
import ReferencePanel from './reference/ReferencePanel'
import WebDesigner from './webdesign/WebDesigner'

const TEMPLATE = `void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  delay(500);
}
`

export default function App() {
  const [path, setPath] = useState<string | null>(null)
  const [code, setCode] = useState(TEMPLATE)
  const [dirty, setDirty] = useState(false)
  const b = useBuild()
  const [fqbn, setFqbn] = useState(BOARD_PRESETS[0].fqbn)
  const [port, setPort] = useState('')
  const [tab, setTab] = useState<'log' | 'monitor' | 'manager'>('log')
  const [view, setView] = useState<'code' | 'ui' | 'web' | 'ref'>('code')

  const open = async (): Promise<void> => {
    const f = await window.api.openFile()
    if (f) { setPath(f.path); setCode(f.content); setDirty(false) }
  }
  const save = async (saveAs = false): Promise<string | null> => {
    const p = await window.api.saveFile(path, code, saveAs)
    if (p) { setPath(p); setDirty(false) }
    return p
  }

  // Verify/Upload компилируют сохранённый файл: сначала сохраняем (для нового скетча создаётся папка)
  const build = async (upload: boolean): Promise<void> => {
    const p = await save()
    if (!p) return
    setTab('log')
    b.append(`
=== ${upload ? 'Прошивка' : 'Проверка'}: ${fqbn}${upload ? ' → ' + port : ''} ===
`)
    await b.run(upload ? window.api.cli.upload(p, fqbn, port) : window.api.cli.compile(p, fqbn))
  }

  return (
    <div className="app">
      <div className="toolbar">
        <button onClick={open}>Открыть</button>
        <button onClick={() => void save()}>Сохранить</button>
        <button onClick={() => void save(true)}>Сохранить как…</button>
        <BuildToolbar b={b} fqbn={fqbn} setFqbn={setFqbn} port={port} setPort={setPort}
          onVerify={() => void build(false)} onUpload={() => void build(true)} />
        <span className="title">{path ?? 'Без имени'}{dirty ? ' •' : ''}</span>
      </div>
      <div className="views">
        <button className={view === 'code' ? 'on' : ''} onClick={() => setView('code')}>Код</button>
        <button className={view === 'ui' ? 'on' : ''} onClick={() => setView('ui')}>Конструктор ESPUI</button>
        <button className={view === 'web' ? 'on' : ''} onClick={() => setView('web')}>Веб-дизайнер (HTML+CSS)</button>
        <button className={view === 'ref' ? 'on' : ''} onClick={() => setView('ref')}>Справочник</button>
      </div>
      {view === 'ui' && <div className="main"><UiBuilder /></div>}
      {view === 'web' && <div className="main"><WebDesigner /></div>}
      {view === 'ref' && <div className="main"><ReferencePanel /></div>}
      <div className="main" style={{ display: view === 'code' ? undefined : 'none' }}>
        <Editor value={code} onChange={(v) => { setCode(v); setDirty(true) }} onSave={() => void save()} />
      </div>
      <div className="bottom" style={{ display: view === 'code' ? undefined : 'none' }}>
        <div className="tabs">
          <button className={tab === 'log' ? 'on' : ''} onClick={() => setTab('log')}>Вывод</button>
          <button className={tab === 'monitor' ? 'on' : ''} onClick={() => setTab('monitor')}>Монитор порта</button>
          <button className={tab === 'manager' ? 'on' : ''} onClick={() => setTab('manager')}>Ядра и библиотеки</button>
        </div>
        {tab === 'log' && <OutputPanel log={b.log || (b.status && !b.status.found ? b.status.help ?? '' : '')} onClear={b.clear} />}
        {tab === 'monitor' && <MonitorPanel port={port} disabled={b.busy || !b.status?.found} />}
        {tab === 'manager' && <ManagerPanel b={b} onShowLog={() => setTab('log')} />}
      </div>
    </div>
  )
}
