// Только для визуальной проверки UI в браузере: подставляет заглушку window.api из web-stub/stub.js
import { readFileSync } from 'fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'src/renderer',
  plugins: [
    react(),
    {
      name: 'stub',
      transformIndexHtml: () => [{ tag: 'script', children: readFileSync('web-stub/stub.js', 'utf8'), injectTo: 'head-prepend' }]
    }
  ],
  server: { port: 5199 }
})
