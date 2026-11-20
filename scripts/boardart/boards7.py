# Платы третьей волны, часть 2: Teensy 3.2 и Arduino Mini 05. Единицы — мм, начало — левый верхний угол платы, ось y вниз.
from boards import col, row

BOARDS = {}

# ---------------- Teensy 3.2 (35.56 x 17.78, 2 x 14 выводов; размеры по стандарту DIP-28, приблизительно) ----------------
T32T = ['VIN', 'AGND', '3V3', '23', '22', '21', '20', '19', '18', '17', '16', '15', '14', '13']
T32B = ['GND', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
BOARDS['teensy-32'] = dict(
    W=35.56, H=17.78, mask='green', radius=0.8, title='Teensy 3.2',
    pins=row('t', 1.27, 1.27, T32T, 'b') + row('b', 1.27, 16.51, T32B, 't'),
    comps=[
        ('micro', dict(cx=0.0, edge=-1.6, side='l', cy=8.89)),
        ('qfp', dict(cx=18.0, cy=8.89, body=9.8, pins=16, rot=0, text='MK20DX256')),
        ('btn', dict(cx=30.0, cy=8.4, small=True)),
        ('xtal_sm', dict(cx=10.4, cy=11.6)),
        ('soic', dict(cx=7.6, cy=5.4, w=2.6, h=2.6, text='', pins=0, sot=True)),
        ('soic', dict(cx=10.0, cy=6.4, w=3.0, h=2.4, text='', pins=8)),
        ('led', dict(cx=31.6, cy=13.0, color='red')),
        ('smd', dict(cx=24.0, cy=14.6, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=27.0, cy=4.6, w=1.0, h=0.5, kind='c')),
        ('smd', dict(cx=6.4, cy=11.6, w=1.0, h=0.5, kind='r')),
    ])

# ---------------- Arduino Mini 05 (размеры и положение выводов по масштабу рисунка Arduino, приблизительно) ----------------
MIL = ['TX', 'RX', 'GND', 'NC', '2', '3', '4', '5', '6', '7', '8', '9']
MIR = ['9V', 'GND', 'RST', '5V', 'A3', 'A2', 'A1', 'A0', '13', '12', '11', '10']
BOARDS['arduino-mini'] = dict(
    W=19.1, H=32.4, mask='blue', radius=0.8, title='Arduino Mini', pin_silk=False,
    pins=col('L', 1.35, 2.1, MIL, 'r') + col('R', 17.8, 2.1, MIR, 'l'),
    comps=[
        ('qfp', dict(cx=9.6, cy=13.0, body=7.0, pins=8, rot=45, text='ATMEGA')),
        ('xtal', dict(cx=9.6, cy=23.8, w=4.8, h=3.0, text='16.000')),
        ('btn', dict(cx=12.8, cy=6.4, small=True)),
        ('sot223', dict(cx=7.0, cy=6.6, rot=0, small=True)),
        ('led', dict(cx=5.4, cy=28.4, color='green')),
        ('smd', dict(cx=13.0, cy=27.6, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=5.6, cy=19.6, w=1.0, h=0.5, kind='r')),
        ('text', dict(x=9.6, y=19.0, t='MINI', size=1.0)),
    ])


# ---------------- Raspberry Pi Pico 2 W (те же выводы и габариты, что у Pico 2; модуль CYW43439) ----------------
import boards2  # noqa: E402

BOARDS['pico2w'] = boards2._pico_pad3(boards2.pico('pico2', 'Raspberry Pi Pico 2 W', 'RP2350', [
    ('shieldbox', dict(cx=11.0, cy=40.2, w=11.6, h=10.4, text='CYW43439')),
    ('antenna', dict(cx=10.5, cy=47.9, w=6.6, h=2.4, n=4)),
    ('text', dict(x=10.5, y=34.6, t='Pico 2 W', size=1.1)),
]))


# ---------------- Waveshare RP2040-Zero / ESP32-S3-Zero (18 x 23.5, по чертежу производителя: первый вывод на 1.59 мм, шаг 2.54) ----------------
WY0 = 1.59
WL_RP = ['5V', 'GND', '3V3', 'GP29', 'GP28', 'GP27', 'GP26', 'GP15', 'GP14']
WR_RP = ['GP0', 'GP1', 'GP2', 'GP3', 'GP4', 'GP5', 'GP6', 'GP7', 'GP8']
WB_RP = ['GP13', 'GP12', 'GP11', 'GP10', 'GP9']
WL_S3 = ['5V', 'GND', '3V3', 'GP1', 'GP2', 'GP3', 'GP4', 'GP5', 'GP6']
WR_S3 = ['TX', 'RX', 'GP13', 'GP12', 'GP11', 'GP10', 'GP9', 'GP8', 'GP7']


def _wz(title, chip, left, right, bottom, extra):
    pins = col('L', 1.0, WY0, left, 'r') + col('R', 17.0, WY0, right, 'l')
    if bottom:
        pins += [dict(name='B:%d' % i, x=round(14.08 - i * 2.54, 3), y=22.4, silk=t, side='t') for i, t in enumerate(bottom)]
    return dict(
        W=18.0, H=23.5, mask='blue', radius=1.0, title=title, pin_silk=False, pins=pins,
        comps=[
            ('usbc', dict(cx=7.35, edge=-0.9, side='t')),
            ('btn', dict(cx=4.9, cy=9.0, small=True)), ('btn', dict(cx=13.1, cy=9.0, small=True)),
            ('led', dict(cx=9.0, cy=9.6, color='white')),
            ('smd', dict(cx=5.2, cy=14.8, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=13.2, cy=15.2, w=1.0, h=0.5, kind='r')),
        ] + extra)


BOARDS['waveshare-rp2040-zero'] = _wz('RP2040-Zero', 'RP2040', WL_RP, WR_RP, WB_RP, [
    ('qfn', dict(cx=8.8, cy=15.0, s=5.0, text='RP2040', pins=7)),
    ('soic', dict(cx=13.0, cy=17.0, w=3.0, h=2.4, text='', pins=8)),
    ('text', dict(x=8.8, y=7.4, t='RP2040-ZERO', size=0.7)),
])
BOARDS['waveshare-esp32-s3-zero'] = _wz('ESP32-S3-Zero', 'ESP32-S3', WL_S3, WR_S3, [], [
    ('qfn', dict(cx=9.0, cy=15.0, s=5.0, text='ESP32-S3', pins=7)),
    ('ceramic_ant', dict(cx=9.0, cy=22.2, w=5.4, h=1.6)),
    ('text', dict(x=8.8, y=7.4, t='ESP32-S3-ZERO', size=0.7)),
])
