# Платы второй волны: Adafruit Feather (ESP32-S3, RP2040, M0 Express), Lolin S2/S3/C3 Mini, LILYGO T-Display, Heltec WiFi LoRa 32 V3,
# ESP-01S, ESP32-CAM. Единицы — мм, начало — левый верхний угол платы, ось y вниз.
# Порядок выводов — по официальным схемам распиновки производителей; положение выводов вдоль платы снято по масштабу рисунка
# производителя (шаг 2.54 мм), мелкие детали — типовые/приблизительные. Координаты выводов (pins) — те же числа, что в слое приложения.
from boards import col, row

BOARDS = {}

# ---------------- Adafruit Feather: общие габариты 50.8 x 22.86, выводы через 20.32 мм ----------------
FW, FH = 22.86, 50.8
FY0 = 5.8

FEATHER_S3_L = ['RESET', '3V3', '3V3', 'GND', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'SCK', 'MOSI', 'MISO', 'RX', 'TX', 'TXD0']
FEATHER_R = ['VBAT', 'EN', 'VBUS', 'D13', 'D12', 'D11', 'D10', 'D9', 'D6', 'D5', 'SCL', 'SDA']


def feather_pins(left, right):
    return col('L', 1.27, FY0, left, 'r') + col('R', 21.59, round(FY0 + 4 * 2.54, 3), right, 'l')


BOARDS['feather-esp32s3'] = dict(
    W=FW, H=FH, mask='black', radius=1.2, title='Feather ESP32-S3', pin_silk=False,
    pins=feather_pins(FEATHER_S3_L, FEATHER_R),
    comps=[
        ('usbc', dict(cx=11.43, edge=-0.6, side='t')),
        ('btn', dict(cx=4.6, cy=12.2, small=True)), ('btn', dict(cx=4.6, cy=19.4, small=True)),
        ('smd', dict(cx=16.6, cy=11.4, w=6.4, h=4.4, kind='c')),
        ('rgb', dict(cx=16.4, cy=21.6)),
        ('led', dict(cx=16.4, cy=17.6, color='red')),
        ('shieldbox', dict(cx=11.43, cy=34.0, w=14.0, h=17.0, text='ESP32-S3')),
        ('antenna', dict(cx=11.43, cy=45.6, w=11.0, h=4.0, n=4)),
        ('sot223', dict(cx=11.43, cy=22.6, rot=0, small=True)),
        ('smd', dict(cx=8.0, cy=15.0, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=14.6, cy=25.4, w=1.0, h=0.5, kind='r')),
        ('text', dict(x=11.43, y=26.6, t='FEATHER ESP32-S3', size=0.6)),
    ])

FEATHER_RP_L = ['RESET', '3V3', '3V3', 'GND', 'A0', 'A1', 'A2', 'A3', 'D24', 'D25', 'SCK', 'MOSI', 'MISO', 'RX', 'TX', 'D4']
BOARDS['feather-rp2040'] = dict(
    W=FW, H=FH, mask='black', radius=1.2, title='Feather RP2040', pin_silk=False,
    pins=feather_pins(FEATHER_RP_L, FEATHER_R),
    comps=[
        ('usbc', dict(cx=11.43, edge=-0.6, side='t')),
        ('btn', dict(cx=4.6, cy=12.2, small=True)),
        ('smd', dict(cx=16.6, cy=11.4, w=6.4, h=4.4, kind='c')),
        ('rgb', dict(cx=18.6, cy=25.0)),
        ('led', dict(cx=16.4, cy=17.6, color='red')),
        ('qfn', dict(cx=11.43, cy=31.0, s=7.0, text='RP2040', pins=14)),
        ('soic', dict(cx=8.0, cy=39.0, w=3.2, h=2.6, text='', pins=8)),
        ('xtal_sm', dict(cx=14.6, cy=39.4)),
        ('btn', dict(cx=16.4, cy=45.4, small=True)),
        ('smd', dict(cx=5.4, cy=44.6, w=3.0, h=3.4, kind='c')),
        ('sot223', dict(cx=11.43, cy=22.6, rot=0, small=True)),
        ('smd', dict(cx=8.0, cy=17.0, w=1.0, h=0.5, kind='c')),
        ('text', dict(x=11.43, y=48.2, t='BOOTSEL', size=0.55)),
    ])

