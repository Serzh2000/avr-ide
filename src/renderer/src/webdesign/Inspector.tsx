import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { BLOCKS, ICON_NAMES, bindRule, checkPin, findBlock, findParent, isContainer, parseOptions, pinChoices, sanitizeCss, sanitizeHtml } from './core/index'
import type { Block, BlockProps, BlockStyle, BlockType, Issue, PinRole, ResponsiveOverride, WdProject } from './core/index'
import { Check, ColorField, Group, Mini, NumField, Pair, Row, Seg, Select, TextField, useAcc } from './fields'
import { useWebDesigner } from './store'
import type { RightTab } from './store'

const TABS: Array<{ id: RightTab; title: string; tip: string }> = [
  { id: 'content', title: 'Содержимое', tip: 'Тексты, значения, иконка, варианты' },
  { id: 'look', title: 'Вид', tip: 'Цвета, фон, шрифт, скругление, тень' },
  { id: 'layout', title: 'Макет', tip: 'Отступы, размеры, выравнивание, сетка, адаптивность' },
  { id: 'bind', title: 'Связь', tip: 'Привязка к переменным и пинам, события' },
  { id: 'fx', title: 'Эффекты', tip: 'Наведение (hover), анимации, плавность' }
]

const NO_CONTENT: BlockType[] = ['section', 'grid', 'flex', 'divider']

function tabsFor(b: Block): RightTab[] {
  const t: RightTab[] = []
  if (!NO_CONTENT.includes(b.type)) t.push('content')
  t.push('look', 'layout')
  if (bindRule(b.type) || b.type === 'wifisetup' || b.type === 'table' || b.type === 'list') t.push('bind')
  t.push('fx')
  return t
}

// ---------- поиск по свойствам ----------
interface Entry {
  label: string
  kw: string
  tab: RightTab
  group: string
  fid: string
}
const INDEX: Entry[] = [
  { label: 'Текст', kw: 'надпись содержимое text', tab: 'content', group: 'content.main', fid: 'text' },
  { label: 'Подпись', kw: 'заголовок label название', tab: 'content', group: 'content.main', fid: 'label' },
  { label: 'Иконка', kw: 'значок icon', tab: 'content', group: 'content.main', fid: 'icon' },
  { label: 'Варианты списка', kw: 'options выбор опции радио select', tab: 'content', group: 'content.main', fid: 'options' },
  { label: 'Строки таблицы / списка', kw: 'rows таблица список ячейки', tab: 'content', group: 'content.main', fid: 'rows' },
  { label: 'Адрес ссылки', kw: 'href url ссылка адрес переход', tab: 'content', group: 'content.main', fid: 'href' },
  { label: 'Единицы, знаки, диапазон', kw: 'min max мин макс диапазон единицы знаков шаг', tab: 'content', group: 'content.more', fid: 'range' },
  { label: 'Цвет фона', kw: 'фон bg background заливка', tab: 'look', group: 'look.colors', fid: 'bg' },
  { label: 'Градиент', kw: 'gradient заливка переход', tab: 'look', group: 'look.colors', fid: 'gradient' },
  { label: 'Цвет текста', kw: 'color текст шрифт цвет', tab: 'look', group: 'look.colors', fid: 'color' },
  { label: 'Пресеты вида', kw: 'стиль шаблон готовый пресет', tab: 'look', group: 'look.presets', fid: 'presets' },
  { label: 'Скругление', kw: 'radius углы круглые', tab: 'look', group: 'look.shape', fid: 'radius' },
  { label: 'Рамка', kw: 'border обводка граница', tab: 'look', group: 'look.shape', fid: 'border' },
  { label: 'Тень', kw: 'shadow объём', tab: 'look', group: 'look.shape', fid: 'shadow' },
  { label: 'Прозрачность', kw: 'opacity', tab: 'look', group: 'look.shape', fid: 'opacity' },
  { label: 'Шрифт', kw: 'font семейство гарнитура', tab: 'look', group: 'look.font', fid: 'font' },
  { label: 'Размер шрифта', kw: 'size кегль', tab: 'look', group: 'look.font', fid: 'size' },
  { label: 'Жирность', kw: 'weight bold', tab: 'look', group: 'look.font', fid: 'weight' },
  { label: 'Цвета для тёмной темы', kw: 'dark тёмная ночь', tab: 'look', group: 'look.dark', fid: 'dark' },
  { label: 'Отступы', kw: 'padding margin отступ внутри снаружи', tab: 'layout', group: 'layout.space', fid: 'padding' },
  { label: 'Промежуток (gap)', kw: 'gap расстояние между', tab: 'layout', group: 'layout.space', fid: 'gap' },
  { label: 'Ширина / высота', kw: 'width height размер ширина высота', tab: 'layout', group: 'layout.size', fid: 'widthPct' },
  { label: 'Выравнивание текста', kw: 'align по центру слева справа', tab: 'layout', group: 'layout.align', fid: 'align' },
  { label: 'Колонки сетки', kw: 'columns grid колонок', tab: 'layout', group: 'layout.type', fid: 'columns' },
  { label: 'Направление и выравнивание flex', kw: 'flex ряд колонка direction justify', tab: 'layout', group: 'layout.type', fid: 'direction' },
  { label: 'Страница сайта', kw: 'page страница multi-page', tab: 'layout', group: 'layout.page', fid: 'page' },
  { label: 'Адаптивность', kw: 'планшет телефон responsive мобильный скрыть', tab: 'layout', group: 'layout.resp', fid: 'resp' },
  { label: 'Привязка к переменной / пину', kw: 'binding переменная пин связь устройство', tab: 'bind', group: 'bind.main', fid: 'bind' },
  { label: 'Наведение (hover)', kw: 'hover курсор подъём', tab: 'fx', group: 'fx.hover', fid: 'hover' },
  { label: 'Анимация', kw: 'animation появление пульс', tab: 'fx', group: 'fx.anim', fid: 'anim' },
  { label: 'Плавность (transition)', kw: 'transition длительность', tab: 'fx', group: 'fx.anim', fid: 'transition' }
]

