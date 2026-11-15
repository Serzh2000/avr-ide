// «Что должно происходить?» — понятные человеку варианты привязки поверх модели Binding, проверка совместимости типов
// с объяснением и словесное описание уже заданной привязки. Чистые функции без React (для тестов).
import { WIDGETS } from './widgets'
import type { Binding, UiElement, VarType, WidgetType } from './types'

export type Intent = 'none' | 'show' | 'write' | 'both' | 'pinWrite' | 'pinRead' | 'callback'

export interface IntentInfo {
  id: Intent
  title: string
  hint: string
}

/** Названия элементов в творительном/именительном падеже для объяснений. */
export const WIDGET_RU: Record<WidgetType, { name: string; gives: string }> = {
  label: { name: 'Надпись', gives: 'текст' },
  button: { name: 'Кнопка', gives: 'нажатие (true/false или счётчик)' },
  switcher: { name: 'Переключатель', gives: '«вкл/выкл»' },
  slider: { name: 'Ползунок', gives: 'число' },
  number: { name: 'Числовое поле', gives: 'число' },
  text: { name: 'Текстовое поле', gives: 'строку' },
  select: { name: 'Список', gives: 'выбранное значение' },
  graph: { name: 'График', gives: 'ничего (только показывает)' },
  separator: { name: 'Разделитель', gives: 'ничего' },
  pad: { name: 'Крестовина', gives: 'код нажатой стрелки (int)' },
  padCenter: { name: 'Крестовина с центром', gives: 'код нажатой кнопки (int)' },
  password: { name: 'Поле пароля', gives: 'строку' },
  time: { name: 'Время браузера', gives: 'строку со временем' },
  fileDisplay: { name: 'Окно файла', gives: 'ничего' },
  accel: { name: 'Акселерометр', gives: 'ничего (не завершён в ESPUI)' }
}

type IntentText = Partial<Record<Intent, { title: string; hint: string }>>

