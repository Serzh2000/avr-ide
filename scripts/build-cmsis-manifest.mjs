// Генератор манифеста «пакета поддержки чипа» Pro-режима: src/main/pro/support/manifest.ts
//   node --import ./src/main/libs/tests/register.mjs scripts/build-cmsis-manifest.mjs
// Для каждого чипа базы (src/shared/pro/chips) выбирает файлы CMSIS из первоисточников ST (Apache-2.0):
//   STMicroelectronics/cmsis_core (теги v5.6.0_cm0/cm3/cm4/cm7/cm33) и STMicroelectronics/cmsis-device-<серия> (теги ниже).
// Запрашивает у GitHub API идентификатор коммита тега и git-деревья, записывает ПУТЬ, РАЗМЕР и git-SHA-1 (blob) каждого файла.
// Приложение скачивает файлы по адресу с неизменяемым коммитом и сверяет git-SHA-1 — подмена содержимого обнаруживается.
// Токен GitHub (GITHUB_TOKEN) необязателен: без него хватает лимита 60 запросов в час.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { listChips } from '../src/shared/pro/chipdb.ts'

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'main', 'pro', 'support', 'manifest.ts')
const TAGS = {
  'cmsis-device-f0': 'v2.3.8', 'cmsis-device-f1': 'v4.3.5', 'cmsis-device-f3': 'v2.3.9', 'cmsis-device-f4': 'v2.6.12',
  'cmsis-device-g4': 'v1.2.6', 'cmsis-device-h7': 'v1.10.8', 'cmsis-device-l0': 'v1.9.4', 'cmsis-device-l1': 'v2.3.4', 'cmsis-device-l4': 'v1.7.5'
}
const CORE_TAGS = { 'cortex-m0': 'v5.6.0_cm0', 'cortex-m0plus': 'v5.6.0_cm0', 'cortex-m3': 'v5.6.0_cm3', 'cortex-m4': 'v5.6.0_cm4', 'cortex-m7': 'v5.6.0_cm7', 'cortex-m33': 'v5.6.0_cm33' }
const CORE_FILES = {
  'cortex-m0': ['core_cm0.h'], 'cortex-m0plus': ['core_cm0plus.h'], 'cortex-m3': ['core_cm3.h', 'mpu_armv7.h'],
  'cortex-m4': ['core_cm4.h', 'mpu_armv7.h'], 'cortex-m7': ['core_cm7.h', 'mpu_armv7.h'], 'cortex-m33': ['core_cm33.h', 'mpu_armv8.h', 'tz_context.h']
}
const CORE_COMMON = ['cmsis_compiler.h', 'cmsis_gcc.h', 'cmsis_version.h']

const headers = { 'User-Agent': 'avr-ide-manifest', Accept: 'application/vnd.github+json', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) }
const api = async (p) => { const r = await fetch('https://api.github.com/' + p, { headers }); if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json() }
const info = {}
async function repoInfo(repo, tag) {
  const k = repo + '@' + tag
  if (info[k]) return info[k]
  const c = await api(`repos/STMicroelectronics/${repo}/commits/${tag}`)
  const t = await api(`repos/STMicroelectronics/${repo}/git/trees/${c.sha}?recursive=1`)
  if (t.truncated) throw new Error('дерево обрезано: ' + k)
  return (info[k] = { commit: c.sha, tree: new Map(t.tree.filter((x) => x.type === 'blob').map((x) => [x.path, x])) })
}
const pick = async (repo, tag, paths) => {
  const i = await repoInfo(repo, tag)
  const lic = [...i.tree.keys()].find((k) => /^licen[cs]e(.(md|txt))?$/i.test(k))
  if (!lic && repo !== 'cmsis_core') throw new Error('нет файла лицензии: ' + repo) // в cmsis_core лицензия — SPDX-заголовки файлов (Apache-2.0)
  if (lic) paths = [...paths, lic]
  return { repo, tag, commit: i.commit, files: paths.map((p) => { const e = i.tree.get(p); if (!e) throw new Error(`нет файла ${repo}@${tag}:${p}`); return { path: p, size: e.size, sha1: e.sha } }) }
}

const chips = listChips()
const devices = {}
const cores = {}
for (const c of chips) {
  const f = c.files
  const fam = /^(stm32[a-z]\d)/.exec(f.header)[1] // stm32f1
  const want = [`Include/${fam}xx.h`, `Include/system_${fam}xx.h`, `Include/${f.header}`, `Source/Templates/system_${fam}xx.c`, `Source/Templates/gcc/${f.startup}`]
  const d = (devices[f.cmsisRepo] ??= { paths: new Set() })
  want.forEach((w) => d.paths.add(w))
  const core = c.core.toLowerCase().replace('cortex-m0+', 'cortex-m0plus')
  cores[core] ??= true
}
const out = { devices: {}, cores: {} }
for (const [repo, d] of Object.entries(devices)) out.devices[repo] = await pick(repo, TAGS[repo], [...d.paths].sort())
for (const core of Object.keys(cores)) {
  const tag = CORE_TAGS[core]
  if (!tag) throw new Error('нет тега для ' + core)
  out.cores[core] = await pick('cmsis_core', tag, [...CORE_COMMON, ...CORE_FILES[core]].map((n) => 'Core/Include/' + n))
}
const text = `// СГЕНЕРИРОВАНО scripts/build-cmsis-manifest.mjs — не править вручную.
// Файлы CMSIS из первоисточников ST (Apache-2.0): адрес = неизменяемый коммит тега, проверка = git-SHA-1 содержимого (blob).
export interface SupportFile { path: string; size: number; sha1: string }
export interface SupportSet { repo: string; tag: string; commit: string; files: SupportFile[] }
export const SUPPORT_DEVICES: Record<string, SupportSet> = ${JSON.stringify(out.devices, null, 1)}
export const SUPPORT_CORES: Record<string, SupportSet> = ${JSON.stringify(out.cores, null, 1)}
`
fs.writeFileSync(OUT, text)
console.log('OK', OUT, Object.keys(out.devices).length, 'device repos', Object.keys(out.cores).length, 'cores')