FEATHER_M0_L = ['RESET', '3V3', 'AREF', 'GND', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'SCK', 'MOSI', 'MISO', 'RX', 'TX', 'GND']
BOARDS['feather-m0-express'] = dict(
    W=FW, H=FH, mask='black', radius=1.2, title='Feather M0 Express', pin_silk=False,
    pins=feather_pins(FEATHER_M0_L, FEATHER_R),
    comps=[
        ('micro', dict(cx=11.43, edge=-1.2, side='t')),
        ('btn', dict(cx=4.6, cy=12.2, small=True)),
        ('smd', dict(cx=16.6, cy=11.6, w=6.4, h=4.4, kind='c')),
        ('led', dict(cx=16.4, cy=17.6, color='red')), ('rgb', dict(cx=18.4, cy=27.0)),
        ('qfp', dict(cx=11.43, cy=29.6, body=7.0, pins=12, rot=0, text='SAMD21\nG18A')),
        ('soic', dict(cx=11.43, cy=39.8, w=3.4, h=2.8, text='', pins=8)),
        ('xtal_sm', dict(cx=16.6, cy=34.8)),
        ('sot223', dict(cx=11.43, cy=21.4, rot=0, small=True)),
        ('smd', dict(cx=5.6, cy=36.0, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=17.2, cy=40.6, w=1.0, h=0.5, kind='r')),
        ('text', dict(x=11.43, y=46.4, t='FEATHER M0 EXPRESS', size=0.55)),
    ])

# ---------------- Wemos (Lolin) S2 / S3 Mini: 34.3 x 25.4, по 2 столбца выводов с каждой стороны ----------------
MY0 = 7.6
S2_LO = ['EN', '3', '5', '7', '9', '11', '12', '3V3']
S2_LI = ['1', '2', '4', '6', '8', '10', '13', '14']
S2_RI = ['40', '38', '36', '34', '21', '17', 'GND', '15']
S2_RO = ['39', '37', '35', '33', '18', '16', 'GND', 'VBUS']
S3_LO = ['EN', '2', '4', '12', '13', '11', '10', '3V3']
S3_LI = ['1', '3', '5', '6', '7', '8', '9', '14']
S3_RI = ['33', '37', '38', '34', '21', '17', 'GND', '15']
S3_RO = ['43', '44', '36', '35', '18', '16', 'GND', 'VBUS']


def mini_pins(lo, li, ri, ro):
    return (col('LO', 1.2, MY0, lo, 'r') + col('LI', 3.8, MY0, li, 'r') + col('RI', 21.6, MY0, ri, 'l') + col('RO', 24.2, MY0, ro, 'l'))


def mini_comps(chip, title):
    return [
        ('usbc', dict(cx=12.7, edge=34.9, side='b')),
        ('antenna', dict(cx=12.7, cy=3.4, w=10.0, h=3.6, n=4)),
        ('qfn', dict(cx=14.2, cy=16.3, s=7.0, text=chip, pins=14)),
        ('xtal_sm', dict(cx=15.8, cy=9.2)),
        ('sot223', dict(cx=7.6, cy=23.4, rot=0, small=True)),
        ('btn', dict(cx=3.4, cy=31.0, small=True)), ('btn', dict(cx=22.0, cy=31.0, small=True)),
        ('led', dict(cx=18.6, cy=31.2, color='blue')),
        ('smd', dict(cx=7.0, cy=15.0, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=20.2, cy=22.0, w=1.0, h=0.5, kind='r')),
        ('smd', dict(cx=10.6, cy=27.0, w=1.0, h=0.5, kind='c')),
        ('text', dict(x=19.4, y=16.0, t=title, size=0.9, rot=90)),
        ('text', dict(x=3.4, y=33.6, t='RST', size=0.6)), ('text', dict(x=22.0, y=33.6, t='0', size=0.6)),
    ]


BOARDS['lolin-s2-mini'] = dict(
    W=25.4, H=34.3, mask='purple', radius=2.0, title='S2 Mini', pin_silk=False,
    pins=mini_pins(S2_LO, S2_LI, S2_RI, S2_RO), comps=mini_comps('ESP32-S2', 'S2 MINI'))