const TEXTS: Partial<Record<WidgetType, IntentText>> = {
  label: {
    show: { title: 'Показывать значение переменной', hint: 'Скетч меняет переменную — надпись на странице обновляется сама.' },
    pinRead: { title: 'Показывать состояние пина', hint: 'Читаем вход платы: «ON/OFF» или число с аналогового входа.' }
  },
  graph: {
    show: { title: 'Рисовать график значения переменной', hint: 'Каждый период в график добавляется новая точка.' },
    pinRead: { title: 'Рисовать график сигнала с пина', hint: 'Точки берутся из analogRead / digitalRead.' }
  },
  button: {
    write: { title: 'Записывать нажатие в переменную', hint: 'bool: true, пока кнопка нажата. int: счётчик нажатий.' },
    pinWrite: { title: 'Включать пин, пока кнопка нажата', hint: 'Прямое управление выводом платы (digitalWrite).' },
    callback: { title: 'Вызывать мою функцию', hint: 'Ваша функция получит событие «нажата/отпущена».' }
  },
  switcher: {
    both: { title: 'Переключатель и переменная всегда совпадают', hint: 'Нажали на странице — переменная изменилась; изменили в скетче — переключатель сам перекинулся.' },
    write: { title: 'Записывать положение в переменную', hint: 'Скетч получает true/false (или 1/0).' },
    show: { title: 'Только показывать состояние переменной', hint: 'Индикатор: пользователь может его нажать, но скетч не узнает.' },
    pinWrite: { title: 'Включать и выключать пин', hint: 'Например светодиод или реле (digitalWrite).' },
    pinRead: { title: 'Показывать состояние входа', hint: 'Читаем пин (digitalRead) и показываем «вкл/выкл».' },
    callback: { title: 'Вызывать мою функцию', hint: 'Ваша функция получит событие «включён/выключен».' }
  },
  slider: {
    both: { title: 'Ползунок и переменная связаны', hint: 'Двигаете ползунок — меняется переменная; меняете её в скетче — ползунок едет сам.' },
    write: { title: 'Записывать число с ползунка в переменную', hint: 'Скетч получает число в заданных пределах.' },
    show: { title: 'Показывать значение переменной ползунком', hint: 'Скетч задаёт положение, пользователь тоже может двигать.' },
    pinWrite: { title: 'Менять яркость / мощность на пине (ШИМ)', hint: 'Ползунок задаёт скважность ШИМ (analogWrite / ledcWrite).' },
    pinRead: { title: 'Показывать значение аналогового входа', hint: 'Читаем analogRead и двигаем ползунок.' },
    callback: { title: 'Вызывать мою функцию', hint: 'Ваша функция получит число в sender->value.' }
  },
  number: {
    both: { title: 'Поле и переменная связаны', hint: 'Введённое число попадает в переменную; изменения в скетче отображаются в поле.' },
    write: { title: 'Записывать введённое число в переменную', hint: 'int или float — как у переменной.' },
    show: { title: 'Показывать значение переменной', hint: 'Число обновляется само.' },
    pinWrite: { title: 'Выдавать число на пин как ШИМ', hint: 'Значение уходит в analogWrite / ledcWrite.' },
    pinRead: { title: 'Показывать значение с пина', hint: 'analogRead или digitalRead.' },
    callback: { title: 'Вызывать мою функцию', hint: 'Ваша функция получит число в sender->value.' }
  },
  text: {
    both: { title: 'Поле и строка связаны', hint: 'Текст из поля попадает в String; изменения в скетче видны в поле.' },
    write: { title: 'Записывать введённый текст в переменную', hint: 'Нужна переменная типа String.' },
    show: { title: 'Показывать текст переменной', hint: 'Нужна переменная типа String.' },
    callback: { title: 'Вызывать мою функцию', hint: 'Текст придёт в sender->value.' }
  },
  select: {
    both: { title: 'Список и переменная связаны', hint: 'Выбранный пункт попадает в переменную; изменения в скетче выбирают пункт.' },
    write: { title: 'Записывать выбранный пункт в переменную', hint: 'int (номер/значение пункта) или String.' },
    show: { title: 'Показывать выбор из переменной', hint: 'Пункт выбирается по значению переменной.' },
    callback: { title: 'Вызывать мою функцию', hint: 'Значение выбранного пункта придёт в sender->value.' }
  },
  password: {
    write: { title: 'Записывать пароль в переменную', hint: 'Нужна переменная String. Обратно на страницу пароль не отправляется.' },
    callback: { title: 'Вызывать мою функцию', hint: 'Пароль придёт в sender->value.' }
  },
  pad: {
    write: { title: 'Записывать нажатую стрелку в переменную', hint: 'int: код события (отрицательный — нажата, положительный — отпущена).' },
    callback: { title: 'Вызывать мою функцию', hint: 'Код события придёт вторым аргументом.' }
  },
  padCenter: {
    write: { title: 'Записывать нажатую кнопку в переменную', hint: 'int: код события (отрицательный — нажата, положительный — отпущена).' },
    callback: { title: 'Вызывать мою функцию', hint: 'Код события придёт вторым аргументом.' }
  },
  time: {
    write: { title: 'Записывать время браузера в переменную', hint: 'Нужна переменная String.' },
    callback: { title: 'Вызывать мою функцию', hint: 'Время придёт в sender->value.' }
  },
  accel: { callback: { title: 'Вызывать мою функцию', hint: 'В ESPUI элемент не завершён — формат не подтверждён.' } }
}

/** Варианты ответа на «Что должно происходить?» для элемента. */
export function intentsFor(type: WidgetType): IntentInfo[] {
  const w = WIDGETS[type]
  const t = TEXTS[type] ?? {}
  const out: IntentInfo[] = [{ id: 'none', title: 'Пока ничего', hint: 'Элемент только оформление: ни с чем не связан.' }]
  const add = (id: Intent, fallbackTitle: string): void => {
    out.push({ id, title: t[id]?.title ?? fallbackTitle, hint: t[id]?.hint ?? '' })
  }
  if (w.varToUi.length && w.varFromUi.length && w.varToUi.some((x) => w.varFromUi.includes(x))) add('both', 'В обе стороны')
  if (w.varFromUi.length) add('write', 'Записывать в переменную')
  if (w.varToUi.length) add('show', 'Показывать переменную')
  if (w.pinToPin.length) add('pinWrite', 'Управлять пином')
  if (w.pinFromPin.length) add('pinRead', 'Читать пин')
  if (w.callback) add('callback', 'Вызывать мою функцию')
  return out
}

export function intentOf(b: Binding): Intent {
  switch (b.kind) {
    case 'none':
      return 'none'
    case 'callback':
      return 'callback'
    case 'pin':
      return b.direction === 'toPin' ? 'pinWrite' : 'pinRead'
    case 'var':
      return b.direction === 'toUi' ? 'show' : b.direction === 'fromUi' ? 'write' : 'both'
  }
}

