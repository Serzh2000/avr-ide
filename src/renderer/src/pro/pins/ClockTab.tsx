// Вкладка «Тактирование»: блок-схема HSI/HSE → PLL → SYSCLK → AHB → APB1/APB2 → таймеры с частотами, проверкой пределов и подбором PLL.
import { useState } from 'react'
import type { ReactNode } from 'react'
import { AHB_DIVS, APB_DIVS, CLOCK_SOURCES, PLL_P_VALUES, autoClock, computeClock } from '../../../../shared/pro/pinconfig/clock'
import { setClock } from '../../../../shared/pro/pinconfig/ops'
import type { ClockCfg, PinsConfig } from '../../../../shared/pro/pinconfig/types'
import { Button, Chip, EmptyState, Field, Select } from '../../shell/kit'
import { Icon } from '../../shell/icons'
import { useUi } from '../../shell/ui'
import { fmtHz } from './pinsModel'
import type { PinsModel } from './pinsModel'
import { usePins } from './pinsStore'

const NODE_OF: Record<string, string> = {
  'hse-range': 'hse', 'pll-mul': 'pll', 'pll-m': 'pll', 'pll-n': 'pll', 'pll-p': 'pll', 'pll-q': 'pll', 'pll-r': 'pll', 'vco-in': 'pll', 'vco-out': 'pll', 'clock-pll-manual': 'pll',
  'sys-max': 'sys', 'hclk-max': 'ahb', 'ahb-div': 'ahb', 'pclk1-max': 'apb1', 'pclk2-max': 'apb2', 'apb-div': 'apb1'
}

const int = (v: string): number | undefined => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : undefined }

function Node({ id, title, active, bad, children, value }: { id: string; title: string; active?: boolean; bad?: boolean; children?: ReactNode; value?: string }): ReactNode {
  return (
    <div className={'ck-node' + (active ? ' active' : '') + (bad ? ' bad' : '')} data-testid="ck-node" data-node={id}>
      <div className="ck-title">{title}</div>
      {value !== undefined && <div className="ck-value mono" data-testid={`ck-val-${id}`}>{value}</div>}
      {children}
    </div>
  )
}

