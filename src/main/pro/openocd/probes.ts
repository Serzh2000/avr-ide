// Перечисление ST-Link: список USB-устройств Windows (VID 0483) без запуска OpenOCD и без обращения к самим устройствам.
// Разбор ответа PowerShell (Get-CimInstance Win32_PnPEntity ... | ConvertTo-Json) — чистая функция, проверяется на записанных ответах.
import { execFile } from 'child_process'
import type { Probe } from '../interfaces'

export const ST_VID = '0483'
/** PID → модель. 3748 — ST-Link/V2 (в том числе «свистки» для Blue Pill), 374B и 3752 — V2-1 (Nucleo), 374E/374F/3753/3754 — V3. */
export const STLINK_PIDS: Record<string, { model: string; vcp: boolean }> = {
  '3748': { model: 'ST-Link V2', vcp: false },
  '374B': { model: 'ST-Link V2-1', vcp: true },
  '3752': { model: 'ST-Link V2-1', vcp: true },
  '374E': { model: 'ST-Link V3', vcp: true },
  '374F': { model: 'ST-Link V3', vcp: true },
  '3753': { model: 'ST-Link V3', vcp: true },
  '3754': { model: 'ST-Link V3', vcp: true }
}

export interface PnpRecord { PNPDeviceID?: string; Name?: string; Status?: string; ConfigManagerErrorCode?: number; Service?: string | null }

const GOOD_SERVICES = /^(winusb|libusb|libusbk|libusb0|stlink|st-?link\w*|stlink_winusb|stlinkv\w*)$/i

/** Разбирает записи PnP в список ST-Link. Дочерние интерфейсы (MI_nn) используются только для оценки драйвера. */
export function parsePnp(json: string): Probe[] {
  let raw: unknown
  try { raw = JSON.parse(json.trim() || '[]') } catch { return [] }
  const recs = (Array.isArray(raw) ? raw : [raw]).filter((r): r is PnpRecord => !!r && typeof r === 'object')
  const parents: { pid: string; serial?: string; rec: PnpRecord }[] = []
  const children: { pid: string; rec: PnpRecord }[] = []
  for (const rec of recs) {
    const m = /^USB\\VID_0483&PID_([0-9A-F]{4})(&MI_\d\d)?\\(.+)$/i.exec(rec.PNPDeviceID ?? '')
    if (!m) continue
    const pid = m[1].toUpperCase()
    if (!STLINK_PIDS[pid]) continue
    if (m[2]) children.push({ pid, rec })
    else parents.push({ pid, serial: /&/.test(m[3]) ? undefined : m[3].toUpperCase(), rec })
  }
  return parents.map(({ pid, serial, rec }, i) => {
    const info = STLINK_PIDS[pid]
    const err = rec.ConfigManagerErrorCode ?? 0
    const svc = rec.Service ?? ''
    const kids = children.filter((c) => c.pid === pid)
    let driver: Probe['driver'] = 'unknown'
    if (err === 28 || err === 1 || err === 10) driver = 'missing'
    else if (GOOD_SERVICES.test(svc) || kids.some((k) => GOOD_SERVICES.test(k.rec.Service ?? ''))) driver = 'ok'
    else if (svc && !/^usbccgp$/i.test(svc)) driver = 'missing'
    else if (/^usbccgp$/i.test(svc) && kids.length && kids.every((k) => (k.rec.ConfigManagerErrorCode ?? 0) !== 0)) driver = 'missing'
    return { id: serial ?? `stlink-${pid}-${i}`, kind: 'stlink', name: info.model, serial, driver, vcp: info.vcp }
  })
}

const PS_CMD = "Get-CimInstance Win32_PnPEntity -Filter \"PNPDeviceID LIKE 'USB\\\\VID_0483%'\" | Select-Object PNPDeviceID,Name,Status,ConfigManagerErrorCode,Service | ConvertTo-Json -Compress"

/** Живое перечисление (Windows). Ничего не пишет и не открывает устройства. Подмена для тестов: AVRIDE_PRO_PROBES (JSON-массив Probe). */
export function listStLinks(): Promise<Probe[]> {
  const fake = process.env['AVRIDE_PRO_PROBES']
  if (fake !== undefined) {
    try { const a = JSON.parse(fake) as Probe[]; return Promise.resolve(Array.isArray(a) ? a : []) } catch { return Promise.resolve([]) }
  }
  if (process.platform !== 'win32') return Promise.resolve([])
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', PS_CMD], { windowsHide: true, timeout: 15000, maxBuffer: 1 << 20 }, (err, stdout) => {
      resolve(err ? [] : parsePnp(stdout))
    })
  })
}
