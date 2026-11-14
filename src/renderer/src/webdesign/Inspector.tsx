import { useState } from 'react'
import type { ReactNode } from 'react'
import { BLOCKS, ICON_NAMES, bindRule, checkPin, pinChoices } from './core/index'
import type { Block, BlockProps, BlockStyle, Issue, PinRole, ResponsiveOverride } from './core/index'
import { Check, ColorField, NumField, Row, Section, Select, TextField } from './fields'
import { useWebDesigner } from './store'
import type { RightTab } from './store'

const TABS: Array<{ id: RightTab; title: string }> = [
  { id: 'props', title: 'Свойства' },
  { id: 'style', title: 'Стили' },
  { id: 'bind', title: 'Привязка' }
]

export function Inspector({ issues }: { issues: Issue[] }): ReactNode {
  const project = useWebDesigner((s) => s.project)
  const selected = useWebDesigner((s) => s.selected)
  const right = useWebDesigner((s) => s.right)
  const setRight = useWebDesigner((s) => s.setRight)
  let block: Block | null = null
  const find = (list: Block[]): void => {
    for (const b of list) {
      if (b.id === selected) block = b
      find(b.children)
    }
  }
  find(project.blocks)
  const b = block as Block | null
  return (
    <div className="wd-inspector">
      <div className="wd-tabs">
        {TABS.map((t) => (
          <div key={t.id} className={`wd-tab${right === t.id ? ' active' : ''}`} onClick={() => setRight(t.id)}>
            {t.title}
          </div>
        ))}
      </div>
      <div className="wd-inspector-body">
        {!b ? (
          <div className="wd-hint">Выберите блок в превью (режим «Выбор блоков») или в структуре слева.</div>
        ) : (
          <>
            <div className="wd-sel-title">
              {BLOCKS[b.type]?.title ?? b.type}
              <IdField block={b} />
            </div>
            {issues.filter((i) => i.blockId === b.id).map((i, k) => (
              <div key={k} className={`wd-issue ${i.severity}`}>{i.message}</div>
            ))}
            {right === 'props' && <PropsTab b={b} />}
            {right === 'style' && <StyleTab b={b} />}
            {right === 'bind' && <BindTab b={b} />}
          </>
        )}
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
      title="id блока: DOM-id и CSS-класс. Латиница, цифры, _ и -"
    />
  )
}

