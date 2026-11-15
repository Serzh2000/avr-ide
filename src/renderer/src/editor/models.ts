// Кэш моделей Monaco по пути файла: позиция курсора и история правок сохраняются при переключении вкладок.
import * as monaco from 'monaco-editor'
import { languageForPath, monacoLanguageId } from './language'
import { forgetModel } from './monacoSetup'

const UNTITLED = '__untitled__'
const MAX_MODELS = 24

export function keyFor(filePath: string | null | undefined): string {
  return filePath ? filePath : UNTITLED
}

function uriFor(filePath: string | null | undefined): monaco.Uri {
  if (!filePath) return monaco.Uri.parse('inmemory://avr-ide/untitled.ino')
  // файловый путь Windows/Unix -> file:// URI; относительные имена тоже допустимы
  return monaco.Uri.file(filePath)
}

export class ModelStore {
  private models = new Map<string, monaco.editor.ITextModel>()
  private states = new Map<string, monaco.editor.ICodeEditorViewState | null>()
  private order: string[] = []

  /** Модель для файла; создаёт при необходимости. Содержимое при создании — value. */
  acquire(filePath: string | null | undefined, value: string): monaco.editor.ITextModel {
    const key = keyFor(filePath)
    let model = this.models.get(key)
    if (!model || model.isDisposed()) {
      const uri = uriFor(filePath)
      const existing = monaco.editor.getModel(uri)
      const lang = monacoLanguageId(languageForPath(filePath))
      model = existing ?? monaco.editor.createModel(value, lang, uri)
      if (existing && existing.getValue() !== value) existing.setValue(value)
      this.models.set(key, model)
    }
    this.order = this.order.filter((k) => k !== key)
    this.order.push(key)
    return model
  }

  /** Привести текст модели к value, сохранив историю отмены. Возвращает true, если что-то изменилось. */
  static sync(model: monaco.editor.ITextModel, value: string): boolean {
    if (model.getValue() === value) return false
    model.pushStackElement()
    model.pushEditOperations([], [{ range: model.getFullModelRange(), text: value }], () => null)
    model.pushStackElement()
    return true
  }

  saveState(filePath: string | null | undefined, state: monaco.editor.ICodeEditorViewState | null): void {
    this.states.set(keyFor(filePath), state)
  }

  getState(filePath: string | null | undefined): monaco.editor.ICodeEditorViewState | null {
    return this.states.get(keyFor(filePath)) ?? null
  }

  /** Освободить старые модели, кроме текущей. */
  trim(currentPath: string | null | undefined): void {
    const cur = keyFor(currentPath)
    while (this.order.length > MAX_MODELS) {
      const k = this.order.find((x) => x !== cur)
      if (!k) break
      this.drop(k)
    }
  }

  private drop(key: string): void {
    const m = this.models.get(key)
    if (m && !m.isDisposed()) {
      forgetModel(m.uri)
      m.dispose()
    }
    this.models.delete(key)
    this.states.delete(key)
    this.order = this.order.filter((k) => k !== key)
  }

  disposeAll(): void {
    for (const k of [...this.models.keys()]) this.drop(k)
  }
}
