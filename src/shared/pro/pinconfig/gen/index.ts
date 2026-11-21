// Генерация проекта из avride.pins.json: набор файлов с сохранением пользовательских блоков, вставка board_init() в main.c.
import { getChip } from '../../chipdb'
import { checkConfig, hasErrors } from '../validate'
import type { PinIssue, PinsConfig } from '../types'
import { genCmsis } from './cmsis'
import type { GenOptions } from './cmsis'
import { mergeUserBlocks } from './common'
import type { GenFile } from './common'
import { genHal } from './hal'
import { genFamily } from './support'
import type { GenNote } from './support'

export type { GenOptions, GenFile, GenNote }

export interface PlannedFile {
  path: string
  /** Итоговое содержимое (с пользовательскими блоками из прежнего файла) */
  content: string
  status: 'new' | 'changed' | 'same'
  /** Прежний файл не создан AVR IDE (нет отметки) — перезапись затрёт чужой код */
  foreign: boolean
  keptBlocks: string[]
  orphanBlocks: string[]
}

export interface GenPlan {
  ok: boolean
  /** Почему генерация невозможна */
  blocked: string | null
  files: PlannedFile[]
  notes: GenNote[]
  issues: PinIssue[]
}

export const GEN_MARK_RE = /СГЕНЕРИРОВАНО AVR IDE/

/**
 * План генерации. existing — прежнее содержимое файлов по путям (если файла нет — отсутствует в словаре).
 * Не читает диск и не пишет: запись делает вызывающий.
 */
export function planGeneration(cfg: PinsConfig, existing: Record<string, string | undefined>, opts: GenOptions, halAvailable: boolean): GenPlan {
  const chip = getChip(cfg.chip)
  const issues = checkConfig(cfg)
  if (!chip) return { ok: false, blocked: `Чип «${cfg.chip}» нет в базе.`, files: [], notes: [], issues }
  if (genFamily(chip) === null) return { ok: false, blocked: `Генерация кода для ${chip.family} не поддерживается (поддержаны STM32F1, F4, G4). Конфигурация сохраняется в avride.pins.json, код — пока вручную.`, files: [], notes: [], issues }
  if (hasErrors(issues)) return { ok: false, blocked: 'В конфигурации есть ошибки — исправьте их перед генерацией.', files: [], notes: [], issues }
  if (cfg.mode === 'hal' && !halAvailable) return { ok: false, blocked: 'Режим HAL выбран, но заголовков HAL (stm32…_hal.h) в проекте нет. Выберите режим «Регистры CMSIS» или добавьте HAL в проект.', files: [], notes: [], issues }
  const out = cfg.mode === 'hal' ? genHal(cfg, chip, opts) : genCmsis(cfg, chip, opts)
  const files: PlannedFile[] = out.files.map((f: GenFile) => {
    const raw = existing[f.path]
    // CRLF после git или редактора не считается изменением
    const old = raw === undefined ? undefined : raw.split(/\r\n/).join('\n')
    const m = mergeUserBlocks(f.content, old)
    return {
      path: f.path, content: m.text,
      status: old === undefined ? 'new' : old === m.text ? 'same' : 'changed',
      foreign: old !== undefined && !GEN_MARK_RE.test(old),
      keptBlocks: m.kept, orphanBlocks: m.orphans
    }
  })
  return { ok: true, blocked: null, files, notes: out.notes, issues }
}

// ---------- main.c ----------

export interface MainPlan { code: string; changed: boolean; /** Почему менять нельзя или не нужно */ reason?: string }

const stripComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/\/\/.*$/gm, (m) => ' '.repeat(m.length))

/**
 * Минимальная вставка в main.c: #include "board.h" и вызов board_init() первой строкой main().
 * Уже есть вызов — ничего не меняется.
 */
export function planMainInsert(code: string): MainPlan {
  const clean = stripComments(code)
  const hasCall = /\bboard_init\s*\(/.test(clean)
  const hasInc = /#\s*include\s*"board\.h"/.test(clean)
  if (hasCall && hasInc) return { code, changed: false, reason: 'main.c уже вызывает board_init().' }
  const eol = code.includes('\r\n') ? '\r\n' : '\n'
  let out = code
  if (!hasCall) {
    const m = /\bint\s+main\s*\([^)]*\)\s*\{/.exec(clean)
    if (!m) return { code, changed: false, reason: 'В main.c не найдена функция int main(...) { … }: вызов board_init() добавьте вручную.' }
    const at = m.index + m[0].length
    const rest = code.slice(at)
    const next = /^[ \t]*\r?\n([ \t]*)\S/.exec(rest)
    const indent = next ? next[1] : '    '
    out = code.slice(0, at) + `${eol}${indent}board_init();` + code.slice(at)
  }
  if (!hasInc) {
    const lines = out.split(/\r?\n/)
    const clean2 = stripComments(out).split(/\r?\n/)
    let last = -1
    for (let i = 0; i < clean2.length; i++) if (/^\s*#\s*include\b/.test(clean2[i])) last = i
    if (last >= 0) lines.splice(last + 1, 0, '#include "board.h"')
    else {
      // после ведущих комментариев
      let i = 0
      let inBlock = false
      for (; i < lines.length; i++) {
        const t = lines[i].trim()
        if (inBlock) { if (t.includes('*/')) inBlock = false; continue }
        if (t.startsWith('/*')) { if (!t.includes('*/')) inBlock = true; continue }
        if (t.startsWith('//') || t === '') continue
        break
      }
      lines.splice(i, 0, '#include "board.h"', '')
    }
    out = lines.join(eol)
  }
  return { code: out, changed: out !== code }
}