/** Новая привязка под выбранный вариант; по возможности сохраняет прежний источник (переменную, пин, функцию). */
export function bindingForIntent(el: Pick<UiElement, 'id' | 'type'>, intent: Intent, prev: Binding): Binding {
  const w = WIDGETS[el.type]
  switch (intent) {
    case 'none':
      return { kind: 'none' }
    case 'callback':
      return prev.kind === 'callback' ? prev : { kind: 'callback', fn: '' }
    case 'show':
    case 'write':
    case 'both': {
      const direction = intent === 'show' ? 'toUi' : intent === 'write' ? 'fromUi' : 'both'
      return { kind: 'var', variable: prev.kind === 'var' ? prev.variable : '', direction }
    }
    case 'pinWrite': {
      const mode = w.pinToPin[0] ?? 'digital'
      if (prev.kind === 'pin') {
        const keep: Binding = { kind: 'pin', pin: prev.pin, direction: 'toPin', mode: w.pinToPin.includes(prev.mode) ? prev.mode : mode }
        if (prev.pinName) keep.pinName = prev.pinName
        return keep
      }
      return { kind: 'pin', pin: -1, direction: 'toPin', mode }
    }
    case 'pinRead': {
      const mode = w.pinFromPin[0] ?? 'digital'
      if (prev.kind === 'pin') {
        const keep: Binding = { kind: 'pin', pin: prev.pin, direction: 'fromPin', mode: w.pinFromPin.includes(prev.mode) ? prev.mode : mode }
        if (prev.pinName) keep.pinName = prev.pinName
        return keep
      }
      return { kind: 'pin', pin: -1, direction: 'fromPin', mode }
    }
  }
}

export interface Compat {
  ok: boolean
  /** Объяснение простым языком (и для «подходит», и для «не подходит»). */
  text: string
}

const TYPE_RU: Record<VarType, string> = { bool: 'bool (да/нет)', int: 'int (целое)', float: 'float (дробное)', String: 'String (строка)' }
export function typeRu(t: VarType): string {
  return TYPE_RU[t]
}

/** Подходит ли переменная типа vt под элемент в данном направлении; объясняет причину. */
export function varCompat(type: WidgetType, vt: VarType, direction: 'toUi' | 'fromUi'): Compat {
  const w = WIDGETS[type]
  const who = WIDGET_RU[type].name
  const list = direction === 'toUi' ? w.varToUi : w.varFromUi
  if (list.includes(vt)) return { ok: true, text: okText(type, vt, direction) }
  const accepted = list.map((x) => x).join(', ')
  if (list.length === 0)
    return {
      ok: false,
      text:
        direction === 'toUi'
          ? `${who} не умеет показывать значения переменных.`
          : `${who} ничего не передаёт в переменные — нажатия можно ловить только функцией.`
    }
  if (direction === 'fromUi') {
    if (type === 'slider' || type === 'number') {
      if (vt === 'bool')
        return { ok: false, text: `${who} даёт число, а bool — только 0/1. Возьмите int или float — или используйте переключатель.` }
      return { ok: false, text: `${who} даёт число, его нельзя записать в ${vt}. Нужна переменная int или float.` }
    }
    if (type === 'switcher')
      return { ok: false, text: `${who} даёт «вкл/выкл» — запишите его в bool (или int: 1/0), а не в ${vt}.` }
    if (type === 'button')
      return { ok: false, text: `${who} записывает true/false или счётчик нажатий — нужна переменная bool или int, а не ${vt}.` }
    if (type === 'text' || type === 'password' || type === 'time')
      return { ok: false, text: `${who} даёт строку — нужна переменная String, а не ${vt}.` }
    if (type === 'select') return { ok: false, text: `${who} даёт значение пункта — нужна переменная int или String, а не ${vt}.` }
    if (type === 'pad' || type === 'padCenter') return { ok: false, text: `${who} даёт код нажатия — нужна переменная int, а не ${vt}.` }
    return { ok: false, text: `${who} может писать только в: ${accepted}; а у «${vt}» другой тип.` }
  }
  if (type === 'slider' || type === 'number')
    return { ok: false, text: `${who} показывает только числа (int/float), а здесь ${vt}.` }
  if (type === 'switcher') return { ok: false, text: `${who} показывает «вкл/выкл»: нужна переменная bool (или int 0/1), а здесь ${vt}.` }
  if (type === 'graph') return { ok: false, text: `График рисует числа: нужна переменная int, float или bool, а здесь ${vt}.` }
  if (type === 'text') return { ok: false, text: `${who} показывает только строки (String), а здесь ${vt}.` }
  if (type === 'select') return { ok: false, text: `${who} выбирает пункт по значению: нужна переменная int или String, а здесь ${vt}.` }
  return { ok: false, text: `${who} может показывать: ${accepted}; а здесь ${vt}.` }
}

