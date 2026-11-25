# API ESPAsyncWebServer / AsyncWebSocket — заметки для генератора «Веб-конструктора»

Источник: репозиторий-форк `ESP32Async/ESPAsyncWebServer` (ветка main), прочитан через WebFetch (исходные заголовки
`src/ESPAsyncWebServer.h`, `src/AsyncWebSocket.h`, `src/WebResponses.cpp`, примеры `examples/arduino/WebSocket`,
`examples/arduino/FlashResponse`). Репозиторий `me-no-dev/ESPAsyncWebServer` теперь только заглушка-перенаправление
(README: проект перенесён в организацию ESP32Async; пакеты ESPAsyncWebServer 3.6.0, AsyncTCP 3.3.2 для ESP32,
ESPAsyncTCP 2.0.0 для ESP8266). Дата сверки: 2026-11 (сессия разработки). На реальном железе ничего не запускалось.

## Подтверждено по исходникам форка

Подключение (из примера WebSocket):
```cpp
#if defined(ESP32) || defined(LIBRETINY)
#include <AsyncTCP.h>
#include <WiFi.h>
#elif defined(ESP8266)
#include <ESP8266WiFi.h>
#include <ESPAsyncTCP.h>
#endif
```
Затем `#include <ESPAsyncWebServer.h>` (заголовок сам подтягивает AsyncWebSocket.h, AsyncEventSource.h).

Для Raspberry Pi Pico W / Pico 2 W с Arduino-Pico: `#include <WiFi.h>`, `#include <RPAsyncTCP.h>` и `#include <ESPAsyncWebServer.h>`.
Используется `request->send(...)`, `WiFi.setHostname()` и штатный диапазон `analogWrite()` 0–255.
Сборка проверена на Arduino-Pico 6.4.0 с ESP Async WebServer 3.12.1 и RPAsyncTCP 1.3.2; Wi‑Fi и GPIO на платах не проверялись.

AsyncWebSocket (AsyncWebSocket.h):
- `enum AwsEventType`: WS_EVT_CONNECT, WS_EVT_DISCONNECT, WS_EVT_PING, WS_EVT_PONG, WS_EVT_ERROR, WS_EVT_DATA.
- `struct AwsFrameInfo`: `uint8_t message_opcode; uint32_t num; uint8_t final; uint8_t masked; uint8_t opcode; uint64_t len; uint8_t mask[4]; uint64_t index;`
- `using AwsEventHandler = std::function<void(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len)>;`
- `void onEvent(AwsEventHandler handler)`.
- `SendStatus textAll(const String &message)` (также `const char*`, `const char*, size_t`, `const uint8_t*, size_t`, буферы).
- `bool text(uint32_t id, const String &message)` и аналоги; `size_t count() const`.
- `void cleanupClients(uint16_t maxClients = DEFAULT_MAX_WS_CLIENTS)`.
- `AsyncWebSocketClient`: `bool text(const String &message)`, `text(const char*)`, `text(const char*, size_t)`; `uint32_t id() const`; `AwsClientStatus status() const`.
- Объявление в примере: `static AsyncWebSocket ws("/ws");`, регистрация `server.addHandler(&ws);`, в `loop()` — `ws.cleanupClients(...)`.
- Обработка данных в примере: `AwsFrameInfo *info = (AwsFrameInfo *)arg;` и сравнение `info->index`, `info->len`, `info->final`.

AsyncWebServer / запрос (ESPAsyncWebServer.h):
- `AsyncCallbackWebHandler &on(AsyncURIMatcher uri, WebRequestMethodComposite method, ArRequestHandlerFunction onRequest, ...)`;
  `typedef std::function<void(AsyncWebServerRequest *request)> ArRequestHandlerFunction;`
- `void onNotFound(ArRequestHandlerFunction fn);` `void begin();`
  `AsyncWebHandler &addHandler(AsyncWebHandler *handler);` (и перегрузка по ссылке).
- Отправка: `void send(int code, const char *contentType = asyncsrv::empty, const char *content = asyncsrv::empty, AwsTemplateProcessor callback = nullptr)` —
  вызывается как `request->send(404, "text/plain", "Not found")` и `request->send(204)`;
  `void send(int code, const char *contentType, const uint8_t *content, size_t len, AwsTemplateProcessor callback = nullptr)`.
- `send_P(...)` и `beginResponse_P(...)` в форке помечены **deprecated** (кроме `send_P(code, type, PGM_P)` на ESP8266).
- Пример FlashResponse (форк) отдаёт PROGMEM-данные так:
  `static const char *htmlContent PROGMEM = R"(...)"; request->send(200, "text/html", (uint8_t *)htmlContent, htmlContentLength);`
  `AsyncProgmemResponse::_fillBuffer` копирует через `memcpy_P` (это значит, что чтение из флеша учтено).
- `AsyncWebServerResponse::addHeader(const char *name, const char *value, bool replaceExisting = true)` (есть и вариант для `String`).

## Приём файла / OTA (блок «Обновление прошивки») — подтверждено частично

Источник: примеры `examples/arduino/UploadFlash` и `examples/arduino/Upload` форка ESP32Async.
- Сигнатура обработчика загрузки (подтверждена): `[](AsyncWebServerRequest *request, String filename, size_t index, uint8_t *data, size_t len, bool final) {...}`;
  маршрут: `server.on("/flash", HTTP_POST, <обработчик завершения запроса>, <обработчик загрузки>)` — загрузка передаётся последним аргументом.
- Для прошивки в примере (только `#ifdef ESP32`, `#include <Update.h>`): `Update.begin(UPDATE_SIZE_UNKNOWN, U_FLASH)`, `Update.write(data, len) != len`,
  `Update.end(true)`; ответ `request->send(200, "text/plain", "Upload complete")`, ошибки — `send(400, ...)`. Перезагрузки в примере нет.
