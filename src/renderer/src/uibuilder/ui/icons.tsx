import type { ReactNode } from 'react'
import type { WidgetType } from '../core/index'

/** Набор простых линейных иконок 24×24 (stroke = currentColor). */
const PATHS: Record<string, ReactNode> = {
  // элементы
  label: (
    <>
      <path d="M4 7h16M4 12h10" />
      <path d="M4 17h6" opacity=".5" />
    </>
  ),
  button: (
    <>
      <rect x="3" y="8" width="18" height="8" rx="3" />
      <path d="M9 12h6" />
    </>
  ),
  switcher: (
    <>
      <rect x="3" y="8" width="18" height="8" rx="4" />
      <circle cx="16" cy="12" r="2" fill="currentColor" />
    </>
  ),
  slider: (
    <>
      <path d="M3 12h18" />
      <circle cx="9" cy="12" r="2.5" fill="currentColor" />
    </>
  ),
  number: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M9 10v4M12 10v4M15 10v4" opacity=".6" />
    </>
  ),
  text: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10h6M7 14h3" />
    </>
  ),
  password: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="8" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="16" cy="12" r="1" fill="currentColor" />
    </>
  ),
  select: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M14 11l2 2 2-2" />
    </>
  ),
  graph: (
    <>
      <path d="M4 5v14h16" />
      <path d="M7 15l4-5 3 3 4-6" />
    </>
  ),
  pad: (
    <>
      <path d="M12 3l3 4h-6zM12 21l3-4h-6zM3 12l4-3v6zM21 12l-4-3v6z" />
    </>
  ),
  padCenter: (
    <>
      <path d="M12 3l3 4h-6zM12 21l3-4h-6zM3 12l4-3v6zM21 12l-4-3v6z" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
  time: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  fileDisplay: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M10 12h5M10 16h5" />
    </>
  ),
  accel: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M11 18h2" />
    </>
  ),
  separator: (
    <>
      <path d="M3 12h18" />
      <path d="M8 7h8M8 17h8" opacity=".4" />
    </>
  ),
  // интерфейс
  undo: (
    <>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a6 6 0 010 12h-3" />
    </>
  ),
  redo: (
    <>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H10a6 6 0 000 12h3" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
    </>
  ),
  pin: (
    <>
      <circle cx="12" cy="10" r="3" />
      <path d="M12 21c4-5 6-8 6-11a6 6 0 00-12 0c0 3 2 6 6 11z" />
    </>
  ),
  func: (
    <>
      <path d="M9 4C6 4 7 8 7 12s-1 8 2 8" />
      <path d="M15 4c3 0 2 4 2 8s1 8-2 8" />
    </>
  ),
  warn: (
    <>
      <path d="M12 3l10 18H2z" />
      <path d="M12 10v5M12 18v.5" />
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 16v.5" />
    </>
  ),
  ok: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-6" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M10 7V4h4v3M6 7l1 13h10l1-13" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </>
  ),
  chevron: <path d="M7 10l5 5 5-5" />,
  chevronRight: <path d="M10 7l5 5-5 5" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  code: (
    <>
      <path d="M8 8l-5 4 5 4" />
      <path d="M16 8l5 4-5 4" />
      <path d="M14 5l-4 14" />
    </>
  ),
  play: <path d="M8 5v14l11-7z" />,
  edit: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" />
    </>
  ),
  up: <path d="M7 14l5-5 5 5" />,
  down: <path d="M7 10l5 5 5-5" />,
  left: <path d="M14 7l-5 5 5 5" />,
  right: <path d="M10 7l5 5-5 5" />,
  doc: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h4" />
    </>
  ),
  insert: (
    <>
      <path d="M12 4v11M7 11l5 5 5-5" />
      <path d="M5 20h14" />
    </>
  ),
  tab: (
    <>
      <path d="M3 8h6l1.5-3h8.5v14H3z" />
    </>
  ),
  bulb: (
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 00-4 10.5c.7.8 1 1.5 1 2.5h6c0-1 .3-1.7 1-2.5A6 6 0 0012 3z" />
    </>
  ),
  eyeoff: (
    <>
      <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" />
      <path d="M4 4l16 16" />
    </>
  )
}

export function Icon({ name, size = 16, className }: { name: string; size?: number; className?: string }): ReactNode {
  return (
    <svg
      className={`uib-ico${className ? ' ' + className : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name] ?? PATHS.label}
    </svg>
  )
}

export function WidgetIcon({ type, size = 18 }: { type: WidgetType; size?: number }): ReactNode {
  return <Icon name={type} size={size} />
}
