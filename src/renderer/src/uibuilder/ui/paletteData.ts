// Палитра: группы и простые названия/описания элементов (без жаргона).
import type { WidgetType } from '../core/index'

export interface PaletteItem {
  type: WidgetType
  title: string
  /** Что делает, простыми словами (всплывающая подсказка и поиск). */
  hint: string
  /** Дополнительные слова для поиска. */
  keywords: string
}

export interface PaletteGroup {
  id: string
  title: string
  items: PaletteItem[]
}

export const PALETTE_GROUPS: PaletteGroup[] = [
  {
    id: 'show',
    title: 'Показать значение',
    items: [
      { type: 'label', title: 'Надпись', hint: 'Показывает текст или значение: температуру, состояние, счётчик.', keywords: 'label значение текст датчик температура' },
      { type: 'fileDisplay', title: 'Окно файла', hint: 'Показывает содержимое текстового файла (например, лог).', keywords: 'file файл лог' }
    ]
  },
  {
    id: 'control',
    title: 'Кнопки и переключатели',
    items: [
      { type: 'button', title: 'Кнопка', hint: 'Нажали — скетч получил команду. Можно «пока нажата» или «переключать».', keywords: 'button нажать' },
      { type: 'switcher', title: 'Переключатель', hint: 'Вкл/выкл: свет, реле, режим.', keywords: 'switch тумблер вкл выкл реле светодиод' },
      { type: 'pad', title: 'Крестовина', hint: 'Четыре стрелки: управление машинкой, роботом, камерой.', keywords: 'pad джойстик стрелки' },
      { type: 'padCenter', title: 'Крестовина с центром', hint: 'Четыре стрелки и кнопка в центре.', keywords: 'pad джойстик стрелки центр' }
    ]
  },
  {
    id: 'input',
    title: 'Ввод',
    items: [
      { type: 'slider', title: 'Ползунок', hint: 'Выбор числа движением пальца: яркость, скорость, громкость.', keywords: 'slider яркость скорость' },
      { type: 'number', title: 'Число', hint: 'Поле для ввода числа с границами.', keywords: 'number число уставка' },
      { type: 'text', title: 'Текстовое поле', hint: 'Ввод текста, даты, времени или цвета.', keywords: 'text строка дата' },
      { type: 'select', title: 'Список', hint: 'Выбор одного пункта из нескольких: режим, сцена.', keywords: 'select dropdown режим выбор' },
      { type: 'password', title: 'Пароль', hint: 'Поле, где вводимое скрыто точками.', keywords: 'password пароль' },
      { type: 'time', title: 'Время из браузера', hint: 'Берёт текущее время телефона/компьютера и отдаёт скетчу.', keywords: 'time часы время' },
      { type: 'accel', title: 'Акселерометр', hint: 'Наклон телефона (в ESPUI не завершён — экспериментально).', keywords: 'accel наклон' }
    ]
  },
  {
    id: 'graph',
    title: 'Графики',
    items: [{ type: 'graph', title: 'График', hint: 'Рисует линию значения во времени: температура, напряжение.', keywords: 'graph график линия chart' }]
  },
  {
    id: 'layout',
    title: 'Оформление',
    items: [{ type: 'separator', title: 'Разделитель', hint: 'Линия с заголовком — делит страницу на части.', keywords: 'separator разделитель заголовок' }]
  }
]

const FLAT: Record<string, PaletteItem> = {}
for (const g of PALETTE_GROUPS) for (const i of g.items) FLAT[i.type] = i

/** Дружелюбное название элемента (для инспектора, связей, подсказок). */
export function widgetTitle(type: WidgetType): string {
  return FLAT[type]?.title ?? type
}
export function widgetHint(type: WidgetType): string {
  return FLAT[type]?.hint ?? ''
}
