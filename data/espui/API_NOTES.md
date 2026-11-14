# ESPUI — реестр подтверждённого API

Источник: github.com/s00500/ESPUI, ветка `master`, файлы `src/ESPUI.h`, `src/ESPUI.cpp`,
`src/ESPUIcontrol.h/.cpp`, `src/ESPUIclient.cpp`, `src/dataControlsJS.h` (фронтенд), `src/dataStyleCSS.h`, `README.md`,
`examples/gui-generic-api`. Прочитано через WebFetch (пересказ модели-читателя с короткими цитатами), дата сверки — ноябрь 2026.
Версия библиотеки (тег) не фиксировалась — сверка по `master`.

Метки: **[П]** — подтверждено в источнике; **[Н]** — не подтверждено / не найдено; **[А]** — подтверждено только косвенно
(выведено из кода, на плате не проверялось). C++ генератора **не компилировался**, на железе не запускался.

> Примечание: папка `data/` в репозитории ESPUI в этой сверке не читалась (API GitHub вернул ошибку сокета); фронтенд
> разобран по `src/data*.h` (там тот же JS/CSS в виде PROGMEM-строк).

## 1. ControlType (`ESPUIcontrol.h`, `enum ControlType : uint8_t`) [П]

| Имя | № | Имя | № |
|---|---|---|---|
| Title | 0 | Step | 16 |
| Pad | 1 | Gauge | 17 |
| PadWithCenter | 2 | Accel | 18 |
| Button | 3 | Separator | 19 |
| Label | 4 | Time | 20 |
| Switcher | 5 | FileDisplay | 21 |
| Slider | 6 | ClearGraph | 22 |
| Number | 7 | Fragment | 98 |
| Text | 8 | Password | 99 |
| Graph | 9 | UpdateOffset | 100 |
| GraphPoint | 10 | | |
| Tab | 11 | | |
| Select | 12 | | |
| Option | 13 | | |
| Min | 14 | | |
| Max | 15 | | |

* Тип обновления на проводе = тип + 100 (`UpdateOffset`) [П, JS: `UPDATE_SLIDER=106`, `UPDATE_TAB=111`]. Исключения:
  `ADD_GRAPH_POINT=10`, `CLEAR_GRAPH=22` [П].
* `Password` уходит клиенту как `Text` со значением `"--------"`; настоящее значение не передаётся [П].
* В заголовке остались макросы `UPDATE_*`, `UI_CPAD` на несуществующие члены (`ControlType::UpdateLabel`, `Cpad`) — это
  устаревшие алиасы, **использовать нельзя** [П].
* `Gauge` — во фронтенде заглушка («WILL BE A GAUGE» + number input) → в конструктор **не включён** [П].
* `Accel` — во фронтенде помечен «Not implemented fully!» → в конструктор включён как экспериментальный (только callback) [П].

## 2. ControlColor [П]

Turquoise=0, Emerald=1, Peterriver=2, Wetasphalt=3, Sunflower=4, Carrot=5, Alizarin=6, Dark=7, None=0xFF.
Фронтенд: цвета 0–6 → CSS-классы `turquoise…alizarin`; **Dark и None оба → класс `dark`** (None — не «без стиля») [П].
Цвета CSS (фон / border-bottom): turquoise #1abc9c/#16a085, emerald #2ecc71/#27ae60, peterriver #3498db/#2980b9,
wetasphalt #34495e/#2c3e50, sunflower #f1c40f/#e6bb0f, carrot #e67e22/#d35400, alizarin #e74c3c/#c0392b, dark #444857 [П].

## 3. Константы событий (`ESPUI.h`, второй аргумент callback'а) [П]

B_DOWN=-1, B_UP=1; P_LEFT_DOWN=-2, P_LEFT_UP=2; P_RIGHT_DOWN=-3, P_RIGHT_UP=3; P_FOR_DOWN=-4, P_FOR_UP=4;
P_BACK_DOWN=-5, P_BACK_UP=5; P_CENTER_DOWN=-6, P_CENTER_UP=6; S_ACTIVE=-7, S_INACTIVE=7;
SL_VALUE=8, N_VALUE=9, T_VALUE=10, S_VALUE=11, TM_VALUE=12. Вкладка (`tabvalue`) вызывает callback с `0`.
Значение в `sender->value` (`onWsEvent`): `sactive` → `"1"`, `sinactive` → `"0"`; `slvalue/nvalue/tvalue/svalue` → строка
от клиента; `time` → строка времени браузера (ISO), callback `TM_VALUE`, без широковещательной рассылки изменения.
Callback: `std::function<void(Control*, int)>` [П]. Кнопки/пэд: значение не меняется, важен только `type`.
Сообщения клиент→устройство: `bdown:id`, `bup:id`, `pfdown/pfup/pldown/plup/prdown/prup/pbdown/pbup/pcdown/pcup:id`,
`sactive/sinactive:id`, `slvalue:v:id`, `nvalue:v:id`, `tvalue:v:id`, `svalue:v:id`, `time:ISO:id`, `uiok:N`,
`uifragmentok:…` [П].

