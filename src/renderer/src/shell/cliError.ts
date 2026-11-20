// Человеческий текст вместо «сырых» ошибок arduino-cli (часто это JSON с английским или смешанным текстом).

/** Достаёт сообщение из JSON вида {"error": "..."} или возвращает текст как есть. */
export function plainCliError(raw: string): string {
  const t = raw.trim()
  if (t.startsWith('{')) {
    try {
      const j = JSON.parse(t) as { error?: unknown }
      if (typeof j.error === 'string') return j.error
    } catch { /* не JSON — оставляем как есть */ }
  }
  return t
}

const NETWORK = /proxyconnect|no such host|dial tcp|connection (?:refused|reset|timed out)|Download failed|i\/o timeout|network is unreachable|TLS handshake|Ошибка скачивания/i

/** Объяснение для пользователя: нет сети — что это значит и что делать; иначе — исходный текст без JSON-обёртки. */
export function friendlyCliError(raw: string): { text: string; details: string } {
  const details = plainCliError(raw)
  if (NETWORK.test(details)) {
    return { text: 'Нет связи с интернетом. Уже установленное работает, а поиск и установка новых библиотек и плат требуют сети. Проверьте подключение и повторите.', details }
  }
  return { text: details, details }
}
