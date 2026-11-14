// ui_generated.h — создано конструктором ESPUI (AVR IDE), генератор v2
// Платформа: esp32, LEDC API v3
// Не правьте код между маркерами GEN BEGIN / GEN END — он перезаписывается при каждой генерации.
// Использование в скетче:  #include "ui_generated.h"  →  ui_setup() в setup(),  ui_loop() в loop().
#pragma once

// <<GEN BEGIN>>

#include <Arduino.h>
#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ESPUI.h>

// ---- Настройки ----
#define UI_UPDATE_MS 500
#define UI_WIFI_TIMEOUT_MS 20000
static const char UI_TITLE[] = "Демо \"ESPUI\"";
static const char UI_WIFI_SSID[] = "MyWiFi";
static const char UI_WIFI_PASS[] = "secret123";
static const char UI_AP_SSID[] = "ESPUI-AP";
static const char UI_AP_PASS[] = "apsecret1";
static const char UI_HOSTNAME[] = "espui";

// ---- Переменные ----
bool ledOn = false;
int speed = 50;
float temp = 21.5f;
String status = "ready";
int mode = 1;
int presses = 0;

// ---- ID контролов ESPUI ----
uint16_t tabMain;
uint16_t tabSettings;
uint16_t lblTemp;
uint16_t swLed;
uint16_t swRelay;
uint16_t sldSpeed;
uint16_t sldPwm;
uint16_t btnPress;
uint16_t sep1;
uint16_t numTemp;
uint16_t txtStatus;
uint16_t selMode;
uint16_t lblAdc;
uint16_t grAdc;
uint16_t grTemp;

// ---- Последние отправленные в UI значения (чтобы не слать повторно) ----
String ui_prev_lblTemp;
int8_t ui_prev_swLed = -1;
int ui_prev_sldSpeed = (-2147483647 - 1);
String ui_prev_txtStatus;
String ui_prev_lblAdc;

// ---- Callback'и: UI → устройство ----
void cb_swLed(Control* sender, int type) {
  (void)sender;
  bool on = (type == S_ACTIVE);
  ledOn = on;
  ui_prev_swLed = ledOn ? 1 : 0;
}

void cb_swRelay(Control* sender, int type) {
  (void)sender;
  bool on = (type == S_ACTIVE);
  digitalWrite(2, on ? LOW : HIGH);
}

void cb_sldSpeed(Control* sender, int type) {
  (void)type;
  speed = sender->value.toInt();
  ui_prev_sldSpeed = speed;
}

void cb_sldPwm(Control* sender, int type) {
  (void)type;
  int val = sender->value.toInt();
  ledcWrite(18, constrain(val, 0, 255));
}

void cb_btnPress(Control* sender, int type) {
  (void)sender;
  if (type == B_DOWN) presses++;
}

void cb_numTemp(Control* sender, int type) {
  (void)type;
  temp = sender->value.toFloat();
}

void cb_txtStatus(Control* sender, int type) {
  (void)type;
  status = sender->value;
  ui_prev_txtStatus = status;
}

void cb_selMode(Control* sender, int type) {
  (void)type;
  mode = sender->value.toInt();
}

// ---- WiFi ----
inline void ui_wifi_ap() {
  WiFi.mode(WIFI_AP);
  WiFi.softAP(UI_AP_SSID, UI_AP_PASS);
  Serial.print("AP IP: ");
  Serial.println(WiFi.softAPIP());
}

inline void ui_wifi() {
  WiFi.mode(WIFI_STA);
  WiFi.setHostname(UI_HOSTNAME);
  WiFi.begin(UI_WIFI_SSID, UI_WIFI_PASS);
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < UI_WIFI_TIMEOUT_MS) {
    delay(250);
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    return;
  }
  // Подключиться не удалось — поднимаем собственную точку доступа.
  ui_wifi_ap();
}