## 4. Методы ESPUIClass (`ESPUI.h`) [П]

Сигнатуры (дословно по заголовку):

```
void begin(const char* _title, const char* username = nullptr, const char* password = nullptr, uint16_t port = 80);
void beginLITTLEFS(const char* _title, const char* username = nullptr, const char* password = nullptr, uint16_t port = 80);
void beginSPIFFS(...)  // устар., вызывает beginLITTLEFS
void prepareFileSystem(bool format = true);   void list();   void writeFile(const char* path, const char* data);
void setVerbosity(Verbosity v);
uint16_t addControl(ControlType, const String& label[, const String& value[, ControlColor[, uint16_t parent[, callback]]]]);
bool removeControl(uint16_t id, bool force_rebuild_ui = false);
uint16_t button/switcher/pad/padWithCenter/slider/number/text/label/graph/gauge/separator/fileDisplay/accelerometer(...)  // шорткаты без parent
void updateControlValue(uint16_t id, const String& value, int clientId = -1);   void updateControlLabel(uint16_t, const String&, int = -1);
void updateControl(uint16_t id, int clientId = -1);
void updateLabel(id, value);  updateButton(id, value);  updateSwitcher(id, bool, clientId=-1);  updateSlider(id, int, ...);
void updateNumber(id, int, ...);  updateText(id, String, ...);  updateSelect(id, String, ...);  updateGauge(id, int, clientId);
void updateTime(uint16_t id, int clientId = -1);   void clearGraph(id, clientId=-1);   void addGraphPoint(id, int, clientId=-1);
void setPanelStyle(uint16_t id, const String& style, int clientId = -1);
void setPanelClass(uint16_t id, const String& pClass, int clientId = -1);
void setElementStyle(uint16_t id, const String& style, int clientId = -1);
void setInputType(uint16_t id, const String& type, int clientId = -1);
void setPanelWide(uint16_t id, bool wide);     void setVertical(uint16_t id, bool vert = true);
void setEnabled(uint16_t id, bool enabled = true, int clientId = -1);
void updateVisibility(uint16_t id, bool visibility, int clientId = -1);
void setCustomJS(const char* js);   void setCustomCSS(const char* css);   // строки должны жить всё время работы
void jsonReload();
AsyncWebServer* WebServer();  AsyncWebSocket* WebSocket();
```

Поля: `jsonUpdateDocumentSize = 2000`; `jsonInitialDocumentSize = 8000` (ESP8266: **2000**); `jsonChunkNumberMax = 0`
(ESP8266: **5**); `sliderContinuous = false`; `captivePortal = true`. `uint16_t id` контролов, `Control::noParent = 0xffff` [П].

Поведение (`ESPUI.cpp`) [П]:
* `addControl` дописывает в односвязный список (порядок создания = порядок показа), `controlCount++`, сообщает клиентам
  `RebuildNeeded`, возвращает `id`. Проверок количества и длины значения **нет** [П].
* `switcher()` шорткат: значение `startState ? "1" : "0"`. `updateSwitcher` → `"1"/"0"` [П]. Прямой `addControl(Switcher…, "1"/"0")`
  — логически эквивалентен (фронтенд: «checked», если `value=="1"`) [А].
* `slider()/number()/gauge()` шорткаты создают дочерние `Min`/`Max` (цвет `None`, parent = id контрола, значение = число строкой) [П].
* **Step** (`ControlType::Step`) — фронтенд ставит атрибут `step` для `#sl{parent}` (слайдер) **и** `#num{parent}` (число) [П].
  Прежнее допущение «Step только у Number» неверно — слайдер тоже поддерживает.
* `Max` для **Text** → `maxlength` поля ввода [П].
* `Option`: дочерний контрол Select; `selected` ставится, если `value` Select равно `value` Option [П].
* `setPanelWide/setVertical` просто пишут флаг (без рассылки); `setEnabled`, `setPanelStyle/ElementStyle/Class/InputType` пишут поле +
  `updateControl`; `updateVisibility` для Tab/показа вызывает `RebuildNeeded` [П]. Вызов до `begin()` безопасен по коду (рассылка по
  пустому списку клиентов) [А]; README требует `setInputType` **до `begin()`** [П]; `setCustomJS` до `begin()` [П].