function PropsTab({ b }: { b: Block }): ReactNode {
  const patch = useWebDesigner.getState().patchProps
  const p = b.props
  const set = (x: Partial<BlockProps>): void => patch(b.id, x)
  const t = b.type
  return (
    <Section title="Содержимое">
      {(t === 'heading' || t === 'text' || t === 'button') && (
        <Row title="Текст"><TextField multiline={t !== 'button'} value={p.text} onChange={(v) => set({ text: v })} /></Row>
      )}
      {['card', 'switch', 'slider', 'input', 'color', 'sensor', 'indicator', 'gauge', 'progress', 'chart'].includes(t) && (
        <Row title={t === 'card' ? 'Заголовок' : 'Подпись'}><TextField value={p.label} onChange={(v) => set({ label: v })} /></Row>
      )}
      {t === 'heading' && (
        <Row title="Уровень"><NumField value={p.level} min={1} max={4} onChange={(v) => set({ level: v })} /></Row>
      )}
      {t === 'grid' && <Row title="Колонок"><NumField value={p.columns} min={1} max={12} onChange={(v) => set({ columns: v })} /></Row>}
      {t === 'flex' && (
        <>
          <Row title="Направление">
            <Select value={p.direction} options={[{ value: 'row', label: 'Ряд' }, { value: 'column', label: 'Колонка' }]} onChange={(v) => set({ direction: v })} />
          </Row>
          <Row title="Перенос"><Check value={p.wrap} onChange={(v) => set({ wrap: v })} label="переносить строки" /></Row>
          <Row title="По главной оси">
            <Select value={p.justify} options={[{ value: 'start', label: 'Начало' }, { value: 'center', label: 'Центр' }, { value: 'end', label: 'Конец' }, { value: 'between', label: 'Между' }]} onChange={(v) => set({ justify: v })} />
          </Row>
          <Row title="По поперечной">
            <Select value={p.alignItems} options={[{ value: 'start', label: 'Начало' }, { value: 'center', label: 'Центр' }, { value: 'end', label: 'Конец' }, { value: 'stretch', label: 'Растянуть' }]} onChange={(v) => set({ alignItems: v })} />
          </Row>
        </>
      )}
      {t === 'button' && (
        <>
          <Row title="Действие" hint="momentary: true при нажатии, false при отпускании. send: один раз отправить значение.">
            <Select value={p.action} options={[{ value: 'momentary', label: 'Удержание (true/false)' }, { value: 'send', label: 'Отправить значение' }]} onChange={(v) => set({ action: v })} />
          </Row>
          {p.action === 'send' && <Row title="Значение"><TextField mono value={p.value} onChange={(v) => set({ value: v })} /></Row>}
        </>
      )}
      {t === 'input' && (
        <>
          <Row title="Тип"><Select value={p.inputType} options={[{ value: 'text', label: 'Текст' }, { value: 'number', label: 'Число' }]} onChange={(v) => set({ inputType: v })} /></Row>
          <Row title="Подсказка"><TextField value={p.placeholder} onChange={(v) => set({ placeholder: v })} /></Row>
        </>
      )}
      {['slider', 'gauge', 'progress', 'chart', 'sensor'].includes(t) && (
        <>
          <Row title={t === 'sensor' ? 'Мин (превью)' : 'Мин'}><NumField value={p.min} onChange={(v) => set({ min: v })} /></Row>
          <Row title={t === 'sensor' ? 'Макс (превью)' : 'Макс'}><NumField value={p.max} onChange={(v) => set({ max: v })} /></Row>
        </>
      )}
      {t === 'slider' && <Row title="Шаг"><NumField value={p.step} min={0.001} step={0.1} onChange={(v) => set({ step: v })} /></Row>}
      {['slider', 'gauge', 'progress', 'chart', 'sensor'].includes(t) && (
        <>
          <Row title="Единицы"><TextField value={p.unit} onChange={(v) => set({ unit: v })} /></Row>
          <Row title="Знаков"><NumField optional value={p.decimals} min={0} max={6} onChange={(v) => set({ decimals: v })} /></Row>
        </>
      )}
      {['heading', 'text', 'sensor', 'slider'].includes(t) && (
        <>
          <Row title="Префикс"><TextField value={p.prefix} onChange={(v) => set({ prefix: v })} /></Row>
          <Row title="Суффикс"><TextField value={p.suffix} onChange={(v) => set({ suffix: v })} /></Row>
        </>
      )}
      {t === 'indicator' && (
        <>
          <Row title="Текст «вкл»"><TextField value={p.onText} onChange={(v) => set({ onText: v })} /></Row>
          <Row title="Текст «выкл»"><TextField value={p.offText} onChange={(v) => set({ offText: v })} /></Row>
        </>
      )}
      {t === 'chart' && (
        <>
          <Row title="Точек"><NumField value={p.points} min={5} max={600} onChange={(v) => set({ points: v })} /></Row>
          <Row title="Заливка"><Check value={p.fill} onChange={(v) => set({ fill: v })} label="под линией" /></Row>
        </>
      )}
      {(t === 'icon' || t === 'sensor') && (
        <Row title="Иконка">
          <Select value={p.icon} options={[{ value: '', label: '— нет —' }, ...ICON_NAMES.map((n) => ({ value: n, label: n }))]} onChange={(v) => set({ icon: v })} />
        </Row>
      )}
      {t === 'icon' && <Row title="Размер, px"><NumField value={p.iconSize} min={8} max={256} onChange={(v) => set({ iconSize: v })} /></Row>}
      {t === 'image' && (
        <>
          <Row title="Источник" hint="data:image/...;base64,… или относительный путь. Внешние URL запрещены (устройство может быть без интернета).">
            <TextField multiline mono value={p.src} onChange={(v) => set({ src: v })} placeholder="data:image/png;base64,…" />
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
          <Row title="Alt"><TextField value={p.alt} onChange={(v) => set({ alt: v })} /></Row>
        </>
      )}
    </Section>
  )
}

