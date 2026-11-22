import { useEffect, useRef, useState } from 'react'
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
import type { EditorMarker } from './contracts'
import { functions } from './reference/data'
import { runLocalChecks } from './editor/diagnostics'
import { ModelStore, keyFor } from './editor/models'
import { isCppPath, languageForPath } from './editor/language'
import { libReferenceQuery, setModelPlatform, setModelPro, setupMonaco } from './editor/monacoSetup'
import { setSketchSources } from './libs/store'
import { detectPlatform, findEntry } from './editor/resolve'
import { wordAt } from './editor/signature'
import { extractSymbols, variableTypes } from './editor/symbols'
import { THEME_DARK, THEME_LIGHT } from './editor/themes'
import ProPanels, { useProUi } from './editor/pro/ProPanels'
import { ensureIndex, flushOverlay, pushOverlay, query } from './editor/pro/proClient'
import type { CursorReq, SymDto } from './editor/pro/proClient'
import { setupFormatter } from './editor/pro/proProviders'
import { isProjectFile, projectIssues } from './editor/pro/projectJson'
import { samePath } from './shell/problems'
import { useProStore } from './pro/proStore'
import { useUi } from './shell/ui'
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
    if (startLineNumber === endLineNumber && endColumn - startColumn <= 1) {
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

const PRO_HOTKEYS: [string, string][] = [
  ['F12 / Ctrl+клик', 'перейти к определению'],
  ['Shift+F12', 'найти ссылки'],
  ['F2', 'переименовать символ в проекте'],
  ['Ctrl+T', 'найти символ в проекте'],
  ['Ctrl+Shift+O', 'символы этого файла']
]

const PROJECT_SRC = /\.(c|h|cpp|hpp|cc|cxx|hh|s|inc)$/i

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

const PYTHON_HOTKEYS = HOTKEYS.filter(([key]) =>
  key !== 'Ctrl+Space' && key !== 'F1 / Ctrl+Shift+H' &&
  key !== 'F8 / Shift+F8' && key !== 'Shift+Alt+F'
)

export default function Editor(props: FullEditorProps) {
  const { value, filePath, markers, reveal, fontSize, theme, readOnly, platform } = props
  const isPython = languageForPath(filePath) === 'python'
  const host = useRef<HTMLDivElement>(null)
  const ed = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const store = useRef<ModelStore | null>(null)
  const curPath = useRef<string | null | undefined>(filePath)
  const applying = useRef(false)
  const dbgDeco = useRef<monaco.editor.IEditorDecorationsCollection | null>(null)
  const localMarkers = useRef<EditorMarker[]>([])
  const buildMarkers = useRef<EditorMarker[]>(markers ?? [])
  const localTimer = useRef<number | undefined>(undefined)
  const decorations = useRef<monaco.editor.IEditorDecorationsCollection | null>(null)
  const refAction = useRef<monaco.IDisposable | null>(null)
  const refWord = useRef<string>('')
  const linkDeco = useRef<monaco.editor.IEditorDecorationsCollection | null>(null)
  const proKey = useRef<monaco.editor.IContextKey<boolean> | null>(null)
  const linkKey = useRef('')
  const fmtChecked = useRef(false)

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
    const byLine = new Map<number, { severity: EditorMarker['severity']; messages: string[] }>()
    const rank = { error: 3, warning: 2, info: 1 }
    for (const m of [...buildMarkers.current, ...localMarkers.current]) {
      const line = Math.min(Math.max(1, m.startLine), model.getLineCount())
      const prev = byLine.get(line)
      if (prev) {
        if (rank[m.severity] > rank[prev.severity]) prev.severity = m.severity
        if (!prev.messages.includes(m.message)) prev.messages.push(m.message)
      } else byLine.set(line, { severity: m.severity, messages: [m.message] })
    }
    decorations.current?.set(
      [...byLine].map(([line, { severity: sev, messages }]) => ({
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          glyphMarginClassName: `avr-glyph avr-glyph-${sev}`,
          glyphMarginHoverMessage: messages.map((message) => ({ value: message })),
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
      if (isProjectFile(curPath.current)) {
        localMarkers.current = projectIssues(model.getValue()).map((i) => {
          const a = model.getPositionAt(i.start)
          const b = model.getPositionAt(i.end)
          return { startLine: a.lineNumber, startColumn: a.column, endLine: b.lineNumber, endColumn: b.column, severity: i.severity, message: i.message, source: 'avride.project.json' }
        })
      } else if (!isCppPath(curPath.current) || live.current.pro) {
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

  // ---- умный редактор Pro: переходы, ссылки, переименование, поиск символов ----
  const reqAt = (m: monaco.editor.ITextModel, p: monaco.IPosition): CursorReq => {
    const start = Math.max(1, p.lineNumber - 400)
    return {
      path: curPath.current ?? m.uri.fsPath, line: p.lineNumber, col: p.column, lineText: m.getLineContent(p.lineNumber),
      before: m.getValueInRange({ startLineNumber: start, startColumn: 1, endLineNumber: p.lineNumber, endColumn: p.column })
    }
  }
  const syncOverlay = async (m: monaco.editor.ITextModel): Promise<void> => {
    const cp = curPath.current
    if (cp && PROJECT_SRC.test(cp) && !live.current.readOnly) await flushOverlay(cp, m.getValue())
  }
  const goTo = (path: string, line: number, col: number): void => {
    const e = ed.current
    if (!e) return
    if (curPath.current && samePath(path, curPath.current)) {
      e.setPosition({ lineNumber: line, column: col })
      e.revealLineInCenter(line)
      e.focus()
    } else void live.current.onOpenLocation?.({ path, line, column: col })
  }
  const goDefinition = async (pos?: monaco.IPosition | null): Promise<void> => {
    const e = ed.current
    const m = e?.getModel()
    const p = pos ?? e?.getPosition()
    if (!e || !m || !p) return
    await syncOverlay(m)
    const r = await query<SymDto[]>('definition', reqAt(m, p))
    if (!r || r.length === 0) { useUi.getState().notify('Определение не найдено: это локальное имя или символ вне индекса проекта.'); return }
    let t = r[0]
    // курсор уже на определении — идём к следующему объявлению (например, к прототипу в заголовке)
    if (r.length > 1 && curPath.current && samePath(t.path, curPath.current) && t.line === p.lineNumber) t = r[1]
    goTo(t.path, t.line, t.col)
  }
  const showRefs = async (): Promise<void> => {
    const e = ed.current
    const m = e?.getModel()
    const p = e?.getPosition()
    if (!e || !m || !p) return
    await syncOverlay(m)
    const r = await query<{ name: string; refs: import('../../main/pro/symbols/types').RefMatch[]; truncated: boolean } | { error: string }>('references', reqAt(m, p))
    if (!r) { useUi.getState().notify('Индекс символов недоступен.'); return }
    if ('error' in r) { useUi.getState().notify(r.error); return }
    useProUi.getState().open({ kind: 'refs', name: r.name, refs: r.refs, truncated: r.truncated })
  }
  const startRename = async (): Promise<void> => {
    const e = ed.current
    const m = e?.getModel()
    const p = e?.getPosition()
    if (!e || !m || !p) return
    const w = m.getWordAtPosition(p)
    if (!w) { useUi.getState().notify('Поставьте курсор на имя символа.'); return }
    await syncOverlay(m)
    useProUi.getState().open({ kind: 'rename', req: reqAt(m, p), name: w.word })
  }
  const setupProEditor = (e: monaco.editor.IStandaloneCodeEditor): void => {
    proKey.current = e.createContextKey<boolean>('avrPro', !!live.current.pro)
    linkDeco.current = e.createDecorationsCollection()
    const act = (id: string, label: string, keys: number[], run: () => Promise<void>, order: number): void => {
      e.addAction({ id, label, keybindings: keys, precondition: 'avrPro', contextMenuGroupId: 'navigation', contextMenuOrder: order, run: () => { void run() } })
    }
    act('avr.pro.definition', 'Перейти к определению', [monaco.KeyCode.F12], () => goDefinition(), 0.1)
    act('avr.pro.references', 'Найти все ссылки', [monaco.KeyMod.Shift | monaco.KeyCode.F12], showRefs, 0.2)
    act('avr.pro.rename', 'Переименовать символ…', [monaco.KeyCode.F2], startRename, 0.3)
    act('avr.pro.symbols', 'Найти символ в проекте…', [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyT], async () => { useProUi.getState().open({ kind: 'symbols' }) }, 0.4)
    // Ctrl+клик — переход; при зажатом Ctrl слово, у которого есть определение, подчёркивается
    const clearLink = (): void => { linkKey.current = ''; linkDeco.current?.set([]) }
    e.onMouseDown((ev) => {
      const me = ev.event
      if (!live.current.pro || ev.target.type !== monaco.editor.MouseTargetType.CONTENT_TEXT || !(me.ctrlKey || me.metaKey) || !me.leftButton || !ev.target.position) return
      me.preventDefault()
      clearLink()
      void goDefinition(ev.target.position)
    })
    e.onMouseMove((ev) => {
      const me = ev.event
      const m = e.getModel()
      if (!live.current.pro || !m || !(me.ctrlKey || me.metaKey) || ev.target.type !== monaco.editor.MouseTargetType.CONTENT_TEXT || !ev.target.position) { if (linkKey.current) clearLink(); return }
      const pos = ev.target.position
      const w = m.getWordAtPosition(pos)
      if (!w) { clearLink(); return }
      const key = w.word + '|' + pos.lineNumber + '|' + w.startColumn
      if (key === linkKey.current) return
      linkKey.current = key
      void query<SymDto[]>('definition', reqAt(m, pos)).then((r) => {
        if (linkKey.current !== key) return
        linkDeco.current?.set(r && r.length ? [{ range: new monaco.Range(pos.lineNumber, w.startColumn, pos.lineNumber, w.endColumn), options: { inlineClassName: 'avr-pro-link' } }] : [])
      })
    })
    e.onKeyUp((ev) => { if (ev.keyCode === monaco.KeyCode.Ctrl || ev.keyCode === monaco.KeyCode.Meta) clearLink() })
    e.onMouseLeave(clearLink)
  }
  /** Форматирование в Pro — только через clang-format, если он найден; иначе пункт-подсказка вместо встроенного. */
  const setupProFormat = (e: monaco.editor.IStandaloneCodeEditor): void => {
    if (fmtChecked.current) return
    fmtChecked.current = true
    void setupFormatter().then((ok) => {
      if (ok || ed.current !== e) return
      e.addAction({
        id: 'avr.pro.formatHint', label: 'Форматировать документ (нужен clang-format)', keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF], precondition: 'avrPro',
        contextMenuGroupId: '1_modification', contextMenuOrder: 1.5,
        run: () => useUi.getState().notify('Форматирование недоступно: clang-format не найден. Установите LLVM (clang-format) или укажите путь переменной AVRIDE_PRO_CLANG_FORMAT и перезапустите IDE.')
      })
    })
  }

  // ---- создание редактора ----
  useEffect(() => {
    setupMonaco()
    const models = new ModelStore()
    store.current = models
    const model = models.acquire(filePath, value)
    curPath.current = filePath
    setModelPlatform(model.uri, platform ?? null); setModelPro(model.uri, !!props.pro)
    // для автотестов: доступ к Monaco (языки моделей, маркеры)
    if (window.api?.app?.isE2E) (window as unknown as { __avrMonaco?: typeof monaco }).__avrMonaco = monaco

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
      tabSize: isPython ? 4 : 2,
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
    if (props.pro) {
      // Monaco оценивает место для подсказок по окну целиком. Нижняя панель IDE не входит в редактор.
      const suggest = e.getContribution('editor.contrib.suggestController') as (monaco.editor.IEditorContribution & {
        forceRenderingAbove?: () => void
        stopForceRenderingAbove?: () => void
      }) | null
      let above = false
      const positionSuggestions = (): void => {
        const cursor = e.getPosition()
        const visible = cursor && e.getScrolledVisiblePosition(cursor)
        const next = !!visible && visible.top > 100 && e.getLayoutInfo().height - visible.top - visible.height < 210
        if (next === above) return
        above = next
        if (above) suggest?.forceRenderingAbove?.()
        else suggest?.stopForceRenderingAbove?.()
      }
      e.onDidChangeCursorPosition(positionSuggestions)
      e.onDidScrollChange(positionSuggestions)
      e.onDidLayoutChange(positionSuggestions)
      positionSuggestions()
    }
    decorations.current = e.createDecorationsCollection()
    dbgDeco.current = e.createDecorationsCollection()
    // Поле слева (Pro-режим): щелчок по полю или номеру строки ставит/снимает точку останова
    e.onMouseDown((ev) => {
      const d = live.current.debug
      const t = ev.target.type
      if (d && ev.target.position && (t === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN || t === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS)) d.onToggleBreakpoint(ev.target.position.lineNumber)
    })

    e.onDidChangeModelContent(() => {
      if (!applying.current) live.current.onChange(e.getValue())
      runLocal()
      const cp = curPath.current
      if (live.current.pro && cp && PROJECT_SRC.test(cp) && !live.current.readOnly) pushOverlay(cp, e.getValue())
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
    setupProEditor(e)

    return () => {
      proKey.current = null
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
      { const pos = e.getPosition(); if (pos) live.current.onCursorChange?.(pos.lineNumber, pos.column) } // строка статус-бара — от этого файла
      models.trim(filePath)
      setModelPlatform(model.uri, platform ?? null); setModelPro(model.uri, !!props.pro)
      refWord.current = '\u0000'
      updateRefAction(e)
      runLocal(true)
      if (live.current.pro && filePath && PROJECT_SRC.test(filePath) && !live.current.readOnly) pushOverlay(filePath, model.getValue())
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
    if (model) { setModelPlatform(model.uri, platform ?? null); setModelPro(model.uri, !!props.pro) }
    runLocal(true)
    proKey.current?.set(!!props.pro)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform, filePath, props.pro])

  // ---- Pro: индекс символов проекта (сборка при открытии, освежение при возврате в окно и смене конфигурации) ----
  useEffect(() => {
    if (!props.pro) return
    void ensureIndex(useProStore.getState().config)
    if (ed.current) setupProFormat(ed.current)
    const onFocus = (): void => { void ensureIndex(useProStore.getState().config) }
    window.addEventListener('focus', onFocus)
    const unsub = useProStore.subscribe((s, prev) => { if (s.config !== prev.config) void ensureIndex(s.config, true) })
    return () => { window.removeEventListener('focus', onFocus); unsub() }
  }, [props.pro, props.sketchDir])

  // ---- маркеры из props ----
  useEffect(() => {
    buildMarkers.current = markers ?? []
    refreshMarkers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, filePath])

  // ---- точки останова и строка остановки отладчика ----
  const dbgSig = JSON.stringify(props.debug ? [props.debug.breakpoints, props.debug.line] : null)
  useEffect(() => {
    const d = props.debug
    const model = ed.current?.getModel()
    if (!dbgDeco.current) return
    if (!d || !model) { dbgDeco.current.set([]); return }
    const n = model.getLineCount()
    const out: monaco.editor.IModelDeltaDecoration[] = d.breakpoints.filter((b) => b.line >= 1 && b.line <= n).map((b) => ({
      range: new monaco.Range(b.line, 1, b.line, 1),
      options: { glyphMarginClassName: 'avr-bp-glyph' + (b.verified ? '' : ' avr-bp-glyph-off'), glyphMarginHoverMessage: { value: b.verified ? 'Точка останова' : 'Точка останова (ещё не подтверждена отладчиком)' } }
    }))
    if (d.line && d.line >= 1 && d.line <= n) out.push({ range: new monaco.Range(d.line, 1, d.line, 1), options: { isWholeLine: true, className: 'avr-debug-line', glyphMarginClassName: 'avr-debug-glyph', glyphMarginHoverMessage: { value: 'Здесь остановлена программа' } } })
    dbgDeco.current.set(out)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbgSig, filePath])

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
      {props.pro && (
        <ProPanels hooks={{ root: props.sketchDir ?? null, onOpen: (path, line, col) => goTo(path, line, col), onApply: async (files) => { await live.current.onApplyEdits?.(files); void ensureIndex(undefined, true) }, focusEditor: () => ed.current?.focus() }} />
      )}
      {showHelp && (
        <div className="avr-ed-help" role="dialog" aria-label="Горячие клавиши">
          <h4>Горячие клавиши редактора</h4>
          <dl>
            {(isPython ? PYTHON_HOTKEYS : props.pro ? [...HOTKEYS, ...PRO_HOTKEYS] : HOTKEYS).map(([k, d]) => (
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
