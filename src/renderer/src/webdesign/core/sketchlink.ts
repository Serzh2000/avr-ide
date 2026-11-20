// Сопоставление модели веб-дизайнера со скетчем: переменные «из скетча» берут тип и значение из .ino, а исчезнувшие,
// const и объявленные дважды переменные превращаются в понятные проблемы у привязанных блоков.
// Чистые функции без React (тестируются напрямую). Разбор скетча — общий с конструктором ESPUI.
import { blockVarRefs } from './refs'
import { walk } from './factory'
import { parseSketch } from '../../uibuilder/sketch/parse'
import type { SketchInfo } from '../../uibuilder/sketch/parse'
import type { Issue, WdProject } from './types'

export interface WdResolveResult {
  /** Модель с применёнными данными скетча (для генерации и проверки). */
  project: WdProject
  issues: Issue[]
}

export function resolveWdProject(p: WdProject, sketch: SketchInfo | null): WdResolveResult {
  if (!sketch) return { project: p, issues: [] }
  const project = structuredClone(p)
  const issues: Issue[] = []
  const add = (severity: Issue['severity'], code: string, message: string, extra: Partial<Issue> = {}): void => {
    issues.push({ severity, code, message, ...extra })
  }
  // кто использует переменную (id блоков)
  const users = new Map<string, string[]>()
  walk(project.blocks, (b) => {
    for (const r of blockVarRefs(b)) {
      const l = users.get(r.name) ?? []
      if (!l.includes(b.id)) l.push(b.id)
      users.set(r.name, l)
    }
  })
  const flag = (name: string, severity: Issue['severity'], code: string, msg: string): void => {
    const ids = users.get(name) ?? []
    if (!ids.length) add(severity, code, msg, { variable: name })
    for (const id of ids) add(severity, code, msg, { variable: name, blockId: id })
  }
  const setup = sketch.setup
  for (const v of project.variables) {
    const s = sketch.vars.find((x) => x.name === v.name)
    if (v.external) {
      if (!s) {
        flag(v.name, 'error', 'sketch-var-missing', `Переменная «${v.name}» не найдена в скетче — её удалили или переименовали. Выберите другую переменную или верните её в скетч.`)
        continue
      }
      if (!s.type) {
        flag(v.name, 'error', 'sketch-var-type', `Переменная «${v.name}» (${s.ctype}): ${s.note ?? 'тип не поддерживается'}.`)
        continue
      }
      v.type = s.type
      v.init = s.initValue
      const writes = project.blocks.length > 0 && usedFromUi(project, v.name)
      if (s.isConst && writes) flag(v.name, 'error', 'sketch-var-const', `Переменная «${v.name}» объявлена как const — страница не сможет её менять. Уберите const в скетче (строка ${s.line}) или выберите направление «на страницу».`)
      if (setup && s.offset > setup.offset)
        flag(v.name, 'warning', 'sketch-var-late', `Переменная «${v.name}» объявлена в строке ${s.line}, ниже setup(): подключение web_generated.h не увидит её. Перенесите объявление выше setup().`)
    } else {
      const n = sketch.names.get(v.name)
      if (n) {
        const kindRu = n.kind === 'func' ? 'функция' : n.kind === 'define' ? 'макрос' : 'переменная'
        flag(v.name, 'error', 'var-clash-sketch', `Имя «${v.name}» уже занято в вашем скетче (${kindRu}, строка ${n.line}). Страница объявит такую же переменную второй раз — будет ошибка компиляции. Отметьте её «из скетча» или переименуйте.`)
      }
    }
  }
  return { project, issues }
}

function usedFromUi(p: WdProject, name: string): boolean {
  let w = false
  walk(p.blocks, (b) => {
    for (const r of blockVarRefs(b)) if (r.name === name && r.fromUi) w = true
  })
  return w
}

/** Удобно для тестов и «подхвата»: разбор скетча + сопоставление. */
export function resolveWdProjectFromCode(p: WdProject, code: string | null): WdResolveResult {
  return resolveWdProject(p, code === null ? null : parseSketch(code))
}
