import type { ReactNode } from 'react'

/** Мелкие значки действий панели «Структура». */
export function MiniIcon({ name }: { name: 'up' | 'down' | 'indent' | 'outdent' | 'copy' | 'trash' | 'chev' | 'collapse' | 'expand' | 'search' | 'x' | 'grip' }): ReactNode {
  const paths: Record<string, ReactNode> = {
    up: <path d="m6 15 6-6 6 6" />,
    down: <path d="m6 9 6 6 6-6" />,
    indent: <path d="M4 6h16M10 12h10M4 18h16M4 9l3 3-3 3" />,
    outdent: <path d="M4 6h16M10 12h10M4 18h16M7 9l-3 3 3 3" />,
    copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></>,
    trash: <path d="M4 7h16M18 7v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7M9 7V4h6v3M10 11v6M14 11v6" />,
    chev: <path d="m9 6 6 6-6 6" />,
    collapse: <path d="m15 6-6 6 6 6M19 4v16" />,
    expand: <path d="m9 6 6 6-6 6M5 4v16" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
    x: <path d="M18 6 6 18M6 6l12 12" />,
    grip: <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" strokeWidth={2.6} />
  }
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  )
}