- Страница шлёт `POST` (multipart/form-data, поле `firmware`) на путь из свойства блока (по умолчанию `/update`; в примере путь `/flash`).
- Генератор обработчик НЕ создаёт: только комментарий в `web_generated.h`. TODO: сверить `Update` для ESP8266 (в примере его нет), имя поля формы и поведение при `index == 0`; защита паролем и `ESP.restart()` — на пользователе.

## Протокол: добавленные блоки

- Консоль логов: привязка к String-переменной (toUi). Каждое пришедшее `{"t":"set","k":имя,"v":строка}` добавляет строку (при `state` строка не добавляется). В прошивке: `wdLog("имя", строка)` (шлёт даже повторяющиеся строки).
- Крестовина/джойстик: String-переменная (fromUi). Крестовина шлёт `up|down|left|right|center` при нажатии и «значение при отпускании» (по умолчанию `stop`); джойстик — `"x,y"` (-100..100), при отпускании `0,0`.
- Таблица/список: `{имя}` в ячейках подставляется из переменных (toUi); переменные экспортируются автоматически.
- Форма WiFi: шлёт три значения — String-переменные SSID и пароля и bool-флаг «сохранить» (true). Сохранение в энергонезависимую память генератор не делает.
- Select/radio: значение варианта (число, если привязана int/float). Страницы сайта: `#/id`, переключение внутри одной HTML-страницы.

## Что использует генератор

- Страница: `static const char WD_PAGE[] PROGMEM = R"WDPAGE(...)WDPAGE";`, отдача
  `request->send(200, "text/html", (const uint8_t*)WD_PAGE, WD_PAGE_LEN);` (настройка `serveApi: 'send'`) либо
  `request->send_P(200, "text/html", (const uint8_t*)WD_PAGE, WD_PAGE_LEN);` (`serveApi: 'send_P'`, для старых версий библиотеки).
- WebSocket: `AsyncWebSocket wd_ws("/ws")`, `onEvent`, `addHandler`, `textAll(String)`, `client->text(String)`, `cleanupClients()`, `count()`.
- Из кадра берётся только `info->final`, `info->index`, `info->len` (типы подтверждены); `info->opcode == WS_TEXT` намеренно не используется.

## НЕ подтверждено (TODO — проверить на реальном железе / по документации ядер)

- TODO: на ESP8266 `send(code, type, const uint8_t*, len)` читает PROGMEM корректно — по примеру FlashResponse и `memcpy_P` вероятно да, но связь конкретного `send(...)` с `AsyncProgmemResponse` в этой сессии не прослежена.
- TODO: в старом me-no-dev (до перехода в ESP32Async) перегрузка `send(code, type, const uint8_t*, len)` отсутствует — для него нужен `serveApi: 'send_P'` (по памяти; README устарел и сигнатур не содержит).
- TODO: Arduino-ESP32 API, не сверявшийся в этой сессии: `WiFi.setHostname()` (на ряде версий ядра вызывать до `WiFi.mode()`), `ledcAttach(pin, freq, bits)` и `ledcWrite(pin, duty)` (ядро 3.x), `ledcSetup/ledcAttachPin/ledcWrite(channel, duty)` (2.x), `analogRead` на ADC2 при WiFi.
- TODO: Arduino-ESP8266 API: `WiFi.hostname()`, `analogWrite()` (диапазон по умолчанию 0–1023), `WiFi.softAP(ssid[, pass])`.
- TODO: `AsyncWebSocket::textAll` при переполнении очереди медленных клиентов; в генераторе не обрабатывается (используется `cleanupClients()`).
- TODO: фактические лимиты размера страницы не измерялись; пороги в `validate.ts` (`SIZE_LIMITS`) — эвристика.

## Выбор: PROGMEM raw-строка (а не LittleFS и не gzip)

| Вариант | Плюсы | Минусы |
|---|---|---|
| **PROGMEM raw-строка (выбрано)** | один файл, нет шага загрузки ФС, страница версионируется вместе со скетчем и протоколом WebSocket | нет сжатия: страница занимает во флеше свой размер и уходит по сети как есть |
| PROGMEM + gzip (`Content-Encoding: gzip`) | в 3–5 раз меньше трафик и флеш | сжатие нужно делать в IDE (zlib в main-процессе; в рендерере нет), массив байтов нечитаем в коде. Возможное расширение (TODO) |
| LittleFS | страницу можно менять без перепрошивки | отдельный шаг загрузки ФС, зависимость от схемы разделов и плагина загрузки |

## WebSocket-протокол (JSON, текстовые кадры)

- Страница → устройство: `{"t":"set","k":"<ключ>","v":<значение>}`. Ключ — имя переменной или `gpioN` для пина. Значение: boolean, число или строка.
- Устройство → страница: `{"t":"set","k":"<ключ>","v":<значение>}` при изменении и `{"t":"state","v":{"_":0,"<ключ>":<значение>,...}}` при подключении клиента.
- Разбор на устройстве — минимальный сканер без ArduinoJson (формат фиксирован генерируемой страницей); значения-строки поддерживают `\" \\ \n \r \t \uXXXX`.
- Ограничения: сообщение ≤ 512 байт, один кадр, `final`.
- Безопасность: протокол без аутентификации; кнопка «momentary» шлёт `true`/`false` — при потере связи на нажатой кнопке реле может остаться включённым (рантайм отпускает кнопку при blur/скрытии вкладки, но не при обрыве сети). Критичные нагрузки защищайте таймаутом в прошивке.
