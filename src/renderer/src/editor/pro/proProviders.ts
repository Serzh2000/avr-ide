// Провайдеры Monaco для Pro-режима: дополнение, hover, подсказка параметров, символы документа (C/C++ и ассемблер), avride.project.json, clang-format.
// Данные приходят из индекса символов в main (IPC); Arduino-провайдеры не затрагиваются (другой язык модели: «avr-c»).
import * as monaco from 'monaco-editor'
import type { CompletionDto, FormatResult, HoverDto, SignatureDto } from '../../../../main/pro/symbols/types'
import type { Sym, SymKind } from '../../../../shared/pro/cindex/types'
import { parseAsm, parseSource } from '../../../../shared/pro/cindex/parse'
import { expandSnippet, regSnippets } from '../../../../shared/pro/regSnippets'
import { useProStore } from '../../pro/proStore'
import { proCandidates } from '../proComplete'
import { extractSymbols } from '../symbols'
import { LANG_ASM, LANG_C } from './proLang'
import { fieldAt, FIELDS, childKeys, cursorPath, isProjectFile, normalizePath } from './projectJson'
import { query } from './proClient'

export const modelFsPath = (model: monaco.editor.ITextModel): string => model.uri.fsPath

const KIND: Record<string, monaco.languages.CompletionItemKind> = {
  function: monaco.languages.CompletionItemKind.Function,
  macro: monaco.languages.CompletionItemKind.Constant,
  variable: monaco.languages.CompletionItemKind.Variable,
  struct: monaco.languages.CompletionItemKind.Struct,
  union: monaco.languages.CompletionItemKind.Struct,
  enum: monaco.languages.CompletionItemKind.Enum,
  class: monaco.languages.CompletionItemKind.Class,
  typedef: monaco.languages.CompletionItemKind.TypeParameter,
  enumerator: monaco.languages.CompletionItemKind.EnumMember,
  field: monaco.languages.CompletionItemKind.Field,
  file: monaco.languages.CompletionItemKind.File,
  label: monaco.languages.CompletionItemKind.Reference,
  keyword: monaco.languages.CompletionItemKind.Keyword
}

const SYM_KIND: Record<SymKind, monaco.languages.SymbolKind> = {
  macro: monaco.languages.SymbolKind.Constant,
  function: monaco.languages.SymbolKind.Function,
  variable: monaco.languages.SymbolKind.Variable,
  struct: monaco.languages.SymbolKind.Struct,
  union: monaco.languages.SymbolKind.Struct,
  enum: monaco.languages.SymbolKind.Enum,
  class: monaco.languages.SymbolKind.Class,
  typedef: monaco.languages.SymbolKind.TypeParameter,
  enumerator: monaco.languages.SymbolKind.EnumMember,
  field: monaco.languages.SymbolKind.Field,
  label: monaco.languages.SymbolKind.Key
}

const sortKey = (n: number): string => String(Math.max(0, n + 5000)).padStart(6, '0')

function mdCode(code: string): string { return '```c\n' + code + '\n```' }

function hoverContents(h: HoverDto): monaco.IMarkdownString[] {
  const out: monaco.IMarkdownString[] = [{ value: mdCode(h.code) }]
  if (h.doc) out.push({ value: h.doc.replace(/\n/g, '  \n') })
  if (h.facts.length) out.push({ value: h.facts.map((f) => `- ${f}`).join('\n') })
  if (h.where) {
    const name = h.where.path.split('/').pop()
    out.push({ value: `*${h.where.own ? 'Объявлено' : 'Заголовок'}: ${name}, строка ${h.where.line} — F12 открывает*` })
  }
  return out
}

function cursorReq(model: monaco.editor.ITextModel, pos: monaco.Position): { path: string; line: number; col: number; lineText: string; before: string } {
  const start = Math.max(1, pos.lineNumber - 400)
  return {
    path: modelFsPath(model), line: pos.lineNumber, col: pos.column, lineText: model.getLineContent(pos.lineNumber),
    before: model.getValueInRange({ startLineNumber: start, startColumn: 1, endLineNumber: pos.lineNumber, endColumn: pos.column })
  }
}

