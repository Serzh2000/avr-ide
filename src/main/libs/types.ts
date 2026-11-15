// Типы парсера библиотек проекта. Общие для main (разбор заголовков), preload и renderer.

export type LibSymbolKind = 'function' | 'method' | 'constructor' | 'class' | 'struct' | 'enum' | 'enumValue' | 'macro' | 'constant' | 'typedef' | 'variable'

export interface LibParam {
  type: string
  name: string
  /** Значение по умолчанию, если есть. */
  defaultValue?: string
}

export interface LibSymbol {
  kind: LibSymbolKind
  /** Короткое имя: «begin», «Adafruit_BMP280», «HIGH». */
  name: string
  /** Для методов и констант класса: имя класса или пространства имён. */
  owner?: string
  /** Полная подпись одной строкой: «bool begin(uint8_t addr = 0x77)». */
  signature: string
  returns?: string
  params?: LibParam[]
  /** Описание из комментария рядом (Doxygen /// /** //!, обычные // над объявлением). */
  doc?: string
  /** Заголовочный файл (относительно папки библиотеки), строка (с 1). */
  header: string
  line: number
  /** public / protected / private; в справочник и подсказки попадает только public. */
  access?: 'public' | 'protected' | 'private'
  isStatic?: boolean
  isConst?: boolean
  /** Базовые классы (для class/struct), как написано в заголовке: «Print», «Adafruit_Sensor». Добавлено обратно-совместимо. */
  bases?: string[]
  /** Шаблон: «template <typename T>» (для class/struct/function/method). Добавлено обратно-совместимо. */
  template?: string
}

export interface LibExample {
  name: string
  /** Абсолютный путь к .ino примера. */
  path: string
}

export interface ProjectLibrary {
  name: string
  version?: string
  author?: string
  sentence?: string
  /** Абсолютный путь к папке библиотеки. */
  path: string
  /** Какие #include из скетча привели к этой библиотеке (например «Adafruit_BMP280.h»). */
  matchedIncludes: string[]
  /** Заголовки библиотеки, которые были разобраны (относительные пути). */
  headers: string[]
  symbols: LibSymbol[]
  examples: LibExample[]
  /** Если часть заголовков не удалось разобрать — человекочитаемые замечания. */
  warnings?: string[]
}

export interface LibsForSketchOptions {
  /** Папка скетча: подключения "local.h" рядом со скетчем в расчёт не берутся, но пригодится для будущего. */
  sketchDir?: string | null
  /** FQBN выбранной платы: часть библиотек зависит от архитектуры. */
  fqbn?: string | null
}