* `begin()` не защищён от повторного вызова (создаёт новые `AsyncWebServer`/`AsyncWebSocket`) [П]. Маршруты: `/`, `/js/*.js`,
  `/css/style.css`, `/css/normalize.css`, `/heap`, `/js/custom.js`, `/css/custom.css`, `/ws` [П].
  **`custom.js/custom.css` регистрируются только в `begin()` (PROGMEM-режим), не в `beginLITTLEFS()`** [П].
* Авторизация: `basicAuth` включается, только если заданы и логин и пароль; WebSocket защищается лишь при `#define WS_AUTHENTICATION` [П].
* Captive portal: `ESPUI.captivePortal = true` по умолчанию, но **нужен собственный DNSServer** (`dnsServer.start(53,"*",apIP)` +
  `processNextRequest()` в `loop()`), работает только в режиме AP [П: README + examples/gui-generic-api].
* Заголовок страницы — только аргумент `begin(title)`; он идёт и в `document.title`, и в `#mainHeader` через `.html()` → допускает HTML [П].
  Favicon — в документации/коде **не найден** [Н]. Тему задаёт `setCustomCSS` [П].

## 5. Стилизация [П]

* Панель (карточка): `setPanelStyle(id, "css…")` → атрибут `style` карточки; `setPanelClass` — добавляет CSS-класс.
* Элемент: `setElementStyle(id, "css…")` → `style` внутреннего элемента. README: «работает корректно для Button, Label, Slider, …»
  (перечень дальше в источнике обрезан) → для остальных типов генератор выдаёт предупреждение [А].