function okText(type: WidgetType, vt: VarType, direction: 'toUi' | 'fromUi'): string {
  if (direction === 'toUi') {
    if (type === 'label') {
      if (vt === 'float') return 'float показывается как текст с заданным числом знаков после запятой.'
      if (vt === 'bool') return 'bool показывается как ON / OFF.'
      return `${vt} показывается как текст.`
    }
    if (type === 'graph') return vt === 'float' ? 'float переводится в целые точки (используйте «Множитель», чтобы не потерять дробную часть).' : 'Значение добавляется точкой на график.'
    if (type === 'switcher') return 'true/1 — включён, false/0 — выключен.'
    return 'Тип подходит.'
  }
  if (type === 'slider' || type === 'number') return vt === 'float' ? 'Значение записывается как дробное число.' : 'Значение записывается как целое число.'
  if (type === 'switcher') return vt === 'bool' ? 'true — включён, false — выключен.' : 'Записывается 1 (включён) или 0 (выключен).'
  if (type === 'button') return vt === 'bool' ? 'true, пока кнопка нажата.' : 'Счётчик: +1 при каждом нажатии.'
  return 'Тип подходит.'
}

/** Какие типы переменных допустимы для выбранного намерения. */
export function typesForIntent(type: WidgetType, intent: Intent): VarType[] {
  const w = WIDGETS[type]
  if (intent === 'show') return w.varToUi
  if (intent === 'write') return w.varFromUi
  if (intent === 'both') return w.varToUi.filter((t) => w.varFromUi.includes(t))
  return []
}

/** Тип по умолчанию для новой переменной под элемент. */
export function defaultVarType(type: WidgetType, intent: Intent): VarType {
  const ok = typesForIntent(type, intent)
  const pref: Partial<Record<WidgetType, VarType>> = {
    label: 'float',
    graph: 'float',
    switcher: 'bool',
    button: 'bool',
    slider: 'int',
    number: 'float',
    text: 'String',
    password: 'String',
    time: 'String',
    select: 'int',
    pad: 'int',
    padCenter: 'int'
  }
  const p = pref[type]
  if (p && (ok.length === 0 || ok.includes(p))) return p
  return ok[0] ?? 'int'
}

/** Предлагаемое имя новой переменной по подписи/идентификатору элемента (латиница). */
export function suggestVarName(el: Pick<UiElement, 'id' | 'type' | 'label'>, taken: Set<string>): string {
  const idRest = el.id.replace(/^(lbl|btn|sw|sld|num|txt|sel|gr|sep|pad|padc|pwd|tm|fd|acc)(?=[A-Z0-9])/, '')
  const base = idRest ? idRest.charAt(0).toLowerCase() + idRest.slice(1) : 'value'
  const clean = /^[A-Za-z_]\w*$/.test(base) ? base : 'value'
  let n = clean
  let i = 2
  while (taken.has(n)) n = `${clean}${i++}`
  return n
}

export interface DescribeCtx {
  updateMs: number
  /** Подпись пина для текста («GPIO2» / «LED_PIN (GPIO2)»). */
  pinText?: (b: Extract<Binding, { kind: 'pin' }>) => string
}

/** Описание привязки одним-двумя предложениями. */
export function describeBinding(el: UiElement, ctx: DescribeCtx): string {
  const b = el.binding
  const w = WIDGET_RU[el.type].name
  switch (b.kind) {
    case 'none':
      return 'Элемент ни с чем не связан: он только показывает своё начальное значение.'
    case 'var': {
      if (!b.variable) return 'Переменная ещё не выбрана.'
      const v = `«${b.variable}»`
      const sec = (ctx.updateMs / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 2 })
      const toUi = `Скетч → страница: значение ${v} отправляется на страницу при изменении (проверка каждые ${sec} с).`
      const fromUi = `Страница → скетч: когда пользователь меняет «${el.label}», значение записывается в ${v}.`
      if (b.direction === 'toUi') return toUi
      if (b.direction === 'fromUi') return fromUi
      return `${fromUi} ${toUi}`
    }
    case 'pin': {
      const pin = ctx.pinText ? ctx.pinText(b) : `GPIO${b.pin}`
      if (b.direction === 'toPin')
        return b.mode === 'analog'
          ? `${w} задаёт ШИМ на пине ${pin} (яркость / мощность).`
          : `${w} включает и выключает пин ${pin}${b.invert ? ' (инверсия: «вкл» = LOW)' : ''}.`
      return b.mode === 'analog' ? `Показывается analogRead(${pin}).` : `Показывается состояние входа ${pin}.`
    }
    case 'callback':
      return b.fn
        ? `При действии пользователя вызывается ваша функция ${b.fn}(sender, type); её нужно написать в скетче.`
        : 'Функция пользователя ещё не выбрана.'
  }
}
