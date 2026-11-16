// Реестр команд (палитра, горячие клавиши) и действия сборки.
import { useBuild } from '../build/useBuild'
import { findBoardName } from '../build/boardRows'
import { useProject } from './project'
import { clamp, useUi } from './ui'

export interface Command {
  id: string
  title: string
  category: string
  /** Сочетание клавиш вида «Ctrl+Shift+P» (по физическим клавишам, не зависит от раскладки) */
  keys?: string
  run: () => void | Promise<void>
  enabled?: () => boolean
}

export function boardName(fqbn: string): string {
  return findBoardName(fqbn) ?? fqbn
}

/** Проверка, что сборку можно запускать; иначе подсказывает, что сделать. */
function canBuild(upload: boolean): boolean {
  const p = useProject.getState()
  const ui = useUi.getState()
  const b = useBuild.getState()
  if (b.busy) { ui.notify('Уже выполняется другая операция.'); return false }
  if (!p.root || !p.mainFile) {
    ui.notify(p.root ? 'В папке нет файла .ino — создайте файл с расширением .ino.' : 'Сначала откройте или создайте проект.')
    return false
  }
  if (!b.status?.found) {
    ui.notify('arduino-cli не найден — см. диагностику в разделе «Платы».')
    ui.showSide('boards')
    return false
  }
  if (!ui.fqbn) { ui.notify('Выберите плату.'); ui.setPicker('board'); return false }
  if (upload && !ui.port) { ui.notify('Выберите порт, к которому подключена плата.'); ui.setPicker('port'); return false }
  return true
}

export async function runBuild(upload: boolean): Promise<void> {
  if (!canBuild(upload)) return
  const p = useProject.getState()
  const ui = useUi.getState()
  const b = useBuild.getState()
  if (!(await p.saveAll())) return
  ui.showBottom('output')
  b.append(`\n=== ${upload ? 'Загрузка' : 'Проверка'}: ${boardName(ui.fqbn)}${upload ? ' → ' + ui.port : ''} ===\n`)
  const main = p.mainFile!
  const done = await b.run(
    upload ? window.api.cli.upload(main, ui.fqbn, ui.port) : window.api.cli.compile(main, ui.fqbn),
    upload ? 'upload' : 'compile',
    upload ? 'Сборка и загрузка…' : 'Компиляция…'
  )
  if (done && !done.cancelled && done.code !== 0) {
    const first = useBuild.getState().problems.find((x) => x.severity === 'error')
    useUi.getState().showBottom(first ? 'problems' : 'output')
  }
}

export function openReference(word?: string): void {
  useProject.getState().openPanel('ref', word)
}

const key = (e: KeyboardEvent): string => {
  const c = e.code
  let k = e.key
  if (c.startsWith('Key')) k = c.slice(3)
  else if (c.startsWith('Digit')) k = c.slice(5)
  else if (c === 'Backquote') k = '`'
  else if (c === 'Backslash') k = '\\'
  else if (c === 'Comma') k = ','
  else if (c === 'Equal') k = '='
  else if (c === 'Minus') k = '-'
  else if (c.length === 2 && c[0] === 'F') k = c
  else if (k.length === 1) k = k.toUpperCase()
  return (e.ctrlKey || e.metaKey ? 'Ctrl+' : '') + (e.altKey ? 'Alt+' : '') + (e.shiftKey ? 'Shift+' : '') + k
}


