// Общее для генераторов: шапка «сгенерировано», блоки USER CODE и их сохранение при повторной генерации, имена.
import type { ChipRecord } from '../../chipdb'
import type { GenMode } from '../types'

export interface GenFile {
  /** Путь относительно корня проекта */
  path: string
  content: string
}

export const GEN_MARK = 'СГЕНЕРИРОВАНО AVR IDE'

export function banner(file: string, mode: GenMode): string {
  return `/* ${GEN_MARK} из avride.pins.json (${mode === 'hal' ? 'режим HAL' : 'режим регистров CMSIS'}) — файл ${file}.
 * Не правьте код вне блоков USER CODE: при повторной генерации он создаётся заново. Измените avride.pins.json
 * (вкладка «Пины и тактирование») и сгенерируйте снова. Свой код — только между USER CODE BEGIN … и USER CODE END …. */
`
}

/** Пустой блок для пользовательского кода: тело — одна пустая строка с отступом. */
export const userBlock = (name: string, indent = ''): string => `${indent}/* USER CODE BEGIN ${name} */\n${indent}\n${indent}/* USER CODE END ${name} */`

const BLOCK_RE = /\/\* USER CODE BEGIN ([A-Za-z0-9_]+) \*\/([\s\S]*?)\/\* USER CODE END \1 \*\//g

export interface MergeResult { text: string; kept: string[]; orphans: string[] }

/**
 * Переносит содержимое блоков USER CODE из прежнего файла в заново созданный. Блок, которого в новом шаблоне нет (например, исчез USART),
 * не теряется: непустое тело добавляется в конец файла в виде блока «Orphan_<имя>».
 */
export function mergeUserBlocks(fresh: string, old: string | undefined): MergeResult {
  if (!old) return { text: fresh, kept: [], orphans: [] }
  const oldBodies = new Map<string, string>()
  for (const m of old.matchAll(BLOCK_RE)) oldBodies.set(m[1], m[2])
  const kept: string[] = []
  const used = new Set<string>()
  const text = fresh.replace(BLOCK_RE, (all, name: string, body: string) => {
    const prev = oldBodies.get(name)
    if (prev === undefined) return all
    used.add(name)
    if (prev.trim() !== '') kept.push(name)
    return `/* USER CODE BEGIN ${name} */${prev}/* USER CODE END ${name} */`
  })
  const orphans: string[] = []
  let tail = ''
  for (const [name, body] of oldBodies) {
    if (used.has(name) || body.trim() === '') continue
    if (name.startsWith('Orphan_')) { used.add(name); tail += `\n/* USER CODE BEGIN ${name} */${body}/* USER CODE END ${name} */\n`; orphans.push(name); continue }
    orphans.push(name)
    tail += `\n/* USER CODE BEGIN Orphan_${name} */${body}/* USER CODE END Orphan_${name} */\n`
  }
  return { text: text + tail, kept, orphans }
}

/** Имя заголовка CMSIS семейства: stm32f103xb.h → stm32f1xx.h */
export function familyHeader(chip: ChipRecord): string {
  const m = /^(stm32[a-z]\d)/.exec(chip.files.header)
  return `${m ? m[1] : 'stm32'}xx.h`
}

export const hex = (n: number): string => '0x' + n.toString(16).toUpperCase()
