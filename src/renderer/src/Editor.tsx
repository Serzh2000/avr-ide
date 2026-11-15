import { useEffect, useRef, useState } from 'react'
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
import type { EditorMarker } from './contracts'
import { functions } from './reference/data'
import { runLocalChecks } from './editor/diagnostics'
import { ModelStore, keyFor } from './editor/models'
import { isCppPath } from './editor/language'
import { libReferenceQuery, setModelPlatform, setupMonaco } from './editor/monacoSetup'
import { setSketchSources } from './libs/store'
import { detectPlatform, findEntry } from './editor/resolve'
import { wordAt } from './editor/signature'
import { extractSymbols, variableTypes } from './editor/symbols'
import { THEME_DARK, THEME_LIGHT } from './editor/themes'
import type { FullEditorProps } from './editor/types'
import './editor/editor.css'

;(self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
  getWorker: () => new EditorWorker()
}

const MINIMAP_KEY = 'avr-ide.editor.minimap'
const OWNER_BUILD = 'avr-build'
const OWNER_LOCAL = 'avr-local'

const SEV: Record<EditorMarker['severity'], monaco.MarkerSeverity> = {
  error: monaco.MarkerSeverity.Error,
  warning: monaco.MarkerSeverity.Warning,
  info: monaco.MarkerSeverity.Info
}

function toMarkerData(model: monaco.editor.ITextModel, list: EditorMarker[]): monaco.editor.IMarkerData[] {
  return list.map((m) => {
    const r = model.validateRange(new monaco.Range(m.startLine, m.startColumn, m.endLine, m.endColumn))
    // пустой диапазон — подсвечиваем слово или хотя бы символ
    let { startLineNumber, startColumn, endLineNumber, endColumn } = r
    if (startLineNumber === endLineNumber && startColumn === endColumn) {
      const w = model.getWordAtPosition({ lineNumber: startLineNumber, column: startColumn })
      if (w) {
        startColumn = w.startColumn
        endColumn = w.endColumn
      } else endColumn = Math.min(startColumn + 1, model.getLineMaxColumn(startLineNumber))
    }
    return { severity: SEV[m.severity], message: m.message, source: m.source, startLineNumber, startColumn, endLineNumber, endColumn }
  })
}

function readMinimapPref(): boolean {
  try {
    return localStorage.getItem(MINIMAP_KEY) === '1'
  } catch {
    return false
  }
}

const HOTKEYS: [string, string][] = [
  ['Ctrl+S', 'сохранить'],
  ['Ctrl+Space', 'автодополнение'],
  ['F1 / Ctrl+Shift+H', 'справка по слову'],
  ['F8 / Shift+F8', 'следующая / предыдущая проблема'],
  ['Shift+Alt+F', 'форматировать'],
  ['Ctrl+/', 'комментарий'],
  ['Ctrl+F / Ctrl+H', 'поиск / замена'],
  ['Ctrl+G', 'перейти к строке'],
  ['Ctrl+колесо', 'масштаб шрифта'],
  ['Alt+Shift+M', 'миникарта']
]