function ancestors(p: WdProject, b: Block): Block[] {
  const out: Block[] = []
  let cur = findParent(p, b.id)
  while (cur) {
    out.unshift(cur)
    cur = findParent(p, cur.id)
  }
  return out
}

export function Inspector({ issues }: { issues: Issue[] }): ReactNode {
  const project = useWebDesigner((s) => s.project)
  const selected = useWebDesigner((s) => s.selected)
  const right = useWebDesigner((s) => s.right)
  const { setRight, select, shift, duplicateBlock, removeBlock, nest, setHighlight } = useWebDesigner.getState()
  const [q, setQ] = useState('')
  const b = selected ? findBlock(project, selected) : null
  const tabs = b ? tabsFor(b) : []
  const tab: RightTab = tabs.includes(right) ? right : (tabs[0] ?? 'content')
  const results = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (!words.length) return []
    return INDEX.filter((e) => words.every((w) => `${e.label} ${e.kw}`.toLowerCase().includes(w))).slice(0, 7)
  }, [q])
  const go = (e: Entry): void => {
    setRight(e.tab)
    useAcc.getState().set(e.group, true)
    setHighlight(e.fid)
    setQ('')
  }
  if (!b)
    return (
      <div className="wd-inspector">
        <div className="wd-inspector-body">
          <div className="wd-empty">
            <div className="wd-empty-t">Ничего не выбрано</div>
            <ul>
              <li>Кликните блок в превью (режим «Выбор»)</li>
              <li>или выберите его в «Структуре» слева</li>
              <li>Двойной клик по тексту в превью — правка на месте</li>
              <li>Добавить блок — клик по палитре</li>
            </ul>
            <div className="wd-hint">Здесь появятся вкладки «Содержимое», «Вид», «Макет», «Связь» и «Эффекты».</div>
          </div>
        </div>
      </div>
    )
  const anc = ancestors(project, b)
  const mine = issues.filter((i) => i.blockId === b.id)
  return (
    <div className="wd-inspector">
      <div className="wd-ins-head">
        <div className="wd-crumbs" aria-label="Путь к блоку">
          <button className="wd-crumb" onClick={() => select(null)} title="Снять выделение">Страница</button>
          {anc.map((a) => (
            <span key={a.id}>
              <span className="wd-crumb-sep">›</span>
              <button className="wd-crumb" onClick={() => select(a.id)} title={`Выбрать родителя: ${a.id}`}>{BLOCKS[a.type]?.title ?? a.type}</button>
            </span>
          ))}
          <span className="wd-crumb-sep">›</span>
          <span className="wd-crumb cur">{BLOCKS[b.type]?.title ?? b.type}</span>
        </div>
        <div className="wd-ins-title">
          <IdField block={b} />
          <div className="wd-ins-acts">
            <button className="wd-mini" title="Выше (внутри родителя)" onClick={() => shift(b.id, -1)}>↑</button>
            <button className="wd-mini" title="Ниже (внутри родителя)" onClick={() => shift(b.id, 1)}>↓</button>
            <button className="wd-mini" title="В соседний контейнер выше" onClick={() => nest(b.id, 'into')}>⇥</button>
            <button className="wd-mini" title="Вынести на уровень выше" onClick={() => nest(b.id, 'out')}>⇤</button>
            <button className="wd-mini" title="Дублировать" onClick={() => duplicateBlock(b.id)}>⎘</button>
            <button className="wd-mini danger" title="Удалить блок" onClick={() => removeBlock(b.id)}>✕</button>
          </div>
        </div>
        <div className="wd-search-wrap">
          <input className="wd-input" placeholder="Поиск свойства: «цвет фона», «отступ»…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Поиск по свойствам" />
          {results.length > 0 && (
            <div className="wd-search-res" role="listbox">
              {results.map((e) => (
                <button key={e.fid} className="wd-search-item" role="option" onClick={() => go(e)}>
                  {e.label} <span className="wd-dim">· {TABS.find((t) => t.id === e.tab)?.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="wd-tabs wd-ins-tabs" role="tablist">
          {tabs.map((id) => (
            <div key={id} role="tab" aria-selected={tab === id} className={`wd-tab${tab === id ? ' active' : ''}`} title={TABS.find((t) => t.id === id)?.tip} onClick={() => setRight(id)}>
              {TABS.find((t) => t.id === id)?.title}
            </div>
          ))}
        </div>
      </div>
      <div className="wd-inspector-body">
        {mine.map((i, k) => (
          <div key={k} className={`wd-issue ${i.severity}`}>{i.message}</div>
        ))}
        {tab === 'content' && <ContentTab b={b} />}
        {tab === 'look' && <LookTab b={b} />}
        {tab === 'layout' && <LayoutTab b={b} />}
        {tab === 'bind' && <BindTab b={b} />}
        {tab === 'fx' && <FxTab b={b} />}
      </div>
    </div>
  )
}

function IdField({ block }: { block: Block }): ReactNode {
  const [draft, setDraft] = useState<string | null>(null)
  const rename = useWebDesigner.getState().renameBlock
  const commit = (): void => {
    if (draft !== null && draft !== block.id) rename(block.id, draft)
    setDraft(null)
  }
  return (
    <input
      className="wd-input mono wd-id"
      value={draft ?? block.id}
      spellCheck={false}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      title="Идентификатор блока: DOM-id и CSS-класс. Латиница, цифры, _ и -. Должен быть уникальным."
    />
  )
}

// ---------- Содержимое ----------
const ICON_OPTS = [{ value: '' as const, label: '— нет —' }, ...ICON_NAMES.map((n) => ({ value: n, label: n }))]

function ContentTab({ b }: { b: Block }): ReactNode {
  const patch = useWebDesigner.getState().patchProps
  const p = b.props
  const set = (x: Partial<BlockProps>): void => patch(b.id, x)
  const t = b.type
  const is = (...l: BlockType[]): boolean => l.includes(t)
  const labelled = is('card', 'switch', 'checkbox', 'slider', 'input', 'textarea', 'select', 'radio', 'color', 'sensor', 'indicator', 'gauge', 'progress', 'chart', 'log', 'table', 'pad', 'clock', 'modal', 'wifisetup', 'ota')
  return (
    <>
      <Group id="content.main" title="Основное">
        {is('heading', 'text', 'button', 'link', 'badge', 'footer', 'modal', 'wifisetup', 'ota') && (
          <Row title={is('modal') ? 'Кнопка' : is('wifisetup', 'ota') ? 'Кнопка' : 'Текст'} fid="text" hint="Видимый текст. Можно править двойным кликом прямо в превью.">
            <TextField multiline={is('text', 'footer')} value={p.text} onChange={(v) => set({ text: v })} />
          </Row>
        )}
        {labelled && (
          <Row title={is('card', 'modal', 'wifisetup', 'ota') ? 'Заголовок' : 'Подпись'} fid="label" hint="Подпись или заголовок блока (двойной клик в превью — правка на месте).">
            <TextField value={p.label} onChange={(v) => set({ label: v })} />
          </Row>
        )}
        {is('navbar') && (
          <>
            <Row title="Название" hint="Название сайта слева в панели навигации."><TextField value={p.brand} onChange={(v) => set({ brand: v })} /></Row>
            <Row title="Иконка" fid="icon"><Select value={p.icon} options={ICON_OPTS} onChange={(v) => set({ icon: v })} /></Row>
            <Row title="Прилипает"><Check value={p.sticky} onChange={(v) => set({ sticky: v })} label="всегда вверху при прокрутке" /></Row>
          </>
        )}
        {is('heading') && (
          <Row title="Уровень" hint="Уровень заголовка: 1 — самый крупный (h1)."><Seg value={String(p.level ?? 2) as '1'} options={['1', '2', '3', '4'].map((x) => ({ value: x as '1', label: 'H' + x }))} onChange={(v) => v && set({ level: Number(v) })} /></Row>
        )}
        {is('button') && (
          <>
            <Row title="Действие" hint="Удержание: true при нажатии и false при отпускании (для реле, моторов). Отправить: один раз отправить значение.">
              <Seg value={p.action ?? 'momentary'} options={[{ value: 'momentary', label: 'Удержание' }, { value: 'send', label: 'Отправить' }]} onChange={(v) => set({ action: v })} />
            </Row>
            {p.action === 'send' && <Row title="Значение" hint="Что отправить в привязанную переменную."><TextField mono value={p.value} onChange={(v) => set({ value: v })} /></Row>}
          </>
        )}
        {is('link') && (
          <>
            <Row title="Адрес" fid="href" hint="#якорь, относительный путь, http(s)://, mailto: или tel:. Для перехода между страницами сайта выберите страницу ниже.">
              <TextField mono value={p.href} onChange={(v) => set({ href: v })} placeholder="#" />
            </Row>
            <PageLinkRow b={b} />
            <Row title="Вид"><Seg value={p.variant ?? 'link'} options={[{ value: 'link', label: 'Ссылка' }, { value: 'button', label: 'Кнопка' }]} onChange={(v) => set({ variant: v })} /></Row>
            <Row title="Новая вкладка"><Check value={p.newTab} onChange={(v) => set({ newTab: v })} label="для внешних адресов" /></Row>
          </>
        )}
        {is('input') && (
          <>
            <Row title="Тип"><Seg value={p.inputType ?? 'text'} options={[{ value: 'text', label: 'Текст' }, { value: 'number', label: 'Число' }]} onChange={(v) => set({ inputType: v })} /></Row>
            <Row title="Подсказка"><TextField value={p.placeholder} onChange={(v) => set({ placeholder: v })} /></Row>
          </>
        )}
        {is('textarea') && (
          <>
            <Row title="Строк"><NumField value={p.lines} min={1} max={30} onChange={(v) => set({ lines: v })} /></Row>
            <Row title="Подсказка"><TextField value={p.placeholder} onChange={(v) => set({ placeholder: v })} /></Row>
          </>
        )}
        {is('select', 'radio') && (
          <Row title="Варианты" fid="options" hint="По строке: «значение|подпись». Подпись можно опустить. Значение уходит в привязанную переменную.">
            <TextField multiline mono rows={4} value={p.options} onChange={(v) => set({ options: v })} />
            <div className="wd-hint">{parseOptions(p.options).length} вариантов</div>
          </Row>
        )}
        {is('table', 'list') && (
          <Row title={is('table') ? 'Строки' : 'Пункты'} fid="rows" hint={is('table') ? 'Первая строка — заголовки. Ячейки через «|». В тексте можно {имя_переменной} — подставится значение с устройства.' : 'По пункту на строку. В тексте можно {имя_переменной}.'}>
            <TextField multiline mono rows={5} value={p.rows} onChange={(v) => set({ rows: v })} />
          </Row>
        )}
        {is('pad') && (
          <>
            <Row title="Режим" hint="Крестовина шлёт «up/down/left/right/center», джойстик — «x,y» от -100 до 100."><Seg value={p.padMode ?? 'dpad'} options={[{ value: 'dpad', label: 'Крестовина' }, { value: 'joystick', label: 'Джойстик' }]} onChange={(v) => set({ padMode: v })} /></Row>
            <Row title="При отпускании" hint="Значение, которое уходит на устройство при отпускании (по умолчанию stop или 0,0)."><TextField mono value={p.releaseValue} onChange={(v) => set({ releaseValue: v })} placeholder={p.padMode === 'joystick' ? '0,0' : 'stop'} /></Row>
          </>
        )}
        {is('clock') && (
          <>
            <Row title="Режим" hint="Время браузера или аптайм устройства (секунды из привязанной переменной)."><Seg value={p.clockMode ?? 'browser'} options={[{ value: 'browser', label: 'Браузер' }, { value: 'uptime', label: 'Аптайм' }]} onChange={(v) => set({ clockMode: v })} /></Row>
            <Row title="Формат"><Check value={p.showSeconds} onChange={(v) => set({ showSeconds: v })} label="секунды" /><Check value={p.clock12} onChange={(v) => set({ clock12: v })} label="12 часов" /><Check value={p.showDate} onChange={(v) => set({ showDate: v })} label="дата" /></Row>
          </>
        )}
        {is('log') && <Row title="Строк"><NumField value={p.lines} min={10} max={1000} onChange={(v) => set({ lines: v })} unit="шт" /></Row>}
        {is('ota') && <Row title="Путь" hint="Куда отправлять файл прошивки (POST, multipart, поле «firmware»). Обработчик нужно написать в прошивке самому.">
          <TextField mono value={p.path} onChange={(v) => set({ path: v })} /></Row>}
        {(is('icon') || is('sensor')) && <Row title="Иконка" fid="icon"><Select value={p.icon} options={ICON_OPTS} onChange={(v) => set({ icon: v })} /></Row>}
        {is('icon') && <Row title="Размер"><NumField value={p.iconSize} min={8} max={256} unit="px" onChange={(v) => set({ iconSize: v })} /></Row>}
        {is('indicator') && (
          <Pair>
            <Mini title="Текст «вкл»"><TextField value={p.onText} onChange={(v) => set({ onText: v })} /></Mini>
            <Mini title="Текст «выкл»"><TextField value={p.offText} onChange={(v) => set({ offText: v })} /></Mini>
          </Pair>
        )}
        {is('badge') && <Row title="Вид"><Seg value={p.soft ? 'soft' : 'solid'} options={[{ value: 'soft', label: 'Мягкий' }, { value: 'solid', label: 'Заливка' }]} onChange={(v) => set({ soft: v === 'soft' })} /></Row>}
        {is('chart') && (
          <>
            <Row title="Точек"><NumField value={p.points} min={5} max={600} onChange={(v) => set({ points: v })} /></Row>
            <Row title="Заливка"><Check value={p.fill} onChange={(v) => set({ fill: v })} label="под линией" /></Row>
          </>
        )}
        {is('image') && (
          <>
            <Row title="Источник" hint="data:image/...;base64,… или относительный путь. Внешние URL запрещены: устройство может быть без интернета.">
              <TextField multiline mono rows={2} value={p.src} onChange={(v) => set({ src: v })} placeholder="data:image/png;base64,…" />
            </Row>
            <Row title="Файл">
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  const r = new FileReader()
                  r.onload = () => set({ src: String(r.result) })
                  r.readAsDataURL(f)
                }}
              />
            </Row>
            <Row title="Alt" hint="Описание картинки для скринридеров."><TextField value={p.alt} onChange={(v) => set({ alt: v })} /></Row>
          </>
        )}
        {is('custom') && <CustomEditor b={b} />}
      </Group>
      {is('slider', 'gauge', 'progress', 'chart', 'sensor', 'indicator', 'heading', 'text', 'badge') && (
        <Group id="content.more" title="Дополнительно" def={false}>
          {is('slider', 'gauge', 'progress', 'chart', 'sensor') && (
            <Row title="Диапазон" fid="range" hint={is('sensor') ? 'Только для симуляции в превью.' : 'Минимум и максимум шкалы.'}>
              <Pair>
                <Mini title="мин"><NumField value={p.min} onChange={(v) => set({ min: v })} /></Mini>
                <Mini title="макс"><NumField value={p.max} onChange={(v) => set({ max: v })} /></Mini>
              </Pair>
            </Row>
          )}
          {is('slider') && <Row title="Шаг"><NumField value={p.step} min={0.001} step={0.1} onChange={(v) => set({ step: v })} /></Row>}
          {is('slider', 'gauge', 'progress', 'chart', 'sensor') && (
            <Pair>
              <Mini title="Единицы"><TextField value={p.unit} onChange={(v) => set({ unit: v })} /></Mini>
              <Mini title="Знаков"><NumField optional value={p.decimals} min={0} max={6} onChange={(v) => set({ decimals: v })} /></Mini>
            </Pair>
          )}
          {is('heading', 'text', 'badge', 'sensor', 'slider') && (
            <Pair>
              <Mini title="Префикс" hint="Добавляется перед значением от устройства."><TextField value={p.prefix} onChange={(v) => set({ prefix: v })} /></Mini>
              <Mini title="Суффикс"><TextField value={p.suffix} onChange={(v) => set({ suffix: v })} /></Mini>
            </Pair>
          )}
        </Group>
      )}
    </>
  )
}

function CustomEditor({ b }: { b: Block }): ReactNode {
  const set = (x: Partial<BlockProps>): void => useWebDesigner.getState().patchProps(b.id, x)
  const h = sanitizeHtml(b.props.html ?? '')
  const c = sanitizeCss(b.props.css ?? '', '.x')
  return (
    <>
      <div className="wd-warn">
        Свой HTML проходит жёсткий фильтр: <b>без script, iframe, обработчиков событий (onclick…), style=, url() и @import</b>. Разрешены безопасные теги
        (div, p, b, i, a, ul, table…) и простые правила CSS, ограниченные этим блоком.
        {h.removed + c.removed > 0 && <b> Сейчас отброшено: {h.removed + c.removed}.</b>}
      </div>
      <Row title="HTML"><TextField multiline mono rows={5} value={b.props.html} onChange={(v) => set({ html: v })} /></Row>
      <Row title="CSS" hint="Простые правила «селектор { свойство: значение }»; селекторы автоматически ограничиваются блоком."><TextField multiline mono rows={4} value={b.props.css} onChange={(v) => set({ css: v })} /></Row>
    </>
  )
}

function PageLinkRow({ b }: { b: Block }): ReactNode {
  const pages = useWebDesigner((s) => s.project.pages)
  const set = useWebDesigner.getState().patchProps
  return (
    <Row title="Страница" hint="Переход на другую страницу сайта без перезагрузки (если страниц больше одной). Перекрывает адрес.">
      <Select value={b.props.page} options={[{ value: '', label: '— обычная ссылка —' }, ...pages.map((x) => ({ value: x.id, label: x.title || x.id }))]} onChange={(v) => set(b.id, { page: v })} />
    </Row>
  )
}

// ---------- Вид ----------
interface Preset {
  id: string
  title: string
  style: Partial<BlockStyle>
  chip: (pal: Record<string, string>) => React.CSSProperties
}
const WHITE = '#ffffff'
const PRESETS: Preset[] = [
  { id: 'card', title: 'Карточка', style: { bg: 'surface', borderWidth: 1, borderColor: 'border', radius: 16, shadow: 'sm', padding: 20 }, chip: (p) => ({ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,.2)' }) },
  { id: 'accent', title: 'Акцент', style: { bg: 'primary', color: WHITE, radius: 14, shadow: 'md' }, chip: (p) => ({ background: p.primary, borderRadius: 8 }) },
  { id: 'soft', title: 'Мягкий', style: { bg: 'bg', borderWidth: 1, borderColor: 'border', radius: 14 }, chip: (p) => ({ background: p.bg, border: `1px solid ${p.border}`, borderRadius: 8 }) },
  { id: 'outline', title: 'Контур', style: { bg: 'transparent', borderWidth: 2, borderColor: 'primary', radius: 14 }, chip: (p) => ({ border: `2px solid ${p.primary}`, borderRadius: 8 }) },
  { id: 'gradient', title: 'Градиент', style: { gradient: { from: 'primary', to: 'accent', angle: 135 }, color: WHITE, radius: 16, shadow: 'md' }, chip: (p) => ({ background: `linear-gradient(135deg, ${p.primary}, ${p.accent})`, borderRadius: 8 }) },
  { id: 'dark', title: 'Тёмный', style: { bg: '#111827', color: '#f9fafb', radius: 14, shadow: 'md' }, chip: () => ({ background: '#111827', borderRadius: 8 }) },
  { id: 'success', title: 'Успех', style: { bg: 'success', color: WHITE, radius: 12 }, chip: (p) => ({ background: p.success, borderRadius: 8 }) },
  { id: 'danger', title: 'Опасность', style: { bg: 'danger', color: WHITE, radius: 12 }, chip: (p) => ({ background: p.danger, borderRadius: 8 }) }
]
const CLEAR_LOOK: Partial<BlockStyle> = {
  bg: undefined, gradient: undefined, color: undefined, borderWidth: undefined, borderColor: undefined, shadow: undefined, radius: undefined,
  darkBg: undefined, darkColor: undefined, darkGradient: undefined
}

function LookTab({ b }: { b: Block }): ReactNode {
  const patch = useWebDesigner.getState().patchStyle
  const theme = useWebDesigner((s) => s.project.page.theme)
  const s = b.style
  const set = (x: Partial<BlockStyle>): void => patch(b.id, x)
  const g = s.gradient
  const dg = s.darkGradient
  return (
    <>
      <Group id="look.presets" title="Быстрые пресеты" hint="Готовые сочетания фона, рамки и скругления. Применяются к выбранному блоку.">
        <div className="wd-presets" data-fid="presets">
          <button className="wd-preset" title="Сбросить цвета, рамку, тень и скругление" onClick={() => set(CLEAR_LOOK)}>
            <span className="wd-chip none">⌀</span>Без стиля
          </button>
          {PRESETS.map((pr) => (
            <button key={pr.id} className="wd-preset" title={`Применить пресет «${pr.title}»`} onClick={() => set({ ...CLEAR_LOOK, ...pr.style })}>
              <span className="wd-chip" style={pr.chip(theme.light)} />
              {pr.title}
            </button>
          ))}
        </div>
      </Group>
      <Group id="look.colors" title="Цвета">
        <Row title="Фон" fid="bg" hint="Цвет фона блока. Круги — цвета темы (меняются вместе с темой); «+» — свой цвет."><ColorField value={s.bg} onChange={(v) => set({ bg: v })} /></Row>
        <Row title="Текст" fid="color"><ColorField value={s.color} onChange={(v) => set({ color: v })} /></Row>
        <Row title="Градиент" fid="gradient" hint="Линейный градиент вместо однотонного фона.">
          <Check value={!!g} label="включить" onChange={(on) => set({ gradient: on ? { from: 'primary', to: 'accent', angle: 135 } : undefined })} />
        </Row>
        {g && (
          <>
            <Row title="От"><ColorField value={g.from} onChange={(v) => set({ gradient: { ...g, from: v ?? 'primary' } })} /></Row>
            <Row title="До"><ColorField value={g.to} onChange={(v) => set({ gradient: { ...g, to: v ?? 'accent' } })} /></Row>
            <Row title="Угол"><NumField value={g.angle} min={0} max={360} unit="°" onChange={(v) => set({ gradient: { ...g, angle: v ?? 0 } })} /></Row>
          </>
        )}
      </Group>
      <Group id="look.shape" title="Форма">
        <Pair>
          <Mini title="Скругление" fid="radius" hint="Радиус углов."><NumField optional value={s.radius} min={0} max={999} unit="px" onChange={(v) => set({ radius: v })} /></Mini>
          <Mini title="Рамка" fid="border" hint="Толщина рамки."><NumField optional value={s.borderWidth} min={0} max={20} unit="px" onChange={(v) => set({ borderWidth: v })} /></Mini>
        </Pair>
        {(s.borderWidth ?? 0) > 0 && <Row title="Цвет рамки"><ColorField value={s.borderColor} onChange={(v) => set({ borderColor: v })} /></Row>}
        <Row title="Тень" fid="shadow" hint="Размер тени под блоком."><Seg value={s.shadow} allowClear options={[{ value: 'none', label: 'Нет' }, { value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }]} onChange={(v) => set({ shadow: v })} /></Row>
        <Row title="Прозрачн." fid="opacity" hint="От 0 (невидимый) до 1."><NumField optional value={s.opacity} min={0} max={1} step={0.05} onChange={(v) => set({ opacity: v })} /></Row>
      </Group>
      <Group id="look.font" title="Шрифт" def={false}>
        <Row title="Семейство" fid="font" hint="Только системные шрифты: страница работает без интернета.">
          <Seg value={s.font} allowClear options={[{ value: 'sans', label: 'Sans' }, { value: 'serif', label: 'Serif' }, { value: 'mono', label: 'Mono' }, { value: 'rounded', label: 'Round' }]} onChange={(v) => set({ font: v })} />
        </Row>
        <Pair>
          <Mini title="Размер" fid="size"><NumField optional value={s.size} min={8} max={96} unit="px" onChange={(v) => set({ size: v })} /></Mini>
          <Mini title="Жирность" fid="weight" hint="400 — обычный, 700 — жирный."><NumField optional value={s.weight} min={100} max={900} step={100} onChange={(v) => set({ weight: v })} /></Mini>
        </Pair>
      </Group>
      <Group id="look.dark" title="Тёмная тема" def={false} hint="Цвета, которые заменяют обычные, когда включена тёмная тема страницы.">
        <div data-fid="dark">
          <Row title="Фон"><ColorField value={s.darkBg} onChange={(v) => set({ darkBg: v })} /></Row>
          <Row title="Текст"><ColorField value={s.darkColor} onChange={(v) => set({ darkColor: v })} /></Row>
          <Row title="Градиент"><Check value={!!dg} label="включить" onChange={(on) => set({ darkGradient: on ? { from: 'primary', to: 'accent', angle: 135 } : undefined })} /></Row>
        </div>
      </Group>
    </>
  )
}

// ---------- Макет ----------
const JUSTIFY = [{ value: 'start', label: '⇤', title: 'К началу' }, { value: 'center', label: '↔', title: 'По центру' }, { value: 'end', label: '⇥', title: 'К концу' }, { value: 'between', label: '⇹', title: 'Между' }] as const
const ALIGNI = [{ value: 'start', label: '⤒', title: 'Сверху' }, { value: 'center', label: '↕', title: 'По центру' }, { value: 'end', label: '⤓', title: 'Снизу' }, { value: 'stretch', label: '⇕', title: 'Растянуть' }] as const

function LayoutTab({ b }: { b: Block }): ReactNode {
  const { patchStyle, patchProps, patchResponsive, setBlockPage } = useWebDesigner.getState()
  const pages = useWebDesigner((s) => s.project.pages)
  const parent = useWebDesigner((s) => findParent(s.project, b.id))
  const s = b.style
  const p = b.props
  const set = (x: Partial<BlockStyle>): void => patchStyle(b.id, x)
  const ns = (key: keyof BlockStyle, v: number | undefined): void => set({ [key]: v } as Partial<BlockStyle>)
  const num = (title: string, key: keyof BlockStyle, min: number, max: number, unit: string, fid?: string, hint?: string): ReactNode => (
    <Mini title={title} fid={fid} hint={hint}>
      <NumField optional value={s[key] as number | undefined} min={min} max={max} unit={unit} onChange={(v) => ns(key, v)} />
    </Mini>
  )
  return (
    <>
      {b.type === 'grid' && (
        <Group id="layout.type" title="Сетка">
          <Row title="Колонок" fid="columns" hint="Число колонок на десктопе. На планшете — не больше 2, на телефоне — 1 (можно изменить в «Адаптив»).">
            <Seg value={String(p.columns ?? 3) as '3'} options={['1', '2', '3', '4', '5', '6'].map((x) => ({ value: x as '3', label: x }))} onChange={(v) => v && patchProps(b.id, { columns: Number(v) })} />
          </Row>
        </Group>
      )}
      {b.type === 'flex' && (
        <Group id="layout.type" title="Flex-ряд">
          <Row title="Направление" fid="direction"><Seg value={p.direction ?? 'row'} options={[{ value: 'row', label: '→ Ряд' }, { value: 'column', label: '↓ Колонка' }]} onChange={(v) => patchProps(b.id, { direction: v })} /></Row>
          <Row title="По оси" hint="Выравнивание вдоль главной оси."><Seg value={p.justify} allowClear options={[...JUSTIFY]} onChange={(v) => patchProps(b.id, { justify: v })} /></Row>
          <Row title="Поперёк" hint="Выравнивание поперёк главной оси."><Seg value={p.alignItems} allowClear options={[...ALIGNI]} onChange={(v) => patchProps(b.id, { alignItems: v })} /></Row>
          <Row title="Перенос"><Check value={p.wrap} onChange={(v) => patchProps(b.id, { wrap: v })} label="переносить на новую строку" /></Row>
        </Group>
      )}
      <Group id="layout.space" title="Отступы">
        <Pair>
          {num('Внутри', 'padding', 0, 200, 'px', 'padding', 'Отступ между рамкой блока и его содержимым.')}
          {num('Снаружи', 'margin', 0, 200, 'px', 'margin', 'Отступ вокруг блока.')}
        </Pair>
        {isContainer(b.type) && <Pair>{num('Промежуток', 'gap', 0, 200, 'px', 'gap', 'Расстояние между вложенными блоками.')}</Pair>}
      </Group>
      <Group id="layout.align" title="Выравнивание текста">
        <Row title="Текст" fid="align"><Seg value={s.align} allowClear options={[{ value: 'left', label: '⇤ Слева' }, { value: 'center', label: '↔ Центр' }, { value: 'right', label: 'Справа ⇥' }]} onChange={(v) => set({ align: v })} /></Row>
      </Group>
      <Group id="layout.size" title="Размер" def={false}>
        <Pair>
          {num('Ширина', 'widthPct', 5, 100, '%', 'widthPct', 'Ширина в процентах от родителя.')}
          {num('Макс. ширина', 'maxWidth', 20, 4000, 'px')}
        </Pair>
        <Pair>
          {num('Мин. высота', 'minHeight', 0, 2000, 'px')}
          {parent?.type === 'grid' && num('Занимает колонок', 'span', 1, 12, 'шт', 'span', 'Сколько колонок сетки занимает блок.')}
        </Pair>
      </Group>
      {!parent && (
        <Group id="layout.page" title="Страница сайта" def={pages.length > 1} hint="К какой странице относится верхнеуровневый блок.">
          <Row title="Показывать" fid="page">
            <select className="wd-input" value={b.page ?? ''} onChange={(e) => setBlockPage(b.id, e.target.value || undefined)}>
              <option value="">Первая страница</option>
              <option value="*">На всех страницах</option>
              {pages.map((x) => (
                <option key={x.id} value={x.id}>{x.title || x.id}</option>
              ))}
            </select>
          </Row>
          {pages.length < 2 && <div className="wd-hint">Страницы добавляются во вкладке «Страница и WiFi».</div>}
        </Group>
      )}
      <Group id="layout.resp" title="Адаптивность" def={false} hint="Переопределения для планшета и телефона (брейкпоинты задаются во вкладке «Страница и WiFi»).">
        <div data-fid="resp">
          {(['tablet', 'mobile'] as const).map((bp) => {
            const r: ResponsiveOverride = b.responsive?.[bp] ?? {}
            const setR = (x: Partial<ResponsiveOverride>): void => patchResponsive(b.id, bp, x)
            return (
              <div key={bp} className="wd-resp">
                <div className="wd-sub">{bp === 'tablet' ? '▭ Планшет' : '▯ Телефон'}</div>
                <Pair>
                  <Mini title="Скрыть"><Check value={r.hidden} onChange={(v) => setR({ hidden: v || undefined })} label="скрыть" /></Mini>
                  {b.type === 'grid' && <Mini title="Колонок"><NumField optional value={r.columns} min={1} max={12} onChange={(v) => setR({ columns: v })} /></Mini>}
                  {b.type === 'flex' && <Mini title="Направление"><Seg value={r.direction} allowClear options={[{ value: 'row', label: '→' }, { value: 'column', label: '↓' }]} onChange={(v) => setR({ direction: v })} /></Mini>}
                </Pair>
                <Pair>
                  <Mini title="Отступ"><NumField optional value={r.padding} min={0} max={200} unit="px" onChange={(v) => setR({ padding: v })} /></Mini>
                  <Mini title="Размер текста"><NumField optional value={r.size} min={8} max={96} unit="px" onChange={(v) => setR({ size: v })} /></Mini>
                </Pair>
              </div>
            )
          })}
        </div>
      </Group>
    </>
  )
}

// ---------- Эффекты ----------
const ANIMS = [
  { value: 'fade', label: 'Появление' }, { value: 'slide-up', label: 'Снизу' }, { value: 'zoom', label: 'Масштаб' },
  { value: 'pulse', label: 'Пульс' }, { value: 'float', label: 'Парение' }, { value: 'glow', label: 'Свечение' }
] as const

function FxTab({ b }: { b: Block }): ReactNode {
  const patch = useWebDesigner.getState().patchStyle
  const s = b.style
  const hover = s.hover ?? {}
  const set = (x: Partial<BlockStyle>): void => patch(b.id, x)
  const setHover = (x: Partial<NonNullable<BlockStyle['hover']>>): void => {
    const h = { ...hover, ...x }
    for (const k of Object.keys(h) as Array<keyof typeof h>) if (h[k] === undefined || h[k] === false) delete h[k]
    set({ hover: Object.keys(h).length ? h : undefined })
  }
  return (
    <>
      <Group id="fx.hover" title="При наведении">
        <div data-fid="hover">
          <Row title="Фон"><ColorField value={hover.bg} onChange={(v) => setHover({ bg: v })} /></Row>
          <Row title="Текст"><ColorField value={hover.color} onChange={(v) => setHover({ color: v })} /></Row>
          <Row title="Подъём" hint="Блок слегка приподнимается при наведении курсора."><Check value={hover.lift} onChange={(v) => setHover({ lift: v })} label="приподнять" /></Row>
          <Pair>
            <Mini title="Масштаб" hint="1 — без изменения; 1.05 — чуть крупнее."><NumField optional value={hover.scale} min={0.5} max={2} step={0.01} onChange={(v) => setHover({ scale: v })} /></Mini>
            <Mini title="Тень"><Select value={hover.shadow} options={[{ value: '', label: '—' }, { value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }]} onChange={(v) => setHover({ shadow: v })} /></Mini>
          </Pair>
        </div>
      </Group>
      <Group id="fx.anim" title="Анимация">
        <Row title="Вид" fid="anim" hint="Появление — один раз при загрузке; пульс, парение и свечение повторяются постоянно."><Seg value={s.anim === 'none' ? undefined : s.anim} allowClear options={[...ANIMS]} onChange={(v) => set({ anim: v })} /></Row>
        <Pair>
          <Mini title="Длительность"><NumField optional value={s.animMs} min={50} max={20000} step={50} unit="мс" onChange={(v) => set({ animMs: v })} /></Mini>
          <Mini title="Задержка"><NumField optional value={s.animDelay} min={0} max={20000} step={50} unit="мс" onChange={(v) => set({ animDelay: v })} /></Mini>
        </Pair>
        <Pair>
          <Mini title="Плавность" fid="transition" hint="Длительность плавных переходов при наведении."><NumField optional value={s.transitionMs} min={0} max={5000} step={50} unit="мс" onChange={(v) => set({ transitionMs: v })} /></Mini>
        </Pair>
      </Group>
    </>
  )
}

// ---------- Связь ----------
function BindTab({ b }: { b: Block }): ReactNode {
  const project = useWebDesigner((s) => s.project)
  const { setBinding, patchProps } = useWebDesigner.getState()
  const rule = bindRule(b.type)
  const bd = b.binding
  const set = (x: Partial<BlockProps>): void => patchProps(b.id, x)
  if (b.type === 'wifisetup') {
    const strs = project.variables.filter((v) => v.type === 'String')
    const bools = project.variables.filter((v) => v.type === 'bool')
    const pick = (prop: 'varSsid' | 'varPass' | 'varSave', list: typeof strs, title: string, hint: string): ReactNode => (
      <Row title={title} hint={hint}>
        <Select value={b.props[prop]} options={[{ value: '', label: '— выберите —' }, ...list.map((v) => ({ value: v.name, label: v.name }))]} onChange={(v) => set({ [prop]: v } as Partial<BlockProps>)} />
      </Row>
    )
    return (
      <Group id="bind.main" title="Переменные формы">
        {pick('varSsid', strs, 'SSID', 'String-переменная для имени сети.')}
        {pick('varPass', strs, 'Пароль', 'String-переменная для пароля.')}
        {pick('varSave', bools, 'Флаг', 'bool-переменная: форма ставит true после отправки SSID и пароля. Сохранение в память — в вашем коде.')}
        <div className="wd-hint">Форма отправляет три значения по WebSocket; применить настройки WiFi нужно в вашем скетче (сохранение в память генератор не делает).</div>
      </Group>
    )
  }
  if (b.type === 'table' || b.type === 'list')
    return <div className="wd-hint">Таблица и список берут значения из переменных, указанных в тексте как <code>{'{имя}'}</code>. Объявите переменные внизу, во вкладке «Переменные».</div>
  if (!rule) return <div className="wd-hint">Этот тип блока не поддерживает привязки.</div>
  const compat = project.variables.filter((v) => rule.vars.includes(v.type))
  const dirLabel = { toUi: 'Устройство → страница', fromUi: 'Страница → устройство', both: 'В обе стороны' }
  const pinRole = (dir: 'toPin' | 'fromPin', mode: 'digital' | 'analog'): PinRole =>
    dir === 'toPin' ? (mode === 'analog' ? 'out-pwm' : 'out-digital') : mode === 'analog' ? 'in-analog' : 'in-digital'
  const pinRule = rule.pins
  return (
    <>
    <Group id="bind.main" title="Привязка к устройству">
      <div data-fid="bind">
        <Row title="Тип"><Seg value={bd.kind} options={[{ value: 'none', label: 'Нет' }, { value: 'var', label: 'Переменная' }, ...(pinRule.length ? [{ value: 'pin' as const, label: 'Пин' }] : [])]}
          onChange={(k) => {
            if (k === 'none') setBinding(b.id, { kind: 'none' })
            else if (k === 'var') setBinding(b.id, { kind: 'var', variable: compat[0]?.name ?? '', direction: rule.dirs[0] })
            else if (k === 'pin' && pinRule.length) {
              const pr = pinRule[0]
              const first = pinChoices(project.platform, pinRole(pr.direction, pr.modes[0]))[0]
              setBinding(b.id, { kind: 'pin', pin: first?.pin ?? 0, direction: pr.direction, mode: pr.modes[0] })
            }
          }} /></Row>
        {bd.kind === 'var' && (
          <>
            <Row title="Переменная" hint="Переменная из вкладки «Переменные». Показаны только подходящие по типу.">
              <select className="wd-input" value={bd.variable} onChange={(e) => setBinding(b.id, { ...bd, variable: e.target.value })}>
                {!compat.some((v) => v.name === bd.variable) && <option value={bd.variable}>{bd.variable || '— выберите —'}</option>}
                {compat.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.type})</option>)}
              </select>
            </Row>
            {compat.length === 0 && <div className="wd-hint">Нет подходящих переменных ({rule.vars.join('/')}). Объявите их во вкладке «Переменные».</div>}
            <Row title="Направление" hint="Откуда куда идут данные.">
              <Seg value={bd.direction} options={rule.dirs.map((d) => ({ value: d, label: d === 'toUi' ? '→ на страницу' : d === 'fromUi' ? '← с страницы' : '⇄ оба', title: dirLabel[d] }))} onChange={(d) => d && setBinding(b.id, { ...bd, direction: d })} />
            </Row>
          </>
        )}
        {bd.kind === 'pin' && (
          <>
            <Row title="Направление"><Seg value={bd.direction} options={pinRule.map((x) => ({ value: x.direction, label: x.direction === 'toPin' ? '→ на пин' : '← с пина' }))}
              onChange={(dir) => { const pr = pinRule.find((x) => x.direction === dir); if (dir && pr) setBinding(b.id, { ...bd, direction: dir, mode: pr.modes.includes(bd.mode) ? bd.mode : pr.modes[0] }) }} /></Row>
            <Row title="Режим"><Seg value={bd.mode} options={(pinRule.find((x) => x.direction === bd.direction)?.modes ?? []).map((m) => ({ value: m, label: m === 'digital' ? 'Цифровой' : bd.direction === 'toPin' ? 'PWM' : 'Аналог' }))} onChange={(m) => m && setBinding(b.id, { ...bd, mode: m })} /></Row>
            <Row title="Пин">
              <select className="wd-input" value={bd.pin} onChange={(e) => setBinding(b.id, { ...bd, pin: Number(e.target.value) })}>
                {pinChoices(project.platform, pinRole(bd.direction, bd.mode)).map((c) => <option key={c.pin} value={c.pin}>{c.label}</option>)}
              </select>
            </Row>
            {bd.mode === 'digital' && <Row title="Инверсия" hint="Для реле с активным низким уровнем."><Check value={bd.invert} onChange={(v) => setBinding(b.id, { ...bd, invert: v || undefined })} label="активный низкий уровень" /></Row>}
            {bd.mode === 'digital' && bd.direction === 'fromPin' && <Row title="Подтяжка"><Check value={bd.pull === 'up'} onChange={(v) => setBinding(b.id, { ...bd, pull: v ? 'up' : undefined })} label="INPUT_PULLUP" /></Row>}
            {checkPin(project.platform, bd.pin, pinRole(bd.direction, bd.mode)).map((pp, k) => <div key={k} className={`wd-issue ${pp.severity}`}>{pp.message}</div>)}
          </>
        )}
      </div>
    </Group>
      <Group id="bind.help" title="События" def={false}>
        <div className="wd-hint">
          {b.type === 'button' && 'Кнопка: «Удержание» шлёт true при нажатии и false при отпускании; «Отправить» — одно значение по клику.'}
          {b.type === 'pad' && 'Крестовина шлёт строку направления при нажатии и значение «при отпускании» при отпускании; джойстик — «x,y».'}
          {b.type === 'log' && 'Каждое изменение String-переменной (или вызов wdLog("имя", строка) в прошивке) добавляет строку в журнал.'}
          {!['button', 'pad', 'log'].includes(b.type) && 'Изменения значения отправляются в формате {"t":"set","k":"имя","v":значение}.'}
        </div>
      </Group>
    </>
  )
}
