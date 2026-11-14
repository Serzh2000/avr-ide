import { useEffect, useRef } from 'react'
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'

;(self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
  getWorker: () => new EditorWorker()
}

interface Props {
  value: string
  onChange: (v: string) => void
  onSave: () => void
}

export default function Editor({ value, onChange, onSave }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const ed = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const saveRef = useRef(onSave)
  const changeRef = useRef(onChange)
  saveRef.current = onSave
  changeRef.current = onChange

  useEffect(() => {
    const e = monaco.editor.create(host.current!, {
      value,
      language: 'cpp',
      theme: 'vs-dark',
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14
    })
    e.onDidChangeModelContent(() => changeRef.current(e.getValue()))
    e.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveRef.current())
    ed.current = e
    return () => e.dispose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (ed.current && ed.current.getValue() !== value) ed.current.setValue(value)
  }, [value])

  return <div ref={host} style={{ height: '100%', width: '100%' }} />
}
