// Однократная настройка Monaco: язык «arduino», темы, провайдеры дополнения/подсказок/форматирования.
import { proCandidates } from './proComplete'
import * as monaco from 'monaco-editor'
import { functions } from '../reference/data'
import type { FuncEntry } from '../reference/types'
import { PLATFORM_LABELS } from '../reference/types'
import { computeCompletions, entryDoc, type Candidate, type CandidateKind } from './completion'
import { CONSTANTS } from './constants'
import { formatCode } from './format'
import { buildMonarch } from './monarch'
import { findEntry, isCodeName, parseSignature, detectPlatform } from './resolve'
import { findCallContext, wordAt } from './signature'
import { insideCommentOrString, scan } from './scan'
import { extractSymbols, variableTypes, type FileSymbol } from './symbols'
import { getLibsState } from '../libs/store'
import { classOfObject, type LibIndex } from '../libs/model'
import { allVariableClasses, findIndexContext, inferExprClass } from '../libs/infer'
import { operatorSignatures, pickOverload, refName, resolveWord, signatureCandidates, symbolDoc, type SigCandidate } from '../libs/complete'
import { darkTheme, lightTheme, THEME_DARK, THEME_LIGHT } from './themes'
import type { EditorPlatform } from './types'

export const LANG_ID = 'arduino'
const SELECTOR: monaco.languages.LanguageSelector = LANG_ID

/** Платформа каждой модели (задаёт Editor). */
const platformByModel = new Map<string, EditorPlatform | null>()
export function setModelPlatform(uri: monaco.Uri, platform: EditorPlatform | null): void {
  platformByModel.set(uri.toString(), platform)
}
/** Модели профессионального режима: подсказки Arduino отключены, остаются C-ключевые слова, сниппеты и символы файла. */
const proModels = new Set<string>()
export function setModelPro(uri: monaco.Uri, pro: boolean): void {
  if (pro) proModels.add(uri.toString())
  else proModels.delete(uri.toString())
}
export function forgetModel(uri: monaco.Uri): void {
  proModels.delete(uri.toString())
  platformByModel.delete(uri.toString())
  cache.delete(uri.toString())
  libTypeCache.delete(uri.toString())
}

function platformOf(model: monaco.editor.ITextModel): EditorPlatform | null {
  return platformByModel.get(model.uri.toString()) ?? detectPlatform(model.getValue())
}

// символы файла кэшируем по версии модели
const cache = new Map<string, { version: number; symbols: FileSymbol[]; types: Record<string, string> }>()
function symbolsOf(model: monaco.editor.ITextModel): { symbols: FileSymbol[]; types: Record<string, string> } {
  const key = model.uri.toString()
  const v = model.getVersionId()
  const hit = cache.get(key)
  if (hit && hit.version === v) return hit
  const symbols = extractSymbols(model.getValue())
  const next = { version: v, symbols, types: variableTypes(symbols) }
  cache.set(key, next)
  return next
}

// переменные файла с типом-классом из библиотек проекта: кэш по версии модели и версии индекса библиотек
const libTypeCache = new Map<string, { version: number; libVersion: number; types: Record<string, string> }>()
function libTypesOf(model: monaco.editor.ITextModel): Record<string, string> {
  const st = getLibsState()
  if (st.index.classesBySimple.size === 0) return {}
  const key = model.uri.toString()
  const v = model.getVersionId()
  const hit = libTypeCache.get(key)
  if (hit && hit.version === v && hit.libVersion === st.version) return hit.types
  const types = allVariableClasses(scan(model.getValue()).masked, st.index)
  libTypeCache.set(key, { version: v, libVersion: st.version, types })
  return types
}

/** Класс составного получателя (obj.a().b, doc["k"]) или undefined. */
function receiverClass(lc: { index: LibIndex; libTypes: Record<string, string> }, receiver: string | undefined, fileTypes: Record<string, string>): string | undefined {
  if (!receiver) return undefined
  return inferExprClass(lc.index, receiver, (n) => classOfObject(lc.index, n, fileTypes, lc.libTypes))
}

