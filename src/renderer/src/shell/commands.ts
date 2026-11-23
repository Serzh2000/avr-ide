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
import { openCircuitPython } from '../circuitpython/store'
import { runExportBuild, useProBuild } from '../pro/buildStore'
import { openBottom, useHw } from '../pro/hwStore'
import { openPins } from '../pro/pins/pinsStore'
import { confirmDialog } from './dialogs'
import { samePort, uploadPortIssue } from './guide'

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
function canBuild(fqbnOverride?: string): boolean {
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
  return true
}

let preparingBuild = false

function chooseUploadPort(message: string): void {
  const pick = (): void => useUi.getState().setPicker('port')
  useUi.getState().notify(message, { action: { label: 'Выбрать порт', run: pick } })
  pick()
}

/** opts.fqbn — собрать для другой платы, не меняя выбранную (например, «Проверить страницу» без платы). */
export async function runBuild(upload: boolean, opts: { fqbn?: string } = {}): Promise<void> {
  // Профессиональный режим: сборка и прошивка идут через провайдеры Pro, а не arduino-cli
  if (useProStore.getState().proMode) return runProAction(upload ? 'flash' : 'build')
  if (preparingBuild) { useUi.getState().notify('Уже выполняется другая операция.'); return }
  if (!canBuild(opts.fqbn)) return
  const p = useProject.getState()
  const ui = useUi.getState()
  const b = useBuild.getState()
  const { root, mainFile } = p
  if (!root || !mainFile) return
  const fqbn = opts.fqbn ?? ui.fqbn
  const platform = platformOfFqbn(fqbn)
  const sameSelection = (): boolean => {
    const current = useProject.getState()
    const selection = useUi.getState()
    return current.root === root && current.mainFile === mainFile && selection.fqbn === ui.fqbn && (!upload || selection.port === ui.port)
  }
  preparingBuild = true
  try {
    if (upload && platform === 'stm32') await useBoardOptions.getState().load(fqbn)
    if (!sameSelection()) return
    const target = upload ? uploadPort(fqbn, ui.port) : null
    if (target?.missing) return chooseUploadPort('Выберите порт подключённой платы.')
    if (target?.policy === 'optional' && platform === 'stm32') {
      ui.notify('Не удалось определить способ загрузки STM32. Проверьте «Параметры платы».', {
        action: { label: 'Параметры платы', run: () => ui.setPicker('options') }
      })
      return
    }
    if (!(await p.saveAll()) || !sameSelection()) return
    if (!(await syncPagesBeforeBuild(fqbn)) || !sameSelection()) return

    let serial = false
    const port = target?.port ?? null
    if (port !== null && target) {
      const connected = await b.refreshPorts()
      if (!sameSelection()) return
      if (!connected) return chooseUploadPort('Не удалось проверить список портов. Обновите его и повторите загрузку.')
      const issue = uploadPortIssue(fqbn, target.policy, port, connected)
      if (issue === 'disconnected') {
        const hint = platform === 'rp2040' ? ' Для BOOTSEL снимите выбор порта в списке.' : ''
        return chooseUploadPort(`Порт ${port} не подключён. Выберите порт нужной платы.${hint}`)
      }
      if (issue === 'mismatch') return chooseUploadPort(`На ${port} обнаружена другая плата. Проверьте модель и порт.`)
      serial = connected.some((entry) => samePort(entry.address, port) && entry.protocol === 'serial')
    }
    if (target && port === null && platform === 'rp2040') {
      const answer = await confirmDialog({
        title: 'Загрузить через BOOTSEL?',
        message: `Цель — ${boardName(fqbn)}. Отключите остальные платы в режиме BOOTSEL. Подключите целевую плату по USB, удерживая BOOTSEL, и дождитесь появления её диска.`,
        buttons: [{ id: 'cancel', label: 'Отмена' }, { id: 'upload', label: 'Загрузить', kind: 'primary' }]
      })
      if (answer !== 'upload') return
    }
    if (!sameSelection() || useBuild.getState().busy) return
    if (p.hasDirty()) {
      ui.notify('Во время подготовки скетч изменился. Повторите операцию, чтобы сохранить правки.')
      return
    }

    const revision = useProject.getState().buildRevision
    const isCurrent = (): boolean => sameSelection() && useProject.getState().buildRevision === revision
    const where = target ? (port ? ' → ' + port : ' → без COM-порта') : ''
    b.append(`\n=== ${upload ? 'Загрузка' : 'Проверка'}: ${boardName(fqbn)}${where} ===\n`)
    const launch = upload ? window.api.cli.upload(mainFile, fqbn, port).then((r) => {
      if (!r.ok && sameSelection()) {
        const config = p.tree.find((node) => !node.dir && node.name === 'sketch.yaml')
        ui.notify(r.error, {
          kind: 'error',
          action: config && r.error.includes('sketch.yaml')
            ? { label: 'Открыть sketch.yaml', run: () => void p.openFile(config.path) }
            : { label: 'Открыть вывод', run: () => ui.showBottom('output') }
        })
      }
      return r
    }) : window.api.cli.compile(mainFile, fqbn)
    const done = await b.run(launch, upload ? 'upload' : 'compile', upload ? 'Сборка и загрузка…' : 'Компиляция…', {
      source: { root, fqbn, revision, port },
      isCurrent
    })
    if (!isCurrent() || !done || done.cancelled) return
    if (done.code === 0 && upload) {
      ui.notify('Скетч загружен на плату.', { kind: 'ok', action: serial
        ? { label: 'Открыть монитор порта', run: () => ui.showBottom('monitor') }
        : undefined })
    }
    if (done.code !== 0) {
      const first = useBuild.getState().problems.find((x) => x.severity === 'error')
      const tab = first ? 'problems' : 'output'
      ui.notify(first?.message ?? 'Сборка завершилась с ошибкой.', { kind: 'error', action: { label: first ? 'Открыть проблемы' : 'Открыть вывод', run: () => ui.showBottom(tab) } })
    }
  } finally {
    preparingBuild = false
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
  if (k === 'web' && !isEspPlatform(platformOf(ui.fqbn))) {
    ui.notify('Для этой платы веб-страница экспортируется отдельно. Откройте «Размещение…» и выберите способ запуска.', {
      kind: 'info', action: { label: 'Размещение…', run: () => requestConnect('web') }
    })
    return
  }
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
    { id: 'file.circuitpython', category: 'Файл', title: 'CircuitPython для Raspberry Pi Pico…', run: openCircuitPython },
    { id: 'file.open', category: 'Файл', title: 'Открыть проект…', keys: 'Ctrl+O', run: () => p().pickOpen() },
    { id: 'file.openFile', category: 'Файл', title: useProStore.getState().proMode ? 'Открыть файл…' : 'Открыть файл скетча…', keys: 'Ctrl+Shift+O', run: () => p().pickOpenFile() },
    { id: 'file.examples', category: 'Файл', title: 'Примеры…', run: () => ui().set({ sideVisible: true, sideView: 'examples' }), enabled: () => !useProStore.getState().proMode && hasProject() },
    { id: 'file.quickOpen', category: 'Файл', title: 'Перейти к файлу…', keys: 'Ctrl+P', run: () => ui().setPalette('files'), enabled: hasProject },
    { id: 'file.save', category: 'Файл', title: 'Сохранить', keys: 'Ctrl+S', run: async () => { const f = activeFile(); if (f) await p().saveFile(f) }, enabled: () => !!activeFile() },
    { id: 'file.saveAll', category: 'Файл', title: 'Сохранить всё', keys: 'Ctrl+Shift+S', run: async () => { await p().saveAll() }, enabled: hasProject },
    { id: 'file.close', category: 'Файл', title: 'Закрыть вкладку', keys: 'Ctrl+W', run: async () => { const a = p().activeId; if (a) await p().closeTab(a) } },
    { id: 'file.closeProject', category: 'Файл', title: 'Закрыть проект (на стартовый экран)', run: () => p().closeProject(), enabled: hasProject },
    { id: 'pro.flash', category: 'Отладка', title: 'Прошить плату (ST-Link, J-Link, CMSIS-DAP)', run: () => runProAction('flash'), enabled: () => useProStore.getState().proMode && !!useProStore.getState().project },
    { id: 'debug.continue', category: 'Отладка', title: 'Начать отладку / продолжить', keys: 'F5', run: () => { const h = useHw.getState(); if (h.debug.status === 'off') return runProAction('debug'); return h.run('resume') }, enabled: () => useProStore.getState().proMode && !!useProStore.getState().project },
    { id: 'debug.over', category: 'Отладка', title: 'Шаг с обходом функций', keys: 'F10', run: () => useHw.getState().run('stepOver'), enabled: () => useProStore.getState().proMode && useHw.getState().debug.status === 'stopped' },
    { id: 'debug.into', category: 'Отладка', title: 'Шаг внутрь функции', keys: 'F11', run: () => useHw.getState().run('stepInto'), enabled: () => useProStore.getState().proMode && useHw.getState().debug.status === 'stopped' },
    { id: 'debug.out', category: 'Отладка', title: 'Шаг наружу из функции', keys: 'Shift+F11', run: () => useHw.getState().run('stepOut'), enabled: () => useProStore.getState().proMode && useHw.getState().debug.status === 'stopped' },
    { id: 'debug.pause', category: 'Отладка', title: 'Пауза (остановить выполнение программы)', run: () => useHw.getState().run('pause'), enabled: () => useProStore.getState().proMode && useHw.getState().debug.status === 'running' },
    { id: 'debug.stop', category: 'Отладка', title: 'Остановить отладку', keys: 'Shift+F5', run: () => useHw.getState().stopDebug(), enabled: () => useProStore.getState().proMode && useHw.getState().debug.status !== 'off' },
    { id: 'debug.toggleBp', category: 'Отладка', title: 'Точка останова на текущей строке', keys: 'F9', run: () => { const f = activeFile(); if (f) return useHw.getState().toggleBreakpoint(f, ui().cursor.line) }, enabled: () => useProStore.getState().proMode && !!activeFile() },
    { id: 'pro.clean', category: 'Сборка', title: 'Очистить результаты сборки (Pro)', run: () => runProAction('clean'), enabled: () => useProStore.getState().proMode && !!useProStore.getState().project },
    { id: 'pro.export', category: 'Сборка', title: 'Экспорт сборки: Makefile и CMakeLists.txt (Pro)', run: () => runExportBuild(), enabled: () => useProStore.getState().proMode && !!useProStore.getState().project },
    { id: 'pro.pins', category: 'Проект', title: 'Выводы и тактирование: конфигуратор выводов (Pro)', run: () => openPins(), enabled: () => useProStore.getState().proMode && !!useProStore.getState().project },
    { id: 'pro.configs', category: 'Сборка', title: 'Конфигурации сборки: Debug, Release… (Pro)', run: () => useProBuild.getState().setDialog({ kind: 'configs' }), enabled: () => useProStore.getState().proMode && !!useProStore.getState().project },
    { id: 'pro.toolchain', category: 'Сборка', title: 'Установить компилятор ARM (Pro)', run: async () => { await useProBuild.getState().refreshToolchain(); useProBuild.getState().setDialog({ kind: 'toolchain', resume: false }) }, enabled: () => useProStore.getState().proMode },
    { id: 'view.size', category: 'Вид', title: 'Панель «Размер» (Flash и RAM последней сборки)', run: () => ui().showBottom('size'), enabled: () => useProStore.getState().proMode },
    { id: 'view.swo', category: 'Вид', title: 'Панель «SWO» (printf через ITM)', run: () => ui().showBottom('swo'), enabled: () => useProStore.getState().proMode },
    { id: 'view.hw', category: 'Вид', title: 'Мастер прошивки (ST-Link, J-Link, CMSIS-DAP)', run: () => openBottom('hw'), enabled: () => useProStore.getState().proMode },
    { id: 'view.debug', category: 'Вид', title: 'Панель «Отладка»', run: () => openBottom('debug'), enabled: () => useProStore.getState().proMode },
    { id: 'build.verify', category: 'Сборка', title: 'Проверить (компилировать)', keys: 'Ctrl+B', run: () => runBuild(false) },
    { id: 'build.upload', category: 'Сборка', title: 'Загрузить на плату', keys: 'Ctrl+U', run: () => runBuild(true) },
    { id: 'page.check', category: 'Сборка', title: 'Проверить страницу (сборка скетча со страницей, плата не нужна)', run: () => checkPage(), enabled: () => !useProStore.getState().proMode && !!useProject.getState().root },
    { id: 'build.cancel', category: 'Сборка', title: 'Отменить текущую операцию', run: () => useBuild.getState().cancel(), enabled: () => useBuild.getState().busy },
    { id: 'board.select', category: 'Сборка', title: 'Выбрать плату…', run: () => ui().setPicker('board'), enabled: () => !useProStore.getState().proMode },
    { id: 'board.options', category: 'Сборка', title: 'Параметры платы…', run: () => ui().setPicker('options'), enabled: () => !useProStore.getState().proMode },
    { id: 'port.select', category: 'Сборка', title: 'Выбрать порт…', run: () => { void useBuild.getState().refreshPorts(); ui().setPicker('port') }, enabled: () => !useProStore.getState().proMode },
    { id: 'port.refresh', category: 'Сборка', title: 'Обновить список портов', run: async () => { await useBuild.getState().refreshPorts() }, enabled: () => !useProStore.getState().proMode },
    { id: 'view.files', category: 'Вид', title: 'Проводник (файлы проекта)', keys: 'Ctrl+Shift+E', run: () => ui().showSide('files') },
    { id: 'view.boards', category: 'Вид', title: 'Платы: поддержка плат и источники', keys: 'Ctrl+Shift+X', run: () => ui().showSide('boards'), enabled: () => !useProStore.getState().proMode },
    { id: 'view.libs', category: 'Вид', title: 'Библиотеки', keys: 'Ctrl+Shift+K', run: () => ui().showSide('libs'), enabled: () => !useProStore.getState().proMode },
    { id: 'view.search', category: 'Вид', title: 'Поиск по проекту', keys: 'Ctrl+Shift+F', run: () => ui().focusSearch(), enabled: hasProject },
    { id: 'view.toggleSide', category: 'Вид', title: 'Показать / скрыть боковую панель', keys: 'Ctrl+\\', run: () => ui().toggleSide() },
    { id: 'view.output', category: 'Вид', title: 'Вывод сборки', keys: 'Ctrl+Shift+U', run: () => ui().showBottom('output') },
    { id: 'view.problems', category: 'Вид', title: 'Панель «Проблемы»', keys: 'Ctrl+Shift+M', run: () => ui().showBottom('problems') },
    { id: 'view.monitor', category: 'Вид', title: 'Монитор порта', keys: 'Ctrl+Shift+L', run: () => ui().showBottom('monitor') },
    { id: 'view.plotter', category: 'Вид', title: 'Серийный плоттер (график значений из порта)', run: () => ui().showBottom('plotter'), enabled: () => !useProStore.getState().proMode },
    { id: 'view.reference', category: 'Вид', title: 'Справочник', keys: 'F1', run: () => openReference() },
    { id: 'view.ui', category: 'Вид', title: 'Конструктор ESPUI', run: () => p().openPanel('ui'), enabled: () => !useProStore.getState().proMode },
    { id: 'view.web', category: 'Вид', title: 'Веб-дизайнер (HTML + CSS)', run: () => p().openPanel('web') },
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
    if (k === 'Ctrl+`') { e.preventDefault(); useUi.getState().showBottom('output'); return }
    const cmd = getCommands().find((c) => c.keys === k)
    if (!cmd || (cmd.enabled && !cmd.enabled())) return
    // F1 в поле ввода не перехватываем
    e.preventDefault()
    void cmd.run()
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}
