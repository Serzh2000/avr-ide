// Темы Monaco под цветовую гамму IDE.
import type { editor } from 'monaco-editor'

export const THEME_DARK = 'avr-dark'
export const THEME_LIGHT = 'avr-light'

export const darkTheme: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
    { token: 'string', foreground: 'ce9178' },
    { token: 'string.include', foreground: 'ce9178' },
    { token: 'string.escape', foreground: 'd7ba7d' },
    { token: 'number', foreground: 'b5cea8' },
    { token: 'number.float', foreground: 'b5cea8' },
    { token: 'number.hex', foreground: 'b5cea8' },
    { token: 'number.binary', foreground: 'b5cea8' },
    { token: 'keyword', foreground: 'c586c0' },
    { token: 'keyword.directive', foreground: '9aa5b1' },
    { token: 'type', foreground: '4ec9b0' },
    { token: 'constant.arduino', foreground: '61afef', fontStyle: 'bold' },
    { token: 'constant.macro', foreground: '56b6c2' },
    { token: 'support.function.arduino', foreground: 'e5c07b' },
    { token: 'support.class.arduino', foreground: '4fc1ff' },
    { token: 'identifier', foreground: 'd4d4d4' },
    { token: 'variable.register', foreground: '9cdcfe' },
    { token: 'entity.label', foreground: 'dcdcaa', fontStyle: 'bold' },
    { token: 'keyword.mnemonic', foreground: '569cd6' },
    { token: 'operator', foreground: 'c8c8c8' },
    { token: 'delimiter', foreground: 'a0a0a0' }
  ],
  colors: {
    'editor.background': '#1e1e1e',
    'editor.foreground': '#d4d4d4',
    'editor.lineHighlightBackground': '#2a2d2e',
    'editor.selectionBackground': '#264f78',
    'editorLineNumber.foreground': '#6b6b6b',
    'editorLineNumber.activeForeground': '#c6c6c6',
    'editorCursor.foreground': '#aeafad',
    'editorIndentGuide.background1': '#333333',
    'editorIndentGuide.activeBackground1': '#555555',
    'editorBracketMatch.background': '#0064001a',
    'editorBracketMatch.border': '#888888',
    'editorGutter.background': '#1e1e1e',
    'editorWidget.background': '#252526',
    'editorSuggestWidget.background': '#252526',
    'editorSuggestWidget.selectedBackground': '#04395e',
    'editorHoverWidget.background': '#252526'
  }
}

export const lightTheme: editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '5f7f4a', fontStyle: 'italic' },
    { token: 'string', foreground: 'a31515' },
    { token: 'string.include', foreground: 'a31515' },
    { token: 'string.escape', foreground: 'ee0000' },
    { token: 'number', foreground: '098658' },
    { token: 'number.float', foreground: '098658' },
    { token: 'number.hex', foreground: '098658' },
    { token: 'number.binary', foreground: '098658' },
    { token: 'keyword', foreground: 'af00db' },
    { token: 'keyword.directive', foreground: '6b7280' },
    { token: 'type', foreground: '267f99' },
    { token: 'constant.arduino', foreground: '0057b8', fontStyle: 'bold' },
    { token: 'constant.macro', foreground: '0e7490' },
    { token: 'support.function.arduino', foreground: '8a5a00' },
    { token: 'support.class.arduino', foreground: '0070c1' },
    { token: 'identifier', foreground: '1f1f1f' },
    { token: 'variable.register', foreground: '0070c1' },
    { token: 'entity.label', foreground: '795e26', fontStyle: 'bold' },
    { token: 'keyword.mnemonic', foreground: '0451a5' }
  ],
  colors: {
    'editor.background': '#ffffff',
    'editor.foreground': '#1f1f1f',
    'editor.lineHighlightBackground': '#f3f5f7',
    'editorLineNumber.foreground': '#9a9a9a',
    'editorLineNumber.activeForeground': '#333333',
    'editorIndentGuide.background1': '#e3e3e3',
    'editorIndentGuide.activeBackground1': '#b9b9b9',
    'editorWidget.background': '#ffffff',
    'editorWidget.border': '#aeb8bc',
    'editorSuggestWidget.background': '#ffffff',
    'editorSuggestWidget.border': '#aeb8bc',
    'editorSuggestWidget.foreground': '#1f1f1f',
    'editorSuggestWidget.selectedBackground': '#d7edf0',
    'editorSuggestWidget.selectedForeground': '#132f34',
    'editorSuggestWidget.highlightForeground': '#005d68',
    'editorSuggestWidget.focusHighlightForeground': '#00525c',
    'editorHoverWidget.background': '#ffffff',
    'editorHoverWidget.border': '#aeb8bc'
  }
}
