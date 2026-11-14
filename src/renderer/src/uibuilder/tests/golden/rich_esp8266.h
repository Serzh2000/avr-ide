// ui_generated.h — создано конструктором ESPUI (AVR IDE), генератор v2
// Платформа: esp8266
// Не правьте код между маркерами GEN BEGIN / GEN END — он перезаписывается при каждой генерации.
// Использование в скетче:  #include "ui_generated.h"  →  ui_setup() в setup(),  ui_loop() в loop().
#pragma once

// <<GEN BEGIN>>

#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESPAsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ESPUI.h>
#include <DNSServer.h>

// ---- Настройки ----
#define UIGEN_UPDATE_MS 500
#define UIGEN_WIFI_TIMEOUT_MS 20000
static const char UIGEN_TITLE[] = "Rich";
static const char UIGEN_AP_SSID[] = "Rich-AP";
static const char UIGEN_AP_PASS[] = "";
static const char UIGEN_HOSTNAME[] = "espui";
// Тема оформления (CSS для ESPUI.setCustomCSS; раздаётся только при ESPUI.begin(), не beginLITTLEFS()).
static const char UIGEN_CUSTOM_CSS[] =
  "html body{background-color:#0a0a14;color:#e0f7ff;font-family:Consolas, Courier New, monospace}"
  "body #mainHeader{color:#00ffc8}"
  "body .card{border-radius:10px;box-shadow:0 0 12px rgba(0,255,200,.55);color:#06060f}"
  "body button{border-radius:2px}"
  "body ul.navigation{border-bottom-color:#00ffc8}"
  "body ul.navigation li.active a{background:#00ffc8}"
  "body .switch.checked{background-color:#00ffc8}"
  "body .turquoise{background-color:#00e5c3}"
  "body .emerald{background-color:#39ff14}"
  "body .peterriver{background-color:#00b3ff}"
  "body .wetasphalt{background-color:#7a5cff}"
  "body .sunflower{background-color:#fff200}"
  "body .carrot{background-color:#ff9500}"
  "body .alizarin{background-color:#ff0055}"
  "body .dark{background-color:#8892b0}";
static DNSServer ui_dns;
static bool ui_dns_on = false;

// ---- Переменные ----
int padEvent = 0;
String secret = "";
String clockText = "";
bool flag = false;
int level = 3;
float temp = 20.0f;

// ---- ID контролов ESPUI ----
uint16_t tabCtl;
uint16_t tabInfo;
uint16_t padMove;
uint16_t padCam;
uint16_t btnToggle;
uint16_t btnFlag;
uint16_t sldLevel;
uint16_t accGyro;
uint16_t txtDate;
uint16_t pwdKey;
uint16_t tmNow;
uint16_t fdLog;
uint16_t selPick;
uint16_t grFast;

// ---- Последние отправленные в UI значения (чтобы не слать повторно) ----
int ui_prev_sldLevel = (-2147483647 - 1);

// ---- Функции пользователя: определите их в своём скетче (тип события — второй аргумент) ----
void onCamera(Control* sender, int type);  // padCam (Pad: P_FOR_DOWN, P_FOR_UP, P_BACK_DOWN, P_BACK_UP, P_LEFT_DOWN, P_LEFT_UP, P_RIGHT_DOWN, P_RIGHT_UP)
void onTilt(Control* sender, int type);  // accGyro (Accel)
void onPick(Control* sender, int type);  // selPick (Select: S_VALUE)

// ---- Callback'и: UI → устройство ----
void cb_padMove(Control* sender, int type) {
  (void)sender;
  padEvent = type;
}

void cb_btnToggle(Control* sender, int type) {
  (void)sender;
  static bool st = false;
  if (type != B_DOWN) return;
  st = !st;
  digitalWrite(4, st ? HIGH : LOW);
}

void cb_btnFlag(Control* sender, int type) {
  (void)sender;
  if (type == B_DOWN) flag = !flag;
}

void cb_sldLevel(Control* sender, int type) {
  (void)type;
  level = sender->value.toInt();
  ui_prev_sldLevel = level;
}

void cb_pwdKey(Control* sender, int type) {
  (void)type;
  secret = sender->value;
}

void cb_tmNow(Control* sender, int type) {
  (void)type;
  clockText = sender->value;
}

// ---- WiFi ----
inline void ui_wifi_ap() {
  WiFi.mode(WIFI_AP);
  WiFi.softAP(UIGEN_AP_SSID);
  Serial.print("AP IP: ");
  Serial.println(WiFi.softAPIP());
  // Captive portal: ESPUI сама DNS не запускает — отвечаем на все имена адресом точки доступа.
  ui_dns.start(53, "*", WiFi.softAPIP());
  ui_dns_on = true;
}

