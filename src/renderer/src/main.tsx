import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { useBuild } from './build/useBuild'
import { useUi } from './shell/ui'
import './styles.css'

createRoot(document.getElementById('root')!).render(<App />)

// Доступ к хранилищам для e2e-сценариев (имитация состояний сборки, уведомлений). В работе приложения не используется.
;(window as unknown as Record<string, unknown>).__avrStores = { useBuild, useUi }
