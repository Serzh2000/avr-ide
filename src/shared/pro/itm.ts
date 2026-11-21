// Разбор потока ITM/SWO (ARMv7-M, «CoreSight»): чистые функции без Electron и Node, покрыты юнит-тестами на фикстурах.
// Формат пакетов — Arm Architecture Reference Manual ARMv7-M (DDI 0403), приложение «Debug ITM and DWT packet protocol»:
//   заголовок 0x00 — синхронизация (серия нулевых байт, заканчивается 0x80);
//   0x70 — переполнение (OVERFLOW): часть пакетов потеряна, потому что SWO не успевал;
//   0b0TTT0000 (TTT не 000 и не 111) — локальная метка времени, формат 2 (один байт);
//   0b11TT0000 — локальная метка времени, формат 1 (далее 1-4 байта по 7 бит, старший бит — «продолжение»);
//   0x94 и 0xB4 — глобальные метки времени 1 и 2 (далее байты с битом продолжения);
//   нижние два бита (SS) не 00 — пакет-источник: SS=01 — 1 байт данных, 10 — 2, 11 — 4; бит 2 = 0 — ITM (SWIT), адрес порта — биты 7:3;
//   бит 2 = 1 — аппаратный источник DWT (событие, исключение, PC); их полезная нагрузка пропускается, но считается.
// Другие протокольные заголовки с битом «продолжение» (расширения) пропускаются вместе с продолжением.

export type ItmEvent =
  | { type: 'swit'; port: number; data: Uint8Array }
  | { type: 'overflow' }
  | { type: 'timestamp'; ticks: number; kind: 'local' | 'global' }
  | { type: 'hw'; source: number; data: Uint8Array }
  | { type: 'sync' }

type Wait = { kind: 'none' } | { kind: 'payload'; need: number; got: number[]; src: number; hw: boolean; port: number } | { kind: 'cont'; header: number; got: number[] } | { kind: 'sync' }

/**
 * Накопительный разборщик: байты можно подавать кусками любого размера (граница пакета в куске не обязана совпадать с границей данных).
 */
export class ItmParser {
  private st: Wait = { kind: 'none' }

  push(chunk: Uint8Array): ItmEvent[] {
    const out: ItmEvent[] = []
    for (const b of chunk) this.byte(b, out)
    return out
  }

  /** Сброс состояния (после переподключения). */
  reset(): void { this.st = { kind: 'none' } }

  private byte(b: number, out: ItmEvent[]): void {
    const st = this.st
    if (st.kind === 'sync') {
      if (b === 0x00) return
      this.st = { kind: 'none' }
      if (b === 0x80) { out.push({ type: 'sync' }); return }
      // в «синхронизации» встретился другой байт: потеряли границу, разбираем его как заголовок
    } else if (st.kind === 'payload') {
      st.got.push(b)
      if (st.got.length === st.need) {
        const data = Uint8Array.from(st.got)
        out.push(st.hw ? { type: 'hw', source: st.src, data } : { type: 'swit', port: st.port, data })
        this.st = { kind: 'none' }
      }
      return
    } else if (st.kind === 'cont') {
      st.got.push(b & 0x7f)
      if (!(b & 0x80) || st.got.length >= 4) {
        const h = st.header
        const kind = h === 0x94 || h === 0xb4 ? 'global' : 'local'
        if (kind === 'global' || (h & 0x0f) === 0) {
          // значение: младшие 7 бит первыми
          let v = 0
          st.got.forEach((x, i) => { v += x * 2 ** (7 * i) })
          if ((h & 0x0f) === 0 || h === 0x94 || h === 0xb4) out.push({ type: 'timestamp', ticks: v, kind })
        }
        this.st = { kind: 'none' }
      }
      return
    }
    this.header(b, out)
  }

  private header(b: number, out: ItmEvent[]): void {
    if (b === 0x00) { this.st = { kind: 'sync' }; return }
    if (b === 0x70) { out.push({ type: 'overflow' }); return }
    const ss = b & 0x03
    if (ss !== 0) {
      const need = ss === 1 ? 1 : ss === 2 ? 2 : 4
      const hw = (b & 0x04) !== 0
      this.st = { kind: 'payload', need, got: [], src: b >> 3, hw, port: b >> 3 }
      return
    }
    // протокольные пакеты (SS = 00)
    if ((b & 0x0f) === 0x00) {
      if (b & 0x80) { // 0b11TT0000 — формат 1 (если C=1); 0x80 сам — конец синхронизации без начала: пропускаем
        if (b === 0x80) { out.push({ type: 'sync' }); return }
        this.st = { kind: 'cont', header: b, got: [] }
        return
      }
      const ts = (b >> 4) & 0x07
      if (ts !== 0 && ts !== 7) { out.push({ type: 'timestamp', ticks: ts, kind: 'local' }); return }
      return
    }
    if (b === 0x94 || b === 0xb4) { this.st = { kind: 'cont', header: b, got: [] }; return }
    if (b & 0x80) { this.st = { kind: 'cont', header: b, got: [] } } // расширение с продолжением: пропуск
  }
}

/** Разбирает байты целиком (для тестов и коротких фрагментов). */
export function parseItm(bytes: Uint8Array): ItmEvent[] { return new ItmParser().push(bytes) }

export interface ItmStats { bytes: number; packets: number; overflows: number; timestamps: number; hw: number; ports: Record<number, number> }

/** Собирает текст порта (обычно 0: printf через ITM_SendChar) из событий; многобайтные символы UTF-8, разорванные границей, дописываются при следующем вызове. */
export class ItmText {
  private readonly dec = new TextDecoder('utf-8')
  readonly stats: ItmStats = { bytes: 0, packets: 0, overflows: 0, timestamps: 0, hw: 0, ports: {} }

  private readonly port: number
  constructor(port = 0) { this.port = port }

  /** Возвращает новый текст выбранного порта; статистику ведёт по всем. */
  feed(events: ItmEvent[]): string {
    let text = ''
    for (const e of events) {
      if (e.type === 'swit') {
        this.stats.packets++
        this.stats.bytes += e.data.length
        this.stats.ports[e.port] = (this.stats.ports[e.port] ?? 0) + e.data.length
        if (e.port === this.port) text += this.dec.decode(e.data, { stream: true })
      } else if (e.type === 'overflow') this.stats.overflows++
      else if (e.type === 'timestamp') this.stats.timestamps++
      else if (e.type === 'hw') this.stats.hw++
    }
    return text
  }
}
