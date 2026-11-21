// Реестр команд (палитра, горячие клавиши) и действия сборки.
import { useBuild } from '../build/useBuild'
import { findBoardName } from '../build/boardRows'
import { defaultsOf, useBoardOptions, valueLabel } from '../build/boardOptions'
import { baseFqbn, fqbnOptions, platformOfFqbn, portPolicy } from '../../../main/cli/fqbn'
import { useProject } from './project'
import { requestConnect, syncPagesBeforeBuild, usePageLink } from './pageLink'
import { isEspPlatform, platformOf } from '../build/boards'
import { useUiBuilder } from '../uibuilder/store'
import { useWebDesigner } from '../webdesign/store'
import type { PageKind } from '../uibuilder/sketch/integrate'
import { clamp, useUi } from './ui'
import { runProAction, useProStore } from '../pro/proStore'
import { runExportBuild, useProBuild } from '../pro/buildStore'
import { openBottom, useHw } from '../pro/hwStore'

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
  const exact = findBoardName(fqbn, true)
  if (exact) return exact
  // У общих плат STM32 модель задаёт параметр pnum — показываем её, а не «Generic STM32F1 series»
  const pnum = fqbnOptions(fqbn)['pnum']
  const det = useBoardOptions.getState().byBoard[baseFqbn(fqbn)]
  if (pnum && det?.state === 'ok') return valueLabel(det.data, 'pnum', pnum)
  return findBoardName(fqbn) ?? fqbn
}

/** Порт для прошивки с учётом платы и способа загрузки: нужен ли он вообще и что передать в arduino-cli. */
export function uploadPort(fqbn: string, port: string): { port: string | null; missing: boolean; policy: ReturnType<typeof portPolicy> } {
  const det = useBoardOptions.getState().byBoard[baseFqbn(fqbn)]
  const policy = portPolicy(fqbn, defaultsOf(det?.state === 'ok' ? det.data : undefined))
  if (policy === 'none') return { port: null, missing: false, policy }
  return { port: port || null, missing: policy === 'required' && !port, policy }
}

/** Проверка, что сборку можно запускать; иначе подсказывает, что сделать. */
function canBuild(upload: boolean, fqbnOverride?: string): boolean {
  const p = useProject.getState()
  const ui = useUi.getState()
  const b = useBuild.getState()
  if (b.busy) { ui.notify('Уже выполняется другая операция.'); return false }
  if (!p.root || !p.mainFile) {
    ui.notify(p.root ? 'В папке нет файла .ino — создайте файл с расширением .ino.' : 'Сначала откройте или создайте проект.')
    return false
  }
  if (!b.status?.found) {
    ui.notify('arduino-cli не найден — см. диагностику в разделе «Платы».', { kind: 'error' })
    ui.showSide('boards')
    return false
  }
  if (!ui.fqbn && !fqbnOverride) { ui.notify('Выберите плату, для которой собираем скетч.', { kind: 'info', action: { label: 'Выбрать', run: () => useUi.getState().setPicker('board') } }); ui.setPicker('board'); return false }
  if (upload && uploadPort(ui.fqbn, ui.port).missing) { ui.notify('Выберите порт, к которому подключена плата.', { kind: 'info', action: { label: 'Выбрать порт', run: () => useUi.getState().setPicker('port') } }); ui.setPicker('port'); return false }
  return true
}

/** opts.fqbn — собрать для другой платы, не меняя выбранную (например, «Проверить страницу» без платы). */
export async function runBuild(upload: boolean, opts: { fqbn?: string } = {}): Promise<void> {
  // Профессиональный режим: сборка и прошивка идут через провайдеры Pro, а не arduino-cli
  if (useProStore.getState().proMode) return runProAction(upload ? 'flash' : 'build')
  if (!canBuild(upload, opts.fqbn)) return
  const p = useProject.getState()
  const ui = useUi.getState()
  const b = useBuild.getState()
  const fqbn = opts.fqbn ?? ui.fqbn
  if (!(await p.saveAll())) return
  // Страница конструктора подключена к скетчу — её код обновляется из сохранённой страницы, если устарел
  await syncPagesBeforeBuild(fqbn)
  // Способ загрузки (а значит и нужность порта) известен только по параметрам платы — подгружаем их заранее
  if (upload && platformOfFqbn(fqbn) === 'stm32') await useBoardOptions.getState().load(fqbn)
  ui.showBottom('output')
  const target = upload ? uploadPort(fqbn, ui.port) : null
  const where = target ? (target.port ? ' → ' + target.port : target.policy === 'none' ? ' → без COM-порта' : '') : ''
  b.append(`\n=== ${upload ? 'Загрузка' : 'Проверка'}: ${boardName(fqbn)}${where} ===\n`)
  if (target && !target.port && platformOfFqbn(fqbn) === 'rp2040') {
    const msg = 'Порт не выбран. Если плата не в списке портов — зажмите кнопку BOOTSEL и подключите USB, затем нажмите «Загрузить» снова.'
    b.append(msg + '\n')
    ui.notify(msg)
  }
  const main = p.mainFile!
  const done = await b.run(
    upload ? window.api.cli.upload(main, fqbn, target?.port ?? null) : window.api.cli.compile(main, fqbn),
    upload ? 'upload' : 'compile',
    upload ? 'Сборка и загрузка…' : 'Компиляция…'
  )
  if (done && !done.cancelled && done.code === 0 && upload) {
    useUi.getState().notify('Скетч загружен на плату.', { kind: 'ok', action: { label: 'Открыть монитор порта', run: () => useUi.getState().showBottom('monitor') } })
  }
  if (done && !done.cancelled && done.code !== 0) {
    const first = useBuild.getState().problems.find((x) => x.severity === 'error')
    useUi.getState().showBottom(first ? 'problems' : 'output')
  }
}