/** Дерево символов файла для Ctrl+Shift+O: поля и перечислители — внутри своих типов. */
export function documentSymbols(text: string, asm: boolean): monaco.languages.DocumentSymbol[] {
  const idx = asm ? parseAsm(text) : parseSource(text, {})
  const lines = text.split('\n')
  const mk = (s: Sym): monaco.languages.DocumentSymbol => {
    const len = lines[s.l - 1]?.length ?? 1
    return {
      name: s.n, detail: s.k === 'macro' ? (s.v ?? '').slice(0, 40) : s.s && s.s !== s.n ? s.s.slice(0, 80) : '', kind: SYM_KIND[s.k] ?? monaco.languages.SymbolKind.Variable, tags: [],
      range: new monaco.Range(s.l, 1, s.l, len + 1), selectionRange: new monaco.Range(s.l, s.c, s.l, s.c + s.n.length), children: []
    }
  }
  const owners = new Map<string, monaco.languages.DocumentSymbol>()
  const top: monaco.languages.DocumentSymbol[] = []
  for (const s of idx.syms) {
    if (s.k === 'struct' || s.k === 'union' || s.k === 'enum' || s.k === 'class') {
      if (s.t) continue
      const d = mk(s)
      owners.set(s.n, d)
      top.push(d)
    }
  }
  for (const s of idx.syms) {
    if (s.k === 'struct' || s.k === 'union' || s.k === 'enum' || s.k === 'class') continue
    const d = mk(s)
    const parent = s.p ? owners.get(s.p) : undefined
    if ((s.k === 'field' || s.k === 'enumerator' || (s.k === 'function' && s.p)) && parent) { parent.children!.push(d); continue }
    if (s.k === 'field' && s.p) continue
    top.push(d)
  }
  return top.sort((a, b) => a.selectionRange.startLineNumber - b.selectionRange.startLineNumber)
}

let formatter: monaco.IDisposable | null = null

/** Подключает форматирование clang-format, если он найден; иначе пункт «Форматировать» в Pro отсутствует. Возвращает доступность. */
export async function setupFormatter(): Promise<boolean> {
  const f = await query<{ available: boolean }>('formatter')
  if (!f?.available) { formatter?.dispose(); formatter = null; return false }
  if (formatter) return true
  formatter = monaco.languages.registerDocumentFormattingEditProvider(LANG_C, {
    displayName: 'clang-format',
    async provideDocumentFormattingEdits(model) {
      const r = await query<FormatResult>('format', { text: model.getValue(), path: modelFsPath(model) })
      if (!r?.ok || r.text === undefined) throw new Error(r?.error ?? 'clang-format не выполнился')
      if (r.text === model.getValue()) return []
      return [{ range: model.getFullModelRange(), text: r.text }]
    }
  })
  return true
}

let done = false

