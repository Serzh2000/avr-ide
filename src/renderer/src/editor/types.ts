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
}

export type FullEditorProps = EditorProps & EditorExtraProps