export default function Editor(props: FullEditorProps) {
  const { value, filePath, markers, reveal, fontSize, theme, readOnly, platform } = props
  const host = useRef<HTMLDivElement>(null)
  const ed = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const store = useRef<ModelStore | null>(null)
  const curPath = useRef<string | null | undefined>(filePath)
  const applying = useRef(false)
  const localMarkers = useRef<EditorMarker[]>([])
  const buildMarkers = useRef<EditorMarker[]>(markers ?? [])
  const localTimer = useRef<number | undefined>(undefined)
  const decorations = useRef<monaco.editor.IEditorDecorationsCollection | null>(null)
  const refAction = useRef<monaco.IDisposable | null>(null)
  const refWord = useRef<string>('')

  const [minimap, setMinimap] = useState<boolean>(() => props.minimap ?? readMinimapPref())
  const [showHelp, setShowHelp] = useState(false)

  // актуальные значения для обработчиков, созданных один раз
  const live = useRef(props)
  live.current = props
  const minimapRef = useRef(minimap)
  minimapRef.current = minimap

  /** Пересчитать маркеры Monaco и глифы на полях. */
  const refreshMarkers = (): void => {
    const e = ed.current
    const model = e?.getModel()
    if (!e || !model) return
    monaco.editor.setModelMarkers(model, OWNER_BUILD, toMarkerData(model, buildMarkers.current))
    monaco.editor.setModelMarkers(model, OWNER_LOCAL, toMarkerData(model, localMarkers.current))
    const worst = new Map<number, EditorMarker['severity']>()
    const rank = { error: 3, warning: 2, info: 1 }
    for (const m of [...buildMarkers.current, ...localMarkers.current]) {
      const line = Math.min(Math.max(1, m.startLine), model.getLineCount())
      const prev = worst.get(line)
      if (!prev || rank[m.severity] > rank[prev]) worst.set(line, m.severity)
    }
    decorations.current?.set(
      [...worst].map(([line, sev]) => ({
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          glyphMarginClassName: `avr-glyph avr-glyph-${sev}`,
          className: sev === 'info' ? undefined : `avr-line-${sev}`,
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
        }
      }))
    )
  }

  const runLocal = (immediate = false): void => {
    window.clearTimeout(localTimer.current)
    const go = (): void => {
      const e = ed.current
      const model = e?.getModel()
      if (!model) return
      if (!isCppPath(curPath.current)) {
        localMarkers.current = []
      } else {
        const text = model.getValue()
        const p = live.current.platform ?? null
        localMarkers.current = runLocalChecks(text, { platform: p, effectivePlatform: p ?? detectPlatform(text) })
      }
      refreshMarkers()
    }
    if (immediate) go()
    else localTimer.current = window.setTimeout(go, 300)
  }

  /** Обновить пункт контекстного меню «Справка по «слово»». */
  const updateRefAction = (e: monaco.editor.IStandaloneCodeEditor): void => {
    const pos = e.getPosition()
    const model = e.getModel()
    let word = ''
    if (pos && model) word = wordAt(model.getLineContent(pos.lineNumber), pos.column - 1)?.word ?? ''
    if (word === refWord.current && refAction.current) return
    refWord.current = word
    refAction.current?.dispose()
    refAction.current = e.addAction({
      id: 'avr.reference',
      label: word ? `Справка по «${word}»` : 'Справка по слову под курсором',
      keybindings: [monaco.KeyCode.F1, monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyH],
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 0.5,
      run: (ed2) => {
        const p = ed2.getPosition()
        const m = ed2.getModel()
        if (!p || !m) return
        const w = wordAt(m.getLineContent(p.lineNumber), p.column - 1)
        if (!w) return
        const symbols = extractSymbols(m.getValue())
        const entry = findEntry(functions, w.word, { qualifier: w.qualifier, varTypes: variableTypes(symbols), platform: live.current.platform ?? detectPlatform(m.getValue()) })
        // слово из библиотеки проекта: справочник найдёт его среди символов подключённых библиотек
        const lib = entry ? undefined : libReferenceQuery(m, w)
        live.current.onOpenReference?.(entry ? entry.name : lib ?? w.word)
      }
    })
  }

  // ---- создание редактора ----
  useEffect(() => {
    setupMonaco()
    const models = new ModelStore()
    store.current = models
    const model = models.acquire(filePath, value)
    curPath.current = filePath
    setModelPlatform(model.uri, platform ?? null)

    const e = monaco.editor.create(host.current!, {
      model,
      theme: theme === 'light' ? THEME_LIGHT : THEME_DARK,
      automaticLayout: true,
      fontSize: fontSize ?? 14,
      fontFamily: "'Cascadia Code', 'Cascadia Mono', Consolas, 'Courier New', monospace",
      readOnly: !!readOnly,
      minimap: { enabled: minimapRef.current, renderCharacters: false, maxColumn: 100 },
      glyphMargin: true,
      folding: true,
      foldingHighlight: false,
      showFoldingControls: 'mouseover',
      lineNumbersMinChars: 3,
      matchBrackets: 'always',
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: true, indentation: true, highlightActiveIndentation: true },
      renderWhitespace: 'selection',
      renderLineHighlight: 'all',
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorSmoothCaretAnimation: 'on',
      mouseWheelZoom: true,
      tabSize: 2,
      insertSpaces: true,
      detectIndentation: false,
      wordBasedSuggestions: 'off',
      quickSuggestions: { other: true, comments: false, strings: false },
      suggest: { showSnippets: true, snippetsPreventQuickSuggestions: false, showWords: false, preview: true },
      parameterHints: { enabled: true, cycle: true },
      hover: { delay: 350, above: false },
      padding: { top: 6, bottom: 6 },
      fixedOverflowWidgets: true,
      overviewRulerBorder: false,
      stickyScroll: { enabled: false }
    })
    ed.current = e
    decorations.current = e.createDecorationsCollection()

    e.onDidChangeModelContent(() => {
      if (!applying.current) live.current.onChange(e.getValue())
      runLocal()
    })
    e.onDidChangeCursorPosition((ev) => {
      live.current.onCursorChange?.(ev.position.lineNumber, ev.position.column)
      updateRefAction(e)
    })
    e.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => live.current.onSave())
    e.addAction({
      id: 'avr.toggleMinimap',
      label: 'Показать/скрыть миникарту',
      keybindings: [monaco.KeyMod.Alt | monaco.KeyMod.Shift | monaco.KeyCode.KeyM],
      run: () => setMinimap((v) => !v)
    })
    updateRefAction(e)
    runLocal(true)

    return () => {
      window.clearTimeout(localTimer.current)
      refAction.current?.dispose()
      refAction.current = null
      const m = e.getModel()
      if (m) {
        monaco.editor.setModelMarkers(m, OWNER_BUILD, [])
        monaco.editor.setModelMarkers(m, OWNER_LOCAL, [])
      }
      e.dispose()
      models.disposeAll()
      ed.current = null
      store.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- смена файла / внешнее изменение текста ----
  useEffect(() => {
    const e = ed.current
    const models = store.current
    if (!e || !models) return
    if (keyFor(curPath.current) !== keyFor(filePath)) {
      models.saveState(curPath.current, e.saveViewState())
      const model = models.acquire(filePath, value)
      applying.current = true
      ModelStore.sync(model, value)
      applying.current = false
      curPath.current = filePath
      e.setModel(model)
      const st = models.getState(filePath)
      if (st) e.restoreViewState(st)
      models.trim(filePath)
      setModelPlatform(model.uri, platform ?? null)
      refWord.current = '\u0000'
      updateRefAction(e)
      runLocal(true)
    } else {
      const model = e.getModel()
      if (model && model.getValue() !== value) {
        applying.current = true
        ModelStore.sync(model, value)
        applying.current = false
        runLocal()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath, value])

  // ---- библиотеки проекта: #include из текущего файла и (если переданы) остальных файлов скетча ----
  useEffect(() => {
    // нет файла (активна вкладка настроек/справочника) или не C++ — список библиотек не трогаем
    if (filePath ? !isCppPath(filePath) : !value) return
    setSketchSources('editor', [value, ...(props.sketchSources ?? [])], { fqbn: props.fqbn ?? null, sketchDir: props.sketchDir ?? null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, filePath, props.sketchSources, props.fqbn, props.sketchDir])

  // ---- платформа ----
  useEffect(() => {
    const model = ed.current?.getModel()
    if (model) setModelPlatform(model.uri, platform ?? null)
    runLocal(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform, filePath])

  // ---- маркеры из props ----
  useEffect(() => {
    buildMarkers.current = markers ?? []
    refreshMarkers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, filePath])

  // ---- переход к позиции ----
  useEffect(() => {
    const e = ed.current
    const model = e?.getModel()
    if (!e || !model || !reveal) return
    const line = Math.min(Math.max(1, Math.floor(reveal.line)), model.getLineCount())
    let range: monaco.Range
    if (reveal.column && reveal.column > 0) {
      const col = Math.min(reveal.column, model.getLineMaxColumn(line))
      const w = model.getWordAtPosition({ lineNumber: line, column: col })
      range = w ? new monaco.Range(line, w.startColumn, line, w.endColumn) : new monaco.Range(line, col, line, col)
    } else {
      const first = model.getLineFirstNonWhitespaceColumn(line) || 1
      range = new monaco.Range(line, first, line, model.getLineMaxColumn(line))
    }
    e.setSelection(range)
    e.revealRangeInCenterIfOutsideViewport(range, monaco.editor.ScrollType.Smooth)
    e.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal?.nonce])

  // ---- внешний вид ----
  useEffect(() => {
    monaco.editor.setTheme(theme === 'light' ? THEME_LIGHT : THEME_DARK)
  }, [theme])
  useEffect(() => {
    ed.current?.updateOptions({ fontSize: fontSize ?? 14 })
  }, [fontSize])
  useEffect(() => {
    ed.current?.updateOptions({ readOnly: !!readOnly })
  }, [readOnly])
  useEffect(() => {
    if (props.minimap !== undefined) setMinimap(props.minimap)
  }, [props.minimap])
  useEffect(() => {
    ed.current?.updateOptions({ minimap: { enabled: minimap, renderCharacters: false, maxColumn: 100 } })
    if (props.minimap === undefined) {
      try {
        localStorage.setItem(MINIMAP_KEY, minimap ? '1' : '0')
      } catch {
        /* хранилище недоступно */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minimap])

  return (
    <div className="avr-ed-wrap" data-theme={theme === 'light' ? 'light' : 'dark'}>
      <div ref={host} className="avr-ed-host" />
      <button className="avr-ed-help-btn" type="button" title="Горячие клавиши" aria-label="Горячие клавиши редактора" aria-expanded={showHelp} onClick={() => setShowHelp((v) => !v)}>
        ?
      </button>
      {showHelp && (
        <div className="avr-ed-help" role="dialog" aria-label="Горячие клавиши">
          <h4>Горячие клавиши редактора</h4>
          <dl>
            {HOTKEYS.map(([k, d]) => (
              <div key={k} style={{ display: 'contents' }}>
                <dt>{k}</dt>
                <dd>{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}
