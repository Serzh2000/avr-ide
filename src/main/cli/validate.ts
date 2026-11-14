// Валидация входных строк перед передачей в arduino-cli.
// Аргументы всё равно идут массивом (без shell), но строгие регулярки защищают
// от подстановки флагов (начало с «-») и странных значений.

const FQBN_RE = /^[A-Za-z0-9_][A-Za-z0-9_.-]*:[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+(:[A-Za-z0-9_.=,-]+)?$/
const PORT_RE = /^(COM\d{1,3}|\/dev\/[A-Za-z0-9_.-]{1,60}|\d{1,3}(\.\d{1,3}){3}(:\d{1,5})?)$/
const CORE_RE = /^[A-Za-z0-9_][A-Za-z0-9_.-]*:[A-Za-z0-9_.-]+(@[A-Za-z0-9_.+-]+)?$/
const LIB_RE = /^[A-Za-z0-9][A-Za-z0-9_ .+-]{0,99}(@[A-Za-z0-9_.+-]+)?$/
const QUERY_RE = /^[A-Za-z0-9_ .+:-]{0,100}$/
const URL_RE = /^https?:\/\/[A-Za-z0-9._~:/?#@!$&'()*+,;=%-]{1,300}$/
export const BAUDS = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 74880, 115200, 230400, 250000, 460800, 921600, 1000000, 2000000]

export const isFqbn = (s: unknown): s is string => typeof s === 'string' && FQBN_RE.test(s)
export const isPort = (s: unknown): s is string => typeof s === 'string' && PORT_RE.test(s)
export const isCoreId = (s: unknown): s is string => typeof s === 'string' && CORE_RE.test(s)
export const isLibName = (s: unknown): s is string => typeof s === 'string' && LIB_RE.test(s)
export const isQuery = (s: unknown): s is string => typeof s === 'string' && QUERY_RE.test(s) && !s.trimStart().startsWith('-')
export const isUrl = (s: unknown): s is string => typeof s === 'string' && URL_RE.test(s)
export const isBaud = (n: unknown): n is number => typeof n === 'number' && BAUDS.includes(n)
