# Платы третьей волны: Arduino Uno R4 (Minima, WiFi), Nano RP2040 Connect, MKR WiFi 1010, XIAO nRF52840 / ESP32C6,
# Adafruit ItsyBitsy RP2040, QT Py RP2040. Единицы — мм, начало — левый верхний угол платы, ось y вниз.
# Порядок выводов — по официальным схемам производителей; положение выводов вдоль платы снято по масштабу рисунка (шаг 2.54 мм),
# мелкие детали — типовые/приблизительные.
from boards import col, row
import boards2
from boards3 import xiao, XL, XCR, NANO_Y0, NER, NEL

BOARDS = {}

# ---------------- Arduino Uno R4 (формат Uno) ----------------
_uno = boards2.BOARDS['uno']
_hdr = [c for c in _uno['comps'] if c[0] in ('fheader', 'hole')]
BOARDS['uno-r4-minima'] = dict(
    _uno, title='Uno R4 Minima',
    comps=_hdr + [
        ('usbc', dict(cx=0, edge=-0.9, side='l', cy=15.3)),
        ('dcjack', dict(cx=4.4, cy=46.2, w=14.4, h=9.0)),
        ('qfp', dict(cx=40.0, cy=30.0, body=10.0, pins=16, rot=0, text='R7FA4M1')),
        ('btn2', dict(cx=7.0, cy=4.8)),
        ('icsp', dict(cx=56.0, cy=26.0)),
        ('sot223', dict(cx=22.4, cy=41.4, rot=0)),
        ('ecap', dict(cx=16.4, cy=33.4, r=2.6)),
        ('led', dict(cx=24.0, cy=13.8, color='green')), ('led', dict(cx=24.0, cy=16.6, color='green')), ('led', dict(cx=24.0, cy=19.4, color='red')),
        ('smd', dict(cx=28.0, cy=14.4, w=1.0, h=0.5, kind='r')), ('smd', dict(cx=28.0, cy=17.2, w=1.0, h=0.5, kind='r')),
        ('smd', dict(cx=46.0, cy=42.0, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=28.6, cy=47.0, w=2.0, h=1.2, kind='c')),
        ('text', dict(x=47.0, y=45.0, t='UNO R4 MINIMA', size=1.8)),
    ])
BOARDS['uno-r4-wifi'] = dict(
    _uno, title='Uno R4 WiFi',
    comps=_hdr + [
        ('usbc', dict(cx=0, edge=-0.9, side='l', cy=15.3)),
        ('dcjack', dict(cx=4.4, cy=46.2, w=14.4, h=9.0)),
        ('shieldbox', dict(cx=24.0, cy=13.0, w=15.0, h=14.0, text='ESP32-S3')),
        ('box', dict(cx=46.0, cy=22.0, w=26.0, h=17.0, dz=1.0, mat='plastic_black', bevel=0.2)),
        ('qfp', dict(cx=47.0, cy=39.0, body=10.0, pins=16, rot=0, text='R7FA4M1')),
        ('btn2', dict(cx=7.0, cy=4.8)),
        ('sot223', dict(cx=22.4, cy=41.4, rot=0)),
        ('ecap', dict(cx=16.4, cy=33.4, r=2.6)),
        ('smd', dict(cx=36.0, cy=40.0, w=1.0, h=0.5, kind='r')), ('smd', dict(cx=28.6, cy=47.0, w=2.0, h=1.2, kind='c')),
        ('text', dict(x=35.0, y=48.0, t='UNO R4 WIFI', size=1.8)),
    ])

