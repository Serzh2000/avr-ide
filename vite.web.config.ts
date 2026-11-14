// Только для визуальной проверки UI в браузере: подставляет заглушку window.api
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const stub = `window.api = new Proxy({}, { get: (_t, k) => k === 'cli' || k === 'monitor'
  ? new Proxy({}, { get: (_t2, m) => (m.startsWith('on') ? () => () => {} : async () => (m === 'status' ? { found: false, help: 'arduino-cli не найден (заглушка)' } : [])) })
  : async () => null })`

export default defineConfig({
  root: 'src/renderer',
  plugins: [react(), { name: 'stub', transformIndexHtml: () => [{ tag: 'script', children: stub, injectTo: 'head-prepend' }] }],
  server: { port: 5199 }
})
