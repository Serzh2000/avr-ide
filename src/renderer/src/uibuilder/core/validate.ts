// Валидатор модели: идентификаторы C++, переменные, пины, совместимость привязок.
import { identProblem, initProblem } from './cpp'
import { checkPin } from './pins'
import type { PinRole } from './pins'
import type { Binding, GenerateOptions, Issue, Platform, UiElement, UiProject, UiVariable } from './types'
import { ESPUI_COLORS } from './types'
import { INPUT_TYPES, WIDGETS, isWidgetType } from './widgets'
import { classProblem, compileStyle, styleProblems } from './css'
import { themeCss, themeProblems } from './themes'
import {
  JSON_MARGIN,
  JSON_OVERHEAD,
  STYLE_WARN_BYTES_ESP8266,
  THEME_WARN_BYTES_ESP8266,
  jsonDocumentSize,
  utf8Len
} from './espui-api'

/** Роль пина для привязки (для проверок и генератора). */
export function pinRoleOf(b: Binding): PinRole | null {
  if (b.kind !== 'pin') return null
  if (b.direction === 'toPin') return b.mode === 'analog' ? 'out-pwm' : 'out-digital'
  return b.mode === 'analog' ? 'in-analog' : 'in-digital'
}

export function findVariable(p: UiProject, name: string): UiVariable | undefined {
  return p.variables.find((v) => v.name === name)
}

export function hasErrors(issues: Issue[]): boolean {
  return issues.some((i) => i.severity === 'error')
}

/** Максимальное значение PWM-«дуты» для платформы/проекта. */
export function pwmMax(p: UiProject, platform: Platform): number {
  return platform === 'esp8266' ? 1023 : 2 ** p.settings.pwmBits - 1
}