// ---- Инициализация ----
inline void ui_setup() {
  // Пины
  pinMode(2, OUTPUT);
  digitalWrite(2, LOW);
  ledcAttach(18, 5000, 8);
  ledcWrite(18, 0);

  // WiFi
  ui_wifi();

  // Контролы ESPUI
  ESPUI.sliderContinuous = true;
  tabMain = ESPUI.addControl(ControlType::Tab, "Главная", "Главная");
  tabSettings = ESPUI.addControl(ControlType::Tab, "Настройки", "Настройки");
  lblTemp = ESPUI.addControl(ControlType::Label, "Температура", String("T = ") + String(temp, 1) + " °C", ControlColor::Alizarin, tabMain);
  swLed = ESPUI.addControl(ControlType::Switcher, "Светодиод", ledOn ? "1" : "0", ControlColor::Emerald, tabMain, &cb_swLed);
  swRelay = ESPUI.addControl(ControlType::Switcher, "Реле", "1", ControlColor::Carrot, tabMain, &cb_swRelay);
  sldSpeed = ESPUI.addControl(ControlType::Slider, "Скорость", String(speed), ControlColor::Peterriver, tabMain, &cb_sldSpeed);
  ESPUI.addControl(ControlType::Min, "", "0", ControlColor::None, sldSpeed);
  ESPUI.addControl(ControlType::Max, "", "100", ControlColor::None, sldSpeed);
  sldPwm = ESPUI.addControl(ControlType::Slider, "Яркость", "0", ControlColor::Sunflower, tabMain, &cb_sldPwm);
  ESPUI.addControl(ControlType::Min, "", "0", ControlColor::None, sldPwm);
  ESPUI.addControl(ControlType::Max, "", "255", ControlColor::None, sldPwm);
  btnPress = ESPUI.addControl(ControlType::Button, "Счётчик нажатий", "Жми", ControlColor::Dark, tabMain, &cb_btnPress);
  sep1 = ESPUI.addControl(ControlType::Separator, "Датчики", "", ControlColor::None, tabMain);
  numTemp = ESPUI.addControl(ControlType::Number, "Уставка", String(temp, 1), ControlColor::Turquoise, tabSettings, &cb_numTemp);
  ESPUI.addControl(ControlType::Min, "", "10", ControlColor::None, numTemp);
  ESPUI.addControl(ControlType::Max, "", "30", ControlColor::None, numTemp);
  ESPUI.addControl(ControlType::Step, "", "0.5", ControlColor::None, numTemp);
  txtStatus = ESPUI.addControl(ControlType::Text, "Статус", status, ControlColor::Wetasphalt, tabSettings, &cb_txtStatus);
  selMode = ESPUI.addControl(ControlType::Select, "Режим", String(mode), ControlColor::Sunflower, tabSettings, &cb_selMode);
  ESPUI.addControl(ControlType::Option, "Авто", "1", ControlColor::None, selMode);
  ESPUI.addControl(ControlType::Option, "Ручной \"R\"", "2", ControlColor::None, selMode);
  lblAdc = ESPUI.addControl(ControlType::Label, "АЦП", String(analogRead(34)), ControlColor::Turquoise, tabSettings);
  grAdc = ESPUI.addControl(ControlType::Graph, "График АЦП", "", ControlColor::Wetasphalt, tabSettings);
  grTemp = ESPUI.addControl(ControlType::Graph, "График температуры", "", ControlColor::Alizarin, tabSettings);

  // Оформление (до begin)
  ESPUI.setPanelWide(sldSpeed, true);
  ESPUI.setVertical(sldPwm, true);

  // Запуск веб-интерфейса
  ESPUI.begin(UI_TITLE);
}

// ---- Периодическое обновление: устройство → UI ----
inline void ui_loop() {
  static uint32_t ui_last = 0;
  if (millis() - ui_last < UI_UPDATE_MS) return;
  ui_last = millis();
  {
    String cur = String("T = ") + String(temp, 1) + " °C";
    if (cur != ui_prev_lblTemp) {
      ui_prev_lblTemp = cur;
      ESPUI.updateLabel(lblTemp, cur);
    }
  }
  {
    int8_t cur = ledOn ? 1 : 0;
    if (cur != ui_prev_swLed) {
      ui_prev_swLed = cur;
      ESPUI.updateSwitcher(swLed, cur == 1);
    }
  }
  {
    int cur = speed;
    if (cur != ui_prev_sldSpeed) {
      ui_prev_sldSpeed = cur;
      ESPUI.updateSlider(sldSpeed, cur);
    }
  }
  {
    String cur = status;
    if (cur != ui_prev_txtStatus) {
      ui_prev_txtStatus = cur;
      ESPUI.updateText(txtStatus, cur);
    }
  }
  {
    String cur = String(analogRead(34));
    if (cur != ui_prev_lblAdc) {
      ui_prev_lblAdc = cur;
      ESPUI.updateLabel(lblAdc, cur);
    }
  }
  {
    ESPUI.addGraphPoint(grAdc, (int)(analogRead(34)));
  }
  {
    ESPUI.addGraphPoint(grTemp, (int)lroundf((float)(temp) * 10.0f));
  }
}
// <<GEN END>>
