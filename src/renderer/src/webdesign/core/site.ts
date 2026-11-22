// Сборка сайта: html / css / js / bundle (один файл) и страница для превью в редакторе.
import { generateCss } from './css'
import { generateHtml } from './html'
import { generateJs } from './js'
import { PREVIEW_BRIDGE, buildMockScript } from './mock'
import type { Block, SiteOutput, WdProject } from './types'

function standaloneProject(project: WdProject): WdProject {
  const pageBlocks = (blocks: Block[]): Block[] => blocks
    .filter((block) => block.type !== 'ota' && block.type !== 'wifisetup')
    .map((block) => ({ ...block, binding: { kind: 'none' }, children: pageBlocks(block.children) }))
  return { ...project, page: { ...project.page, showStatus: false }, blocks: pageBlocks(project.blocks) }
}

export function generateSite(p: WdProject, standalone = false): SiteOutput {
  if (standalone) p = standaloneProject(p)
  const css = generateCss(p)
  const js = generateJs(p, standalone)
  return {
    html: generateHtml(p),
    css,
    js,
    bundle: generateHtml(p, { inline: { css, js } })
  }
}

/** Документ для srcdoc-превью: бандл + мок WebSocket + мост выбора блоков. Не для прошивки. */
export function buildPreviewHtml(p: WdProject, standalone = false): string {
  if (standalone) p = standaloneProject(p)
  return generateHtml(p, {
    inline: { css: generateCss(p), js: generateJs(p, standalone) },
    preview: true,
    beforeScript: standalone ? undefined : buildMockScript(p),
    afterScript: PREVIEW_BRIDGE
  })
}
