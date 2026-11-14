// Vite-импорты `?raw` (текст файла как строка). vite/client уже объявляет это, но фиксируем явно для папки preview.
declare module '*?raw' {
  const content: string
  export default content
}
