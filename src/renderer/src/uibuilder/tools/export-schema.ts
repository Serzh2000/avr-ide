import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSchema } from './schema'

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../data/espui/widgets.json')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, buildSchema())
console.log('written', out)