export function registerProProviders(): void {
  if (done) return
  done = true

  monaco.languages.registerCompletionItemProvider(LANG_C, {
    triggerCharacters: ['.', '>', '"', '<', '/'],
    async provideCompletionItems(model, position, context) {
      const req = cursorReq(model, position)
      if (context.triggerKind === monaco.languages.CompletionTriggerKind.TriggerCharacter) {
        if (context.triggerCharacter === '>' && !/->\s*\w*$/.test(req.lineText.slice(0, position.column - 1))) return { suggestions: [] }
      }
      const res = await query<CompletionDto>('complete', { before: req.before })
      const w = model.getWordUntilPosition(position)
      let startColumn = w.startColumn
      const lineBefore = req.lineText.slice(0, position.column - 1)
      if (res?.context === 'include') startColumn = Math.max(lineBefore.lastIndexOf('"'), lineBefore.lastIndexOf('<')) + 2
      const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn, endColumn: position.column }
      const items: monaco.languages.CompletionItem[] = []
      const seen = new Set<string>()
      for (const c of res?.items ?? []) {
        seen.add(c.label)
        items.push({
          label: c.label, kind: KIND[c.kind] ?? monaco.languages.CompletionItemKind.Text, insertText: c.insert ?? c.label, range,
          detail: c.detail && c.detail !== c.label ? c.detail : undefined,
          documentation: c.doc ? { value: c.doc } : undefined, sortText: sortKey(c.sort) + c.label.toLowerCase()
        })
      }
      if (res?.context === 'plain' || !res) {
        // ключевые слова, типы stdint, общие сниппеты и символы самого файла; сниппеты регистров — по семейству проекта
        const fam = useProStore.getState().project?.target.family
        for (const s of regSnippets(fam)) items.push({ label: s.prefix, kind: monaco.languages.CompletionItemKind.Snippet, insertText: s.body, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, detail: s.title, documentation: { value: s.doc + '\n\n```c\n' + expandSnippet(s.body) + '\n```' }, sortText: '900000' + s.prefix, filterText: s.prefix })
        for (const c of proCandidates(extractSymbols(model.getValue()))) {
          if (seen.has(c.label)) continue
          items.push({ label: c.label, kind: c.kind === 'snippet' ? monaco.languages.CompletionItemKind.Snippet : c.kind === 'keyword' ? monaco.languages.CompletionItemKind.Keyword : c.kind === 'function' ? monaco.languages.CompletionItemKind.Function : c.kind === 'type' ? monaco.languages.CompletionItemKind.TypeParameter : monaco.languages.CompletionItemKind.Variable, insertText: c.insertText, insertTextRules: c.isSnippet ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined, range, detail: c.detail, sortText: String(800000 + c.rank) + c.label.toLowerCase(), filterText: c.filterText })
        }
      }
      return { suggestions: items, incomplete: !!res?.incomplete }
    }
  })

  monaco.languages.registerHoverProvider(LANG_C, {
    async provideHover(model, position) {
      const req = cursorReq(model, position)
      const h = await query<HoverDto | null>('hover', req)
      if (!h) return null
      return { range: new monaco.Range(position.lineNumber, h.start + 1, position.lineNumber, h.end + 1), contents: hoverContents(h) }
    }
  })

  monaco.languages.registerSignatureHelpProvider(LANG_C, {
    signatureHelpTriggerCharacters: ['(', ','],
    signatureHelpRetriggerCharacters: [','],
    async provideSignatureHelp(model, position) {
      const req = cursorReq(model, position)
      const s = await query<SignatureDto | null>('signature', { before: req.before })
      if (!s) return null
      return {
        value: {
          signatures: s.signatures.map((x) => ({ label: x.label, documentation: x.doc ? { value: x.doc } : undefined, parameters: x.params.map((p) => ({ label: p })) })),
          activeSignature: s.active, activeParameter: s.activeParam
        },
        dispose() {}
      }
    }
  })

  monaco.languages.registerDocumentSymbolProvider(LANG_C, { displayName: 'C/C++', provideDocumentSymbols: (model) => documentSymbols(model.getValue(), false) })
  monaco.languages.registerDocumentSymbolProvider(LANG_ASM, { displayName: 'Ассемблер', provideDocumentSymbols: (model) => documentSymbols(model.getValue(), true) })

  // ---- avride.project.json ----
  monaco.languages.registerCompletionItemProvider('json', {
    triggerCharacters: ['"', ':', ' '],
    provideCompletionItems(model, position) {
      if (!isProjectFile(model.uri.path)) return { suggestions: [] }
      const text = model.getValue()
      const off = model.getOffsetAt(position)
      const cp = cursorPath(text, off)
      if (!cp) return { suggestions: [] }
      const s = model.getPositionAt(cp.wordStart)
      const e = model.getPositionAt(cp.wordEnd)
      const range = new monaco.Range(s.lineNumber, s.column, e.lineNumber, e.column)
      const suggestions: monaco.languages.CompletionItem[] = []
      if (cp.inKey) {
        const present = new Set<string>()
        const keys = childKeys(cp.path)
        for (const k of keys) {
          const doc = FIELDS[normalizePath([...cp.path, k])]
          if (!doc || present.has(k)) continue
          const quoted = text[cp.wordStart - 1] === '"'
          const tail = doc.kind === 'object' ? '": {$0}' : doc.kind === 'array' ? '": [$0]' : doc.kind === 'number' ? '": ${1:0}' : '": "$0"'
          suggestions.push({ label: k, kind: monaco.languages.CompletionItemKind.Property, insertText: (quoted ? '' : '"') + k + tail, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, documentation: { value: doc.desc }, detail: doc.kind === 'object' ? 'раздел' : doc.kind === 'array' ? 'список' : doc.kind === 'number' ? 'число' : 'строка' })
        }
      } else if (cp.forKey) {
        const doc = FIELDS[normalizePath([...cp.path, cp.forKey])]
        for (const v of doc?.values ?? []) suggestions.push({ label: v, kind: monaco.languages.CompletionItemKind.EnumMember, insertText: v, range, documentation: { value: doc?.desc ?? '' } })
      }
      return { suggestions }
    }
  })
  monaco.languages.registerHoverProvider('json', {
    provideHover(model, position) {
      if (!isProjectFile(model.uri.path)) return null
      const h = fieldAt(model.getValue(), model.getOffsetAt(position))
      if (!h) return null
      const a = model.getPositionAt(h.start)
      const b = model.getPositionAt(h.end)
      const contents: monaco.IMarkdownString[] = [{ value: `**${h.key.replace('.*', '.<имя>')}**\n\n${h.doc.desc}` }]
      if (h.doc.values) contents.push({ value: 'Допустимые значения: ' + h.doc.values.map((v) => '`' + v + '`').join(', ') })
      if (h.doc.example) contents.push({ value: 'Пример: `' + h.doc.example + '`' })
      return { range: new monaco.Range(a.lineNumber, a.column, b.lineNumber, b.column), contents }
    }
  })
}