# ---------------- Arduino Nano RP2040 Connect (45 x 18) ----------------
NRL = ['D13', '3V3', 'AREF', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', '5V', 'REC', 'GND', 'VIN']
NRR = ['D12', 'D11', 'D10', 'D9', 'D8', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'GND', 'RST', 'RX', 'TX']
BOARDS['nano-rp2040-connect'] = dict(
    W=18, H=45, mask='teal', radius=1.0, title='Nano RP2040 Connect',
    pins=col('L', 1.38, NANO_Y0, NRL, 'r') + col('R', 16.62, NANO_Y0, NRR, 'l'),
    comps=[
        ('micro', dict(cx=9.0, edge=-1.4, side='t')),
        ('btn', dict(cx=9.0, cy=8.4, small=True)),
        ('qfn', dict(cx=9.0, cy=22.0, s=7.0, text='RP2040', pins=14)),
        ('soic', dict(cx=5.0, cy=14.0, w=3.0, h=2.4, text='', pins=8)),
        ('soic', dict(cx=13.0, cy=14.0, w=3.0, h=2.4, text='', pins=8)),
        ('shieldbox', dict(cx=9.0, cy=34.5, w=11.0, h=8.6, text='NINA-W102')),
        ('antenna', dict(cx=9.0, cy=41.4, w=9.0, h=3.2, n=4)),
        ('led', dict(cx=5.4, cy=11.0, color='green')), ('led', dict(cx=12.6, cy=11.0, color='red')),
        ('smd', dict(cx=5.4, cy=27.4, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=12.6, cy=28.4, w=1.0, h=0.5, kind='r')),
        ('text', dict(x=9.0, y=17.4, t='NANO RP2040', size=0.65)),
    ])

# ---------------- Arduino MKR WiFi 1010 (61.5 x 25, выводы через 20.32 мм) ----------------
MKL = ['AREF', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'D0', 'D1', 'D2', 'D3', 'D4', 'D5']
MKR_ = ['5V', 'VIN', '3V3', 'GND', 'RST', 'D14', 'D13', 'D12', 'D11', 'D10', 'D9', 'D8', 'D7', 'D6']
BOARDS['mkr-wifi-1010'] = dict(
    W=25.0, H=61.5, mask='teal', radius=1.4, title='MKR WiFi 1010',
    pins=col('L', 2.34, 22.2, MKL, 'r') + col('R', 22.66, 22.2, MKR_, 'l'),
    comps=[
        ('micro', dict(cx=12.5, edge=-1.4, side='t')),
        ('btn', dict(cx=12.5, cy=17.0, small=True)),
        ('smd', dict(cx=19.0, cy=7.0, w=6.0, h=4.0, kind='c')),
        ('qfn', dict(cx=12.5, cy=28.0, s=7.0, text='SAMD21', pins=14)),
        ('shieldbox', dict(cx=12.5, cy=49.0, w=13.0, h=10.0, text='NINA-W10')),
        ('antenna', dict(cx=12.5, cy=57.4, w=11.0, h=3.0, n=4)),
        ('led', dict(cx=5.4, cy=9.0, color='red')), ('led', dict(cx=19.0, cy=13.0, color='green')),
        ('smd', dict(cx=8.0, cy=40.0, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=17.0, cy=40.0, w=1.0, h=0.5, kind='r')),
        ('text', dict(x=12.5, y=21.0, t='MKR WIFI 1010', size=0.7)),
    ])

# ---------------- Seeed XIAO nRF52840 / ESP32C6 (тот же форм-фактор 21 x 17.8) ----------------
BOARDS['xiao-nrf52840'] = xiao('XIAO nRF52840', 'nRF52840', [
    ('btn', dict(cx=4.6, cy=18.4, small=True)), ('led', dict(cx=8.9, cy=18.4, color='blue')),
    ('smd', dict(cx=13.2, cy=18.4, w=2.4, h=2.0, kind='c')),
], [('led', dict(cx=14.6, cy=5.0, color='red')), ('smd', dict(cx=4.2, cy=6.8, w=1.0, h=0.5, kind='c'))])
BOARDS['xiao-esp32c6'] = xiao('XIAO ESP32C6', 'ESP32-C6', [
    ('smd', dict(cx=4.6, cy=18.2, w=2.6, h=2.6, kind='c')), ('smd', dict(cx=12.6, cy=18.4, w=5.0, h=1.6, kind='r')),
], [('led', dict(cx=14.6, cy=5.0, color='red')), ('btn', dict(cx=4.2, cy=3.4, small=True)), ('smd', dict(cx=13.6, cy=7.4, w=1.0, h=0.5, kind='r'))])

# ---------------- Adafruit ItsyBitsy RP2040 (36 x 18, выводы через 12.7 мм) ----------------
IBL = ['RESET', '3V3', '3V3', 'VHI', 'A0', 'A1', 'A2', 'A3', 'D24', 'D25', 'SCK', 'MOSI', 'MISO', 'D2']
IBR = ['VBAT', 'GND', 'VBUS', 'D13', 'D12', 'D11', 'D10', 'D9', 'D7', 'D5', 'SCL', 'SDA', 'TX', 'RX']
BOARDS['itsybitsy-rp2040'] = dict(
    W=18.0, H=36.0, mask='black', radius=1.0, title='ItsyBitsy RP2040', pin_silk=False,
    pins=col('L', 2.65, 1.6, IBL, 'r') + col('R', 15.35, 1.6, IBR, 'l'),
    comps=[
        ('usbc', dict(cx=9.0, edge=-0.9, side='t')),
        ('qfn', dict(cx=9.0, cy=18.0, s=7.0, text='RP2040', pins=14)),
        ('soic', dict(cx=9.0, cy=26.0, w=3.2, h=2.6, text='', pins=8)),
        ('btn', dict(cx=4.4, cy=30.8, small=True)), ('btn', dict(cx=13.6, cy=30.8, small=True)),
        ('rgb', dict(cx=9.0, cy=10.4)),
        ('xtal_sm', dict(cx=13.4, cy=22.6)),
        ('smd', dict(cx=5.0, cy=22.0, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=13.0, cy=14.0, w=1.0, h=0.5, kind='r')),
        ('text', dict(x=9.0, y=33.6, t='ITSYBITSY', size=0.6)),
    ])

# ---------------- Adafruit QT Py RP2040 (форм-фактор XIAO, размеры по форм-фактору) ----------------
QTL = ['A0', 'A1', 'A2', 'A3', 'SDA', 'SCL', 'TX']
QTR = ['5V', 'GND', '3V3', 'MOSI', 'MISO', 'SCK', 'RX']
BOARDS['qtpy-rp2040'] = dict(
    W=17.8, H=21, mask='black', radius=1.2, title='QT Py RP2040', pin_silk=False,
    pins=col('L', 1.0, 3.0, QTL, 'r') + col('R', 16.8, 3.0, QTR, 'l'),
    comps=[
        ('usbc', dict(cx=8.9, edge=-0.9, side='t')),
        ('qfn', dict(cx=8.9, cy=10.8, s=7.0, text='RP2040', pins=14)),
        ('soic', dict(cx=8.9, cy=16.6, w=3.2, h=2.6, text='', pins=8)),
        ('btn', dict(cx=4.4, cy=7.6, small=True)), ('btn', dict(cx=13.6, cy=7.6, small=True)),
        ('smd', dict(cx=4.6, cy=15.6, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=13.2, cy=15.8, w=1.0, h=0.5, kind='r')),
    ])
