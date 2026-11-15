// Сопоставление модели конструктора с реальным скетчем: подставляет типы/значения переменных и номера пинов из скетча,
// находит проблемы (переменная исчезла, const, объявлена ниже setup(), конфликт имён, функция не написана).
import type { Issue, UiProject } from '../core/types'
import { resolvePin } from './parse'
import type { SketchInfo, SketchVar } from './parse'

export interface ResolveResult {
  /** Модель с применёнными данными скетча (для превью, проверки и генерации). */
  project: UiProject
  /** Дополнительные проблемы, найденные по скетчу. */
  issues: Issue[]
}

export function resolveProject(p: UiProject, sketch: SketchInfo | null): ResolveResult {
  if (!sketch) return { project: p, issues: [] }
  const project = structuredClone(p)
  const issues: Issue[] = []
  const add = (severity: Issue['severity'], code: string, message: string, extra: Partial<Issue> = {}): void => {
    issues.push({ severity, code, message, ...extra })
  }
  const sv = (name: string): SketchVar | undefined => sketch.vars.find((v) => v.name === name)

  // Переменные из скетча: тип и начальное значение берём из скетча.
  for (const v of project.variables) {
    if (!v.external) continue
    const s = sv(v.name)
    if (!s) continue
    if (s.type) {
      v.type = s.type
      v.init = s.initValue
    }
  }

  const usedBy = (name: string): string[] => {
    const ids: string[] = []
    for (const t of project.tabs)
      for (const e of t.elements) if (e.binding.kind === 'var' && e.binding.variable === name) ids.push(e.id)
    return ids
  }

  // Ошибки по переменным скетча
  for (const v of project.variables) {
    if (!v.external) continue
    const s = sv(v.name)
    const users = usedBy(v.name)
    if (!s) {
      const msg = `Переменная «${v.name}» не найдена в скетче — её удалили или переименовали. Выберите другую переменную или верните её в скетч.`
      if (users.length) for (const id of users) add('error', 'sketch-var-missing', msg, { elementId: id, variable: v.name })
      else add('error', 'sketch-var-missing', msg, { variable: v.name })
      continue
    }
    if (!s.type) {
      for (const id of users)
        add('error', 'sketch-var-type', `Переменная «${v.name}» (${s.ctype}): ${s.note ?? 'тип не поддерживается'}.`, { elementId: id, variable: v.name })
      continue
    }
    const late = sketch.setup && s.offset > sketch.setup.offset
    for (const t of project.tabs)
      for (const e of t.elements) {
        const b = e.binding
        if (b.kind !== 'var' || b.variable !== v.name) continue
        if (s.isConst && (b.direction === 'fromUi' || b.direction === 'both'))
          add('error', 'sketch-var-const', `Переменная «${v.name}» объявлена как const — страница не сможет её менять. Уберите const в скетче (строка ${s.line}) или выберите «только показывать».`, {
            elementId: e.id,
            variable: v.name
          })
        if (late)
          add('warning', 'sketch-var-late', `Переменная «${v.name}» объявлена в строке ${s.line}, ниже setup(): подключение ui_generated.h не увидит её. Перенесите объявление выше setup().`, {
            elementId: e.id,
            variable: v.name
          })
      }
  }

  // Конфликты имён со скетчем
  for (const v of project.variables) {
    if (v.external) continue
    const s = sketch.names.get(v.name)
    if (s) {
      const kindRu = s.kind === 'func' ? 'функция' : s.kind === 'define' ? 'макрос' : 'переменная'
      add('error', 'var-clash-sketch', `Имя «${v.name}» уже занято в вашем скетче (${kindRu}, строка ${s.line}). Конструктор объявит такую же переменную второй раз — будет ошибка компиляции.`, {
        variable: v.name
      })
    }
  }
  for (const t of project.tabs) {
    const s = sketch.names.get(t.id)
    if (s) add('error', 'id-clash-sketch', `Идентификатор вкладки «${t.id}» уже занят в скетче (строка ${s.line}). Переименуйте вкладку (раздел «Дополнительно»).`, { tabId: t.id })
    for (const e of t.elements) {
      for (const nm of [e.id, `cb_${e.id}`, `ui_prev_${e.id}`]) {
        const c = sketch.names.get(nm)
        if (c) {
          add('error', 'id-clash-sketch', `Идентификатор элемента «${e.id}» совпадает с именем в вашем скетче (строка ${c.line}). Переименуйте элемент в блоке «Дополнительно».`, { elementId: e.id })
          break
        }
      }
    }
  }

  // Пины и функции
  for (const t of project.tabs)
    for (const e of t.elements) {
      const b = e.binding
      if (b.kind === 'pin' && b.pinName) {
        const sp = sketch.pins.find((x) => x.name === b.pinName)
        if (!sp) {
          add('error', 'sketch-pin-missing', `Пин «${b.pinName}» не найден в скетче (#define или const int) — его удалили или переименовали. Выберите пин заново.`, { elementId: e.id })
        } else {
          const n = resolvePin(sp, project.platform)
          if (n === null) add('error', 'sketch-pin-unresolved', `Не удалось определить номер пина «${b.pinName}» (${sp.expr}) для этой платы. Выберите номер пина вручную.`, { elementId: e.id })
          else b.pin = n
        }
      }
      if (b.kind === 'callback' && b.fn) {
        const f = sketch.funcs.find((x) => x.name === b.fn)
        const other = !f ? sketch.names.get(b.fn) : undefined
        if (other)
          add('error', 'fn-clash-sketch', `Имя «${b.fn}» в скетче уже занято не функцией-обработчиком (строка ${other.line}). Выберите другое имя.`, { elementId: e.id })
        else if (!f) add('warning', 'fn-missing', `Функции «${b.fn}» в скетче ещё нет — напишите её (или добавьте заготовку кнопкой «Добавить в скетч»).`, { elementId: e.id })
        else if (!f.isCallback)
          add('warning', 'fn-signature', `Функция «${b.fn}» (строка ${f.line}) должна выглядеть так: void ${b.fn}(Control* sender, int type).`, { elementId: e.id })
      }
    }

  return { project, issues }
}

/** Кто использует переменную: имя → id элементов (для панелей «Связи» и «Переменные»). */
export function variableUsage(p: UiProject): Map<string, string[]> {
  const m = new Map<string, string[]>()
  for (const t of p.tabs)
    for (const e of t.elements)
      if (e.binding.kind === 'var' && e.binding.variable) {
        const l = m.get(e.binding.variable) ?? []
        l.push(e.id)
        m.set(e.binding.variable, l)
      }
  return m
}
