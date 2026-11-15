// Чистая логика стартового экрана: подписи даты и платы в списке недавних.

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const two = (n: number): string => String(n).padStart(2, '0')

/** «сегодня, 14:05», «вчера», «12 ноя», «3 мар 2025». */
export function formatWhen(ts: number, now: Date = new Date()): string {
  const d = new Date(ts)
  const day = (x: Date): number => Math.floor(new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime() / 86400000)
  const diff = day(now) - day(d)
  if (diff === 0) return `сегодня, ${two(d.getHours())}:${two(d.getMinutes())}`
  if (diff === 1) return 'вчера'
  if (diff > 1 && diff < 7) return `${diff} дн. назад`
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`
}

/** Короткое название платы для списка: известное имя или хвост FQBN. */
export function shortBoard(fqbn: string | undefined, nameOf: (fqbn: string) => string | undefined): string {
  if (!fqbn) return ''
  return nameOf(fqbn) ?? fqbn.split(':').slice(2).join(':')
}

/** Путь, сокращённый в середине: важны диск и последние папки. */
export function midEllipsis(path: string, max = 58): string {
  if (path.length <= max) return path
  const head = Math.ceil((max - 1) * 0.3)
  const tail = max - 1 - head
  return path.slice(0, head) + '…' + path.slice(path.length - tail)
}
