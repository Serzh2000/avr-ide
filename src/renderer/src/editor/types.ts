import type { EditorProps } from '../contracts'
import type { PlatformId } from '../reference/types'

/** Платформа для подсказок и проверок. 'esp32s3'/'esp32c3' ведут себя как семейство ESP32. */
export type EditorPlatform = PlatformId

/**
 * Необязательные расширения props сверх EditorProps из contracts.ts.
 * Editor принимает их, но оболочка может и не передавать — тогда платформа определяется по тексту (#include).
 */
export interface EditorExtraProps {
  /** Платформа выбранной платы (UiBuilderHost.platform подходит как есть). */
  platform?: EditorPlatform | null
  /** Показывать миникарту. Если не задано — как выбрал пользователь (хранится локально), по умолчанию выключена. */
  minimap?: boolean
  /**
   * Тексты ДРУГИХ файлов скетча (.ino/.h/.cpp рядом): из них берутся #include для подсказок по библиотекам.
   * Из текущего файла #include берутся автоматически. Без этого пропа подсказки строятся только по текущему файлу.
   */
  sketchSources?: string[]
  /** FQBN выбранной платы (например esp32:esp32:esp32): часть библиотек ядра зависит от архитектуры. */
  fqbn?: string | null
  /** Папка скетча (на будущее; для поиска библиотек не используется). */
  sketchDir?: string | null
}

export type FullEditorProps = EditorProps & EditorExtraProps