BOARDS['lolin-s3-mini'] = dict(
    W=25.4, H=34.3, mask='purple_dark', radius=2.0, title='S3 Mini', pin_silk=False,
    pins=mini_pins(S3_LO, S3_LI, S3_RI, S3_RO), comps=mini_comps('ESP32-S3', 'S3 MINI'))

# ---------------- Wemos (Lolin) C3 Mini: 34.3 x 25.4, один столбец с каждой стороны ----------------
C3ML = ['EN', '3', '2', '1', '0', '4', '5', '3V3']
C3MR = ['21', '20', '10', '8', '7', '6', 'GND', 'VBUS']
BOARDS['lolin-c3-mini'] = dict(
    W=25.4, H=34.3, mask='purple_dark', radius=2.0, title='C3 Mini', pin_silk=False,
    pins=col('L', 1.3, 7.7, C3ML, 'r') + col('R', 24.1, 7.7, C3MR, 'l'),
    comps=[
        ('usbc', dict(cx=12.7, edge=34.9, side='b')),
        ('ceramic_ant', dict(cx=12.7, cy=1.9, w=6.4, h=1.8)),
        ('qfn', dict(cx=13.6, cy=14.0, s=5.0, text='ESP32\nC3', pins=8, shield=True)),
        ('xtal_sm', dict(cx=17.6, cy=13.8, vertical=True)),
        ('sot223', dict(cx=7.4, cy=22.0, rot=0, small=True)),
        ('btn', dict(cx=3.4, cy=31.0, small=True)), ('btn', dict(cx=22.0, cy=31.0, small=True)),
        ('rgb', dict(cx=18.0, cy=31.2)),
        ('smd', dict(cx=8.0, cy=14.0, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=19.6, cy=22.0, w=1.0, h=0.5, kind='r')),
        ('text', dict(x=13.0, y=20.6, t='C3 MINI', size=0.9)),
        ('text', dict(x=3.4, y=33.6, t='RST', size=0.6)),
    ])

# ---------------- LILYGO TTGO T-Display (размеры по масштабу рисунка производителя) ----------------
TDL = ['GND', 'GND', '21', '22', '17', '2', '15', '13', '12', 'GND', 'GND', '3V3']
TDR = ['3V3', '36', '37', '38', '39', '32', '33', '25', '26', '27', 'GND', '5V']
BOARDS['ttgo-t-display'] = dict(
    W=25.0, H=51.5, mask='black', radius=1.2, title='TTGO T-Display',
    pins=col('L', 1.07, 7.2, TDL, 'r') + col('R', 23.93, 7.2, TDR, 'l'),
    comps=[
        ('usbc', dict(cx=12.5, edge=52.1, side='b')),
        ('display', dict(cx=12.5, cy=22.3, w=17.9, h=28.6, gw=14.2, gh=24.6, gdy=0.5)),
        ('btn', dict(cx=3.7, cy=46.6, small=True)), ('btn', dict(cx=21.3, cy=46.6, small=True)),
        ('smd', dict(cx=12.5, cy=40.2, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=8.0, cy=44.0, w=1.0, h=0.5, kind='r')),
        ('text', dict(x=12.5, y=3.4, t='T-DISPLAY', size=1.0)),
        ('text', dict(x=3.7, y=49.4, t='0', size=0.6)), ('text', dict(x=21.3, y=49.4, t='35', size=0.6)),
    ])

