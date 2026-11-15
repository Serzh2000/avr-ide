// Шаблоны новых скетчей. id используется в IPC, код подставляется как есть.
import type { TemplateInfo } from './types'

interface Template extends TemplateInfo { code: string }

const BLINK = `// Мигание встроенным светодиодом
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  delay(500);
}
`

const EMPTY = `void setup() {
  // Код, который выполняется один раз при старте
}

void loop() {
  // Код, который выполняется постоянно
}
`

const SERIAL = `// Вывод в монитор порта
int counter = 0;

void setup() {
  Serial.begin(115200);
  Serial.println("Привет из скетча!");
}

void loop() {
  Serial.print("Счётчик: ");
  Serial.println(counter++);
  delay(1000);
}
`

const BUTTON = `// Кнопка включает светодиод
const int BUTTON_PIN = 2;   // кнопка между пином и GND
const int LED_PIN = LED_BUILTIN;

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  bool pressed = digitalRead(BUTTON_PIN) == LOW;
  digitalWrite(LED_PIN, pressed ? HIGH : LOW);
}
`

const ANALOG = `// Чтение аналогового входа
const int SENSOR_PIN = A0;

void setup() {
  Serial.begin(115200);
}

void loop() {
  int value = analogRead(SENSOR_PIN);
  Serial.println(value);
  delay(200);
}
`

const ESP32_WIFI = `// ESP32: подключение к Wi-Fi
#include <WiFi.h>

const char* WIFI_SSID = "ИМЯ_СЕТИ";
const char* WIFI_PASS = "ПАРОЛЬ";

void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Подключение к Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("IP-адрес: ");
  Serial.println(WiFi.localIP());
}

void loop() {
}
`

const ESP8266_WIFI = `// ESP8266: подключение к Wi-Fi
#include <ESP8266WiFi.h>

const char* WIFI_SSID = "ИМЯ_СЕТИ";
const char* WIFI_PASS = "ПАРОЛЬ";

void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Подключение к Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("IP-адрес: ");
  Serial.println(WiFi.localIP());
}

void loop() {
}
`

const ALL: Template[] = [
  { id: 'empty', name: 'Пустой скетч', description: 'Только setup() и loop()', group: 'basic', code: EMPTY },
  { id: 'blink', name: 'Blink', description: 'Мигание встроенным светодиодом', group: 'basic', code: BLINK },
  { id: 'serial', name: 'Монитор порта', description: 'Вывод текста и счётчика в Serial', group: 'basic', code: SERIAL },
  { id: 'button', name: 'Кнопка и светодиод', description: 'Чтение кнопки с подтяжкой', group: 'basic', code: BUTTON },
  { id: 'analog', name: 'Аналоговый вход', description: 'analogRead и вывод значения', group: 'basic', code: ANALOG },
  { id: 'esp32-wifi', name: 'ESP32 Wi-Fi', description: 'Подключение к сети, вывод IP', group: 'esp32', code: ESP32_WIFI },
  { id: 'esp8266-wifi', name: 'ESP8266 Wi-Fi', description: 'Подключение к сети, вывод IP', group: 'esp8266', code: ESP8266_WIFI }
]

export const listTemplates = (): TemplateInfo[] => ALL.map(({ code: _c, ...t }) => t)
export const templateCode = (id: unknown): string | null => ALL.find((t) => t.id === id)?.code ?? null