export function getCommands(): Command[] {
  const p = (): ReturnType<typeof useProject.getState> => useProject.getState()
  const ui = (): ReturnType<typeof useUi.getState> => useUi.getState()
  const hasProject = (): boolean => !!p().root
  const activeFile = (): string | null => p().tabs.find((t) => t.id === p().activeId)?.path ?? null
  return [
    { id: 'file.new', category: 'Файл', title: 'Создать проект…', keys: 'Ctrl+N', run: () => ui().setWizard(true) },
    { id: 'file.open', category: 'Файл', title: 'Открыть проект…', keys: 'Ctrl+O', run: () => p().pickOpen() },
    { id: 'file.openFile', category: 'Файл', title: 'Открыть файл скетча…', keys: 'Ctrl+Shift+O', run: () => p().pickOpenFile() },
    { id: 'file.examples', category: 'Файл', title: 'Примеры…', run: () => ui().set({ sideVisible: true, sideView: 'examples' }), enabled: hasProject },
    { id: 'file.quickOpen', category: 'Файл', title: 'Перейти к файлу…', keys: 'Ctrl+P', run: () => ui().setPalette('files'), enabled: hasProject },
    { id: 'file.save', category: 'Файл', title: 'Сохранить', keys: 'Ctrl+S', run: async () => { const f = activeFile(); if (f) await p().saveFile(f) }, enabled: () => !!activeFile() },
    { id: 'file.saveAll', category: 'Файл', title: 'Сохранить всё', keys: 'Ctrl+Shift+S', run: async () => { await p().saveAll() }, enabled: hasProject },
    { id: 'file.close', category: 'Файл', title: 'Закрыть вкладку', keys: 'Ctrl+W', run: async () => { const a = p().activeId; if (a) await p().closeTab(a) } },
    { id: 'file.closeProject', category: 'Файл', title: 'Закрыть проект (на стартовый экран)', run: () => p().closeProject(), enabled: hasProject },
    { id: 'build.verify', category: 'Сборка', title: 'Проверить (компилировать)', keys: 'Ctrl+B', run: () => runBuild(false) },
    { id: 'build.upload', category: 'Сборка', title: 'Загрузить на плату', keys: 'Ctrl+U', run: () => runBuild(true) },
    { id: 'build.cancel', category: 'Сборка', title: 'Отменить текущую операцию', run: () => useBuild.getState().cancel(), enabled: () => useBuild.getState().busy },
    { id: 'board.select', category: 'Сборка', title: 'Выбрать плату…', run: () => ui().setPicker('board') },
    { id: 'port.select', category: 'Сборка', title: 'Выбрать порт…', run: () => { void useBuild.getState().refreshPorts(); ui().setPicker('port') } },
    { id: 'port.refresh', category: 'Сборка', title: 'Обновить список портов', run: () => useBuild.getState().refreshPorts() },
    { id: 'view.files', category: 'Вид', title: 'Проводник (файлы проекта)', keys: 'Ctrl+Shift+E', run: () => ui().showSide('files') },
    { id: 'view.boards', category: 'Вид', title: 'Платы (ядра и источники)', keys: 'Ctrl+Shift+X', run: () => ui().showSide('boards') },
    { id: 'view.libs', category: 'Вид', title: 'Библиотеки', keys: 'Ctrl+Shift+K', run: () => ui().showSide('libs') },
    { id: 'view.search', category: 'Вид', title: 'Поиск по проекту', keys: 'Ctrl+Shift+F', run: () => ui().focusSearch(), enabled: hasProject },
    { id: 'view.toggleSide', category: 'Вид', title: 'Показать / скрыть боковую панель', keys: 'Ctrl+\\', run: () => ui().toggleSide() },
    { id: 'view.toggleBottom', category: 'Вид', title: 'Показать / скрыть нижнюю панель', keys: 'Ctrl+`', run: () => ui().toggleBottom() },
    { id: 'view.output', category: 'Вид', title: 'Панель «Вывод»', keys: 'Ctrl+Shift+U', run: () => ui().showBottom('output') },
    { id: 'view.problems', category: 'Вид', title: 'Панель «Проблемы»', keys: 'Ctrl+Shift+M', run: () => ui().showBottom('problems') },
    { id: 'view.monitor', category: 'Вид', title: 'Монитор порта', keys: 'Ctrl+Shift+L', run: () => ui().showBottom('monitor') },
    { id: 'view.plotter', category: 'Вид', title: 'Серийный плоттер (график значений из порта)', run: () => ui().showBottom('plotter') },
    { id: 'view.reference', category: 'Вид', title: 'Справочник', keys: 'F1', run: () => openReference() },
    { id: 'view.ui', category: 'Вид', title: 'Конструктор ESPUI', run: () => p().openPanel('ui') },
    { id: 'view.web', category: 'Вид', title: 'Веб-дизайнер (HTML + CSS)', run: () => p().openPanel('web') },
    { id: 'view.settings', category: 'Вид', title: 'Настройки', keys: 'Ctrl+,', run: () => p().openPanel('settings') },
    { id: 'tab.next', category: 'Вид', title: 'Следующая вкладка', keys: 'Ctrl+Tab', run: () => p().cycleTab(1) },
    { id: 'tab.prev', category: 'Вид', title: 'Предыдущая вкладка', keys: 'Ctrl+Shift+Tab', run: () => p().cycleTab(-1) },
    { id: 'font.inc', category: 'Настройки', title: 'Увеличить шрифт редактора', keys: 'Ctrl+=', run: () => ui().setSettings({ fontSize: clamp(ui().settings.fontSize + 1, 10, 28) }) },
    { id: 'font.dec', category: 'Настройки', title: 'Уменьшить шрифт редактора', keys: 'Ctrl+-', run: () => ui().setSettings({ fontSize: clamp(ui().settings.fontSize - 1, 10, 28) }) },
    { id: 'theme.toggle', category: 'Настройки', title: 'Переключить тему (тёмная / светлая)', run: () => ui().setSettings({ theme: ui().settings.theme === 'dark' ? 'light' : 'dark' }) },
    { id: 'autosave.toggle', category: 'Настройки', title: 'Автосохранение: включить / выключить', run: () => ui().setSettings({ autosave: !ui().settings.autosave }) },
    { id: 'cli.index', category: 'Платы', title: 'Обновить индекс плат и библиотек', run: async () => { ui().showBottom('output'); await useBuild.getState().run(window.api.cli.updateIndex(), 'index-update', 'Обновление индекса') } },
    { id: 'cli.recheck', category: 'Платы', title: 'Проверить arduino-cli заново', run: async () => { const s = await useBuild.getState().recheck(); ui().notify(s.found ? 'arduino-cli найден.' : 'arduino-cli не найден.') } }
  ]
}

const START_KEYS = new Set(['Ctrl+N', 'Ctrl+O', 'Ctrl+Shift+O'])

/** Глобальные горячие клавиши. Возвращает функцию отписки. */
export function installHotkeys(): () => void {
  const onKey = (e: KeyboardEvent): void => {
    if (e.defaultPrevented) return
    const k = key(e)
    if (k === 'Ctrl+Shift+P' && useProject.getState().root) { e.preventDefault(); useUi.getState().setPalette('commands'); return }
    // На стартовом экране работают только создание и открытие проекта
    if (!useProject.getState().root && !START_KEYS.has(k)) return
    const cmd = getCommands().find((c) => c.keys === k)
    if (!cmd || (cmd.enabled && !cmd.enabled())) return
    // F1 в поле ввода не перехватываем
    e.preventDefault()
    void cmd.run()
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}
