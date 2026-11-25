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
    'editor.background': '#1d2027',
    'editor.foreground': '#d4d4d4',
    'editor.lineHighlightBackground': '#242834',
    'editor.selectionBackground': '#3a4390',
    'editorLineNumber.foreground': '#6b6b6b',
    'editorLineNumber.activeForeground': '#c6c6c6',
    'editorCursor.foreground': '#a9b2ff',
    'editorIndentGuide.background1': '#2d313c',
    'editorIndentGuide.activeBackground1': '#4a5062',
    'editorBracketMatch.background': '#0064001a',
    'editorBracketMatch.border': '#888888',
    'editorGutter.background': '#1d2027',
    'editorWidget.background': '#232730',
    'editorSuggestWidget.background': '#232730',
    'editorSuggestWidget.selectedBackground': '#323a86',
    'editorHoverWidget.background': '#232730'
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
    'editor.lineHighlightBackground': '#f3f4fa',
    'editorLineNumber.foreground': '#9a9a9a',
    'editorLineNumber.activeForeground': '#333333',
    'editorIndentGuide.background1': '#e3e3e3',
    'editorIndentGuide.activeBackground1': '#b9b9b9',
    'editorWidget.background': '#ffffff',
    'editorWidget.border': '#bfc4cf',
    'editorSuggestWidget.background': '#ffffff',
    'editorSuggestWidget.border': '#bfc4cf',
    'editorSuggestWidget.foreground': '#1f1f1f',
    'editorSuggestWidget.selectedBackground': '#e3e5ff',
    'editorSuggestWidget.selectedForeground': '#1e1b4b',
    'editorSuggestWidget.highlightForeground': '#4338ca',
    'editorSuggestWidget.focusHighlightForeground': '#3730a3',
    'editorHoverWidget.background': '#ffffff',
    'editorHoverWidget.border': '#bfc4cf'
  }
}
