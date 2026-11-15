// Скачивание по HTTPS встроенным fetch Node с лимитом размера, таймаутом и понятными ошибками.
// Токен GitHub (если задан) добавляется только в заголовок запросов к api.github.com и никогда не пишется в логи.

export class NetError extends Error {
  status?: number
  rateLimited?: boolean
  constructor(message: string, status?: number, rateLimited?: boolean) {
    super(message)
    this.status = status
    this.rateLimited = rateLimited
  }
}

export interface FetchOpts {
  maxBytes: number
  headers?: Record<string, string>
  signal?: AbortSignal
  timeoutMs?: number
  onProgress?: (got: number, total: number | null) => void
}

const fmtMb = (n: number): string => (n / 1048576).toFixed(n >= 10485760 ? 0 : 1) + ' МБ'

function rateLimitMessage(res: Response): string {
  const reset = Number(res.headers.get('x-ratelimit-reset'))
  const when = Number.isFinite(reset) && reset > 0 ? ` Лимит сбросится около ${new Date(reset * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}.` : ''
  return 'Лимит запросов к GitHub исчерпан (без токена — 60 запросов в час).' + when + ' Подождите или укажите токен GitHub в настройках источника.'
}

export async function fetchBuffer(url: string, o: FetchOpts): Promise<Buffer> {
  const timeout = AbortSignal.timeout(o.timeoutMs ?? 120_000)
  const signal = o.signal ? AbortSignal.any([o.signal, timeout]) : timeout
  let res: Response
  try {
    res = await fetch(url, { headers: { 'User-Agent': 'AVR-IDE', ...o.headers }, signal, redirect: 'follow' })
  } catch (e) {
    if (o.signal?.aborted) throw new NetError('Отменено.')
    if (timeout.aborted) throw new NetError('Превышено время ожидания ответа сервера.')
    throw new NetError(`Нет соединения с ${new URL(url).hostname}. Проверьте интернет.`)
  }
  if (!res.ok) {
    void res.body?.cancel().catch(() => undefined)
    if ((res.status === 403 || res.status === 429) && (res.headers.get('x-ratelimit-remaining') === '0' || res.status === 429)) {
      throw new NetError(rateLimitMessage(res), res.status, true)
    }
    if (res.status === 404) throw new NetError('Не найдено на сервере (404): репозиторий, тег или ветка не существует либо репозиторий приватный.', 404)
    throw new NetError(`Сервер ответил ошибкой ${res.status}.`, res.status)
  }
  const len = Number(res.headers.get('content-length'))
  const total = Number.isFinite(len) && len > 0 ? len : null
  if (total && total > o.maxBytes) {
    void res.body?.cancel().catch(() => undefined)
    throw new NetError(`Файл слишком большой (${fmtMb(total)}), допустимо не более ${fmtMb(o.maxBytes)}.`)
  }
  const chunks: Buffer[] = []
  let got = 0
  try {
    const reader = res.body!.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      got += value.length
      if (got > o.maxBytes) {
        void reader.cancel().catch(() => undefined)
        throw new NetError(`Файл слишком большой (больше ${fmtMb(o.maxBytes)}), загрузка прервана.`)
      }
      chunks.push(Buffer.from(value))
      o.onProgress?.(got, total)
    }
  } catch (e) {
    if (e instanceof NetError) throw e
    if (o.signal?.aborted) throw new NetError('Отменено.')
    if (timeout.aborted) throw new NetError('Превышено время ожидания ответа сервера.')
    throw new NetError('Соединение прервано во время загрузки.')
  }
  return Buffer.concat(chunks)
}
