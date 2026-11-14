import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  PROJECT_TEMPLATES,
  THEME_PRESETS,
  THEME_VAR_FIELDS,
  identProblem,
  initProblem,
  resolveTheme,
  serializeProject,
  styleValueProblem,
  themeCss,
  utf8Len
} from './core/index'
import type { Issue, UiProject, VarType } from './core/index'
import { useUiBuilder } from './store'

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function CopyButton({ text, label = 'Копировать' }: { text: string; label?: string }): ReactNode {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle')
  return (
    <button
      className="uib-btn"
      onClick={async () => {
        setState((await copyText(text)) ? 'ok' : 'fail')
        setTimeout(() => setState('idle'), 1500)
      }}
    >
      {state === 'ok' ? 'Скопировано' : state === 'fail' ? 'Не удалось' : label}
    </button>
  )
}

export function VariablesPanel(): ReactNode {
  const variables = useUiBuilder((s) => s.project.variables)
  const { addVariable, patchVariable, removeVariable } = useUiBuilder.getState()
  const names = variables.map((v) => v.name)
  return (
    <div className="uib-panel-pad">
      <table className="uib-table">
        <thead>
          <tr>
            <th>Имя</th>
            <th>Тип</th>
            <th>Начальное значение</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {variables.map((v, i) => {
            const nameProb = identProblem(v.name) ?? (names.indexOf(v.name) !== i ? 'повтор имени' : null)
            const initProb = initProblem(v.type, v.init)
            return (
              <tr key={i}>
                <td>
                  <input
                    className={`uib-input mono${nameProb ? ' bad' : ''}`}
                    title={nameProb ?? ''}
                    value={v.name}
                    onChange={(e) => patchVariable(i, { name: e.target.value })}
                  />
                </td>
                <td>
                  <select className="uib-input" value={v.type} onChange={(e) => patchVariable(i, { type: e.target.value as VarType })}>
                    {(['bool', 'int', 'float', 'String'] as const).map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    className={`uib-input mono${initProb ? ' bad' : ''}`}
                    title={initProb ?? ''}
                    value={v.init}
                    onChange={(e) => patchVariable(i, { init: e.target.value })}
                  />
                </td>
                <td>
                  <button className="uib-btn small danger" onClick={() => removeVariable(i)}>
                    ✕
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <button className="uib-btn" onClick={addVariable}>
        + переменная
      </button>
      <div className="uib-hint">
        Переменные объявляются в сгенерированном коде как глобальные. Меняйте их в своём скетче — элементы с привязкой «устройство → UI»
        обновятся сами.
      </div>
    </div>
  )
}

function Field({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <label className="uib-row">
      <span className="uib-row-title">{title}</span>
      {children}
    </label>
  )
}

export function ProjectPanel(): ReactNode {
  const project = useUiBuilder((s) => s.project)
  const { patchWifi, patchSettings } = useUiBuilder.getState()
  const w = project.wifi
  const s = project.settings
  const txt = (value: string, on: (v: string) => void, type = 'text'): ReactNode => (
    <input className="uib-input" type={type} value={value} onChange={(e) => on(e.target.value)} />
  )
  return (
    <div className="uib-panel-pad uib-cols">
      <div>
        <div className="uib-h">WiFi</div>
        <Field title="Режим">
          <select className="uib-input" value={w.mode} onChange={(e) => patchWifi({ mode: e.target.value as 'sta' | 'ap' })}>
            <option value="sta">STA (подключиться к роутеру; при неудаче — AP)</option>
            <option value="ap">AP (своя точка доступа)</option>
          </select>
        </Field>
        {w.mode === 'sta' && (
          <>
            <Field title="SSID">{txt(w.ssid, (v) => patchWifi({ ssid: v }))}</Field>
            <Field title="Пароль">{txt(w.password, (v) => patchWifi({ password: v }), 'password')}</Field>
          </>
        )}
        <Field title="AP: имя сети">{txt(w.apSsid, (v) => patchWifi({ apSsid: v }))}</Field>
        <Field title="AP: пароль (8+ или пусто)">{txt(w.apPassword, (v) => patchWifi({ apPassword: v }), 'password')}</Field>
        <Field title="Hostname">{txt(w.hostname, (v) => patchWifi({ hostname: v }))}</Field>
        <div className="uib-hint">Пароли попадут в сгенерированный код открытым текстом.</div>
      </div>
      <div>
        <div className="uib-h">Страница</div>
        <Field title="Заголовок">{txt(s.title, (v) => patchSettings({ title: v }))}</Field>
        <Field title="Логин (необязательно)">{txt(s.authUser, (v) => patchSettings({ authUser: v }))}</Field>
        <Field title="Пароль страницы">{txt(s.authPass, (v) => patchSettings({ authPass: v }), 'password')}</Field>
        <Field title="Период обновления, мс">
          <input className="uib-input" type="number" min={50} value={s.updateMs} onChange={(e) => patchSettings({ updateMs: Number(e.target.value) })} />
        </Field>
        <Field title="Слайдер шлёт значение при движении">
          <input type="checkbox" checked={s.sliderContinuous} onChange={(e) => patchSettings({ sliderContinuous: e.target.checked })} />
        </Field>
        <Field title="DNS для captive portal (только AP)">
          <input type="checkbox" checked={s.dnsCaptive} onChange={(e) => patchSettings({ dnsCaptive: e.target.checked })} />
        </Field>
        <Field title="Печатать IP в Serial">
          <input type="checkbox" checked={s.serialLog} onChange={(e) => patchSettings({ serialLog: e.target.checked })} />
        </Field>
        {project.platform === 'esp32' && (
          <>
            <Field title="PWM: частота, Гц">
              <input className="uib-input" type="number" value={s.pwmFreq} onChange={(e) => patchSettings({ pwmFreq: Number(e.target.value) })} />
            </Field>
            <Field title="PWM: разрядность, бит">
              <input className="uib-input" type="number" value={s.pwmBits} onChange={(e) => patchSettings({ pwmBits: Number(e.target.value) })} />
            </Field>
          </>
        )}
      </div>
    </div>
  )
}

const ESPUI_COLOR_NAMES = ['Turquoise', 'Emerald', 'Peterriver', 'Wetasphalt', 'Sunflower', 'Carrot', 'Alizarin', 'Dark'] as const

export function ThemePanel(): ReactNode {
  const project = useUiBuilder((s) => s.project)
  const { setTheme, patchTheme, patchThemeColor } = useUiBuilder.getState()
  const theme = project.theme
  const resolved = resolveTheme(theme)
  const css = themeCss(theme)
  return (
    <div className="uib-panel-pad uib-cols">
      <div>
        <div className="uib-h">Готовые темы</div>
        <div className="uib-theme-grid">
          {THEME_PRESETS.map((t) => (
            <div key={t.id} className={`uib-theme-card${theme.preset === t.id ? ' active' : ''}`} onClick={() => setTheme(t.id)} title={t.description}>
              <div className="uib-theme-sample" style={{ background: t.vars.pageBg ?? '#ecf0f1' }}>
                {ESPUI_COLOR_NAMES.slice(0, 5).map((c) => (
                  <i key={c} style={{ background: t.vars.colors?.[c] ?? DEFAULT_COLORS[c], borderRadius: t.vars.cardRadius ?? '6px' }} />
                ))}
              </div>
              <strong>{t.title}</strong>
              <div className="uib-hint">{t.description}</div>
            </div>
          ))}
        </div>
        <div className="uib-hint">
          Тема превращается в CSS и передаётся через <code>ESPUI.setCustomCSS()</code>. Работает при <code>ESPUI.begin()</code>; при{' '}
          <code>beginLITTLEFS()</code> custom.css не раздаётся.
        </div>
      </div>
      <div>
        <div className="uib-h">Параметры темы (переопределяют пресет)</div>
        {THEME_VAR_FIELDS.map((f) => {
          const val = theme.vars[f.key] ?? ''
          const prob = styleValueProblem(f.kind, val)
          return (
            <Field key={f.key} title={f.title}>
              <input
                className={`uib-input mono${prob ? ' bad' : ''}`}
                title={prob ?? `из пресета: ${resolved[f.key] ?? '—'}`}
                placeholder={String(resolved[f.key] ?? f.hint)}
                value={val}
                onChange={(e) => patchTheme({ [f.key]: e.target.value })}
              />
            </Field>
          )
        })}
        <div className="uib-h">Цвета панелей</div>
        {ESPUI_COLOR_NAMES.map((c) => {
          const val = theme.vars.colors?.[c] ?? ''
          const prob = styleValueProblem('color', val)
          return (
            <Field key={c} title={c}>
              <input
                className={`uib-input mono${prob ? ' bad' : ''}`}
                title={prob ?? ''}
                placeholder={resolved.colors?.[c] ?? DEFAULT_COLORS[c]}
                value={val}
                onChange={(e) => patchThemeColor(c, e.target.value)}
              />
            </Field>
          )
        })}
        <div className="uib-hint">CSS темы: {utf8Len(css)} байт{project.platform === 'esp8266' ? ' (ESP8266: держите в пределах 2000)' : ''}</div>
        {css && <pre className="uib-code small css">{css.replace(/\}/g, '}\n')}</pre>}
      </div>
    </div>
  )
}

const DEFAULT_COLORS: Record<(typeof ESPUI_COLOR_NAMES)[number], string> = {
  Turquoise: '#1abc9c',
  Emerald: '#2ecc71',
  Peterriver: '#3498db',
  Wetasphalt: '#34495e',
  Sunflower: '#f1c40f',
  Carrot: '#e67e22',
  Alizarin: '#e74c3c',
  Dark: '#444857'
}

export function CodePanel({ code, issues }: { code: string; issues: Issue[] }): ReactNode {
  const errs = issues.filter((i) => i.severity === 'error').length
  return (
    <div className="uib-code-wrap">
      <div className="uib-code-bar">
        <CopyButton text={code} />
        <span className="uib-hint">
          Сохраните как <code>ui_generated.h</code> рядом со скетчем; в скетче: <code>#include "ui_generated.h"</code>,{' '}
          <code>ui_setup()</code> в setup(), <code>ui_loop()</code> в loop(). Нужны библиотеки: ESPUI, ArduinoJson, ESPAsyncWebServer,{' '}
          {code.includes('ESPAsyncTCP') ? 'ESPAsyncTCP' : 'AsyncTCP'}.
        </span>
        {errs > 0 && <span className="uib-issue error">Ошибок в модели: {errs} — код содержит #error</span>}
      </div>
      <pre className="uib-code">{code}</pre>
    </div>
  )
}

export function IssuesPanel({ issues }: { issues: Issue[] }): ReactNode {
  const select = useUiBuilder((s) => s.select)
  const setActiveTab = useUiBuilder((s) => s.setActiveTab)
  const project = useUiBuilder((s) => s.project)
  const setBottom = useUiBuilder((s) => s.setBottom)
  if (issues.length === 0) return <div className="uib-panel-pad uib-hint">Проблем не найдено.</div>
  const go = (i: Issue): void => {
    if (i.elementId) {
      const tab = project.tabs.find((t) => t.elements.some((e) => e.id === i.elementId))
      if (tab) setActiveTab(tab.id)
      select(i.elementId)
    } else if (i.variable) setBottom('variables')
  }
  return (
    <div className="uib-panel-pad">
      {issues.map((i, n) => (
        <div key={n} className={`uib-issue ${i.severity} clickable`} onClick={() => go(i)}>
          {i.severity === 'error' ? '●' : '▲'} {i.message}
        </div>
      ))}
    </div>
  )
}

export function JsonPanel({ project }: { project: UiProject }): ReactNode {
  const importJson = useUiBuilder((s) => s.importJson)
  const importNotes = useUiBuilder((s) => s.importNotes)
  const newFromTemplate = useUiBuilder((s) => s.newFromTemplate)
  const reset = useUiBuilder((s) => s.reset)
  const [draft, setDraft] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const text = serializeProject(project)
  return (
    <div className="uib-panel-pad uib-cols">
      <div>
        <div className="uib-h">ui.json (текущая модель)</div>
        <CopyButton text={text} />
        <pre className="uib-code small">{text}</pre>
      </div>
      <div>
        <div className="uib-h">Импорт ui.json</div>
        <textarea className="uib-input uib-textarea mono" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Вставьте содержимое ui.json" />
        <div className="uib-code-bar">
          <button className="uib-btn" onClick={() => setErr(importJson(draft))}>
            Загрузить
          </button>
          <button className="uib-btn danger" onClick={() => window.confirm('Сбросить проект?') && reset()}>
            Новый проект
          </button>
        </div>
        {err && <div className="uib-issue error">{err}</div>}
        {importNotes.map((n, i) => (
          <div key={i} className="uib-hint">Миграция: {n}</div>
        ))}
        <div className="uib-h">Новый проект из шаблона</div>
        <select
          className="uib-input"
          value=""
          onChange={(e) => e.target.value && window.confirm('Заменить текущий проект шаблоном?') && newFromTemplate(e.target.value)}
        >
          <option value="">выберите шаблон…</option>
          {PROJECT_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title} — {t.description}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
