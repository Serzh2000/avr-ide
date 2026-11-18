// Рисунки плат справочника. Все рисунки — рендеры собственных 3D-моделей AVR IDE (boardRenders.ts, генерируются scripts/boardart/build.mjs).
// Старые векторные рисунки (Wokwi, Fritzing, Raspberry Pi) удалены; их лицензии сохранены в licenses/THIRD_PARTY.md, потому что
// координаты выводов слоя взяты из тех рисунков (см. scripts/boardart/legacy_pins.json).
import { boardRenders } from './boardRenders'

export interface BoardArt {
  /** Готовый документ SVG (вставляется как изображение); у рендеров пусто */
  svg: string
  /** Растровый рисунок (data URI WebP) — рендер 3D-модели платы */
  img?: string
  /** Размеры самой платы (без полей рисунка), мм в координатах схемы */
  bw?: number
  bh?: number
  /** Положение и размер рисунка в координатах платы, мм (начало — левый верхний угол платы) */
  x: number
  y: number
  w: number
  h: number
  /** Выводы: имя → центр площадки, мм */
  pins: Record<string, [number, number]>
  license: string
}

export const boardArt: Record<string, BoardArt> = { ...boardRenders }
