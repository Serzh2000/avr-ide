// Галерея встроенных шаблонов веб-дизайнера: категории слева сверху, карточки с названием и описанием.
import { useState } from 'react'
import type { ReactNode } from 'react'
import { TEMPLATES, TEMPLATE_CATEGORIES } from './core/index'
import { Button, Dialog } from '../shell/kit'

export default function TemplateGallery({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }): ReactNode {
  const [cat, setCat] = useState<string>('all')
  const list = cat === 'all' ? TEMPLATES : TEMPLATES.filter((t) => t.category === cat)
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <Dialog className="wd-gallery" testid="wd-gallery" title="Шаблоны страниц" icon="web" onClose={onClose}
        footer={<Button onClick={onClose}>Закрыть</Button>}>
        <div className="wd-gallery-cats" role="tablist" aria-label="Категории шаблонов">
          {[{ id: 'all', title: 'Все' }, ...TEMPLATE_CATEGORIES].map((c) => (
            <button key={c.id} role="tab" aria-selected={cat === c.id} className={'wd-gallery-cat' + (cat === c.id ? ' on' : '')} onClick={() => setCat(c.id)}>{c.title}</button>
          ))}
        </div>
        <div className="wd-gallery-grid">
          {list.map((t) => (
            <button key={t.id} className="wd-gallery-item" data-testid="wd-gallery-item" data-id={t.id} onClick={() => onPick(t.id)}>
              <span className="wd-gallery-t">{t.title}</span>
              <span className="wd-gallery-d">{t.description}</span>
            </button>
          ))}
        </div>
        <p className="wd-gallery-note">Шаблон заменяет текущую страницу. Перед заменой IDE спросит подтверждение.</p>
      </Dialog>
    </div>
  )
}
