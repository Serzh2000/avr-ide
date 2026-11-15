import type { ReactNode } from 'react'

const KEYWORDS = new Set([
  'void', 'int', 'float', 'bool', 'if', 'else', 'return', 'static', 'const', 'inline', 'uint8_t', 'uint16_t', 'uint32_t', 'int8_t',
  'true', 'false', 'while', 'for', 'String', 'char', 'long', 'unsigned', 'define', 'include', 'pragma', 'once', 'nullptr', 'new'
])

const TOKEN = /(\/\/[^\n]*)|("(?:[^"\\]|\\.)*")|(\b\d+(?:\.\d+)?[fFuUlL]*\b)|(#\s*\w+)|(\b[A-Za-z_]\w*\b)|(\s+)|(.)/g

/** Упрощённая подсветка C++ (комментарии, строки, числа, ключевые слова, вызовы). */
export function highlightLine(line: string): ReactNode[] {
  const out: ReactNode[] = []
  let i = 0
  TOKEN.lastIndex = 0
  for (let m = TOKEN.exec(line); m; m = TOKEN.exec(line)) {
    const t = m[0]
    if (m[1]) out.push(<span key={i++} className="hl-c">{t}</span>)
    else if (m[2]) out.push(<span key={i++} className="hl-s">{t}</span>)
    else if (m[3]) out.push(<span key={i++} className="hl-n">{t}</span>)
    else if (m[4]) out.push(<span key={i++} className="hl-k">{t}</span>)
    else if (m[5]) {
      if (KEYWORDS.has(t)) out.push(<span key={i++} className="hl-k">{t}</span>)
      else if (/^[A-Z][A-Za-z]*$/.test(t) && (t === 'ESPUI' || t === 'Control' || t === 'ControlType' || t === 'ControlColor' || t === 'WiFi' || t === 'Serial'))
        out.push(<span key={i++} className="hl-t">{t}</span>)
      else if (line[m.index + t.length] === '(') out.push(<span key={i++} className="hl-f">{t}</span>)
      else out.push(t)
    } else out.push(t)
  }
  return out
}