function sigHelp(cands: SigCandidate[], argIndex: number): monaco.languages.SignatureHelpResult {
  const active = pickOverload(cands, argIndex)
  return {
    value: {
      signatures: cands.map((c) => ({
        label: c.label,
        documentation: c.doc ? { value: c.doc } : undefined,
        parameters: c.params.map((p, i) => ({ label: p, documentation: c.paramDocs[i] ? { value: c.paramDocs[i]! } : undefined }))
      })),
      activeSignature: active,
      activeParameter: Math.min(argIndex, Math.max(0, cands[active].params.length - 1))
    },
    dispose() {}
  }
}

/** Подсказки по библиотекам для модели: индекс и типы переменных (null, если библиотек нет). */
export function libContextOf(model: monaco.editor.ITextModel): { index: LibIndex; libTypes: Record<string, string> } | null {
  const st = getLibsState()
  if (st.index.all.length === 0) return null
  return { index: st.index, libTypes: libTypesOf(model) }
}

/** Для F1: слово из библиотеки проекта → строка запроса для справочника («Adafruit_BMP280.begin», «ESPUI»); undefined — не из библиотек. */
export function libReferenceQuery(model: monaco.editor.ITextModel, w: { word: string; qualifier: string | null; scope: string | null; receiver?: string }): string | undefined {
  const lc = libContextOf(model)
  if (!lc) return undefined
  const { types } = symbolsOf(model)
  const recvCls = receiverClass(lc, w.receiver, types)
  if (w.receiver && !recvCls) return undefined
  let refs = resolveWord(lc.index, w.word, recvCls ?? w.qualifier, types, lc.libTypes, w.scope)
  if (refs.length === 0 && !w.qualifier && !w.scope && lc.libTypes[w.word]) refs = lc.index.classesBySimple.get(lc.libTypes[w.word]) ?? []
  return refs.length ? refName(refs[0].sym) : undefined
}

const KIND: Record<CandidateKind, monaco.languages.CompletionItemKind> = {
  function: monaco.languages.CompletionItemKind.Function,
  method: monaco.languages.CompletionItemKind.Method,
  constant: monaco.languages.CompletionItemKind.Constant,
  class: monaco.languages.CompletionItemKind.Class,
  keyword: monaco.languages.CompletionItemKind.Keyword,
  type: monaco.languages.CompletionItemKind.TypeParameter,
  variable: monaco.languages.CompletionItemKind.Variable,
  snippet: monaco.languages.CompletionItemKind.Snippet,
  macro: monaco.languages.CompletionItemKind.Constant,
  file: monaco.languages.CompletionItemKind.File
}

function toItem(c: Candidate, range: monaco.IRange): monaco.languages.CompletionItem {
  return {
    label: c.label,
    kind: KIND[c.kind],
    insertText: c.insertText,
    insertTextRules: c.isSnippet ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
    detail: c.detail,
    documentation: c.documentation ? { value: c.documentation } : undefined,
    range,
    sortText: String(c.rank) + c.label.toLowerCase(),
    filterText: c.filterText
  }
}

function hoverMarkdown(e: FuncEntry): monaco.IMarkdownString[] {
  const parts: monaco.IMarkdownString[] = [{ value: entryDoc(e) }]
  const meta: string[] = [e.category]
  if (e.platforms.length < 5) meta.push(e.platforms.map((p) => PLATFORM_LABELS[p] ?? p).join(', '))
  parts.push({ value: `*${meta.join(' · ')}* — F1 открывает справку` })
  return parts
}

let done = false