inline void ui_wifi() {
  ui_wifi_ap();
}

// ---- Инициализация ----
inline void ui_setup() {
  // Пины
  pinMode(4, OUTPUT);
  digitalWrite(4, LOW);

  // WiFi
  ui_wifi();

  // Контролы ESPUI
  tabCtl = ESPUI.addControl(ControlType::Tab, "Управление", "Управление");
  tabInfo = ESPUI.addControl(ControlType::Tab, "Инфо", "Инфо");
  ESPUI.addControl(ControlType::Separator, "Моторы", "", ControlColor::None, tabCtl);
  padMove = ESPUI.addControl(ControlType::PadWithCenter, "Движение", "", ControlColor::Carrot, tabCtl, &cb_padMove);
  padCam = ESPUI.addControl(ControlType::Pad, "Камера", "", ControlColor::Sunflower, tabCtl, &onCamera);
  btnToggle = ESPUI.addControl(ControlType::Button, "Реле", "Вкл/выкл", ControlColor::Peterriver, tabCtl, &cb_btnToggle);
  btnFlag = ESPUI.addControl(ControlType::Button, "Флаг", "Флаг", ControlColor::Turquoise, tabCtl, &cb_btnFlag);
  sldLevel = ESPUI.addControl(ControlType::Slider, "Уровень", String(level), ControlColor::Emerald, tabCtl, &cb_sldLevel);
  ESPUI.addControl(ControlType::Min, "", "0", ControlColor::None, sldLevel);
  ESPUI.addControl(ControlType::Max, "", "10", ControlColor::None, sldLevel);
  ESPUI.addControl(ControlType::Step, "", "2", ControlColor::None, sldLevel);
  accGyro = ESPUI.addControl(ControlType::Accel, "Наклон", "", ControlColor::Turquoise, tabCtl, &onTilt);
  txtDate = ESPUI.addControl(ControlType::Text, "Дата", "", ControlColor::Turquoise, tabInfo);
  ESPUI.addControl(ControlType::Max, "", "10", ControlColor::None, txtDate);
  pwdKey = ESPUI.addControl(ControlType::Password, "Ключ", "", ControlColor::Turquoise, tabInfo, &cb_pwdKey);
  tmNow = ESPUI.addControl(ControlType::Time, "Время", "", ControlColor::Turquoise, tabInfo, &cb_tmNow);
  fdLog = ESPUI.addControl(ControlType::FileDisplay, "Лог", "/log.txt", ControlColor::Turquoise, tabInfo);
  selPick = ESPUI.addControl(ControlType::Select, "Выбор", "b", ControlColor::Turquoise, tabInfo, &onPick);
  ESPUI.addControl(ControlType::Option, "A", "a", ControlColor::None, selPick);
  ESPUI.addControl(ControlType::Option, "B", "b", ControlColor::None, selPick);
  grFast = ESPUI.addControl(ControlType::Graph, "График", "", ControlColor::Turquoise, tabInfo);

  // Оформление (до begin)
  ESPUI.setEnabled(padCam, false);
  ESPUI.updateVisibility(btnToggle, false);
  ESPUI.setPanelWide(sldLevel, true);
  ESPUI.setPanelStyle(sldLevel, "background:#102030;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,.4);");
  ESPUI.setElementStyle(sldLevel, "width:90%;");
  ESPUI.setPanelClass(sldLevel, "big card2");
  ESPUI.setInputType(txtDate, "date");
  ESPUI.setCustomCSS(UIGEN_CUSTOM_CSS);

  // Запуск веб-интерфейса
  ESPUI.begin(UIGEN_TITLE);
  ESPUI.clearGraph(grFast);
}

// ---- Периодическое обновление: устройство → UI ----
inline void ui_loop() {
  if (ui_dns_on) ui_dns.processNextRequest();
  {
    static uint32_t ui_t_tmNow = 0;
    if (millis() - ui_t_tmNow >= 30000UL) {
      ui_t_tmNow = millis();
      ESPUI.updateTime(tmNow);
    }
  }
  {
    static uint32_t ui_t_grFast = 0;
    if (millis() - ui_t_grFast >= 1000) {
      ui_t_grFast = millis();
      ESPUI.addGraphPoint(grFast, (int)lroundf((float)(temp) * 10.0f));
    }
  }
  static uint32_t ui_last = 0;
  if (millis() - ui_last < UIGEN_UPDATE_MS) return;
  ui_last = millis();
  {
    int cur = level;
    if (cur != ui_prev_sldLevel) {
      ui_prev_sldLevel = cur;
      ESPUI.updateSlider(sldLevel, cur);
    }
  }
}
// <<GEN END>>
