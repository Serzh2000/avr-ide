import { libConflictBanner } from './libConflicts'
// Подсказки «что делать дальше» и «как исправить ошибку». Чистые функции без зависимостей — их легко проверять тестами.

export type GuideAction = 'cli' | 'pickBoard' | 'cores' | 'verify' | 'pickPort' | 'upload' | 'monitor' | 'problems' | 'output' | 'libs' | 'linkUi' | 'linkWeb' | 'openUi' | 'openWeb'

export interface NextStepInput {
  found: boolean | undefined
  busy: boolean
  /** Что выполняется (для текста «Идёт сборка…») */
  busyKind?: string | null
  fqbn: string
  coreMissing: boolean
  /** Порт нужен для загрузки, но не выбран или не найден среди подключённых */
  portProblem: boolean
  /** Итог последней сборки: null — ещё не запускали */
  result: { kind: 'compile' | 'upload'; ok: boolean; cancelled: boolean } | null
  errors: number
  /** Есть несохранённые или изменённые после сборки файлы */
  dirty: boolean
  /** Страница конструктора с элементами есть, но в скетче не подключена (null/не задано — нечего предлагать) */
  pageUnlinked?: 'ui' | 'web' | null
}

export interface NextStep { action: GuideAction; text: string; title: string }

/** Следующий шаг по состоянию проекта; null — подсказка не нужна (идёт операция). */
export function nextStep(s: NextStepInput): NextStep | null {
  if (s.busy) return { action: 'output', text: s.busyKind === 'compile' || s.busyKind === 'upload' ? 'Идёт сборка…' : 'Выполняется операция…', title: 'Показать ход выполнения. Остановить можно кнопкой слева вверху' }
  if (s.found === false) return { action: 'cli', text: 'Нужен arduino-cli', title: 'arduino-cli не найден — откройте диагностику в разделе «Платы»' }
  if (!s.fqbn) return { action: 'pickBoard', text: 'Выберите плату', title: 'Скажите IDE, для какой платы собирать скетч' }
  if (s.coreMissing) return { action: 'cores', text: 'Установите поддержку платы', title: 'Для выбранной платы не установлено ядро — раздел «Платы»' }
  const r = s.result
  if (r && !r.ok && !r.cancelled && !s.dirty) {
    return { action: s.errors ? 'problems' : 'output', text: 'Исправьте ошибки сборки', title: 'Откроется список ошибок с подсказками' }
  }
  if (s.pageUnlinked) {
    return {
      action: s.pageUnlinked === 'ui' ? 'linkUi' : 'linkWeb',
      text: 'Страница не подключена',
      title: 'Страница из конструктора пока не попадёт в прошивку: нажмите, чтобы вставить её в скетч (покажем, что изменится)'
    }
  }
  if (!r || s.dirty || r.cancelled || (!r.ok)) return { action: 'verify', text: 'Проверьте скетч', title: 'Компиляция без загрузки (Ctrl+B)' }
  if (r.kind === 'upload') return { action: 'monitor', text: 'Откройте монитор порта', title: 'Смотрите, что плата присылает по USB' }
  if (s.portProblem) return { action: 'pickPort', text: 'Подключите плату и выберите порт', title: 'Плата подключается USB-кабелем с данными' }
  return { action: 'upload', text: 'Загрузите на плату', title: 'Загрузить скетч на плату (Ctrl+U)' }
}

export interface Explained { text: string; action: GuideAction; button: string }

/** Человеческое объяснение провала сборки или загрузки по тексту ошибок и журналу. null — нечего подсказать. */
export function explainFailure(messages: string[], log: string): Explained | null {
  const text = messages.join('\n') + '\n' + log.slice(-6000)
  // Ошибки страницы из конструктора: #error в сгенерированном заголовке и двойное объявление переменной
  // Конфликты библиотек (две копии, копия внутри проекта, чужая архитектура) — самое частое и самое непонятное
  const lc = libConflictBanner(text)
  if (lc) return { text: lc.title + '. ' + lc.text, action: 'libs', button: 'Открыть «Библиотеки»' }
  const pageHdr = /#error\s+"(ui|web)_generated\.h/.exec(text)
  if (pageHdr) {
    return { text: 'В странице из конструктора есть ошибки, поэтому сборка остановлена директивой #error. Откройте конструктор и исправьте проблемы (вкладка «Проблемы»).', action: pageHdr[1] === 'ui' ? 'openUi' : 'openWeb', button: 'Открыть конструктор' }
  }
  const redecl = /(redeclaration of|redefinition of|conflicting declaration|multiple definition of)[^\n]*/i.exec(text)
  if (redecl && /(ui|web)_generated\.h/.test(text)) {
    const web = /web_generated\.h/.test(text)
    return { text: 'Переменная объявлена и в вашем скетче, и в странице конструктора. В конструкторе пометьте её как переменную из скетча (во вкладке «Переменные» / в выборе переменной) или переименуйте.', action: web ? 'openWeb' : 'openUi', button: 'Открыть конструктор' }
  }
  const header = /fatal error:\s*([\w./+-]+\.h)[^\n]*No such file or directory/i.exec(text)
  if (header) return { text: `Не найден файл «${header[1]}» — скорее всего, не установлена библиотека, которая его содержит.`, action: 'libs', button: 'Открыть «Библиотеки»' }
  if (/platform not installed|Platform '[^']*' not found|Unknown FQBN|Error resolving FQBN|core .* not installed/i.test(text)) {
    return { text: 'Не установлена поддержка выбранной платы (ядро).', action: 'cores', button: 'Открыть «Платы»' }
  }
  if (/was not declared in this scope|not declared/i.test(text)) {
    return { text: 'Компилятор не знает это имя: проверьте написание или подключите библиотеку через #include.', action: 'libs', button: 'Открыть «Библиотеки»' }
  }
  if (/expected ['`‘][;})\]]['’]|expected ';'/i.test(text)) {
    return { text: 'Пропущен знак (чаще всего «;» или скобка) в строке с ошибкой или чуть выше неё.', action: 'problems', button: 'К ошибкам' }
  }
  if (/could not open port|can't open device|access is denied|PermissionError|Serial port .* not found|No such file or directory: '?COM|failed to connect|Timed out waiting for packet header|Failed to connect/i.test(text)) {
    return { text: 'Не удалось связаться с платой: проверьте кабель (нужен с данными), выберите нужный порт и закройте программы, занимающие порт (например, монитор порта).', action: 'pickPort', button: 'Выбрать порт' }
  }
  if (/section .* will not fit in region|region\s+[`'"]?\w+[`'"]?\s+overflowed|text section exceeds|Sketch too big|data section exceeds/i.test(text)) {
    return { text: 'Скетч не помещается в память платы: уберите лишнее или выберите схему разделов побольше в «Параметрах платы».', action: 'output', button: 'Показать вывод' }
  }
  if (/undefined reference to/i.test(text)) {
    return { text: 'Не хватает реализации функции: возможно, нужна библиотека или не подходит выбранная плата.', action: 'libs', button: 'Открыть «Библиотеки»' }
  }
  return null
}
