import { Fragment, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { PALETTE_KEYS, TEMPLATES, TEMPLATE_CATEGORIES, identProblem, serializeProject, utf8Length } from './core/index'
import type { CppOutput, Issue, SiteOutput, VarType, WdProject } from './core/index'
import { Check, HexField, NumField, Row, Select, TextField } from './fields'
import { useWebDesigner } from './store'
import { Select as KitSelect, Chip } from '../shell/kit'
import { DeclareVarDialog } from '../shell/DeclareVarDialog'
import { useWdSketch } from './sketchCtx'

const TYPES: VarType[] = ['bool', 'int', 'float', 'String']

export function VariablesPanel(): ReactNode {
  const project = useWebDesigner((s) => s.project)
  const mutate = useWebDesigner.getState().mutate
  const { host, sketch, issues } = useWdSketch()
  const [declaring, setDeclaring] = useState(false)
  const own = new Set(project.variables.map((v) => v.name))
  // Переменные скетча, которых на странице ещё нет и которые страница умеет показывать
  const offer = sketch ? sketch.vars.filter((v) => v.type && !own.has(v.name) && !v.isArray) : []
  const taken = new Set([...own, ...project.blocks.map((b) => b.id)])
  const addExternal = (name: string, type: VarType, init: string): void =>
    mutate((p) => {
      if (!p.variables.some((v) => v.name === name)) p.variables.push({ name, type, init, external: true })
    })
  return (
    <div className="wd-pad" data-testid="wd-vars">
      <div className="wd-hint">
        {host
          ? <>Переменные из вашего скетча подхватываются сами: выберите их ниже или в свойствах блока — страница будет показывать и менять именно их. Свои переменные страницы объявляются в <code>web_generated.h</code>.</>
          : <>Переменные объявляются в сгенерированном <code>web_generated.h</code> — меняйте их в своём коде, привязанные блоки обновятся сами.</>}
      </div>
      <table className="wd-table">
        <thead>
          <tr><th>Имя</th><th>Тип</th><th>Начальное</th><th /></tr>
        </thead>
        <tbody>
          {project.variables.map((v, i) => {
            const prob = identProblem(v.name)
            const sv = v.external ? sketch?.vars.find((x) => x.name === v.name) : undefined
            const bad = issues.filter((x) => x.variable === v.name)
            const missing = v.external && !!sketch && !sv
            return (
              <Fragment key={i}>
                <tr>
                  <td>
                    {v.external ? (
                      <span className="wd-ext" title={sv ? `Объявлена в вашем скетче, строка ${sv.line}` : 'Объявлена в вашем скетче'}>
                        <code className="wd-mono">{v.name}</code> <Chip tone="accent">из скетча</Chip>
                      </span>
                    ) : (
                      <input className={`wd-input mono${prob ? ' bad' : ''}`} value={v.name} title={prob ?? ''} spellCheck={false}
                        onChange={(e) => mutate((p) => { p.variables[i].name = e.target.value })} />
                    )}
                  </td>
                  <td>
                    {v.external ? (
                      <span className="wd-dim">{sv?.type ?? v.type}</span>
                    ) : (
                      <KitSelect className="wd-input" value={v.type} onChange={(e) => mutate((p) => { p.variables[i].type = e.target.value as VarType })}>
                        {TYPES.map((t) => <option key={t}>{t}</option>)}
                      </KitSelect>
                    )}
                  </td>
                  <td>
                    {v.external ? <span className="wd-dim">{sv ? sv.initValue || '—' : '—'}</span> : <input className="wd-input mono" value={v.init} onChange={(e) => mutate((p) => { p.variables[i].init = e.target.value })} />}
                  </td>
                  <td><button className="wd-btn small danger" aria-label={`Убрать переменную ${v.name}`} onClick={() => mutate((p) => { p.variables.splice(i, 1) })}>✕</button></td>
                </tr>
                {bad.length > 0 && (
                  <tr className="wd-varissue">
                    <td colSpan={4}>
                      <div className={`wd-issue ${bad[0].severity}`} data-testid="wd-var-issue">
                        {bad[0].severity === 'error' ? '✖' : '⚠'} {bad[0].message}
                        {missing && host && (
                          <button className="wd-btn small" style={{ marginLeft: 8 }} onClick={() => setDeclaring(true)}>Создать в скетче…</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
      {offer.length > 0 && (
        <div className="wd-offer" data-testid="wd-sketch-vars">
          <div className="wd-h">Переменные вашего скетча</div>
          <div className="wd-chips">
            {offer.map((v) => (
              <button key={v.name} className="wd-btn small" data-testid="wd-pick-sketch-var" title={`${v.ctype}, строка ${v.line}`} onClick={() => addExternal(v.name, v.type as VarType, v.initValue)}>
                + {v.name} <span className="wd-dim">{v.type}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="wd-btnrow">
        <button
          className="wd-btn"
          onClick={() => mutate((p) => {
            let n = 1
            while (p.variables.some((v) => v.name === `var${n}`)) n++
            p.variables.push({ name: `var${n}`, type: 'int', init: '' })
          })}
        >
          + Переменная
        </button>
        {host && <button className="wd-btn" data-testid="wd-declare-var" onClick={() => setDeclaring(true)} title="Добавить объявление в ваш скетч — переменной можно пользоваться и в своём коде">+ Переменная в скетче…</button>}
      </div>
      {declaring && host && (
        <DeclareVarDialog host={host} name={`var${project.variables.length + 1}`} type="int" taken={taken}
          onCreate={(v) => { setDeclaring(false); addExternal(v.name, v.type, v.init) }} onClose={() => setDeclaring(false)} />
      )}
    </div>
  )
}

export function ThemePanel(): ReactNode {
  const theme = useWebDesigner((s) => s.project.page.theme)
  const mutate = useWebDesigner.getState().mutate
  const LABELS: Record<string, string> = {
    bg: 'Фон', surface: 'Карточки', text: 'Текст', muted: 'Приглушённый', primary: 'Основной', accent: 'Акцент',
    success: 'Успех', warning: 'Внимание', danger: 'Ошибка', border: 'Граница'
  }
  return (
    <div className="wd-pad wd-cols">
      {(['light', 'dark'] as const).map((which) => (
        <div key={which}>
          <div className="wd-h">{which === 'light' ? 'Светлая палитра' : 'Тёмная палитра'}</div>
          {PALETTE_KEYS.map((k) => (
            <Row key={k} title={LABELS[k]}>
              <HexField value={theme[which][k]} onChange={(v) => mutate((p) => { p.page.theme[which][k] = v })} />
            </Row>
          ))}
        </div>
      ))}
      <div>
        <div className="wd-h">Общее</div>
        <Row title="Режим по умолчанию">
          <Select value={theme.mode} options={[{ value: 'auto', label: 'По системе' }, { value: 'light', label: 'Светлая' }, { value: 'dark', label: 'Тёмная' }]}
            onChange={(v) => mutate((p) => { p.page.theme.mode = v ?? 'auto' })} />
        </Row>
        <Row title="Кнопка темы"><Check value={theme.toggle} label="показывать переключатель" onChange={(v) => mutate((p) => { p.page.theme.toggle = v })} /></Row>
        <Row title="Шрифт">
          <Select value={theme.font} options={[{ value: 'sans', label: 'Sans (системный)' }, { value: 'serif', label: 'Serif' }, { value: 'mono', label: 'Mono' }, { value: 'rounded', label: 'Rounded' }]}
            onChange={(v) => mutate((p) => { p.page.theme.font = v ?? 'sans' })} />
        </Row>
        <Row title="Размер шрифта, px"><NumField value={theme.baseSize} min={12} max={24} onChange={(v) => mutate((p) => { p.page.theme.baseSize = v ?? 16 })} /></Row>
        <Row title="Скругление, px"><NumField value={theme.radius} min={0} max={40} onChange={(v) => mutate((p) => { p.page.theme.radius = v ?? 12 })} /></Row>
        <Row title="Ширина контента, px"><NumField value={theme.maxWidth} min={320} max={3000} onChange={(v) => mutate((p) => { p.page.theme.maxWidth = v ?? 1100 })} /></Row>
        <div className="wd-hint">Шрифты — только системные (устройство может быть без интернета).</div>
      </div>
    </div>
  )
}

export function PagePanel(): ReactNode {
  const p = useWebDesigner((s) => s.project)
  const mutate = useWebDesigner.getState().mutate
  return (
    <div className="wd-pad wd-cols">
      <div>
        <div className="wd-h">Страница</div>
        <Row title="Заголовок"><TextField value={p.page.title} onChange={(v) => mutate((x) => { x.page.title = v })} /></Row>
        <Row title="Описание"><TextField value={p.page.description} onChange={(v) => mutate((x) => { x.page.description = v })} /></Row>
        <Row title="Язык (lang)"><TextField mono value={p.page.lang} onChange={(v) => mutate((x) => { x.page.lang = v })} /></Row>
        <Row title="Планшет, px"><NumField value={p.page.tablet} min={320} max={2000} onChange={(v) => mutate((x) => { x.page.tablet = v ?? 900 })} /></Row>
        <Row title="Телефон, px"><NumField value={p.page.mobile} min={240} max={1500} onChange={(v) => mutate((x) => { x.page.mobile = v ?? 600 })} /></Row>
        <Row title="Статус связи"><Check value={p.page.showStatus} label="показывать индикатор" onChange={(v) => mutate((x) => { x.page.showStatus = v })} /></Row>
      </div>
      <div>
        <div className="wd-h">Страницы сайта</div>
        <div className="wd-hint">Переключаются без перезагрузки. Ссылки на страницы — блок «Ссылка» (поле «Страница»). Блок на всех страницах — «Макет → Страница сайта».</div>
        {p.pages.map((pg) => (
          <div key={pg.id} className="wd-pagerow">
            <input className="wd-input mono" key={pg.id} defaultValue={pg.id} title="id страницы (адрес #/id); применяется по Enter или при выходе из поля" onBlur={(e) => useWebDesigner.getState().patchPage(pg.id, { id: e.target.value.trim() })} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
            <input className="wd-input" value={pg.title} title="Название" onChange={(e) => useWebDesigner.getState().patchPage(pg.id, { title: e.target.value })} />
            <button className="wd-btn small danger" disabled={p.pages.length < 2} onClick={() => useWebDesigner.getState().removePage(pg.id)} title="Удалить страницу (её блоки перейдут на первую)">✕</button>
          </div>
        ))}
        <button className="wd-btn small" onClick={() => useWebDesigner.getState().addPage()}>+ Страница</button>
      </div>
      <div>
        <div className="wd-h">WiFi</div>
        <Row title="Режим"><Select value={p.wifi.mode} options={[{ value: 'sta', label: 'Клиент (роутер)' }, { value: 'ap', label: 'Точка доступа' }]} onChange={(v) => mutate((x) => { x.wifi.mode = v ?? 'sta' })} /></Row>
        {p.wifi.mode === 'sta' && (
          <>
            <Row title="SSID"><TextField value={p.wifi.ssid} onChange={(v) => mutate((x) => { x.wifi.ssid = v })} /></Row>
            <Row title="Пароль"><TextField value={p.wifi.password} onChange={(v) => mutate((x) => { x.wifi.password = v })} /></Row>
          </>
        )}
        <Row title="AP SSID"><TextField value={p.wifi.apSsid} onChange={(v) => mutate((x) => { x.wifi.apSsid = v })} /></Row>
        <Row title="AP пароль"><TextField value={p.wifi.apPassword} onChange={(v) => mutate((x) => { x.wifi.apPassword = v })} /></Row>
        <Row title="Имя хоста"><TextField mono value={p.wifi.hostname} onChange={(v) => mutate((x) => { x.wifi.hostname = v })} /></Row>
        <div className="wd-hint">Пароль хранится в project.json открытым текстом и попадёт в прошивку.</div>
      </div>
      <div>
        <div className="wd-h">Устройство</div>
        <Row title="Путь WebSocket"><TextField mono value={p.device.wsPath} onChange={(v) => mutate((x) => { x.device.wsPath = v })} /></Row>
        <Row title="Порт"><NumField value={p.device.port} min={1} max={65535} onChange={(v) => mutate((x) => { x.device.port = v ?? 80 })} /></Row>
        <Row title="Опрос, мс"><NumField value={p.device.updateMs} min={20} onChange={(v) => mutate((x) => { x.device.updateMs = v ?? 200 })} /></Row>
        {p.platform === 'esp32' && (
          <>
            <Row title="Ядро ESP32"><Select value={p.device.ledcApi} options={[{ value: 'v3', label: '3.x (ledcAttach)' }, { value: 'v2', label: '2.x (ledcSetup)' }]} onChange={(v) => mutate((x) => { x.device.ledcApi = v ?? 'v3' })} /></Row>
            <Row title="PWM, Гц"><NumField value={p.device.pwmFreq} min={1} onChange={(v) => mutate((x) => { x.device.pwmFreq = v ?? 5000 })} /></Row>
            <Row title="PWM, бит"><NumField value={p.device.pwmBits} min={1} max={16} onChange={(v) => mutate((x) => { x.device.pwmBits = v ?? 8 })} /></Row>
          </>
        )}
        <Row title="Отдача страницы" hint="send — форк ESP32Async; send_P — старая me-no-dev (см. data/webdesign/API_NOTES.md)">
          <Select value={p.device.serveApi} options={[{ value: 'send', label: 'request->send (ESP32Async)' }, { value: 'send_P', label: 'request->send_P (старая)' }]} onChange={(v) => mutate((x) => { x.device.serveApi = v ?? 'send' })} />
        </Row>
        <Row title="Serial"><Check value={p.device.serialLog} label="печатать IP" onChange={(v) => mutate((x) => { x.device.serialLog = v })} /></Row>
      </div>
    </div>
  )
}

function download(name: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export interface Files {
  [name: string]: { text: string; mime: string }
}

export function buildFiles(project: WdProject, site: SiteOutput, cpp: CppOutput): Files {
  return {
    'index.html': { text: site.html, mime: 'text/html' },
    'style.css': { text: site.css, mime: 'text/css' },
    'app.js': { text: site.js, mime: 'text/javascript' },
    'page_bundle.html': { text: site.bundle, mime: 'text/html' },
    'web_generated.h': { text: cpp.header, mime: 'text/plain' },
    'web_sketch.ino': { text: cpp.sketch, mime: 'text/plain' },
    'project.json': { text: serializeProject(project), mime: 'application/json' }
  }
}

export function ExportMenu({ files }: { files: Files }): ReactNode {
  const importJson = useWebDesigner.getState().importJson
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div className="wd-menu" ref={ref}>
      <button className="wd-btn small" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        Экспорт ▾
      </button>
      {open && (
        <div className="wd-menu-list" role="menu">
          {Object.entries(files).map(([name, f]) => (
            <button key={name} className="wd-menu-item" role="menuitem" onClick={() => { download(name, f.text, f.mime); setOpen(false) }}>
              {name}
            </button>
          ))}
          <div className="wd-menu-sep" />
          <button
            className="wd-menu-item"
            role="menuitem"
            title="Скачивает все файлы подряд (браузер может спросить разрешение на несколько загрузок)"
            onClick={() => {
              let i = 0
              for (const [name, f] of Object.entries(files)) setTimeout(() => download(name, f.text, f.mime), 250 * i++)
              setOpen(false)
            }}
          >
            Все файлы
          </button>
          <label className="wd-menu-item">
            Импорт project.json…
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                setOpen(false)
                if (!f) return
                void f.text().then((t) => setMsg(importJson(t) ?? 'Импортировано'))
              }}
            />
          </label>
        </div>
      )}
      {msg && <span className="wd-dim wd-menu-msg" onClick={() => setMsg('')}>{msg}</span>}
    </div>
  )
}

/** Меню «···» для узкого окна: плата, шаблоны, новый проект, экспорт и импорт. */
export function MoreMenu({ files, platform, setPlatform, pickTemplate, askNew }: {
  files: Files
  platform: string
  setPlatform: (p: 'esp8266' | 'esp32') => void
  pickTemplate: (id: string) => void
  askNew: () => void
}): ReactNode {
  const importJson = useWebDesigner.getState().importJson
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div className="wd-menu wd-tb-more" ref={ref}>
      <button className="wd-btn small" aria-haspopup="menu" aria-expanded={open} title="Плата, шаблоны, экспорт" onClick={() => setOpen(!open)}>···</button>
      {open && (
        <div className="wd-menu-list wd-menu-right" role="menu">
          <label className="wd-menu-row">Плата
            <KitSelect className="wd-input" value={platform} onChange={(e) => setPlatform(e.target.value as 'esp8266' | 'esp32')}>
              <option value="esp32">ESP32 / S3 / C3</option>
              <option value="esp8266">ESP8266</option>
            </KitSelect>
          </label>
          <label className="wd-menu-row">Шаблон
            <KitSelect className="wd-input" value="" onChange={(e) => { setOpen(false); pickTemplate(e.target.value) }}>
              <option value="">— загрузить —</option>
              {TEMPLATE_CATEGORIES.map((c) => (
                <optgroup key={c.id} label={c.title}>
                  {TEMPLATES.filter((t) => t.category === c.id).map((t) => <option key={t.id} value={t.id} title={t.description}>{t.title}</option>)}
                </optgroup>
              ))}
            </KitSelect>
          </label>
          <button className="wd-menu-item" role="menuitem" onClick={() => { setOpen(false); askNew() }}>Новый проект</button>
          <div className="wd-menu-sep" />
          {Object.entries(files).map(([name, f]) => (
            <button key={name} className="wd-menu-item" role="menuitem" onClick={() => { download(name, f.text, f.mime); setOpen(false) }}>Экспорт: {name}</button>
          ))}
          <label className="wd-menu-item">
            Импорт project.json…
            <input type="file" accept="application/json,.json" hidden onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              setOpen(false)
              if (f) void f.text().then((t) => importJson(t))
            }} />
          </label>
        </div>
      )}
    </div>
  )
}

export function CodePanel({ kind, site, cpp, issues }: { kind: 'html' | 'css' | 'js' | 'cpp'; site: SiteOutput; cpp: CppOutput; issues: Issue[] }): ReactNode {
  const [file, setFile] = useState<'header' | 'sketch'>('header')
  const [copied, setCopied] = useState(false)
  const errs = issues.filter((i) => i.severity === 'error').length
  const code = kind === 'html' ? site.html : kind === 'css' ? site.css : kind === 'js' ? site.js : file === 'header' ? cpp.header : cpp.sketch
  const name = kind === 'html' ? 'index.html' : kind === 'css' ? 'style.css' : kind === 'js' ? 'app.js' : file === 'header' ? 'web_generated.h' : 'web_sketch.ino'
  const copy = (): void => {
    void navigator.clipboard?.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }
  return (
    <div className="wd-code-wrap">
      <div className="wd-code-bar">
        <strong>{name}</strong>
        <span className="wd-dim">{(utf8Length(code) / 1024).toFixed(1)} КБ</span>
        {kind === 'cpp' && (
          <>
            <button className={`wd-seg${file === 'header' ? ' on' : ''}`} onClick={() => setFile('header')}>web_generated.h</button>
            <button className={`wd-seg${file === 'sketch' ? ' on' : ''}`} onClick={() => setFile('sketch')}>Пример скетча</button>
          </>
        )}
        {kind === 'cpp' && errs > 0 && <span className="wd-flag error">есть ошибки проекта — код может не собраться</span>}
        <button className="wd-btn small" onClick={copy}>{copied ? 'Скопировано' : 'Копировать'}</button>
        <button className="wd-btn small" onClick={() => download(name, code, 'text/plain')}>Скачать</button>
      </div>
      <pre className="wd-code">{code}</pre>
    </div>
  )
}

export function IssuesPanel({ issues }: { issues: Issue[] }): ReactNode {
  const select = useWebDesigner.getState().select
  if (!issues.length) return <div className="wd-pad wd-hint">Проблем не найдено.</div>
  return (
    <div className="wd-pad">
      {issues.map((i, k) => (
        <div key={k} className={`wd-issue ${i.severity}${i.blockId ? ' clickable' : ''}`} onClick={() => i.blockId && select(i.blockId)}>
          {i.severity === 'error' ? '✖' : '⚠'} {i.message}
        </div>
      ))}
    </div>
  )
}

export function JsonPanel({ project }: { project: WdProject }): ReactNode {
  return <pre className="wd-code">{serializeProject(project)}</pre>
}
