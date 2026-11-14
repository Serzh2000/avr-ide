import type { BoardEntry, FuncEntry } from './types'
import { general } from './data/general'
import { avr } from './data/avr'
import { esp8266 } from './data/esp8266'
import { esp32 } from './data/esp32'
import { boards as boardList } from './data/boards'

/** Все записи функций справочника. */
export const functions: FuncEntry[] = [...general, ...avr, ...esp8266, ...esp32]
export const boards: BoardEntry[] = boardList
