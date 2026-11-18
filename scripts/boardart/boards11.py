# Платы пятой волны, часть 2: LILYGO T-Display-S3 и Heltec Wireless Stick Lite V3. Единицы — мм, ось y вниз.
# Порядок выводов — по официальным картам производителей; габариты оценены по масштабу рисунка (приблизительно).
from boards import col

BOARDS = {}

# ---------------- LILYGO T-Display-S3 (≈ 25.4 x 62) ----------------
TDL = ['3V3', '1', '2', '3', '10', '11', '12', '13', 'NC', 'NC', 'GND', '5V']
TDR = ['GND', 'GND', '43', '44', '18', '17', '21', '16', 'NC', 'GND', 'GND', '3V3']
BOARDS['tdisplay-s3'] = dict(
    W=25.4, H=62.0, mask='black', radius=1.2, title='T-Display-S3', pin_silk=False,
    pins=col('L', 1.27, 3.0, TDL, 'r') + col('R', 24.13, 3.0, TDR, 'l'),
    comps=[
        ('usbc', dict(cx=12.7, edge=62.6, side='b')),
        ('display', dict(cx=12.7, cy=37.6, w=17.4, h=32.0, gw=14.6, gh=28.0, gdy=0.4)),
        ('shieldbox', dict(cx=12.7, cy=12.2, w=12.6, h=15.0, text='ESP32-S3')),
        ('btn', dict(cx=4.6, cy=58.0, small=True)), ('btn', dict(cx=20.8, cy=58.0, small=True)),
        ('smd', dict(cx=5.2, cy=22.0, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=19.6, cy=22.4, w=1.0, h=0.5, kind='r')),
        ('text', dict(x=12.7, y=21.4, t='T-DISPLAY-S3', size=0.8)),
    ])

# ---------------- Heltec Wireless Stick Lite V3 (≈ 25.4 x 62, по 20 выводов) ----------------
WL = ['Ve', 'GND', '12', '44', '43', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '45', '46', '1', '2', '3']
WR = ['5V', '3V3', 'GND', '47', '48', '0', '26', '20', '18', '21', '19', '17', '14', 'RST', '16', '15', '7', '6', '5', '4']
BOARDS['heltec-ws-lite-v3'] = dict(
    W=25.4, H=60.0, mask='black', radius=1.2, title='Wireless Stick Lite V3', pin_silk=False,
    pins=col('L', 1.27, 4.8, WL, 'r') + col('R', 24.13, 4.8, WR, 'l'),
    comps=[
        ('usbc', dict(cx=12.7, edge=-0.6, side='t')),
        ('btn', dict(cx=3.6, cy=8.4, small=True)), ('btn', dict(cx=21.8, cy=8.4, small=True)),
        ('shieldbox', dict(cx=12.7, cy=24.0, w=14.0, h=24.0, text='ESP32-S3 + SX1262')),
        ('ceramic_ant', dict(cx=12.7, cy=52.4, w=9.0, h=2.2)),
        ('led', dict(cx=12.7, cy=11.4, color='white')),
        ('smd', dict(cx=5.6, cy=40.0, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=19.8, cy=42.0, w=1.0, h=0.5, kind='r')),
    ])