* `wide` → класс `wide` карточки; `vertical` → `vert-switcher` / `vert-slider`; `enabled=false` → `disabled`; `visible=false` не рисуется.
* Селекторы фронтенда для `setCustomCSS`: `body` (фон #ecf0f1, шрифт «open sans»), `#mainHeader`, `.container`, `.card` (min-height 100px,
  border-radius 6px, min-width 500px; на ≤630px 98%), `.wide.card`, классы цветов (см. п.2), `button`, `button:enabled:active`,
  `.switch` / `.switch.checked` (#76d21d), `.label`, `.label-wrap`, `h5`, `hr`, `input, select`, `ul.navigation`, `ul.navigation li a`,
  `ul.navigation li.active a`, `.sectionbreak.columns hr`, `.vert-slider`, `.vert-switcher`. CSS-переменных (`:root`) нет [П].
  Порядок подключения `custom.css` относительно `style.css` не проверялся → темы поднимают специфичность (`body .card`) [Н].
* Ограничение по размеру для стилей в явном виде **не** задано; косвенно: один контрол (label + value + стили + ~64 байта служебных +
  запас 100) должен поместиться в JSON-документ `jsonInitialDocumentSize` (ESP8266 — 2000 байт, иначе вместо контрола
  уходит сообщение об ошибке) [П, ESPUIclient.cpp]. Генератор предупреждает при >400 байт стилей на элемент (ESP8266) и
  даёт ошибку, если оценка превышает документ.
* Строки в JS без экранирования: `"<h5>"+label+"</h5>"`, `value='"+value+"'` — `<`, `>` в подписях интерпретируются как HTML, `'` в
  значениях ломает атрибут [П]. Валидатор предупреждает.

## 6. Типы элементов во фронтенде [П]

Button (`bdown/bup`), Switcher (checkbox, checked если value=="1"), Pad / PadWithCenter (4 стрелки + «OK» центр), Slider
(`range`, по умолчанию 0..100, Min/Max/Step переопределяют), Number (`type=number`, клиентский clamp по min/max, `max-width:6em`),
Text (`inputType` → атрибут `type`; Max → `maxlength`), Select/Option, Label (`white-space:pre-wrap`), Graph (точки `{x:time,y:value}`
хранятся в localStorage браузера; README: «много проблем»), Separator (`sectionbreak` с заголовком = label), Time (ничего не рисует; по
`updateTime(id)` браузер присылает время → callback `TM_VALUE`), FileDisplay (`<textarea>`, подгружает URL из `value`),
Accel (не завершён), Tab (`ul.navigation` + `div#tab{id}`; `#tabsnav:empty` скрыт).
README: date/time/color/password-поля — это Text с `setInputType(id, "date"|"time"|"color"|"password")`, вызывать до `begin()` [П].
Шорткаты (`ESPUI.button()` и т. п.) не принимают parent — всегда над вкладками; генератор использует `addControl` [П].

## 7. Память / ограничения

* ESP8266: `jsonInitialDocumentSize=2000`, `jsonChunkNumberMax=5` — порционная отправка (глава «Chunking» с v2.1) [П].
  Лимит числа контролов и общий расход RAM в источниках не заданы [Н]; на практике — десятки контролов, значения длиной в сотни байт
  фрагментируются (`UI_FRAGMENT`) [П].
* `custom.css`/`custom.js` и `static const char[]` с темой занимают RAM (на ESP8266 `const` без PROGMEM — в RAM). Генератор
  предупреждает при >2000 байт CSS на ESP8266 [А].
* Если PROGMEM-режим не помещается: один раз запустить скетч с `ESPUI.prepareFileSystem()` (до ~30 с), затем `beginLITTLEFS(title)`;
  при этом custom.css не раздаётся [П]. Конструктор по умолчанию использует `begin()`.
* `Verbosity`: Quiet=0, Verbose, VerboseJSON [П].

## 8. Формат JSON страницы (WebSocket `/ws`, сервер → фронтенд) [П: `ESPUIclient.cpp`, `ESPUIcontrol.cpp`]

`MessageTypes`: InitialGui=200, Reload=201, ExtendGUI=210, UpdateGui=220, ExtendedUpdateGui=230 [П: ESPUI.h; в JS используются 200/201/210].

```json
{ "type": 200, "sliderContinuous": false, "startindex": 0, "totalcontrols": 65535,
  "controls": [
    { "type": 0, "label": "<заголовок>" },
    { "id": 1, "type": 11, "label": "Вкладка", "value": "Вкладка", "visible": true, "color": 255, "enabled": true },
    { "id": 2, "type": 5, "label": "Реле", "value": "1", "visible": true, "color": 5, "enabled": true, "parentControl": "1",
      "panelStyle": "...", "elementStyle": "...", "panelClass": "...", "inputType": "...", "wide": true, "vertical": true } ] }
```

* Первый элемент `controls` — всегда заголовок (`type 0`, `label`) [П].
* Ключи контрола: `id`, `type` (число), `label`, `value` (строка), `visible`, `color` (число), `enabled`; `panelStyle`, `panelClass`,
  `elementStyle`, `inputType` — только если непусты; `wide`, `vertical` — только если `true`; `parentControl` — **строка**
  `String(id)`, только если не `noParent`; у `Option` — `selected: "selected" | ""` [П].
* Обновление: тот же объект с `type + 100`. Точка графика: `{type:10, id, value}`; очистка: `{type:22, id, value:0}` [П].
* `id = ++idCounter` при создании (порядок = порядок `addControl`). Начальное значение счётчика в прочитанных файлах не видно —
  модель использует 1,2,3… [А].
* Порционная отправка (`jsonChunkNumberMax`, размер документа) и фрагменты длинных значений в `core/espuijson.ts` **не эмулируются** [Н].
* Control chars экранируются `\u00XX` [П].

Реализация в конструкторе: `buildEspuiPage(project)` в `core/espuijson.ts` возвращает `{ message, ids, customCss, customJs }` в этом формате —
точка интеграции для будущего живого превью с настоящим фронтендом (`dataControlsJS.h` + `dataStyleCSS.h`; в проект не вендорятся).

## 9. Закрытые TODO(ESPUI) из generate.ts

| # | Было | Итог |
|---|---|---|
| 1 | Формат значения Switcher в `addControl` ("1"/"0") | **Подтверждено косвенно**: шорткат `switcher()` и `updateSwitcher` используют `"1"/"0"`, JS проверяет `value=="1"` [П/А] |
| 2 | Значения констант B_DOWN/S_ACTIVE… | **Подтверждено**, таблица в п.3; генератор по-прежнему использует имена макросов |
| 3 | Captive portal / DNS | **Подтверждено**: ESPUI сам DNS не запускает, нужен `DNSServer` (только AP). Добавлена опция `settings.dnsCaptive` |
| 4 | Step у Slider | **Подтверждено**: JS ставит `step` и для слайдера. Генерируется для slider и number |
| — | (в коде на деле 4 пункта «НЕ подтверждено» в шапке + 1 маркер `TODO(ESPUI)` у Switcher — это пункт 1; «шести» TODO не нашлось) | |
| + | Побочно уточнено: список ControlType, `Fragment/Password/UpdateOffset`, Callback `(Control*, int)` | **Подтверждено** (п.1, п.3) |

## 10. Не подтверждено (TODO)

* Номер версии библиотеки / тег, на котором всё сверено; папка `data/` репозитория не читалась.
* Порядок подключения `custom.css` и `style.css`; работают ли наши повышенные по специфичности селекторы на реальном фронтенде.
* Полный перечень типов, для которых работает `setElementStyle` (в README обрезан после «Button, Label, Slider»).
* Что приходит в callback у `Accel` (в `onWsEvent` ветки для accel нет — вероятно, значения шлёт `customJS`).
* Поведение `FileDisplay`, если файла нет в раздаваемой файловой системе (в PROGMEM-режиме `begin()` маршрута на LittleFS нет).
* Лимиты числа контролов и RAM на ESP8266.
* Favicon.
* Компиляция сгенерированного C++ и запуск на плате не проводились.