/** Регистрирует язык, темы и провайдеры. Безопасно вызывать многократно. */
export function setupMonaco(): void {
  if (done) return
  done = true

  // Языковые сервисы JSON/CSS/HTML/JS в Monaco требуют отдельных воркеров, которых в сборке нет:
  // оставляем только подсветку, остальное отключаем (иначе будут ошибки воркера в консоли).
  const tokensOnly = { tokens: true }
  try {
    monaco.json.jsonDefaults.setDiagnosticsOptions({ validate: false })
    monaco.json.jsonDefaults.setModeConfiguration({ ...tokensOnly, documentFormattingEdits: false, documentRangeFormattingEdits: false, completionItems: false, hovers: false, documentSymbols: false, colors: false, foldingRanges: false, diagnostics: false, selectionRanges: false })
    monaco.css.cssDefaults.setOptions({ validate: false })
    monaco.css.cssDefaults.setModeConfiguration({ ...tokensOnly, completionItems: false, hovers: false, documentSymbols: false, definitions: false, references: false, documentHighlights: false, rename: false, colors: false, foldingRanges: false, diagnostics: false, selectionRanges: false, documentFormattingEdits: false, documentRangeFormattingEdits: false })
    monaco.html.htmlDefaults.setModeConfiguration({ ...tokensOnly, completionItems: false, hovers: false, documentSymbols: false, links: false, documentHighlights: false, rename: false, colors: false, foldingRanges: false, selectionRanges: false, diagnostics: false, documentFormattingEdits: false, documentRangeFormattingEdits: false })
    const off = { noSemanticValidation: true, noSyntaxValidation: true, noSuggestionDiagnostics: true }
    monaco.typescript.javascriptDefaults.setDiagnosticsOptions(off)
    monaco.typescript.javascriptDefaults.setModeConfiguration({ completionItems: false, hovers: false, documentSymbols: false, definitions: false, references: false, documentHighlights: false, rename: false, diagnostics: false, documentRangeFormattingEdits: false, signatureHelp: false, onTypeFormattingEdits: false, codeActions: false, inlayHints: false })
  } catch {
    /* версия Monaco без этих настроек — не критично */
  }

  monaco.languages.register({ id: LANG_ID, extensions: ['.ino', '.pde'], aliases: ['Arduino', 'arduino'] })
  monaco.languages.setLanguageConfiguration(LANG_ID, {
    comments: { lineComment: '//', blockComment: ['/*', '*/'] },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '[', close: ']' },
      { open: '{', close: '}' },
      { open: '(', close: ')' },
      { open: "'", close: "'", notIn: ['string', 'comment'] },
      { open: '"', close: '"', notIn: ['string'] },
      { open: '/*', close: ' */', notIn: ['string'] }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    indentationRules: {
      increaseIndentPattern: /^.*\{[^}"']*$|^.*\([^)"']*$/,
      decreaseIndentPattern: /^\s*[})\]]/
    },
    onEnterRules: [
      { beforeText: /^\s*\/\*\*(?!\/)([^*]|\*(?!\/))*$/, afterText: /^\s*\*\/$/, action: { indentAction: monaco.languages.IndentAction.IndentOutdent, appendText: ' * ' } },
      { beforeText: /^\s*\/\*\*(?!\/)([^*]|\*(?!\/))*$/, action: { indentAction: monaco.languages.IndentAction.None, appendText: ' * ' } },
      { beforeText: /^(\t|[ ])*[ ]\*([ ]([^*]|\*(?!\/))*)?$/, action: { indentAction: monaco.languages.IndentAction.None, appendText: '* ' } }
    ],
    folding: { markers: { start: /^\s*#pragma\s+region\b/, end: /^\s*#pragma\s+endregion\b/ } }
  })

  const fnNames = new Set<string>()
  for (const e of functions) if (!e.name.includes('.') && isCodeName(e.name) && e.signature.includes('(')) fnNames.add(e.name)
  for (const n of ['pinMode', 'digitalWrite', 'digitalRead', 'analogRead', 'analogWrite', 'delay', 'delayMicroseconds', 'millis', 'micros', 'tone', 'noTone', 'attachInterrupt', 'detachInterrupt', 'map', 'constrain', 'random', 'randomSeed', 'min', 'max', 'abs', 'pow', 'sqrt', 'sin', 'cos', 'tan', 'pulseIn', 'shiftIn', 'shiftOut', 'setup', 'loop', 'yield']) fnNames.add(n)
  monaco.languages.setMonarchTokensProvider(LANG_ID, buildMonarch([...fnNames]))

  monaco.editor.defineTheme(THEME_DARK, darkTheme)
  monaco.editor.defineTheme(THEME_LIGHT, lightTheme)

  // ----- автодополнение -----
  monaco.languages.registerCompletionItemProvider(SELECTOR, {
    triggerCharacters: ['.', '<', '"', '/', '#', ':', '>'],
    provideCompletionItems(model, position, context) {
      const textBefore = model.getValueInRange({ startLineNumber: 1, startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column })
      const { symbols } = symbolsOf(model)
      // «>» и «:» — триггеры только для «->» и «::» (иначе список всплывал бы после каждого сравнения и тернарного оператора)
      if (context.triggerKind === monaco.languages.CompletionTriggerKind.TriggerCharacter) {
        const lp = model.getValueInRange({ startLineNumber: position.lineNumber, startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column })
        if (context.triggerCharacter === '>' && !/->\s*\w*$/.test(lp)) return { suggestions: [] }
        if (context.triggerCharacter === ':' && !/::\s*\w*$/.test(lp)) return { suggestions: [] }
      }
      if (proModels.has(model.uri.toString())) {
        const w = model.getWordUntilPosition(position)
        const rng = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: w.startColumn, endColumn: position.column }
        return { suggestions: proCandidates(symbols).map((c) => toItem(c, rng)) }
      }
      const lc = libContextOf(model)
      const res = computeCompletions({ textBefore, platform: platformOf(model), entries: functions, symbols, libs: lc?.index, libTypes: lc?.libTypes })
      const word = model.getWordUntilPosition(position)
      let startColumn = word.startColumn
      if (res.replaceFromInLine !== undefined) startColumn = res.replaceFromInLine + 1
      const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn, endColumn: position.column }
      return { suggestions: res.items.map((c) => toItem(c, range)) }
    }
  })

  // ----- hover -----
  monaco.languages.registerHoverProvider(SELECTOR, {
    provideHover(model, position) {
      if (proModels.has(model.uri.toString())) return null
      const line = model.getLineContent(position.lineNumber)
      const w = wordAt(line, position.column - 1)
      if (!w) return null
      // не показываем подсказки в комментариях и строках
      const upTo = model.getValueInRange({ startLineNumber: 1, startColumn: 1, endLineNumber: position.lineNumber, endColumn: w.end + 1 })
      if (insideCommentOrString(upTo)) return null
      const { symbols, types } = symbolsOf(model)
      const range = new monaco.Range(position.lineNumber, w.start + 1, position.lineNumber, w.end + 1)
      const entry = findEntry(functions, w.word, { qualifier: w.qualifier, varTypes: types, platform: platformOf(model) })
      const lc = libContextOf(model)
      const libHover = (): monaco.IMarkdownString[] | null => {
        if (!lc) return null
        const recvCls = receiverClass(lc, w.receiver, types)
        if (w.receiver && !recvCls) return null
        let refs = resolveWord(lc.index, w.word, recvCls ?? w.qualifier, types, lc.libTypes, w.scope)
        let extra = ''
        if (refs.length === 0 && !w.qualifier && !w.scope) {
          // имя переменной, объявленной с классом из библиотеки
          const cls = lc.libTypes[w.word]
          const def = cls ? lc.index.classesBySimple.get(cls)?.[0] : undefined
          if (def) {
            refs = [def]
            extra = `Переменная типа **${cls}**

`
          }
        }
        if (refs.length === 0) return null
        // перегрузки одного имени и kind показываем одним блоком
        const first = refs[0]
        const same = refs.filter((r) => r !== first && r.sym.kind === first.sym.kind && r.sym.name === first.sym.name)
        return [{ value: extra + symbolDoc(first, same) }]
      }
      if (entry) {
        const more = libHover()
        return { range, contents: more ? [...hoverMarkdown(entry), ...more] : hoverMarkdown(entry) }
      }
      const lh = libHover()
      if (lh) return { range, contents: lh }
      if (!w.qualifier) {
        const c = CONSTANTS.find((x) => x.name === w.word)
        if (c) return { range, contents: [{ value: `**${c.name}** — ${c.detail}\n\n${c.doc}` }] }
        const s = symbols.find((x) => x.name === w.word)
        if (s) return { range, contents: [{ value: '```cpp\n' + s.detail + '\n```' }, { value: `Объявлено в этом файле, строка ${s.line}` }] }
      }
      return null
    }
  })

  // ----- Signature Help -----
  monaco.languages.registerSignatureHelpProvider(SELECTOR, {
    signatureHelpTriggerCharacters: ['(', ',', '['],
    signatureHelpRetriggerCharacters: [',', ']'],
    provideSignatureHelp(model, position) {
      if (proModels.has(model.uri.toString())) return null
      const textBefore = model.getValueInRange({ startLineNumber: 1, startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column })
      const lc0 = libContextOf(model)
      // doc["key"] — внутри [ ] подсказываем operator[] класса и тип результата
      if (lc0) {
        const ic = findIndexContext(scan(textBefore.slice(-1500)).masked)
        if (ic) {
          const { types: ft } = symbolsOf(model)
          const cls = receiverClass(lc0, ic.receiver, ft)
          const cands = cls ? operatorSignatures(lc0.index, cls, 'operator[]') : []
          if (cands.length) return sigHelp(cands, 0)
          return null
        }
      }
      const ctx = findCallContext(textBefore)
      if (!ctx) return null
      const { symbols, types } = symbolsOf(model)
      // библиотеки проекта: все перегрузки из заголовков
      const lc = lc0
      if (lc) {
        const recvCls = receiverClass(lc, ctx.receiver, types)
        if (ctx.receiver && !recvCls) return null // составной получатель неизвестного типа — честно молчим
        const cands = signatureCandidates(lc.index, ctx.name, recvCls ?? ctx.qualifier, types, lc.libTypes, ctx.scope)
        if (cands.length) return sigHelp(cands, ctx.argIndex)
      }
      const entry = findEntry(functions, ctx.name, { qualifier: ctx.qualifier, varTypes: types, platform: platformOf(model) })
      let label: string
      let params: string[]
      let doc: string | undefined
      let paramDocs: (string | undefined)[] = []
      if (entry) {
        const parsed = parseSignature(entry.signature)
        if (!parsed.hasParens) return null
        label = entry.signature
        params = parsed.params
        doc = entry.description
        paramDocs = params.map((p, i) => entry.params[i]?.desc ?? entry.params.find((x) => new RegExp(`\\b${x.name}\\b`).test(p))?.desc)
      } else {
        const s = !ctx.qualifier ? symbols.find((x) => x.name === ctx.name && x.kind === 'function') : undefined
        if (!s) return null
        label = s.detail
        params = parseSignature(s.detail).params
        doc = `Функция из этого файла, строка ${s.line}`
      }
      return {
        value: {
          signatures: [
            {
              label,
              documentation: doc ? { value: doc } : undefined,
              parameters: params.map((p, i) => ({ label: p, documentation: paramDocs[i] ? { value: paramDocs[i]! } : undefined }))
            }
          ],
          activeSignature: 0,
          activeParameter: Math.min(ctx.argIndex, Math.max(0, params.length - 1))
        },
        dispose() {}
      }
    }
  })

  // ----- форматирование -----
  monaco.languages.registerDocumentFormattingEditProvider(SELECTOR, {
    displayName: 'Arduino (отступы по скобкам)',
    provideDocumentFormattingEdits(model) {
      const opts = model.getOptions()
      const formatted = formatCode(model.getValue(), { indent: opts.insertSpaces ? ' '.repeat(opts.tabSize) : '\t' })
      if (formatted === model.getValue()) return []
      return [{ range: model.getFullModelRange(), text: formatted }]
    }
  })
  monaco.languages.registerDocumentRangeFormattingEditProvider(SELECTOR, {
    displayName: 'Arduino (отступы по скобкам)',
    provideDocumentRangeFormattingEdits(model, range) {
      const opts = model.getOptions()
      const formatted = formatCode(model.getValue(), { indent: opts.insertSpaces ? ' '.repeat(opts.tabSize) : '\t' }).split(/\r?\n/)
      const edits: monaco.languages.TextEdit[] = []
      for (let l = range.startLineNumber; l <= range.endLineNumber; l++) {
        const cur = model.getLineContent(l)
        if (formatted[l - 1] !== undefined && formatted[l - 1] !== cur) edits.push({ range: new monaco.Range(l, 1, l, cur.length + 1), text: formatted[l - 1] })
      }
      return edits
    }
  })
}
