// Контракты между частями IDE. Менять только по согласованию: на них опираются
// оболочка (App/shell), редактор (Editor/editor) и конструкторы (uibuilder, webdesign).

/** Подсветка проблем в редакторе (ошибки компиляции и т.п.). Нумерация строк и столбцов с 1. */
export interface EditorMarker {
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
  severity: 'error' | 'warning' | 'info'
  message: string
  source?: string
}

/** Props редактора кода. Обязательные три — как раньше; остальное необязательно. */
export interface EditorProps {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  /** Путь файла (для модели Monaco и определения языка). */
  filePath?: string | null
  markers?: EditorMarker[]
  /** Прокрутить к позиции; nonce меняется при каждом запросе, чтобы повторный переход срабатывал. */
  reveal?: { line: number; column?: number; nonce: number } | null
  /** Пользователь нажал F1 / «Справка» на слове. */
  onOpenReference?: (word: string) => void
  onCursorChange?: (line: number, column: number) => void
  fontSize?: number
  theme?: 'dark' | 'light'
  readOnly?: boolean
}

export type TargetPlatform = 'esp32' | 'esp8266' | 'avr'

/** Что оболочка IDE даёт конструкторам (ESPUI и веб-дизайнер). Все поля работают и без хоста (host не передан). */
export interface UiBuilderHost {
  /** Текущий текст главного файла скетча (.ino) — по нему конструктор находит переменные и пины. */
  sketchCode: string
  /** Путь к .ino или null, если скетч ещё не сохранён. */
  sketchPath: string | null
  /** Папка скетча или null. */
  sketchDir: string | null
  /** Платформа выбранной платы. */
  platform: TargetPlatform | null
  /** Записать файл в папку скетча (имя без пути, например «ui_generated.h»). Возвращает полный путь или null при отказе/ошибке. */
  writeFile: (name: string, content: string) => Promise<string | null>
  /** Заменить текст главного файла скетча в редакторе (например, добавить #include и вызовы). */
  replaceSketchCode: (code: string) => void
  /** Открыть редактор кода на строке главного файла скетча. */
  goToLine: (line: number) => void
}
