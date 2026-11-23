import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { PICO_BLINK, PICO_BOARDS } from '../../../shared/circuitpython/boards'
import type { PicoBoardId } from '../../../shared/circuitpython/boards'
import Editor from '../Editor'
import { Button, Dialog, Field, Select } from '../shell/kit'
import { useUi } from '../shell/ui'
import { confirmCircuitPythonDiscard, useCircuitPython } from './store'
import './circuitpython.css'

type Operation = 'open' | 'save' | 'deploy' | 'firmware'

export default function CircuitPythonDialog(): ReactNode {
  const open = useCircuitPython((s) => s.open)
  return open ? <CircuitPythonWorkspace /> : null
}

function CircuitPythonWorkspace(): ReactNode {
  const modal = useRef<HTMLDialogElement>(null)
  const theme = useUi((s) => s.settings.theme)
  const fontSize = useUi((s) => s.settings.fontSize)
  const [text, setText] = useState(PICO_BLINK)
  const [saved, setSaved] = useState(PICO_BLINK)
  const [path, setPath] = useState<string>()
  const [documentId, setDocumentId] = useState(0)
  const [board, setBoard] = useState<PicoBoardId>('raspberry_pi_pico')
  const [operation, setOperation] = useState<Operation>()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const busy = useCircuitPython((s) => s.busy)
  const api = window.api.circuitpython
  const dirty = text !== saved

  useEffect(() => {
    const el = modal.current
    const previousFocus = document.activeElement
    el?.showModal()
    return () => {
      el?.close()
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [])

  function change(value: string): void {
    useCircuitPython.setState({ dirty: value !== saved })
    setText(value)
  }

  function load(file: { path?: string; text: string }, replaceDocument = false): void {
    useCircuitPython.setState({ dirty: false })
    setPath(file.path)
    setSaved(file.text)
    setText(file.text)
    if (replaceDocument) setDocumentId((id) => id + 1)
  }

  async function close(): Promise<void> {
    if (await confirmCircuitPythonDiscard()) useCircuitPython.setState({ open: false, dirty: false })
  }

  async function perform(kind: Operation, task: () => Promise<void>): Promise<void> {
    if (useCircuitPython.getState().busy) return
    useCircuitPython.setState({ busy: true })
    setOperation(kind)
    setError('')
    setMessage('')
    try {
      await task()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выполнить операцию.')
    } finally {
      setOperation(undefined)
      useCircuitPython.setState({ busy: false })
    }
  }

  async function openFile(): Promise<void> {
    if (!await confirmCircuitPythonDiscard()) return
    await perform('open', async () => {
      const result = await api.open()
      if (!result.ok) setError(result.error)
      else if (result.data) load(result.data, true)
    })
  }

  function save(saveAs = false): Promise<void> {
    return perform('save', async () => {
      const result = await api.save(text, saveAs || !path)
      if (!result.ok) setError(result.error)
      else if (result.data) {
        load(result.data)
        setMessage('Программа сохранена.')
      }
    })
  }

  return (
    <dialog
      ref={modal}
      className="cp-dialog-shell"
      role="presentation"
      onCancel={(event) => { event.preventDefault(); void close() }}
      onKeyDown={(event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && !event.defaultPrevented) {
          event.preventDefault()
          void save(event.shiftKey)
        }
        event.stopPropagation()
      }}
    >
      <Dialog
        title="CircuitPython для Raspberry Pi Pico"
        icon="code"
        className="cp-dialog"
        testid="circuitpython"
        onClose={() => void close()}
        closeDisabled={busy}
        footerStart={<Button disabled={busy} onClick={() => void save(true)}>Сохранить как…</Button>}
        footer={<>
          <Button disabled={busy} onClick={() => void save()}>Сохранить</Button>
          <Button variant="primary" disabled={busy} loading={operation === 'deploy'} onClick={() => void perform('deploy', async () => {
            const result = await api.deploy(text)
            if (!result.ok) setError(result.error)
            else if (result.data) setMessage(`code.py записан на ${result.data.board}. Вывод print() и ошибки видны в последовательной консоли USB.`)
          })}>Записать на плату…</Button>
        </>}
      >
        <p className="cp-instructions dim">
          Используйте <b>BOOTSEL</b> для установки файла UF2. Когда появится диск <b>CIRCUITPY</b>, нажмите «Записать на плату…», чтобы сохранить <code>code.py</code>.
        </p>
        <details className="cp-setup">
          <summary>Как установить CircuitPython</summary>
          <div className="cp-firmware">
            <Field label="Модель платы">
              <Select value={board} onChange={(event) => setBoard(event.target.value as PicoBoardId)} disabled={busy}>
                {PICO_BOARDS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            </Field>
            <Button disabled={busy} onClick={() => void perform('firmware', async () => {
              const result = await api.firmware(board)
              if (!result.ok) setError(result.error)
            })}>Открыть страницу прошивки</Button>
          </div>
          <ol>
            <li>Скачайте файл UF2 для своей модели.</li>
            <li>Подключите Pico по USB, удерживая BOOTSEL.</li>
            <li>Скопируйте UF2 на появившийся загрузочный диск. После перезапуска откроется CIRCUITPY.</li>
          </ol>
        </details>
        <div className="cp-toolbar">
          <Button disabled={busy} onClick={() => void openFile()}>Открыть .py…</Button>
          <Button disabled={busy} onClick={() => void confirmCircuitPythonDiscard().then((okay) => {
            if (okay) { load({ text: PICO_BLINK }, true); setMessage('Открыт пример мигания светодиодом.'); setError('') }
          })}>Пример «Мигание»</Button>
          <span className="cp-filename" title={path}>{path?.split(/[\\/]/).pop() ?? 'code.py'}{dirty ? ' • Не сохранён' : ''}</span>
        </div>
        <div className="cp-editor">
          <Editor key={documentId} value={text} filePath="circuitpython-workspace/code.py" onChange={change} onSave={() => void save()}
            readOnly={busy} theme={theme} fontSize={fontSize} minimap={false} />
        </div>
        <div className="cp-feedback">
          {error ? <div role="alert" className="field-error">{error}</div> :
            <div role="status">{message || <>Вывод <code>print()</code> и ошибки видны в последовательной консоли USB. Откройте COM-порт Pico в мониторе порта или другой программе для последовательной связи. Библиотеки помещаются в <code>lib</code> на CIRCUITPY.</>}</div>}
        </div>
      </Dialog>
    </dialog>
  )
}