export function validate(p: UiProject, platform: Platform = p.platform, opts: GenerateOptions = {}): Issue[] {
  void opts
  const issues: Issue[] = []
  const add = (
    severity: Issue['severity'],
    code: string,
    message: string,
    extra: Partial<Issue> = {}
  ): void => {
    issues.push({ severity, code, message, ...extra })
  }

  // --- Платформа/общие настройки ---
  if (platform !== 'esp8266' && platform !== 'esp32')
    add('error', 'platform', `Неизвестная платформа: ${String(platform)}`)

  const w = p.wifi
  const apOk = (): void => {
    if (!w.apSsid) add('error', 'wifi-ap-ssid', 'Не задано имя точки доступа (apSsid)')
    if (w.apSsid.length > 32) add('error', 'wifi-ap-ssid-len', 'Имя точки доступа длиннее 32 символов')
    if (w.apPassword && (w.apPassword.length < 8 || w.apPassword.length > 63))
      add('error', 'wifi-ap-pass', 'Пароль точки доступа: пусто (открытая сеть) или 8–63 символа')
  }
  if (w.mode === 'sta') {
    if (!w.ssid) add('error', 'wifi-ssid', 'Режим STA: не задано имя сети (SSID)')
    if (w.ssid.length > 32) add('error', 'wifi-ssid-len', 'SSID длиннее 32 символов')
    if (w.password && (w.password.length < 8 || w.password.length > 63))
      add('warning', 'wifi-pass', 'Пароль WPA2 обычно 8–63 символа')
    // Резервная AP при неудаче подключения
    apOk()
  } else if (w.mode === 'ap') {
    apOk()
  } else {
    add('error', 'wifi-mode', `Неизвестный режим WiFi: ${String(w.mode)}`)
  }
  if (w.hostname && !/^[A-Za-z0-9]([A-Za-z0-9-]{0,30}[A-Za-z0-9])?$/.test(w.hostname))
    add('warning', 'wifi-hostname', 'hostname: латинские буквы, цифры и дефис, до 32 символов')

  const s = p.settings
  if (!Number.isInteger(s.updateMs) || s.updateMs < 50)
    add('error', 'update-ms', 'Период обновления должен быть целым числом не менее 50 мс')
  if (!!s.authUser !== !!s.authPass)
    add('warning', 'auth', 'Для авторизации ESPUI задайте и логин, и пароль (иначе она отключена)')
  if (platform === 'esp32') {
    if (!Number.isInteger(s.pwmBits) || s.pwmBits < 1 || s.pwmBits > 14)
      add('error', 'pwm-bits', 'Разрядность PWM: целое 1–14')
    if (!Number.isFinite(s.pwmFreq) || s.pwmFreq <= 0) add('error', 'pwm-freq', 'Частота PWM должна быть > 0')
  }

  if (/[<>]/.test(s.title))
    add('warning', 'html-title', 'Заголовок страницы ESPUI выводится как HTML: символы < и > будут интерпретированы браузером')

  // --- Тема ---
  for (const m of themeProblems(p.theme)) add('error', 'theme-value', m)
  if (platform === 'esp8266') {
    const css = utf8Len(themeCss(p.theme))
    if (css > THEME_WARN_BYTES_ESP8266)
      add('warning', 'theme-size', `CSS темы занимает ${css} байт RAM (ESP8266: рекомендуется не более ${THEME_WARN_BYTES_ESP8266}); упростите тему`)
  }

  // --- Идентификаторы ---
  const owners = new Map<string, string>() // имя → описание владельца
  const claim = (name: string, what: string, extra: Partial<Issue>, fromSketch = false): void => {
    // Имена из скетча уже компилируются у пользователя — «зарезервированность» не проверяем, только повторы.
    const prob = fromSketch ? null : identProblem(name)
    if (prob) add('error', 'ident', `${what} «${name}»: ${prob}`, extra)
    const prev = owners.get(name)
    if (prev) add('error', 'ident-dup', `Имя «${name}» используется дважды: ${prev} и ${what}`, extra)
    else owners.set(name, what)
  }

  for (const v of p.variables) {
    claim(v.name, v.external ? 'переменная скетча' : 'переменная', { variable: v.name }, !!v.external)
    if (v.external) {
      if (!['bool', 'int', 'float', 'String'].includes(v.type))
        add('error', 'var-type', `Переменная «${v.name}»: тип не поддерживается конструктором`, { variable: v.name })
      continue
    }
    if (!['bool', 'int', 'float', 'String'].includes(v.type))
      add('error', 'var-type', `Переменная «${v.name}»: неизвестный тип ${String(v.type)}`, { variable: v.name })
    else {
      const ip = initProblem(v.type, v.init)
      if (ip) add('error', 'var-init', `Переменная «${v.name}»: ${ip}`, { variable: v.name })
    }
  }

  if (p.tabs.length === 0) add('error', 'tabs-empty', 'Нужна хотя бы одна вкладка')
  const multiTab = p.tabs.length > 1
  for (const t of p.tabs) {
    // Идентификатор вкладки используется в коде только при нескольких вкладках,
    // но резервируем всегда, чтобы переключение не ломало проект.
    claim(t.id, 'вкладка', { tabId: t.id })
    if (multiTab && !t.title) add('warning', 'tab-title', `Вкладка «${t.id}» без названия`, { tabId: t.id })
    for (const e of t.elements) claim(e.id, 'элемент', { elementId: e.id })
  }

  // --- Элементы ---
  const pinUse = new Map<number, Array<{ el: UiElement; role: PinRole }>>()
  let pwmPins = 0
  const callbackFns: Array<{ fn: string; elementId: string }> = []

  for (const t of p.tabs) {
    for (const el of t.elements) {
      const at = { elementId: el.id }
      if (!isWidgetType(el.type)) {
        add('error', 'el-type', `Элемент «${el.id}»: неизвестный тип ${String(el.type)}`, at)
        continue
      }
      const def = WIDGETS[el.type]
      const props = el.props ?? {}
      if (el.type !== 'separator' && !el.label.trim())
        add('warning', 'el-label', `Элемент «${el.id}» без подписи`, at)
      if (props.color && !ESPUI_COLORS.includes(props.color))
        add('error', 'el-color', `Элемент «${el.id}»: неизвестный цвет ${props.color}`, at)
      if (props.vertical && el.type !== 'slider' && el.type !== 'switcher')
        add('warning', 'el-vertical', `Элемент «${el.id}»: вертикальный вид поддерживают только slider и switcher`, at)
      if (props.decimals !== undefined && (!Number.isInteger(props.decimals) || props.decimals < 0 || props.decimals > 6))
        add('error', 'el-decimals', `Элемент «${el.id}»: знаков после запятой — целое 0–6`, at)

      // min / max / step
      if (el.type === 'slider' || el.type === 'number') {
        const mn = props.min ?? 0
        const mx = props.max ?? 100
        if (!Number.isFinite(mn) || !Number.isFinite(mx))
          add('error', 'el-range', `Элемент «${el.id}»: min/max должны быть числами`, at)
        else if (mn >= mx) add('error', 'el-range', `Элемент «${el.id}»: min должен быть меньше max`, at)
        if (el.type === 'slider' && (!Number.isInteger(mn) || !Number.isInteger(mx)))
          add('error', 'el-slider-int', `Slider «${el.id}»: границы должны быть целыми`, at)
        if (props.step !== undefined && !(props.step > 0))
          add('error', 'el-step', `${def.title} «${el.id}»: шаг должен быть > 0`, at)
      }
      if (el.type === 'graph' && props.scale !== undefined && !Number.isFinite(props.scale))
        add('error', 'el-scale', `Graph «${el.id}»: множитель должен быть числом`, at)

      // специфические свойства новых виджетов
      if (def.experimental)
        add('warning', 'el-experimental', `${def.title} «${el.id}»: в ESPUI элемент экспериментальный/неполный — проверьте на устройстве`, at)
      if (props.inputType !== undefined && !INPUT_TYPES.some((x) => x.value === props.inputType))
        add('error', 'el-input-type', `Text «${el.id}»: неизвестный тип поля «${String(props.inputType)}»`, at)
      if (props.inputType !== undefined && props.inputType !== 'text' && el.type !== 'text')
        add('warning', 'el-input-type', `Элемент «${el.id}»: inputType применяется только к Text`, at)
      if (props.maxLength !== undefined && (!Number.isInteger(props.maxLength) || props.maxLength < 1 || props.maxLength > 1024))
        add('error', 'el-maxlength', `Элемент «${el.id}»: максимальная длина — целое 1–1024`, at)
      if (props.pollSec !== undefined && (!Number.isInteger(props.pollSec) || props.pollSec < 0 || props.pollSec > 86400))
        add('error', 'el-pollsec', `Time «${el.id}»: период — целое число секунд 0–86400`, at)
      if (props.graphMs !== undefined && (!Number.isInteger(props.graphMs) || props.graphMs < 50))
        add('error', 'el-graphms', `Graph «${el.id}»: период точек — целое не менее 50 мс`, at)
      if (props.action !== undefined && props.action !== 'hold' && props.action !== 'toggle')
        add('error', 'el-action', `Button «${el.id}»: неизвестное действие «${String(props.action)}»`, at)
      if (el.type === 'fileDisplay') {
        const f = props.file ?? ''
        if (!f) add('error', 'el-file', `FileDisplay «${el.id}»: не указан путь к файлу`, at)
        else if (!/^\/?[A-Za-z0-9._\/-]{1,120}$/.test(f) || f.includes('..'))
          add('error', 'el-file', `FileDisplay «${el.id}»: путь — латиница, цифры, . _ - /, без «..» (до 120 символов)`, at)
        add(
          'warning',
          'el-file-fs',
          `FileDisplay «${el.id}»: браузер запросит файл у веб-сервера; ESPUI.begin() (PROGMEM-режим) такие файлы не раздаёт — не подтверждено, проверьте на устройстве`,
          at
        )
      }
      const hasHtml = (x: string | undefined): boolean => !!x && /[<>]/.test(x)
      if (hasHtml(el.label) || hasHtml(props.prefix) || hasHtml(props.suffix))
        add('warning', 'html-label', `Элемент «${el.id}»: фронтенд ESPUI вставляет подпись как HTML — символы < и > будут интерпретированы`, at)
      const quoted = [props.text, props.initial, ...(props.options ?? []).map((o) => o.value)]
      if (quoted.some((x) => !!x && x.includes("'")))
        add('warning', 'html-quote', `Элемент «${el.id}»: апостроф в значении ломает HTML-атрибут во фронтенде ESPUI (value='…')`, at)
      if (el.group !== undefined && (typeof el.group !== 'string' || el.group.length > 60))
        add('error', 'el-group', `Элемент «${el.id}»: название группы — строка до 60 символов`, at)

      // стили
      for (const [which, spec] of [
        ['панели', props.panelStyle],
        ['элемента', props.elementStyle]
      ] as const)
        for (const si of styleProblems(spec)) add('error', 'style-value', `Элемент «${el.id}», стиль ${which}: ${si.message}`, at)
      if (props.panelClass) {
        const cp = classProblem(props.panelClass)
        if (cp) add('error', 'style-class', `Элемент «${el.id}»: ${cp}`, at)
      }
      const ps = compileStyle(props.panelStyle)
      const es = compileStyle(props.elementStyle)
      if (es && el.type !== 'button' && el.type !== 'label' && el.type !== 'slider')
        add('warning', 'style-element-support', `Элемент «${el.id}»: README ESPUI гарантирует setElementStyle только для Button, Label, Slider (список в источнике обрезан)`, at)
      const styleBytes = utf8Len(ps) + utf8Len(es) + utf8Len(props.panelClass ?? '')
      if (platform === 'esp8266' && styleBytes > STYLE_WARN_BYTES_ESP8266)
        add('warning', 'style-size', `Элемент «${el.id}»: стили занимают ${styleBytes} байт — на ESP8266 документ порции всего 2000 байт, сократите стиль`, at)
      // Оценка размера JSON одного контрола (ESPUIclient.cpp: если не помещается — вместо контрола уходит сообщение об ошибке).
      const valueBytes = utf8Len(el.type === 'fileDisplay' ? (props.file ?? '') : (props.initial ?? props.text ?? ''))
      const est = utf8Len(el.label) + valueBytes + styleBytes + JSON_OVERHEAD
      if (est > jsonDocumentSize(platform) - JSON_MARGIN)
        add('error', 'el-too-big', `Элемент «${el.id}»: оценка ${est} байт не помещается в JSON-документ ESPUI (${jsonDocumentSize(platform)} байт)`, at)

      // select
      if (el.type === 'select') {
        const opts = props.options ?? []
        if (opts.length === 0) add('error', 'sel-empty', `Select «${el.id}»: нет вариантов`, at)
        const seen = new Set<string>()
        for (const o of opts) {
          if (seen.has(o.value)) add('error', 'sel-dup', `Select «${el.id}»: повтор значения «${o.value}»`, at)
          seen.add(o.value)
          if (o.value === '') add('error', 'sel-empty-value', `Select «${el.id}»: пустое значение варианта`, at)
        }
      }

      // --- привязка ---
      const b = el.binding ?? { kind: 'none' }
      if (b.kind === 'none') continue

      if (b.kind === 'callback') {
        if (!def.callback) {
          add('error', 'bind-incompat', `${def.title} «${el.id}» не порождает событий — привязка «callback» недоступна`, at)
          continue
        }
        if (!b.fn) {
          add('error', 'bind-cb-missing', `Элемент «${el.id}»: не выбрана функция — укажите имя своей функции в блоке «Связь с кодом»`, at)
          continue
        }
        const prob = identProblem(b.fn ?? '')
        if (prob) add('error', 'bind-cb-name', `Элемент «${el.id}»: имя функции «${b.fn ?? ''}»: ${prob}`, at)
        else callbackFns.push({ fn: b.fn, elementId: el.id })
        continue
      }

      if (b.kind === 'var') {
        const v = findVariable(p, b.variable)
        if (!b.variable) {
          add('error', 'bind-var-missing', `Элемент «${el.id}»: не выбрана переменная — укажите её в блоке «Связь с кодом»`, at)
          continue
        }
        if (!v) {
          add('error', 'bind-var-unknown', `Элемент «${el.id}»: переменная «${b.variable}» не объявлена`, {
            ...at,
            variable: b.variable
          })
          continue
        }
        const toUi = b.direction === 'toUi' || b.direction === 'both'
        const fromUi = b.direction === 'fromUi' || b.direction === 'both'
        if (!toUi && !fromUi) add('error', 'bind-dir', `Элемент «${el.id}»: неизвестное направление привязки`, at)
        if (toUi && !def.varToUi.includes(v.type))
          add(
            'error',
            'bind-incompat',
            `${def.title} «${el.id}» не может показывать переменную «${v.name}» типа ${v.type} (device→UI поддерживает: ${def.varToUi.join(', ') || 'нет'})`,
            { ...at, variable: v.name }
          )
        if (fromUi && !def.varFromUi.includes(v.type))
          add(
            'error',
            'bind-incompat',
            `${def.title} «${el.id}» не может писать в переменную «${v.name}» типа ${v.type} (UI→device поддерживает: ${def.varFromUi.join(', ') || 'нет'})`,
            { ...at, variable: v.name }
          )
        if (el.type === 'select' && v.type === 'int' && (fromUi || toUi))
          for (const o of props.options ?? [])
            if (!/^-?\d+$/.test(o.value))
              add('error', 'sel-int', `Select «${el.id}»: переменная int, а значение «${o.value}» не целое`, at)
        if (el.type === 'select' && fromUi && v.type === 'String' && v.init) {
          if (!(props.options ?? []).some((o) => o.value === v.init))
            add('warning', 'sel-init', `Select «${el.id}»: начальное значение «${v.init}» не входит в список вариантов`, at)
        }
        if (el.type === 'label' && v.type === 'String' && toUi)
          add('warning', 'label-html', `Label «${el.id}»: ESPUI выводит значение как HTML — спецсимволы в String не экранируются`, at)
        continue
      }

      if (b.kind === 'pin') {
        const role = pinRoleOf(b)
        if (!role) continue
        if (!Number.isInteger(b.pin) || b.pin < 0) {
          add('error', 'bind-pin-missing', `Элемент «${el.id}»: пин не выбран — укажите его в блоке «Связь с кодом»`, at)
          continue
        }
        const allowed = b.direction === 'toPin' ? def.pinToPin : def.pinFromPin
        if (!allowed.includes(b.mode)) {
          add(
            'error',
            'bind-incompat',
            `${def.title} «${el.id}»: режим ${b.mode} недоступен для направления ${b.direction === 'toPin' ? 'UI→пин' : 'пин→UI'}`,
            at
          )
          continue
        }
        for (const prob of checkPin(platform, b.pin, role)) add(prob.severity, prob.code, `Элемент «${el.id}»: ${prob.message}`, at)
        const list = pinUse.get(b.pin) ?? []
        list.push({ el, role })
        pinUse.set(b.pin, list)
        if (role === 'out-pwm') {
          pwmPins++
          const mx = props.max ?? 100
          const lim = pwmMax(p, platform)
          if (mx > lim)
            add('warning', 'pwm-range', `Элемент «${el.id}»: max=${mx} больше предела PWM (${lim}); значение будет обрезано`, at)
          if ((props.min ?? 0) < 0)
            add('warning', 'pwm-neg', `Элемент «${el.id}»: отрицательные значения PWM будут обрезаны до 0`, at)
        }
        if (role === 'in-analog' && (el.type === 'slider' || el.type === 'number')) {
          const lim = platform === 'esp8266' ? 1023 : 4095
          if ((props.max ?? 100) < lim)
            add('warning', 'adc-range', `Элемент «${el.id}»: analogRead даёт 0–${lim}, а max=${props.max ?? 100}`, at)
        }
        if (b.direction === 'fromPin' && b.mode === 'analog' && b.invert)
          add('warning', 'invert-analog', `Элемент «${el.id}»: invert для аналоговых пинов игнорируется`, at)
      }
    }
  }

  // Имя функции пользователя не должно совпадать с переменной, вкладкой или id элемента
  for (const c of callbackFns) {
    const owner = owners.get(c.fn)
    if (owner) add('error', 'ident-dup', `Имя функции «${c.fn}» (элемент «${c.elementId}») совпадает с именем: ${owner}`, { elementId: c.elementId })
  }

  // Конфликты пинов
  for (const [pin, uses] of pinUse) {
    if (uses.length < 2) continue
    const outs = uses.filter((u) => u.role === 'out-digital' || u.role === 'out-pwm')
    const names = uses.map((u) => `«${u.el.id}»`).join(', ')
    if (outs.length > 0)
      add('error', 'pin-conflict', `Пин ${pin} используется несколькими элементами, среди них выходные: ${names}`, {
        elementId: uses[0].el.id
      })
  }
  if (platform === 'esp32' && pwmPins > 16)
    add('error', 'pwm-channels', `PWM-пинов ${pwmPins}, а каналов LEDC на ESP32 не больше 16`)

  return issues
}
