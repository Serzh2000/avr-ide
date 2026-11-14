// Сборка сайта: html / css / js / bundle (один файл) и страница для превью в редакторе.
import { generateCss } from './css'
import { generateHtml } from './html'
import { generateJs } from './js'
import { PREVIEW_BRIDGE, buildMockScript } from './mock'
import type { SiteOutput, WdProject } from './types'

export function generateSite(p: WdProject): SiteOutput {
  const css = generateCss(p)
  const js = generateJs(p)
  return {
    html: generateHtml(p),
    css,
    js,
    bundle: generateHtml(p, { inline: { css, js } })
  }
}

/** Документ для srcdoc-превью: бандл + мок WebSocket + мост выбора блоков. Не для прошивки. */
export function buildPreviewHtml(p: WdProject): string {
  return generateHtml(p, {
    inline: { css: generateCss(p), js: generateJs(p) },
    preview: true,
    beforeScript: buildMockScript(p),
    afterScript: PREVIEW_BRIDGE
  })
}
