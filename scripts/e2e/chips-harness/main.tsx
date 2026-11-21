// Временная страница для scripts/e2e/probe-chips.mjs: ChipsView отдельно от оболочки приложения.
import { createRoot } from 'react-dom/client'
import ChipsView from '../../../src/renderer/src/pro/ChipsView'
import '../../../src/renderer/src/styles.css'

const q = new URLSearchParams(location.search)
document.documentElement.dataset.theme = q.get('theme') === 'light' ? 'light' : 'dark'
createRoot(document.getElementById('root')!).render(<ChipsView initialChip={q.get('chip') ?? undefined} onOpenBoard={() => undefined} />)
