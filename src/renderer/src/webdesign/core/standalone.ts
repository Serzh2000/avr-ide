import { rawDelimiter, utf8Length } from './escape'
import { isPicoWBoard } from './targets'

export type StaticFirmware = 'pico-arduino' | 'pico-python' | 'uno-at'

export const UNO_PAGE_GUIDE_BYTES = 18 * 1024

export function staticFirmwareFor(fqbn: string | undefined): StaticFirmware | null {
  const board = fqbn?.split(':').slice(0, 3).join(':')
  if (isPicoWBoard(fqbn)) return 'pico-arduino'
  if (board === 'arduino:avr:uno') return 'uno-at'
  return null
}

export function standaloneSketch(bundle: string, target: 'pico-arduino' | 'uno-at'): string {
  const uno = target === 'uno-at'
  const delimiter = rawDelimiter(bundle)
  const setup = uno ? `  modem.begin(9600);
  WiFi.init(modem);
  if (WiFi.status() == WL_NO_MODULE) {
    Serial.println(F("ESP-AT module not responding"));
    return;
  }
  // Configure the connection once with WiFiEspAT's SetupPersistentWiFiConnection.
  Serial.println(F("Waiting for the saved Wi-Fi connection"));` : `  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.println(F("Waiting for Wi-Fi"));`

  return `// AVR IDE: stand-alone static web page for ${uno ? 'Arduino Uno + ESP8266 ESP-AT' : 'Raspberry Pi Pico W / Pico 2 W (Arduino-Pico)'}.
// This HTTP server serves the page. It has no pin control, WebSocket or OTA.
#include <Arduino.h>
${uno ? '#include <SoftwareSerial.h>\n#include <WiFiEspAT.h>' : '#include <WiFi.h>'}
#include <string.h>

${uno ? 'SoftwareSerial modem(6, 7); // Uno RX, TX. Use 3.3 V level translation.' : 'const char WIFI_SSID[] = "YOUR_WIFI";\nconst char WIFI_PASSWORD[] = "YOUR_PASSWORD";'}
WiFiServer server(80);
static const char PAGE_HTML[] PROGMEM = R"${delimiter}(${bundle})${delimiter}";
static const unsigned long PAGE_BYTES = ${utf8Length(bundle)}UL;
static bool listening = false;

void setup() {
  Serial.begin(115200);
${setup}
}

// Read bounded headers and serve a fixed path; never open client-supplied files.
static bool requestingPage(WiFiClient& client) {
  char line[64];
  size_t used = 0;
  uint16_t total = 0;
  bool first = true;
  bool root = false;
  bool empty = true;
  const unsigned long started = millis();
  while (client.connected() && millis() - started < 2500 && total < 2048) {
    if (!client.available()) { delay(1); continue; }
    int value = client.read();
    if (value < 0) continue;
    total++;
    if (value == '\\r') continue;
    if (value == '\\n') {
      if (first) {
        line[used] = 0;
        root = strncmp(line, "GET / HTTP/1.", 13) == 0 ||
               strncmp(line, "GET /index.html HTTP/1.", 23) == 0;
        first = false;
      } else if (empty) return root;
      empty = true;
    } else {
      empty = false;
      if (!first) continue;
      if (used == sizeof(line) - 1) return false;
      line[used++] = (char)value;
    }
  }
  return false;
}

static void sendPage(WiFiClient& client) {
  client.print(F("HTTP/1.1 200 OK\\r\\nContent-Type: text/html; charset=utf-8\\r\\nConnection: close\\r\\nContent-Length: "));
  client.println(PAGE_BYTES);
  client.println();
  uint8_t chunk[128];
  for (unsigned long offset = 0; offset < PAGE_BYTES;) {
    size_t length = PAGE_BYTES - offset > sizeof(chunk) ? sizeof(chunk) : (size_t)(PAGE_BYTES - offset);
    memcpy_P(chunk, PAGE_HTML + offset, length);
    size_t sent = client.write(chunk, length);
    if (!sent || sent > length) break;
    offset += sent;
  }
}

void loop() {
  if (!listening) {
    if (WiFi.status() != WL_CONNECTED) { delay(250); return; }
    server.begin();
    listening = true;
    Serial.print(F("http://"));
    Serial.println(WiFi.localIP());
  }
  WiFiClient client = server.accept();
  if (!client) return;
  if (requestingPage(client)) sendPage(client);
  else client.print(F("HTTP/1.1 404 Not Found\\r\\nContent-Length: 0\\r\\nConnection: close\\r\\n\\r\\n"));
  client.stop();
}
`
}

export const PICO_WEB_PYTHON = String.raw`# AVR IDE: serve page_bundle.html from the CIRCUITPY drive on Pico W / Pico 2 W.
# Set CIRCUITPY_WIFI_SSID and CIRCUITPY_WIFI_PASSWORD in settings.toml.
import os
import time
import wifi
import socketpool

SSID = os.getenv("CIRCUITPY_WIFI_SSID")
PASSWORD = os.getenv("CIRCUITPY_WIFI_PASSWORD", "")
if not SSID:
    raise RuntimeError("Set CIRCUITPY_WIFI_SSID in settings.toml")
if not wifi.radio.connected:
    wifi.radio.connect(SSID, PASSWORD)

pool = socketpool.SocketPool(wifi.radio)
server = pool.socket(pool.AF_INET, pool.SOCK_STREAM)
server.bind(("0.0.0.0", 80))
server.listen(1)
print("http://{}".format(wifi.radio.ipv4_address))
buffer = bytearray(512)

def serve(client):
    request = bytearray()
    started = time.monotonic()
    while b"\r\n\r\n" not in request and len(request) < 2048 and time.monotonic() - started < 2:
        size = client.recv_into(buffer)
        if not size:
            return
        request.extend(memoryview(buffer)[:size])
    if b"\r\n\r\n" not in request:
        return
    parts = bytes(request).split(b"\n", 1)[0].strip().split()
    if len(parts) != 3 or parts[0] != b"GET" or parts[1] not in (b"/", b"/index.html"):
        client.sendall(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
        return
    try:
        length = os.stat("/page_bundle.html")[6]
        page = open("/page_bundle.html", "rb")
    except OSError:
        body = b"Copy page_bundle.html to CIRCUITPY."
        client.sendall(b"HTTP/1.1 404 Not Found\r\nConnection: close\r\n"
                       b"Content-Type: text/plain\r\nContent-Length: %d\r\n\r\n" % len(body))
        client.sendall(body)
        return
    with page:
        client.sendall(b"HTTP/1.1 200 OK\r\nConnection: close\r\n"
                       b"Content-Type: text/html; charset=utf-8\r\nContent-Length: %d\r\n\r\n" % length)
        while True:
            size = page.readinto(buffer)
            if not size:
                break
            client.sendall(memoryview(buffer)[:size])

while True:
    client, address = server.accept()
    try:
        client.settimeout(2)
        serve(client)
    except OSError:
        pass
    finally:
        client.close()
`
