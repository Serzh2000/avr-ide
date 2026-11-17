// Значки интерфейса: встроенные SVG (без внешних ресурсов), штриховой стиль 24x24.
import type { CSSProperties, ReactNode } from 'react'

const P: Record<string, string> = {
  files: 'M15 2H9a2 2 0 0 0-2 2v2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-2h3a2 2 0 0 0 2-2V8zM15 2v6h6M7 6h2M7 11v0',
  library: 'M4 3v18M9 3v18M14 5.5l5 15M3 21h18',
  board: 'M7 7h10v10H7zM9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3M10 10h4v4h-4z',
  book: 'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20',
  layout: 'M3 4h18v16H3zM3 9h18M9 20V9',
  web: 'M3 4h18v16H3zM3 9h18M6.5 6.5h.01M9.5 6.5h.01M7 14l2 2-2 2M12 18h4',
  gear:
    'M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7V20a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  check: 'M20 6 9 17l-5-5',
  arrow: 'M5 12h14M12 5l7 7-7 7',
  x: 'M18 6 6 18M6 6l12 12',
  plus: 'M12 5v14M5 12h14',
  chevR: 'm9 18 6-6-6-6',
  chevD: 'm6 9 6 6 6-6',
  refresh: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
  search: 'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM21 21l-4.3-4.3',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
  filePlus: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M12 18v-6M9 15h6',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  folderOpen: 'M3 19V6a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v2M3 19l2.5-8H22l-2.5 8a2 2 0 0 1-2 1.5H5',
  folderPlus: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 10v6M9 13h6',
  trash: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6',
  save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8',
  terminal: 'm4 17 6-6-6-6M12 19h8',
  error: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM15 9l-6 6M9 9l6 6',
  warn: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
  info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 16v-4M12 8h.01',
  stop: 'M6 6h12v12H6z',
  panelBottom: 'M3 3h18v18H3zM3 15h18',
  sidebar: 'M3 3h18v18H3zM9 3v18',
  command: 'M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3',
  plug: 'M12 22v-5M9 8V2M15 8V2M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8z',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  copy: 'M9 9h11v11H9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  collapse: 'M3 3h18v18H3zM8 12h8',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  external: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3',
  zap: 'M13 2 3 14h9l-1 8 10-12h-9z',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  home: 'm3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  code: 'm16 18 6-6-6-6M8 6l-6 6 6 6',
  chart: 'M3 3v18h18M7 15l4-5 4 3 5-7',
  replace: 'M3 7h13l-3-3M21 17H8l3 3M3 7v3M21 17v-3',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6'
}

export type IconName = keyof typeof P

export function Icon({ name, size = 16, style, fill }: { name: IconName; size?: number; style?: CSSProperties; fill?: boolean }): ReactNode {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true" focusable="false"
    >
      <path d={P[name]} />
    </svg>
  )
}

const FILE_KINDS: Record<string, { glyph: string; color: string }> = {
  ino: { glyph: '∞', color: 'var(--ft-ino)' },
  h: { glyph: 'H', color: 'var(--ft-h)' },
  hpp: { glyph: 'H', color: 'var(--ft-h)' },
  c: { glyph: 'C', color: 'var(--ft-c)' },
  cpp: { glyph: 'C+', color: 'var(--ft-c)' },
  json: { glyph: '{}', color: 'var(--ft-json)' },
  html: { glyph: '<>', color: 'var(--ft-html)' },
  css: { glyph: '#', color: 'var(--ft-c)' },
  js: { glyph: 'JS', color: 'var(--ft-js)' },
  md: { glyph: 'M', color: 'var(--ft-md)' },
  txt: { glyph: '≡', color: 'var(--ft-md)' }
}

/** Значок файла по расширению. */
export function FileIcon({ name }: { name: string }): ReactNode {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  const k = FILE_KINDS[ext]
  if (!k) return <span className="fi"><Icon name="file" size={14} /></span>
  return <span className="fi fi-glyph" style={{ color: k.color }}>{k.glyph}</span>
}
