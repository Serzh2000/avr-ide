// Перечисление программаторов (ST-Link, J-Link, CMSIS-DAP): список USB-устройств Windows без запуска OpenOCD и без обращения к самим устройствам.
// Разбор ответа PowerShell (Get-CimInstance Win32_PnPEntity ... | ConvertTo-Json) — чистая функция, проверяется на записанных ответах.
// VID/PID и правила распознавания — в shared/pro/programmers.ts (источники указаны там).
import { execFile } from 'child_process'
import type { Probe } from '../interfaces'
import { CMSIS_DAP_IDS, VID, isJlinkPid } from '../../../shared/pro/programmers'
import type { ProgrammerKind } from '../../../shared/pro/programmers'

export const ST_VID = VID.st
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

/** Службы, с которыми libusb/OpenOCD открывает устройство (WinUSB и родственные) и драйверы ST-Link. */
const USB_OK = /^(winusb|libusb|libusbk|libusb0)$/i
const STLINK_OK = /^(stlink|st-?link\w*|stlink_winusb|stlinkv\w*)$/i

interface Entry { prefix: string; vid: string; pid: string; mi?: string; inst: string; rec: PnpRecord }

function parseEntries(recs: PnpRecord[]): Entry[] {
  const out: Entry[] = []
  for (const rec of recs) {
    const m = /^(USB|HID)\\VID_([0-9A-F]{4})&PID_([0-9A-F]{4})(&MI_\d\d)?\\(.+)$/i.exec(rec.PNPDeviceID ?? '')
    if (m) out.push({ prefix: m[1].toUpperCase(), vid: m[2].toUpperCase(), pid: m[3].toUpperCase(), mi: m[4], inst: m[5], rec })
  }
  return out
}

function kindOf(vid: string, pid: string, names: string[]): ProgrammerKind | null {
  if (vid === VID.st && STLINK_PIDS[pid]) return 'stlink'
  if (vid === VID.segger && (isJlinkPid(pid) || names.some((n) => /J-?Link/i.test(n)))) return 'jlink'
  if (CMSIS_DAP_IDS[`${vid}:${pid}`] || names.some((n) => /CMSIS-DAP/i.test(n))) return 'cmsis-dap'
  return null
}

function driverOf(kind: ProgrammerKind, parent: PnpRecord, kids: PnpRecord[]): Probe['driver'] {
  const err = parent.ConfigManagerErrorCode ?? 0
  const svc = parent.Service ?? ''
  if (err === 28 || err === 1 || err === 10) return 'missing'
  const all = [svc, ...kids.map((k) => k.Service ?? '')]
  if (kind === 'stlink') {
    const good = (s: string): boolean => USB_OK.test(s) || STLINK_OK.test(s)
    if (all.some(good)) return 'ok'
    if (svc && !/^usbccgp$/i.test(svc)) return 'missing'
    if (/^usbccgp$/i.test(svc) && kids.length && kids.every((k) => (k.ConfigManagerErrorCode ?? 0) !== 0)) return 'missing'
    return 'unknown'
  }
  if (kind === 'jlink') {
    // OpenOCD открывает J-Link через libusb: нужен WinUSB. Любая другая служба на самом устройстве (драйвер SEGGER) — OpenOCD его не откроет.
    if (all.some((s) => USB_OK.test(s))) return 'ok'
    const other = all.find((s) => s && !/^(usbccgp|usbser|usbhub\w*)$/i.test(s))
    return other ? 'missing' : 'unknown'
  }
  // CMSIS-DAP v1 — HID (драйвера не нужно), v2 — WinUSB
  if (all.some((s) => USB_OK.test(s) || /^hidusb$/i.test(s))) return 'ok'
  return kids.some((k) => (k.ConfigManagerErrorCode ?? 0) !== 0) ? 'missing' : 'unknown'
}

/** Разбирает записи PnP в список программаторов. Дочерние интерфейсы (MI_nn) используются для оценки драйвера и названия. */
export function parsePnp(json: string): Probe[] {
  let raw: unknown
  try { raw = JSON.parse(json.trim() || '[]') } catch { return [] }
  const recs = (Array.isArray(raw) ? raw : [raw]).filter((r): r is PnpRecord => !!r && typeof r === 'object')
  const entries = parseEntries(recs)
  const groups = new Map<string, Entry[]>()
  for (const e of entries) { const k = `${e.vid}:${e.pid}`; groups.set(k, [...(groups.get(k) ?? []), e]) }
  const probes: Probe[] = []
  let idx = 0
  for (const [usbId, list] of groups) {
    const [vid, pid] = usbId.split(':')
    const kind = kindOf(vid, pid, list.map((e) => e.rec.Name ?? ''))
    if (!kind) continue
    const parents = list.filter((e) => e.prefix === 'USB' && !e.mi)
    const kids = list.filter((e) => !(e.prefix === 'USB' && !e.mi)).map((e) => e.rec)
    const make = (parent: PnpRecord | null, serial: string | undefined): Probe => {
      const i = idx++
      let name = ''
      let vcp: boolean | undefined
      if (kind === 'stlink') { name = STLINK_PIDS[pid].model; vcp = STLINK_PIDS[pid].vcp }
      else if (kind === 'jlink') name = 'J-Link'
      else { const k = CMSIS_DAP_IDS[usbId]; name = k ? `${k} (CMSIS-DAP)` : 'CMSIS-DAP' }
      return {
        id: serial ?? `${kind}-${vid}${pid}-${i}`, kind, name, serial, usbId,
        driver: parent ? driverOf(kind, parent, kids) : 'unknown',
        ...(vcp !== undefined ? { vcp } : {})
      }
    }
    if (parents.length) for (const p of parents) probes.push(make(p.rec, /&/.test(p.inst) ? undefined : p.inst.toUpperCase()))
    else if (kind === 'cmsis-dap') probes.push(make(null, undefined)) // HID-интерфейс без родителя в выборке
  }
  return probes
}

const FILTER = [VID.st, VID.segger, VID.arm, VID.rpi].map((v) => `PNPDeviceID LIKE 'USB\\\\VID_${v}%'`).concat("Name LIKE '%CMSIS-DAP%'").join(' OR ')
const PS_CMD = `Get-CimInstance Win32_PnPEntity -Filter "${FILTER}" | Select-Object PNPDeviceID,Name,Status,ConfigManagerErrorCode,Service | ConvertTo-Json -Compress`

/** Живое перечисление (Windows). Ничего не пишет и не открывает устройства. Подмена для тестов: AVRIDE_PRO_PROBES (JSON-массив Probe). */
export function listUsbProbes(): Promise<Probe[]> {
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
export const listStLinks = listUsbProbes
