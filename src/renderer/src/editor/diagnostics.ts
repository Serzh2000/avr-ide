// Лёгкие локальные проверки без компилятора. Только очевидное, чтобы не было ложных срабатываний.
import type { EditorMarker } from '../contracts'
import type { EditorPlatform } from './types'
import { posAt, scan } from './scan'

export interface LocalCheckOptions {
  /** Платформа, выбранная пользователем (для проверки #include). null — неизвестна. */
  platform?: EditorPlatform | null
  /** Платформа выбранная или определённая по тексту (для проверки delay). */
  effectivePlatform?: EditorPlatform | null
}

const isEsp = (p: EditorPlatform | null | undefined): boolean => !!p && p.startsWith('esp')

const mk = (text: string, start: number, end: number, severity: EditorMarker['severity'], message: string): EditorMarker => {
  const a = posAt(text, start)
  const b = posAt(text, Math.max(end, start + 1))
  return { startLine: a.line, startColumn: a.column, endLine: b.line, endColumn: b.column, severity, message, source: 'проверка' }
}

/** Заголовки, которых нет на указанной платформе. */
const BAD_INCLUDES: { re: RegExp; bad: (p: EditorPlatform) => boolean; hint: string }[] = [
  { re: /^ESP8266(WiFi|WebServer|mDNS|HTTPClient)\.h$/, bad: (p) => p !== 'esp8266', hint: 'это заголовок ESP8266, для ESP32 используйте WiFi.h / WebServer.h / ESPmDNS.h / HTTPClient.h' },
  { re: /^(WebServer|ESPmDNS|HTTPClient|Preferences)\.h$/, bad: (p) => p === 'esp8266' || p === 'avr', hint: 'заголовок есть только в ядре ESP32' },
  { re: /^avr\/.+\.h$/, bad: (p) => p !== 'avr', hint: 'заголовки avr/* есть только на AVR (Uno/Nano/Mega)' }
]

export function runLocalChecks(text: string, opts: LocalCheckOptions = {}): EditorMarker[] {
  const out: EditorMarker[] = []
  if (!text.trim()) return out
  const { masked, problems } = scan(text)
  for (const p of problems) out.push(mk(text, p.start, p.end, p.severity, p.message))

  // delay() с очень большим литералом на ESP
  if (isEsp(opts.effectivePlatform)) {
    const re = /\bdelay\s*\(\s*(\d{4,})\s*\)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(masked))) {
      const ms = Number(m[1])
      if (ms > 3000) out.push(mk(text, m.index, m.index + m[0].length, 'warning', `delay(${ms}) блокирует выполнение на ${Math.round(ms / 100) / 10} с: на ESP в это время не обслуживаются WiFi и сервер, возможен сброс по сторожевому таймеру. Используйте таймер на millis().`))
    }
  }

  // присваивание в условии: if (x = 5)
  {
    const re = /\b(?:if|while)\s*\(\s*[A-Za-z_]\w*\s*=(?!=)\s*[\w.-]+\s*\)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(masked))) {
      const eq = m.index + m[0].indexOf('=')
      out.push(mk(text, eq, eq + 1, 'warning', 'Присваивание «=» в условии. Возможно, нужно сравнение «==».'))
    }
  }

  // Serial.print без Serial.begin (только если в файле есть setup — это основной файл скетча)
  if (/\bvoid\s+setup\s*\(/.test(masked) && /\bSerial\s*\.\s*(print|println|write|printf)\s*\(/.test(masked) && !/\bSerial\s*\.\s*begin\s*\(/.test(masked)) {
    const m = /\bSerial\s*\.\s*(print|println|write|printf)\s*\(/.exec(masked)!
    out.push(mk(text, m.index, m.index + m[0].length - 1, 'info', 'В файле нет Serial.begin(): вывод в Serial не будет работать, пока порт не инициализирован (если begin вызывается в другом файле — игнорируйте).'))
  }

  // заголовки не той платформы
  if (opts.platform) {
    const re = /^[ \t]*(#)[ \t]*include[ \t]*[<"]([^>"\n]+)[>"]/gm
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) {
      const hashAt = m.index + m[0].indexOf('#')
      if (masked[hashAt] !== '#') continue // внутри комментария
      const header = m[2].trim()
      for (const rule of BAD_INCLUDES) {
        if (rule.re.test(header) && rule.bad(opts.platform)) {
          const start = m.index + m[0].indexOf(m[2])
          out.push(mk(text, start, start + m[2].length, 'warning', `Заголовок ${header} не подходит для выбранной платформы: ${rule.hint}.`))
          break
        }
      }
    }
  }
  return out
}
