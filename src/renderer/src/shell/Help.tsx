// «Справка» (где что находится, горячие клавиши, ссылки) и необязательный первый тур по интерфейсу.
import { useEffect, useLayoutEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './icons'
import type { IconName } from './icons'
import { Button, Dialog } from './kit'
import { lsGet, lsSet, useUi } from './ui'
import { useProject } from './project'

const TOUR_KEY = 'avride.tour.seen.v1'

const PLACES: { icon: IconName; name: string; text: string }[] = [
  { icon: 'files', name: 'Файлы', text: 'Файлы вашего проекта: открыть, создать, переименовать.' },
  { icon: 'search', name: 'Поиск', text: 'Найти и заменить текст во всех файлах проекта.' },
  { icon: 'code', name: 'Примеры', text: 'Готовые скетчи — откройте как свой проект и меняйте.' },
  { icon: 'board', name: 'Платы', text: 'Поддержка плат (ядра): без неё скетч для платы не соберётся.' },
  { icon: 'library', name: 'Библиотеки', text: 'Готовый код для датчиков и модулей — из реестра Arduino или GitHub.' },
  { icon: 'book', name: 'Справочник', text: 'Функции Arduino, распиновка плат и пин для светодиода.' },
  { icon: 'layout', name: 'ESPUI', text: 'Соберите веб-пульт для ESP мышкой и вставьте в скетч одной кнопкой.' },
  { icon: 'web', name: 'Веб-сайт', text: 'Веб-дизайнер: свой HTML и CSS для ESP, в скетч — одной кнопкой.' }
]

const KEYS: [string, string][] = [
  ['Ctrl+B', 'Проверить скетч (компиляция без загрузки)'],
  ['Ctrl+U', 'Загрузить на плату'],
  ['Ctrl+S', 'Сохранить файл'],
  ['Ctrl+Shift+P', 'Палитра команд — любое действие по названию'],
  ['Ctrl+P', 'Перейти к файлу по имени'],
  ['F1', 'Справочник (на слове в коде — по нему)'],
  ['Ctrl+Space', 'Подсказки при наборе кода'],
  ['Ctrl+Shift+F', 'Поиск по проекту'],
  ['Ctrl+Shift+X / K', 'Платы / Библиотеки'],
  ['Ctrl+Shift+L', 'Монитор порта'],
  ['Ctrl+\\', 'Скрыть или показать боковую панель'],
  ['Ctrl+,', 'Настройки'],
  ['Esc', 'Закрыть окно, список или подсказку']
]

export function HelpDialog(): ReactNode {
  const open = useUi((s) => s.help)
  const setHelp = useUi((s) => s.setHelp)
  const setTour = useUi((s) => s.setTour)
  const hasProject = useProject((s) => !!s.root)
  if (!open) return null
  const close = (): void => setHelp(false)
  const link = (k: 'repo' | 'readme' | 'issues') => (): void => { void window.api.app.openHelpLink(k) }
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}>
      <Dialog className="wide help" testid="help-dialog" title="Справка" icon="info" ariaLabel="Справка" onClose={close}
        footerStart={<span className="dim small">Не нашли ответ? Напишите через «Сообщить о проблеме».</span>}
        footer={<Button variant="primary" onClick={close}>Понятно</Button>}>
        <h3 className="help-h">Как начать</h3>
        <ol className="help-steps">
          <li><b>Создайте проект</b>: выберите плату и назовите проект.</li>
          <li><b>Напишите скетч</b> или откройте готовый из «Примеров».</li>
          <li><b>Проверить</b> — найдёт ошибки; <b>Загрузить</b> — запишет программу на плату.</li>
          <li>Подсказка <b>«Дальше»</b> вверху всегда говорит, какой шаг следующий.</li>
        </ol>
        <h3 className="help-h">Где что находится</h3>
        <ul className="help-places">
          {PLACES.map((p) => <li key={p.name}><Icon name={p.icon} size={16} /><b>{p.name}</b><span>{p.text}</span></li>)}
        </ul>
        <h3 className="help-h" data-testid="help-link-page">Как связать веб-страницу со скетчем</h3>
        <ol className="help-steps">
          <li>В скетче объявите переменные (например, <code>float temperature;</code>) — конструктор покажет их списком, ничего не надо дублировать.</li>
          <li>Соберите страницу в «ESPUI» или «Веб-сайте» и нажмите <b>«Вставить в скетч»</b>: IDE запишет файл страницы, добавит <code>#include</code> и вызовы в <code>setup()</code> и <code>loop()</code> — перед этим покажет, что изменится.</li>
          <li>Дальше <b>код страницы обновляется сам</b>: поменяли страницу или переменную — просто нажмите «Проверить» (настройка «Обновлять код страницы автоматически» — в «Настройках»). Плашка в конструкторе показывает: подключено ли и актуален ли код.</li>
          <li>Нужной переменной нет в скетче? Кнопка <b>«Создать переменную в скетче»</b> добавит объявление в нужное место.</li>
          <li><b>«Проверить страницу»</b> собирает скетч вместе со страницей без платы и показывает ошибки в «Проблемах». Две страницы (ESPUI и веб-дизайнер) в одном скетче держать нельзя — оба поднимают веб-сервер на порту 80.</li>
        </ol>
        <h3 className="help-h">Горячие клавиши</h3>
        <table className="help-keys"><tbody>
          {KEYS.map(([k, t]) => <tr key={k}><td><kbd>{k}</kbd></td><td>{t}</td></tr>)}
        </tbody></table>
        <h3 className="help-h">Помощь и обратная связь</h3>
        <div className="row-actions">
          {hasProject && <Button onClick={() => { close(); setTour(0) }} data-testid="help-tour"><Icon name="info" size={14} /> Показать тур по интерфейсу</Button>}
          <Button onClick={link('readme')}>Описание проекта (README)</Button>
          <Button onClick={link('repo')}>Репозиторий на GitHub</Button>
          <Button onClick={link('issues')}>Сообщить о проблеме</Button>
        </div>
      </Dialog>
    </div>
  )
}

