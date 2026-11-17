// Параметры платы: способ загрузки, USB, частота… Форма используется в шапке (поповер) и в мастере создания проекта.
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { fqbnOptions, platformOfFqbn, portPolicy, withOption } from '../../../main/cli/fqbn'
import { defaultsOf, effectiveOptions, useBoardDetails } from '../build/boardOptions'
import { Icon } from './icons'
import { Spinner } from './kit'

/** Русские названия частых параметров разных ядер (если id незнаком — остаётся подпись из ядра). */
const RU_LABELS: Record<string, string> = {
  pnum: 'Модель платы', upload_method: 'Способ загрузки', usb: 'USB', xserial: 'Serial (UART)', opt: 'Оптимизация', dbg: 'Отладка',
  rtlib: 'Библиотека C', freq: 'Частота ЦП', flash: 'Размер Flash', usbstack: 'Стек USB', dbgport: 'Порт отладки', dbglvl: 'Уровень отладки',
  boot2: 'Загрузчик (boot2)', ipbtstack: 'Стек IP/Bluetooth', uploadmethod: 'Способ загрузки', wire: 'Интерфейс I2C',
  CPUFreq: 'Частота ЦП', FlashMode: 'Режим Flash', FlashFreq: 'Частота Flash', FlashSize: 'Размер Flash', PartitionScheme: 'Схема разделов',
  UploadSpeed: 'Скорость загрузки', PSRAM: 'PSRAM', DebugLevel: 'Уровень отладки', CDCOnBoot: 'USB CDC при старте', JTAGAdapter: 'JTAG-адаптер',
  baud: 'Скорость загрузки', xtal: 'Частота ЦП', eesz: 'Размер Flash', dbgport_: 'Порт отладки', cpu: 'Процессор', clock: 'Частота'
}
export const optionTitle = (id: string, label: string): string => RU_LABELS[id] ?? label

/** Пояснение к способу прошивки: нужен ли COM-порт. */
export function PortNote({ fqbn, defaults }: { fqbn: string; defaults: Record<string, string> }): ReactNode {
  const kind = platformOfFqbn(fqbn)
  const policy = portPolicy(fqbn, defaults)
  if (kind === 'stm32' && policy === 'none') return <div className="bo-note"><Icon name="info" size={13} /> Для этого способа загрузки COM-порт не нужен: плата прошивается через ST-Link или USB.</div>
  if (kind === 'stm32' && policy === 'required') return <div className="bo-note"><Icon name="info" size={13} /> Для этого способа загрузки нужен COM-порт (перемычка BOOT0 в нужном положении).</div>
  if (kind === 'rp2040') return <div className="bo-note"><Icon name="info" size={13} /> Если плату не видно в списке портов — зажмите BOOTSEL и подключите USB.</div>
  return null
}

export function BoardOptionsForm({ fqbn, onChange, idPrefix = 'bo' }: { fqbn: string; onChange: (next: string) => void; idPrefix?: string }): ReactNode {
  const st = useBoardDetails(fqbn)
  const data = st?.state === 'ok' ? st.data : undefined
  const defaults = useMemo(() => defaultsOf(data), [data])
  const eff = effectiveOptions(fqbn, data)
  const explicit = Object.keys(fqbnOptions(fqbn)).length

  if (!st || st.state === 'loading') return <div className="bo-state dim"><Spinner /> Загружаю параметры платы…</div>
  if (st.state === 'error') return <div className="bo-state dim">Параметры платы недоступны: {st.error.split('\n')[0]}</div>
  if (!data || data.options.length === 0) return <div className="bo-state dim">У этой платы нет настраиваемых параметров.</div>

  return (
    <div className="bo-form" data-testid={idPrefix + '-form'}>
      {data.options.map((o) => (
        <div className="bo-row" key={o.id}>
          <label className="bo-label" htmlFor={`${idPrefix}-${o.id}`} title={`${o.label} (${o.id})`}>{optionTitle(o.id, o.label)}</label>
          <select id={`${idPrefix}-${o.id}`} className="select bo-select" data-testid={`${idPrefix}-${o.id}`} value={eff[o.id] ?? ''} title={o.values.find((v) => v.value === eff[o.id])?.label}
            onChange={(e) => onChange(withOption(fqbn, o.id, e.target.value))}>
            {o.values.map((v) => <option key={v.value} value={v.value}>{v.label}{defaults[o.id] === v.value ? ' (по умолчанию)' : ''}</option>)}
          </select>
        </div>
      ))}
      <PortNote fqbn={fqbn} defaults={defaults} />
      <div className="bo-foot">
        <span className="dim small">{explicit ? `Изменено параметров: ${explicit}` : 'Все параметры по умолчанию'}</span>
        <button className="btn small" data-testid={idPrefix + '-reset'} disabled={!explicit}
          onClick={() => onChange(fqbn.split(':').slice(0, 3).join(':'))}>Сбросить</button>
      </div>
    </div>
  )
}