const SHADOWS = [{ value: 'none', label: 'Нет' }, { value: 'sm', label: 'Малая' }, { value: 'md', label: 'Средняя' }, { value: 'lg', label: 'Большая' }] as const
const ANIMS = [
  { value: 'none', label: 'Нет' }, { value: 'fade', label: 'Появление' }, { value: 'slide-up', label: 'Выезд снизу' },
  { value: 'zoom', label: 'Масштаб' }, { value: 'pulse', label: 'Пульс' }, { value: 'float', label: 'Парение' }, { value: 'glow', label: 'Свечение' }
] as const

function StyleTab({ b }: { b: Block }): ReactNode {
  const { patchStyle, patchResponsive } = useWebDesigner.getState()
  const s = b.style
  const set = (x: Partial<BlockStyle>): void => patchStyle(b.id, x)
  const num = (title: string, key: keyof BlockStyle, min = 0, max = 999, step = 1): ReactNode => (
    <Row title={title}>
      <NumField optional min={min} max={max} step={step} value={s[key] as number | undefined} onChange={(v) => set({ [key]: v } as Partial<BlockStyle>)} />
    </Row>
  )
  const g = s.gradient
  const dg = s.darkGradient
  const hover = s.hover ?? {}
  const setHover = (x: Partial<NonNullable<BlockStyle['hover']>>): void => {
    const h = { ...hover, ...x }
    for (const k of Object.keys(h) as Array<keyof typeof h>) if (h[k] === undefined || h[k] === false) delete h[k]
    set({ hover: Object.keys(h).length ? h : undefined })
  }
  return (
    <>
      <Section title="Цвета">
        <Row title="Фон"><ColorField value={s.bg} onChange={(v) => set({ bg: v })} /></Row>
        <Row title="Градиент">
          <Check value={!!g} label="включить" onChange={(on) => set({ gradient: on ? { from: 'primary', to: 'accent', angle: 135 } : undefined })} />
        </Row>
        {g && (
          <>
            <Row title="От"><ColorField value={g.from} onChange={(v) => set({ gradient: { ...g, from: v ?? 'primary' } })} /></Row>
            <Row title="До"><ColorField value={g.to} onChange={(v) => set({ gradient: { ...g, to: v ?? 'accent' } })} /></Row>
            <Row title="Угол, °"><NumField value={g.angle} min={0} max={360} onChange={(v) => set({ gradient: { ...g, angle: v ?? 0 } })} /></Row>
          </>
        )}
        <Row title="Текст"><ColorField value={s.color} onChange={(v) => set({ color: v })} /></Row>
        <Row title="Фон (тёмная)"><ColorField value={s.darkBg} onChange={(v) => set({ darkBg: v })} /></Row>
        <Row title="Градиент (тёмная)">
          <Check value={!!dg} label="включить" onChange={(on) => set({ darkGradient: on ? { from: 'primary', to: 'accent', angle: 135 } : undefined })} />
        </Row>
        {dg && (
          <>
            <Row title="От"><ColorField value={dg.from} onChange={(v) => set({ darkGradient: { ...dg, from: v ?? 'primary' } })} /></Row>
            <Row title="До"><ColorField value={dg.to} onChange={(v) => set({ darkGradient: { ...dg, to: v ?? 'accent' } })} /></Row>
          </>
        )}
        <Row title="Текст (тёмная)"><ColorField value={s.darkColor} onChange={(v) => set({ darkColor: v })} /></Row>
      </Section>
      <Section title="Размеры и форма">
        {num('Отступ внутри, px', 'padding', 0, 200)}
        {num('Внешний отступ, px', 'margin', 0, 200)}
        {num('Промежуток, px', 'gap', 0, 200)}
        {num('Скругление, px', 'radius', 0, 999)}
        {num('Рамка, px', 'borderWidth', 0, 20)}
        {(s.borderWidth ?? 0) > 0 && <Row title="Цвет рамки"><ColorField value={s.borderColor} onChange={(v) => set({ borderColor: v })} /></Row>}
        <Row title="Тень"><Select value={s.shadow} options={[{ value: '', label: '— по умолчанию —' }, ...SHADOWS]} onChange={(v) => set({ shadow: v })} /></Row>
        {num('Ширина, %', 'widthPct', 5, 100)}
        {num('Макс. ширина, px', 'maxWidth', 20, 4000)}
        {num('Мин. высота, px', 'minHeight', 0, 2000)}
        {num('Колонок в сетке', 'span', 1, 12)}
        {num('Прозрачность', 'opacity', 0, 1, 0.05)}
      </Section>
      <Section title="Шрифт">
        <Row title="Семейство">
          <Select value={s.font} options={[{ value: '', label: '— тема —' }, { value: 'sans', label: 'Sans' }, { value: 'serif', label: 'Serif' }, { value: 'mono', label: 'Mono' }, { value: 'rounded', label: 'Rounded' }]} onChange={(v) => set({ font: v })} />
        </Row>
        {num('Размер, px', 'size', 8, 96)}
        {num('Жирность', 'weight', 100, 900, 100)}
        <Row title="Выравнивание">
          <Select value={s.align} options={[{ value: '', label: '—' }, { value: 'left', label: 'Слева' }, { value: 'center', label: 'По центру' }, { value: 'right', label: 'Справа' }]} onChange={(v) => set({ align: v })} />
        </Row>
      </Section>
      <Section title="Анимация и hover">
        <Row title="Анимация"><Select value={s.anim} options={[{ value: '', label: '—' }, ...ANIMS]} onChange={(v) => set({ anim: v })} /></Row>
        {num('Длительность, мс', 'animMs', 50, 20000, 50)}
        {num('Задержка, мс', 'animDelay', 0, 20000, 50)}
        {num('Transition, мс', 'transitionMs', 0, 5000, 50)}
        <Row title="Hover: фон"><ColorField value={hover.bg} onChange={(v) => setHover({ bg: v })} /></Row>
        <Row title="Hover: текст"><ColorField value={hover.color} onChange={(v) => setHover({ color: v })} /></Row>
        <Row title="Hover: подъём"><Check value={hover.lift} onChange={(v) => setHover({ lift: v })} label="приподнять" /></Row>
        <Row title="Hover: масштаб"><NumField optional value={hover.scale} min={0.5} max={2} step={0.01} onChange={(v) => setHover({ scale: v })} /></Row>
        <Row title="Hover: тень"><Select value={hover.shadow} options={[{ value: '', label: '—' }, ...SHADOWS]} onChange={(v) => setHover({ shadow: v })} /></Row>
      </Section>
      {(['tablet', 'mobile'] as const).map((bp) => {
        const r: ResponsiveOverride = b.responsive?.[bp] ?? {}
        const setR = (x: Partial<ResponsiveOverride>): void => patchResponsive(b.id, bp, x)
        return (
          <Section key={bp} title={bp === 'tablet' ? 'Адаптив: планшет' : 'Адаптив: телефон'}>
            <Row title="Скрыть"><Check value={r.hidden} onChange={(v) => setR({ hidden: v || undefined })} label="не показывать" /></Row>
            {b.type === 'grid' && <Row title="Колонок"><NumField optional value={r.columns} min={1} max={12} onChange={(v) => setR({ columns: v })} /></Row>}
            {b.type === 'flex' && (
              <Row title="Направление"><Select value={r.direction} options={[{ value: '', label: '—' }, { value: 'row', label: 'Ряд' }, { value: 'column', label: 'Колонка' }]} onChange={(v) => setR({ direction: v })} /></Row>
            )}
            <Row title="Отступ, px"><NumField optional value={r.padding} min={0} max={200} onChange={(v) => setR({ padding: v })} /></Row>
            <Row title="Размер, px"><NumField optional value={r.size} min={8} max={96} onChange={(v) => setR({ size: v })} /></Row>
            <Row title="Ширина, %"><NumField optional value={r.widthPct} min={5} max={100} onChange={(v) => setR({ widthPct: v })} /></Row>
          </Section>
        )
      })}
    </>
  )
}

