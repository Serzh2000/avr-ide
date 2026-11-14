# Сторонние компоненты AVR IDE

| Компонент | Лицензия | Где используется |
|---|---|---|
| Electron | MIT (текст — LICENSE.electron.txt) | оболочка приложения |
| Monaco Editor | MIT | редактор кода |
| React, Zustand | MIT | интерфейс |
| ESPUI (фронтенд, s00500/ESPUI) | MIT, см. ESPUI-LICENSE.txt | живое превью конструктора ESPUI |
| arduino-cli (Arduino SA) | GPL-3.0 или коммерческая, см. arduino-cli-LICENSE.txt | сборка и прошивка; поставляется отдельным исполняемым файлом `arduino-cli.exe` рядом с приложением. Исходный код: https://github.com/arduino/arduino-cli |

Ядра плат и библиотеки Arduino (ESP32, ESP8266, ESPUI и др.) в дистрибутив не входят и скачиваются пользователем через arduino-cli со своими лицензиями.
