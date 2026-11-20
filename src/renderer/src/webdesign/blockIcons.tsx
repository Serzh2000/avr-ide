import type { ReactNode } from 'react'
import type { BlockType } from './core/index'

/** Единый набор значков типов блоков (24x24, штрих currentColor) — для палитры и дерева «Структура». */
const P: Record<BlockType, ReactNode> = {
  section: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9h18" /></>,
  grid: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>,
  flex: <><rect x="3" y="7" width="7" height="10" rx="1.5" /><rect x="14" y="7" width="7" height="10" rx="1.5" /><path d="M11 12h2" /></>,
  card: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 9h8M8 13h5" /></>,
  heading: <path d="M6 5v14M18 5v14M6 12h12" />,
  text: <path d="M4 7h16M4 12h16M4 17h10" />,
  icon: <path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.7 1.1-6.1L3.2 9.4l6.1-.8z" />,
  image: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m4 18 5-5 4 4 3-3 4 4" /></>,
  divider: <path d="M3 12h18M3 9v6M21 9v6" />,
  button: <><rect x="3" y="8" width="18" height="8" rx="3" /><path d="M9 12h6" /></>,
  switch: <><rect x="3" y="8" width="18" height="8" rx="4" /><circle cx="16" cy="12" r="2" fill="currentColor" /></>,
  slider: <><path d="M3 12h18" /><circle cx="9" cy="12" r="2.6" fill="currentColor" /></>,
  input: <><rect x="3" y="7" width="18" height="10" rx="2" /><path d="M7 10.5v3" /></>,
  color: <><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" /></>,
  sensor: <path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0zM12 9v7" />,
  indicator: <><circle cx="12" cy="12" r="3.5" fill="currentColor" /><circle cx="12" cy="12" r="8" /></>,
  gauge: <><path d="M4.5 17a8 8 0 1 1 15 0" /><path d="m12 14 3.5-4.5" /></>,
  progress: <><rect x="3" y="9" width="18" height="6" rx="3" /><path d="M6 12h6" /></>,
  chart: <path d="M3 4v16h18M7 15l4-5 3 3 5-6" />,
  select: <><rect x="3" y="7" width="18" height="10" rx="2" /><path d="m14.5 11 2 2 2-2" /></>,
  checkbox: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8 12 3 3 5-6" /></>,
  radio: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" fill="currentColor" /></>,
  textarea: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9h10M7 13h10M7 17h5" /></>,
  log: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m7 10 3 2-3 2M12 15h5" /></>,
  navbar: <><rect x="3" y="5" width="18" height="6" rx="2" /><path d="M7 8h2M12 8h2M17 8h1" /><path d="M3 15h18M3 19h12" opacity=".4" /></>,
  footer: <><path d="M3 5h18M3 9h12" opacity=".4" /><rect x="3" y="13" width="18" height="6" rx="2" /></>,
  tabs: <><path d="M3 9h5V6h6v3h7v10H3z" /></>,
  accordion: <><rect x="3" y="4" width="18" height="6" rx="1.5" /><rect x="3" y="14" width="18" height="6" rx="1.5" /><path d="m16 7 1.5 1.5L19 7" /></>,
  panel: <rect x="4" y="5" width="16" height="14" rx="1.5" />,
  table: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M3 14.5h18M10 5v14" /></>,
  list: <path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1" />,
  badge: <><rect x="3" y="8" width="18" height="8" rx="4" /><circle cx="8" cy="12" r="1.2" fill="currentColor" /></>,
  modal: <><rect x="2.5" y="4" width="19" height="16" rx="2" opacity=".4" /><rect x="6" y="7" width="12" height="10" rx="1.5" /></>,
  pad: <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></>,
  custom: <path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 6l-3 12" />,
  wifisetup: <><path d="M3 9a13 13 0 0 1 18 0M6 12.5a8.5 8.5 0 0 1 12 0M9 16a4 4 0 0 1 6 0" /><circle cx="12" cy="19" r=".8" fill="currentColor" /></>,
  ota: <path d="M12 16V4M7 9l5-5 5 5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
}

export function BlockIcon({ type, size = 16 }: { type: BlockType; size?: number }): ReactNode {
  return (
    <svg className="wd-bic" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {P[type] ?? <rect x="5" y="5" width="14" height="14" rx="2" />}
    </svg>
  )
}

export { MiniIcon } from '../shell/MiniIcon'