# ---------------- Heltec WiFi LoRa 32 V3 (габариты по масштабу рисунка производителя, приблизительно) ----------------
HVL = ['GPIO7', 'GPIO6', 'GPIO5', 'GPIO4', 'GPIO3', 'GPIO2', 'GPIO1', 'GPIO38', 'GPIO39', 'GPIO40', 'GPIO41', 'GPIO42', 'GPIO45', 'GPIO46', 'GPIO37', '3V3', '3V3', 'GND']
HVR = ['GPIO19', 'GPIO20', 'GPIO21', 'GPIO26', 'GPIO48', 'GPIO47', 'GPIO33', 'GPIO34', 'GPIO35', 'GPIO36', 'GPIO0', 'RST', 'GPIO43', 'GPIO44', 'Ve', 'Ve2', '5V', 'GND']
BOARDS['heltec-lora32-v3'] = dict(
    W=25.4, H=52.5, mask='white', radius=1.2, title='WiFi LoRa 32 V3',
    pins=col('L', 1.27, 4.8, [t.replace('GPIO', '') for t in HVL], 'r') + col('R', 24.13, 4.8, [t.replace('GPIO', '') for t in HVR], 'l'),
    comps=[
        ('usbc', dict(cx=12.7, edge=53.1, side='b')),
        ('display', dict(cx=12.7, cy=19.0, w=15.4, h=24.6, gw=12.6, gh=22.0, dz=1.2)),
        ('shieldbox', dict(cx=12.7, cy=43.0, w=9.0, h=5.0, text='')),
        ('btn', dict(cx=4.8, cy=47.6, small=True)), ('btn', dict(cx=20.6, cy=47.6, small=True)),
        ('led', dict(cx=18.2, cy=43.8, color='white')),
        ('smd', dict(cx=6.4, cy=40.2, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=19.8, cy=38.0, w=1.0, h=0.5, kind='r')),
        ('text', dict(x=5.0, y=51.0, t='PRG', size=0.6)), ('text', dict(x=20.4, y=51.0, t='RST', size=0.6)),
    ])

# ---------------- ESP-01S (24.4 x 14.4, по документации Ai-Thinker; вид, как на рисунке документации) ----------------
EXA = 3.39
BOARDS['esp-01s'] = dict(
    W=14.4, H=24.4, mask='blue', radius=0.8, title='ESP-01S',
    pins=row('I', EXA, 20.4, ['RX', 'IO0', 'IO2', 'GND'], 't') + row('O', EXA, 22.94, ['3V3', 'RST', 'EN', 'TX'], 'b'),
    comps=[
        ('antenna', dict(cx=7.2, cy=3.2, w=9.6, h=4.2, n=5)),
        ('qfn', dict(cx=7.2, cy=11.6, s=5.0, text='ESP\n8266', pins=7)),
        ('soic', dict(cx=11.4, cy=16.0, w=3.2, h=2.6, text='', pins=8)),
        ('xtal_sm', dict(cx=3.2, cy=14.6, vertical=True)),
        ('led', dict(cx=3.4, cy=18.0, color='red')), ('led', dict(cx=11.0, cy=7.6, color='blue')),
        ('smd', dict(cx=4.0, cy=9.4, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=10.8, cy=11.4, w=1.0, h=0.5, kind='r')),
    ])

# ---------------- AI-Thinker ESP32-CAM (27 x 40.5, по документации AI-Thinker) ----------------
CAML = ['5V', 'GND', '12', '13', '15', '14', '2', '4']
CAMR = ['3V3', '16', '0', 'GND', 'VCC', 'U0R', 'U0T', 'GND']
BOARDS['esp32-cam'] = dict(
    W=27.0, H=40.5, mask='black', radius=1.2, title='ESP32-CAM',
    pins=col('L', 2.07, 5.0, CAML, 'r') + col('R', 24.93, 5.0, CAMR, 'l'),
    comps=[
        ('box', dict(cx=13.5, cy=10.4, w=8.4, h=8.4, dz=4.0, mat='plastic_black', bevel=0.3)),
        ('lens', dict(cx=13.5, cy=10.4, r=2.2, dz=4.4, mat='print_dark')),
        ('lens', dict(cx=13.5, cy=10.4, r=1.0, dz=4.6, mat='led_blue')),
        ('box', dict(cx=13.5, cy=26.8, w=12.0, h=2.2, dz=1.2, mat='plastic_white', bevel=0.1)),
        ('shieldbox', dict(cx=13.5, cy=33.6, w=13.0, h=6.2, text='ESP32-S')),
        ('led', dict(cx=24.0, cy=30.2, color='white')),
        ('smd', dict(cx=6.6, cy=19.6, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=19.6, cy=19.8, w=1.0, h=0.5, kind='r')),
        ('text', dict(x=13.5, y=38.2, t='ESP32-CAM', size=1.2)),
    ])