export default function ClockTab({ model, cfg }: { model: PinsModel; cfg: PinsConfig }): ReactNode {
  const edit = usePins((s) => s.edit)
  const [target, setTarget] = useState('')
  const { profile: prof, clock: r } = model
  const ck = cfg.clock
  const set = (p: Partial<ClockCfg>): void => edit((c) => setClock(c, p))
  const setPll = (p: Partial<ClockCfg['pll']>): void => edit((c) => setClock(c, { pll: p }))
  const clockIssues = model.issues.filter((i) => i.code in NODE_OF || i.code.startsWith('clock') || i.code === 'hse-range')
  const bad = (n: string): boolean => clockIssues.some((i) => NODE_OF[i.code] === n && i.severity === 'error')

  if (!prof.kind) {
    return (
      <div className="ck ck-manual" data-testid="pins-clock">
        <EmptyState icon="zap" title="Тактирование для этого семейства пока вручную" hint={prof.note}>
          <Chip tone="warn">{model.chip.family}: код тактирования не создаётся</Chip>
        </EmptyState>
        <ClockSources />
      </div>
    )
  }
  const pllOn = ck.source === 'pll'
  const hseUsed = ck.source === 'hse' || (pllOn && ck.pllSource === 'hse')
  const auto = (): void => {
    const hz = Number(target.replace(',', '.')) * 1e6
    if (!(hz > 0)) { useUi.getState().notify('Введите целевую частоту SYSCLK в мегагерцах, например 72.', { kind: 'error' }); return }
    const base = setClock(cfg, {}).clock
    const res = autoClock(model.chip, base, hz)
    if (!res) { useUi.getState().notify(`Для ${fmtHz(hz)} параметры PLL подобрать нельзя: частота выше предела ${fmtHz(prof.sysMaxHz)}, источник вне диапазона или PLL этого чипа пока вручную.`, { kind: 'error' }); return }
    edit((c) => setClock(c, res.cfg))
    useUi.getState().notify(res.exact ? `PLL подобран точно: ${fmtHz(hz)}.` : `Точной частоты нет, ближайшая допустимая: ${fmtHz(computeClock(model.chip, res.cfg).sysclk)}.`, { kind: res.exact ? 'ok' : 'info' })
  }
  return (
    <div className="ck" data-testid="pins-clock">
      <div className="ck-limits dim small">
        Пределы {model.chip.name}: SYSCLK ≤ {fmtHz(prof.sysMaxHz)}, APB1 ≤ {fmtHz(prof.apb1MaxHz)}, APB2 ≤ {fmtHz(prof.apb2MaxHz)}; HSE {fmtHz(prof.hseMinHz)}–{fmtHz(prof.hseMaxHz)}.
        {prof.note && !clockIssues.some((i) => i.message === prof.note) && <> <b>{prof.note}</b></>}
      </div>
      <div className="ck-diagram" role="group" aria-label="Схема тактирования">
        <div className="ck-col">
          <Node id="hsi" title="HSI (внутренний)" value={fmtHz(prof.hsiHz)} active={ck.source === 'hsi' || (pllOn && ck.pllSource === 'hsi')} />
          <Node id="hse" title="HSE (внешний)" value={fmtHz(ck.hseHz)} active={hseUsed} bad={bad('hse')}>
            <div className="ck-ctl">
              <input className="input ck-num" type="number" min={0} step={0.001} aria-label="Частота HSE, МГц" data-testid="ck-hse" value={ck.hseHz / 1e6} onChange={(e) => { const v = Number(e.target.value) * 1e6; if (v > 0) set({ hseHz: Math.round(v) }) }} /><span className="dim small">МГц</span>
            </div>
            <label className="ck-check"><input type="checkbox" checked={ck.hseBypass} onChange={(e) => set({ hseBypass: e.target.checked })} /> внешний сигнал (без кварца)</label>
          </Node>
        </div>
        <div className="ck-col">
          <Node id="pll" title="PLL" active={pllOn} bad={bad('pll')} value={pllOn && r.sysclk ? `${fmtHz(r.sysclk)}` : undefined}>
            <div className="ck-ctl">
              <Select value={ck.pllSource} aria-label="Источник PLL" data-testid="ck-pllsrc" onChange={(e) => set({ pllSource: e.target.value as 'hsi' | 'hse' })}>
                <option value="hsi">вход: HSI</option><option value="hse">вход: HSE</option>
              </Select>
            </div>
            {prof.kind === 'f1' && (
              <div className="ck-ctl">
                <label className="ck-lbl">×<Select value={ck.pll.mul ?? ''} aria-label="Множитель PLL" data-testid="ck-mul" onChange={(e) => setPll({ mul: int(e.target.value) })}>
                  <option value="">—</option>{Array.from({ length: 15 }, (_, i) => i + 2).map((m) => <option key={m} value={m}>{m}</option>)}
                </Select></label>
                {ck.pllSource === 'hse' && <label className="ck-check"><input type="checkbox" checked={!!ck.pll.hseDiv2} onChange={(e) => setPll({ hseDiv2: e.target.checked })} /> ÷2</label>}
              </div>
            )}
            {prof.kind !== 'f1' && (
              <div className="ck-grid">
                <label className="ck-lbl">M<input className="input" type="number" data-testid="ck-m" value={ck.pll.m ?? ''} onChange={(e) => setPll({ m: int(e.target.value) })} /></label>
                <label className="ck-lbl">N<input className="input" type="number" data-testid="ck-n" value={ck.pll.n ?? ''} onChange={(e) => setPll({ n: int(e.target.value) })} /></label>
                {prof.kind === 'f4' && <label className="ck-lbl">P<Select value={ck.pll.p ?? ''} data-testid="ck-p" onChange={(e) => setPll({ p: int(e.target.value) })}><option value="">—</option>{PLL_P_VALUES.map((p) => <option key={p} value={p}>{p}</option>)}</Select></label>}
                {prof.kind === 'f4' && <label className="ck-lbl">Q<input className="input" type="number" data-testid="ck-q" value={ck.pll.q ?? ''} onChange={(e) => setPll({ q: int(e.target.value) })} /></label>}
                {prof.kind === 'g4' && <label className="ck-lbl">R<Select value={ck.pll.r ?? ''} data-testid="ck-r" onChange={(e) => setPll({ r: int(e.target.value) })}><option value="">—</option>{PLL_P_VALUES.map((p) => <option key={p} value={p}>{p}</option>)}</Select></label>}
              </div>
            )}
            {pllOn && r.pllIn !== undefined && prof.kind !== 'f1' && <div className="dim small mono" data-testid="ck-vco">вход VCO {fmtHz(r.pllIn)} → VCO {fmtHz(r.pllVco ?? 0)}{r.pllQ ? ` · Q ${fmtHz(r.pllQ)}` : ''}</div>}
          </Node>
        </div>
        <div className="ck-col">
          <Node id="sys" title="SYSCLK" active bad={bad('sys')} value={fmtHz(r.sysclk || (ck.source === 'hsi' ? prof.hsiHz : 0))}>
            <div className="ck-ctl">
              <Select value={ck.source} aria-label="Источник SYSCLK" data-testid="ck-source" onChange={(e) => set({ source: e.target.value as ClockCfg['source'] })}>
                <option value="hsi">HSI</option><option value="hse">HSE</option><option value="pll" disabled={!prof.pllAuto}>PLL{prof.pllAuto ? '' : ' (пока вручную)'}</option>
              </Select>
            </div>
            {r.latency !== null && <div className="dim small">Wait states Flash: <b data-testid="ck-latency">{r.latency}</b></div>}
          </Node>
        </div>
        <div className="ck-col">
          <Node id="ahb" title="AHB" bad={bad('ahb')} value={`HCLK ${fmtHz(r.hclk)}`} active>
            <div className="ck-ctl"><label className="ck-lbl">÷<Select value={ck.ahbDiv} aria-label="Делитель AHB" data-testid="ck-ahb" onChange={(e) => set({ ahbDiv: Number(e.target.value) })}>{AHB_DIVS.map((d) => <option key={d} value={d}>{d}</option>)}</Select></label></div>
          </Node>
        </div>
        <div className="ck-col">
          <Node id="apb1" title="APB1" bad={bad('apb1')} value={`PCLK1 ${fmtHz(r.pclk1)}`} active>
            <div className="ck-ctl"><label className="ck-lbl">÷<Select value={ck.apb1Div} aria-label="Делитель APB1" data-testid="ck-apb1" onChange={(e) => set({ apb1Div: Number(e.target.value) })}>{APB_DIVS.map((d) => <option key={d} value={d}>{d}</option>)}</Select></label></div>
            <div className="dim small">Таймеры APB1: <b>{fmtHz(r.timclk1)}</b></div>
          </Node>
          <Node id="apb2" title="APB2" bad={bad('apb2')} value={`PCLK2 ${fmtHz(r.pclk2)}`} active>
            <div className="ck-ctl"><label className="ck-lbl">÷<Select value={ck.apb2Div} aria-label="Делитель APB2" data-testid="ck-apb2" onChange={(e) => set({ apb2Div: Number(e.target.value) })}>{APB_DIVS.map((d) => <option key={d} value={d}>{d}</option>)}</Select></label></div>
            <div className="dim small">Таймеры APB2: <b>{fmtHz(r.timclk2)}</b></div>
          </Node>
        </div>
      </div>

      {prof.pllAuto && (
        <div className="ck-auto">
          <Field label="Подобрать PLL" hint="Целевая частота SYSCLK; источник PLL и HSE берутся из схемы выше.">
            <span className="ck-auto-row">
              <input className="input" type="number" min={0} step={0.1} placeholder={String(prof.sysMaxHz / 1e6)} aria-label="Целевая частота SYSCLK, МГц" data-testid="ck-target" value={target} onChange={(e) => setTarget(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') auto() }} />
              <span className="dim small">МГц</span>
              <Button size="sm" variant="primary" data-testid="ck-auto" onClick={auto}>Подобрать</Button>
            </span>
          </Field>
        </div>
      )}

      <section className="ck-checks" data-testid="ck-checks" aria-label="Проверка пределов">
        <h4>Проверка пределов</h4>
        {clockIssues.length === 0 && r.ok && <div className="pc-note ok"><Icon name="check" size={14} /><span>Все частоты в пределах для {model.chip.name}.</span></div>}
        {clockIssues.map((i, k) => <div key={k} className={'pc-note ' + (i.severity === 'error' ? 'err' : 'warn')} data-testid="ck-issue"><Icon name={i.severity === 'error' ? 'error' : 'warn'} size={14} /><span>{i.message}</span></div>)}
      </section>
      <ClockSources />
    </div>
  )
}

function ClockSources(): ReactNode {
  return (
    <details className="ck-src">
      <summary>Откуда взяты пределы</summary>
      <ul>{CLOCK_SOURCES.map((s) => <li key={s.id}><span>{s.what}</span> <span className="dim small mono">{s.url}</span></li>)}</ul>
    </details>
  )
}