interface Step { target: string; fallback?: string; title: string; text: string }
const STEPS: Step[] = [
  { target: '[data-testid=activity]', title: 'Разделы слева', text: 'Здесь всё: файлы проекта, поиск, платы, библиотеки, справочник и два конструктора (ESPUI и веб-сайт).' },
  { target: '[data-testid=hdr-board]', title: 'Плата и порт', text: 'Выберите плату, для которой пишете, и порт, к которому она подключена. Если платы нет в списке — установите её поддержку в «Платах».' },
  { target: '[data-testid=hdr-verify]', title: 'Проверить и загрузить', text: '«Проверить» ищет ошибки и ничего не меняет на плате. «Загрузить» записывает скетч на плату.' },
  { target: '[data-testid=next-step]', fallback: '.sb-next', title: 'Подсказка «Дальше»', text: 'Всегда показывает следующий шаг: выбрать плату, проверить, подключить порт, открыть монитор. Нажмите — и он выполнится.' },
  { target: '[data-testid=act-ref]', title: 'Справочник и конструкторы', text: 'Справочник — функции и распиновка плат. ESPUI и «Веб-сайт» собирают веб-интерфейс для ESP без ручного HTML. Тур всегда можно повторить в «Справке».' }
]

export const tourSeen = (): boolean => lsGet(TOUR_KEY) === '1'

/** Первый тур: подсвечивает элементы интерфейса по шагам. В автотестах (AVRIDE_E2E=1) сам не запускается. */
export function Tour(): ReactNode {
  const tour = useUi((s) => s.tour)
  const setTour = useUi((s) => s.setTour)
  const hasProject = useProject((s) => !!s.root)
  const [rect, setRect] = useState<DOMRect | null>(null)

  // Автозапуск при первом открытии проекта
  useEffect(() => {
    if (!hasProject || window.api.app.isE2E || tourSeen()) return
    const t = setTimeout(() => { if (!tourSeen() && useUi.getState().tour === null) setTour(0) }, 900)
    return () => clearTimeout(t)
  }, [hasProject, setTour])

  const step = tour !== null ? STEPS[tour] : null
  const finish = (): void => { lsSet(TOUR_KEY, '1'); setTour(null) }

  useLayoutEffect(() => {
    if (!step) { setRect(null); return }
    const find = (): void => {
      const el = [step.target, step.fallback].filter(Boolean).map((s) => document.querySelector(s as string) as HTMLElement | null).find((e) => e && e.getBoundingClientRect().width > 0)
      setRect(el ? el.getBoundingClientRect() : null)
    }
    find()
    window.addEventListener('resize', find)
    return () => window.removeEventListener('resize', find)
  }, [step, tour])

  useEffect(() => {
    if (tour === null) return
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); finish() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); if (tour >= STEPS.length - 1) finish(); else setTour(tour + 1) }
      else if (e.key === 'ArrowLeft' && tour > 0) { e.preventDefault(); setTour(tour - 1) }
    }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [tour]) // eslint-disable-line react-hooks/exhaustive-deps

  if (tour === null || !step) return null
  const last = tour === STEPS.length - 1
  // Карточка справа от элемента (или под ним, если справа нет места); не выходит за окно
  const W = 320
  // Элементы шапки — карточка под ними; боковая панель — справа от неё; не выходит за окно и не закрывает подсвеченный элемент
  const below = !rect || rect.bottom < 100 || rect.right + 14 + W + 12 > window.innerWidth
  const left = rect ? (below ? Math.min(Math.max(12, rect.left), window.innerWidth - W - 12) : rect.right + 14) : window.innerWidth / 2 - W / 2
  const top = rect ? Math.min(Math.max(12, below ? rect.bottom + 12 : rect.top), window.innerHeight - 240) : window.innerHeight / 3
  return (
    <div className="tour" data-testid="tour" role="dialog" aria-label="Тур по интерфейсу">
      {rect && <div className="tour-ring" style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }} />}
      <div className="tour-card" style={{ left, top, width: W }}>
        <div className="tour-count">Шаг {tour + 1} из {STEPS.length}</div>
        <h3>{step.title}</h3>
        <p>{step.text}</p>
        <div className="tour-actions">
          <Button variant="ghost" size="sm" data-testid="tour-skip" onClick={finish}>Пропустить</Button>
          <span className="grow" />
          {tour > 0 && <Button size="sm" onClick={() => setTour(tour - 1)}>Назад</Button>}
          <Button variant="primary" size="sm" data-testid="tour-next" autoFocus onClick={() => (last ? finish() : setTour(tour + 1))}>{last ? 'Готово' : 'Далее'}</Button>
        </div>
      </div>
    </div>
  )
}