/**
 * «Проверить страницу»: собирает скетч вместе с подключённой страницей конструктора без загрузки и без обязательной платы.
 * Если выбрана не ESP-плата, берётся типовая плата того же семейства, что и страница (ESP32 или ESP8266). Ошибки — в «Проблемах».
 */
export async function checkPage(kind?: PageKind): Promise<void> {
  const ui = useUi.getState()
  const st = usePageLink.getState()
  const k: PageKind | null = kind ?? (st.ui.connected ? 'ui' : st.web.connected ? 'web' : null)
  if (!k || !st[k].connected) {
    const want: PageKind = k ?? (st.ui.items > 0 || !st.web.items ? 'ui' : 'web')
    ui.notify('Страница ещё не подключена к скетчу — сначала нажмите «Подключить».', { kind: 'info', action: { label: 'Подключить', run: () => requestConnect(want) } })
    return
  }
  let fqbn = ui.fqbn
  if (!isEspPlatform(platformOf(fqbn))) {
    const pl = k === 'ui' ? useUiBuilder.getState().project.platform : useWebDesigner.getState().project.platform
    fqbn = pl === 'esp8266' ? 'esp8266:esp8266:generic' : 'esp32:esp32:esp32'
  }
  await runBuild(false, { fqbn })
  const r = useBuild.getState().result
  if (r && r.ok && !r.cancelled) useUi.getState().notify('Скетч со страницей собран без ошибок — страницу можно загружать на плату.', { kind: 'ok' })
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
    { id: 'file.openFile', category: 'Файл', title: useProStore.getState().proMode ? 'Открыть файл…' : 'Открыть файл скетча…', keys: 'Ctrl+Shift+O', run: () => p().pickOpenFile() },
    { id: 'file.examples', category: 'Файл', title: 'Примеры…', run: () => ui().set({ sideVisible: true, sideView: 'examples' }), enabled: () => !useProStore.getState().proMode && hasProject() },
    { id: 'file.quickOpen', category: 'Файл', title: 'Перейти к файлу…', keys: 'Ctrl+P', run: () => ui().setPalette('files'), enabled: hasProject },
    { id: 'file.save', category: 'Файл', title: 'Сохранить', keys: 'Ctrl+S', run: async () => { const f = activeFile(); if (f) await p().saveFile(f) }, enabled: () => !!activeFile() },
    { id: 'file.saveAll', category: 'Файл', title: 'Сохранить всё', keys: 'Ctrl+Shift+S', run: async () => { await p().saveAll() }, enabled: hasProject },
    { id: 'file.close', category: 'Файл', title: 'Закрыть вкладку', keys: 'Ctrl+W', run: async () => { const a = p().activeId; if (a) await p().closeTab(a) } },
    { id: 'file.closeProject', category: 'Файл', title: 'Закрыть проект (на стартовый экран)', run: () => p().closeProject(), enabled: hasProject },
    { id: 'pro.flash', category: 'Отладка', title: 'Прошить плату через ST-Link (Pro)', run: () => runProAction('flash'), enabled: () => useProStore.getState().proMode && !!useProStore.getState().project },
    { id: 'debug.continue', category: 'Отладка', title: 'Начать отладку / продолжить', keys: 'F5', run: () => { const h = useHw.getState(); if (h.debug.status === 'off') return runProAction('debug'); return h.run('resume') }, enabled: () => useProStore.getState().proMode && !!useProStore.getState().project },
    { id: 'debug.over', category: 'Отладка', title: 'Шаг с обходом функций', keys: 'F10', run: () => useHw.getState().run('stepOver'), enabled: () => useProStore.getState().proMode && useHw.getState().debug.status === 'stopped' },
    { id: 'debug.into', category: 'Отладка', title: 'Шаг внутрь функции', keys: 'F11', run: () => useHw.getState().run('stepInto'), enabled: () => useProStore.getState().proMode && useHw.getState().debug.status === 'stopped' },
    { id: 'debug.out', category: 'Отладка', title: 'Шаг наружу из функции', keys: 'Shift+F11', run: () => useHw.getState().run('stepOut'), enabled: () => useProStore.getState().proMode && useHw.getState().debug.status === 'stopped' },
    { id: 'debug.pause', category: 'Отладка', title: 'Пауза (остановить выполнение программы)', run: () => useHw.getState().run('pause'), enabled: () => useProStore.getState().proMode && useHw.getState().debug.status === 'running' },
    { id: 'debug.stop', category: 'Отладка', title: 'Остановить отладку', keys: 'Shift+F5', run: () => useHw.getState().stopDebug(), enabled: () => useProStore.getState().proMode && useHw.getState().debug.status !== 'off' },
    { id: 'debug.toggleBp', category: 'Отладка', title: 'Точка останова на текущей строке', keys: 'F9', run: () => { const f = activeFile(); if (f) return useHw.getState().toggleBreakpoint(f, ui().cursor.line) }, enabled: () => useProStore.getState().proMode && !!activeFile() },
    { id: 'pro.clean', category: 'Сборка', title: 'Очистить результаты сборки (Pro)', run: () => runProAction('clean'), enabled: () => useProStore.getState().proMode && !!useProStore.getState().project },
    { id: 'pro.export', category: 'Сборка', title: 'Экспорт сборки: Makefile и CMakeLists.txt (Pro)', run: () => runExportBuild(), enabled: () => useProStore.getState().proMode && !!useProStore.getState().project },
    { id: 'pro.configs', category: 'Сборка', title: 'Конфигурации сборки: Debug, Release… (Pro)', run: () => useProBuild.getState().setDialog({ kind: 'configs' }), enabled: () => useProStore.getState().proMode && !!useProStore.getState().project },
    { id: 'pro.toolchain', category: 'Сборка', title: 'Установить компилятор ARM (Pro)', run: async () => { await useProBuild.getState().refreshToolchain(); useProBuild.getState().setDialog({ kind: 'toolchain', resume: false }) }, enabled: () => useProStore.getState().proMode },
    { id: 'view.size', category: 'Вид', title: 'Панель «Размер» (Flash и RAM последней сборки)', run: () => ui().showBottom('size'), enabled: () => useProStore.getState().proMode },
    { id: 'view.hw', category: 'Вид', title: 'Панель «Прошивка» (ST-Link, OpenOCD)', run: () => openBottom('hw'), enabled: () => useProStore.getState().proMode },
    { id: 'view.debug', category: 'Вид', title: 'Панель «Отладка»', run: () => openBottom('debug'), enabled: () => useProStore.getState().proMode },
    { id: 'build.verify', category: 'Сборка', title: 'Проверить (компилировать)', keys: 'Ctrl+B', run: () => runBuild(false) },
    { id: 'build.upload', category: 'Сборка', title: 'Загрузить на плату', keys: 'Ctrl+U', run: () => runBuild(true) },
    { id: 'page.check', category: 'Сборка', title: 'Проверить страницу (сборка скетча со страницей, плата не нужна)', run: () => checkPage(), enabled: () => !useProStore.getState().proMode && !!useProject.getState().root },
    { id: 'build.cancel', category: 'Сборка', title: 'Отменить текущую операцию', run: () => useBuild.getState().cancel(), enabled: () => useBuild.getState().busy },
    { id: 'board.select', category: 'Сборка', title: 'Выбрать плату…', run: () => ui().setPicker('board'), enabled: () => !useProStore.getState().proMode },
    { id: 'board.options', category: 'Сборка', title: 'Параметры платы…', run: () => ui().setPicker('options'), enabled: () => !useProStore.getState().proMode },
    { id: 'port.select', category: 'Сборка', title: 'Выбрать порт…', run: () => { void useBuild.getState().refreshPorts(); ui().setPicker('port') }, enabled: () => !useProStore.getState().proMode },
    { id: 'port.refresh', category: 'Сборка', title: 'Обновить список портов', run: () => useBuild.getState().refreshPorts(), enabled: () => !useProStore.getState().proMode },
    { id: 'view.files', category: 'Вид', title: 'Проводник (файлы проекта)', keys: 'Ctrl+Shift+E', run: () => ui().showSide('files') },
    { id: 'view.boards', category: 'Вид', title: 'Платы: поддержка плат и источники', keys: 'Ctrl+Shift+X', run: () => ui().showSide('boards'), enabled: () => !useProStore.getState().proMode },
    { id: 'view.libs', category: 'Вид', title: 'Библиотеки', keys: 'Ctrl+Shift+K', run: () => ui().showSide('libs'), enabled: () => !useProStore.getState().proMode },
    { id: 'view.search', category: 'Вид', title: 'Поиск по проекту', keys: 'Ctrl+Shift+F', run: () => ui().focusSearch(), enabled: hasProject },
    { id: 'view.toggleSide', category: 'Вид', title: 'Показать / скрыть боковую панель', keys: 'Ctrl+\\', run: () => ui().toggleSide() },
    { id: 'view.toggleBottom', category: 'Вид', title: 'Показать / скрыть нижнюю панель', keys: 'Ctrl+`', run: () => ui().toggleBottom() },
    { id: 'view.output', category: 'Вид', title: 'Панель «Вывод»', keys: 'Ctrl+Shift+U', run: () => ui().showBottom('output') },
    { id: 'view.problems', category: 'Вид', title: 'Панель «Проблемы»', keys: 'Ctrl+Shift+M', run: () => ui().showBottom('problems') },
    { id: 'view.monitor', category: 'Вид', title: 'Монитор порта', keys: 'Ctrl+Shift+L', run: () => ui().showBottom('monitor') },
    { id: 'view.plotter', category: 'Вид', title: 'Серийный плоттер (график значений из порта)', run: () => ui().showBottom('plotter'), enabled: () => !useProStore.getState().proMode },
    { id: 'view.reference', category: 'Вид', title: 'Справочник', keys: 'F1', run: () => openReference() },
    { id: 'view.ui', category: 'Вид', title: 'Конструктор ESPUI', run: () => p().openPanel('ui'), enabled: () => !useProStore.getState().proMode },
    { id: 'view.web', category: 'Вид', title: 'Веб-дизайнер (HTML + CSS)', run: () => p().openPanel('web'), enabled: () => !useProStore.getState().proMode },
    { id: 'help.open', category: 'Справка', title: 'Справка: где что находится и горячие клавиши', run: () => ui().setHelp(true) },
    { id: 'help.tour', category: 'Справка', title: 'Показать тур по интерфейсу', run: () => ui().setTour(0), enabled: hasProject },
    { id: 'view.settings', category: 'Вид', title: 'Настройки', keys: 'Ctrl+,', run: () => p().openPanel('settings') },
    { id: 'tab.next', category: 'Вид', title: 'Следующая вкладка', keys: 'Ctrl+Tab', run: () => p().cycleTab(1) },
    { id: 'tab.prev', category: 'Вид', title: 'Предыдущая вкладка', keys: 'Ctrl+Shift+Tab', run: () => p().cycleTab(-1) },
    { id: 'font.inc', category: 'Настройки', title: 'Увеличить шрифт редактора', keys: 'Ctrl+=', run: () => ui().setSettings({ fontSize: clamp(ui().settings.fontSize + 1, 10, 28) }) },
    { id: 'font.dec', category: 'Настройки', title: 'Уменьшить шрифт редактора', keys: 'Ctrl+-', run: () => ui().setSettings({ fontSize: clamp(ui().settings.fontSize - 1, 10, 28) }) },
    { id: 'theme.toggle', category: 'Настройки', title: 'Переключить тему (тёмная / светлая)', run: () => ui().setSettings({ theme: ui().settings.theme === 'dark' ? 'light' : 'dark' }) },
    { id: 'autosave.toggle', category: 'Настройки', title: 'Автосохранение: включить / выключить', run: () => ui().setSettings({ autosave: !ui().settings.autosave }) },
    { id: 'cli.index', category: 'Платы', title: 'Обновить индекс плат и библиотек', run: async () => { ui().showBottom('output'); await useBuild.getState().run(window.api.cli.updateIndex(), 'index-update', 'Обновление индекса') }, enabled: () => !useProStore.getState().proMode },
    { id: 'cli.recheck', category: 'Платы', title: 'Проверить arduino-cli заново', run: async () => { const s = await useBuild.getState().recheck(); ui().notify(s.found ? 'arduino-cli найден.' : 'arduino-cli не найден.') }, enabled: () => !useProStore.getState().proMode }
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