function BindTab({ b }: { b: Block }): ReactNode {
  const project = useWebDesigner((s) => s.project)
  const setBinding = useWebDesigner.getState().setBinding
  const rule = bindRule(b.type)
  if (!rule) return <div className="wd-hint">Этот тип блока не поддерживает привязки.</div>
  const bd = b.binding
  const compat = project.variables.filter((v) => rule.vars.includes(v.type))
  const dirLabel = { toUi: 'Устройство → страница', fromUi: 'Страница → устройство', both: 'В обе стороны' }
  const pinRole = (dir: 'toPin' | 'fromPin', mode: 'digital' | 'analog'): PinRole =>
    dir === 'toPin' ? (mode === 'analog' ? 'out-pwm' : 'out-digital') : mode === 'analog' ? 'in-analog' : 'in-digital'
  const pinRule = rule.pins
  return (
    <Section title="Привязка к устройству">
      <Row title="Тип">
        <select
          className="wd-input"
          value={bd.kind}
          onChange={(e) => {
            const k = e.target.value
            if (k === 'none') setBinding(b.id, { kind: 'none' })
            else if (k === 'var') setBinding(b.id, { kind: 'var', variable: compat[0]?.name ?? '', direction: rule.dirs[0] })
            else if (pinRule.length) {
              const pr = pinRule[0]
              const mode = pr.modes[0]
              const first = pinChoices(project.platform, pinRole(pr.direction, mode))[0]
              setBinding(b.id, { kind: 'pin', pin: first?.pin ?? 0, direction: pr.direction, mode })
            }
          }}
        >
          <option value="none">Без привязки</option>
          <option value="var">Переменная</option>
          {pinRule.length > 0 && <option value="pin">Пин</option>}
        </select>
      </Row>
      {bd.kind === 'var' && (
        <>
          <Row title="Переменная">
            <select className="wd-input" value={bd.variable} onChange={(e) => setBinding(b.id, { ...bd, variable: e.target.value })}>
              {!compat.some((v) => v.name === bd.variable) && <option value={bd.variable}>{bd.variable || '— выберите —'}</option>}
              {compat.map((v) => (
                <option key={v.name} value={v.name}>{v.name} ({v.type})</option>
              ))}
            </select>
          </Row>
          {compat.length === 0 && <div className="wd-hint">Нет подходящих переменных ({rule.vars.join('/')}). Объявите их внизу, во вкладке «Переменные».</div>}
          <Row title="Направление">
            <select className="wd-input" value={bd.direction} onChange={(e) => setBinding(b.id, { ...bd, direction: e.target.value as typeof bd.direction })}>
              {rule.dirs.map((d) => (
                <option key={d} value={d}>{dirLabel[d]}</option>
              ))}
            </select>
          </Row>
        </>
      )}
      {bd.kind === 'pin' && (
        <>
          <Row title="Направление">
            <select
              className="wd-input"
              value={bd.direction}
              onChange={(e) => {
                const dir = e.target.value as 'toPin' | 'fromPin'
                const pr = pinRule.find((x) => x.direction === dir)
                if (pr) setBinding(b.id, { ...bd, direction: dir, mode: pr.modes.includes(bd.mode) ? bd.mode : pr.modes[0] })
              }}
            >
              {pinRule.map((x) => (
                <option key={x.direction} value={x.direction}>{x.direction === 'toPin' ? 'Страница → пин' : 'Пин → страница'}</option>
              ))}
            </select>
          </Row>
          <Row title="Режим">
            <select className="wd-input" value={bd.mode} onChange={(e) => setBinding(b.id, { ...bd, mode: e.target.value as 'digital' | 'analog' })}>
              {(pinRule.find((x) => x.direction === bd.direction)?.modes ?? []).map((m) => (
                <option key={m} value={m}>{m === 'digital' ? 'Цифровой' : bd.direction === 'toPin' ? 'PWM (аналоговая запись)' : 'Аналоговый вход'}</option>
              ))}
            </select>
          </Row>
          <Row title="Пин">
            <select className="wd-input" value={bd.pin} onChange={(e) => setBinding(b.id, { ...bd, pin: Number(e.target.value) })}>
              {pinChoices(project.platform, pinRole(bd.direction, bd.mode)).map((c) => (
                <option key={c.pin} value={c.pin}>{c.label}</option>
              ))}
            </select>
          </Row>
          {bd.mode === 'digital' && <Row title="Инверсия"><Check value={bd.invert} onChange={(v) => setBinding(b.id, { ...bd, invert: v || undefined })} label="активный низкий уровень" /></Row>}
          {bd.mode === 'digital' && bd.direction === 'fromPin' && (
            <Row title="Подтяжка"><Check value={bd.pull === 'up'} onChange={(v) => setBinding(b.id, { ...bd, pull: v ? 'up' : undefined })} label="INPUT_PULLUP" /></Row>
          )}
          {checkPin(project.platform, bd.pin, pinRole(bd.direction, bd.mode)).map((pp, k) => (
            <div key={k} className={`wd-issue ${pp.severity}`}>{pp.message}</div>
          ))}
        </>
      )}
    </Section>
  )
}
