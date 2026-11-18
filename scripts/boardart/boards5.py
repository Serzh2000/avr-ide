# Платы второй волны, часть 2: Arduino Due (формат Mega) и Teensy 4.1. Единицы — мм, начало — левый верхний угол платы, ось y вниз.
from boards import row
import boards2

BOARDS = {}

# ---------------- Arduino Due (формат Mega: те же гребёнки и габариты 101.6 x 53.3) ----------------
_mega = boards2.BOARDS['mega']
BOARDS['due'] = dict(
    _mega, title='Arduino Due',
    comps=[c for c in _mega['comps'] if c[0] in ('fheader', 'hole')] + [
        ('micro', dict(cx=0, edge=-1.4, side='l', cy=11.0)), ('micro', dict(cx=0, edge=-1.4, side='l', cy=23.4)),
        ('dcjack', dict(cx=2.4, cy=43.0, w=14.4, h=9.0)),
        ('qfp', dict(cx=50.0, cy=25.0, body=14.0, pins=16, rot=0, text='ATSAM3X8E')),
        ('qfn', dict(cx=19.0, cy=24.5, s=5, text='16U2', pins=7)),
        ('xtal', dict(cx=29.0, cy=18.0, w=4.8, h=3.6, text='12.000')),
        ('btn2', dict(cx=70.0, cy=22.0)), ('btn2', dict(cx=80.0, cy=22.0)),
        ('icsp', dict(cx=62.0, cy=34.0, cols=2, rows=3)),
        ('sot223', dict(cx=20.0, cy=39.0, rot=0)),
        ('ecap', dict(cx=14.0, cy=32.0, r=2.6)), ('ecap', dict(cx=14.0, cy=38.0, r=2.6)),
        ('led', dict(cx=25.0, cy=13.0, color='green')), ('led', dict(cx=25.0, cy=16.0, color='green')), ('led', dict(cx=25.0, cy=19.0, color='red')),
        ('smd', dict(cx=30.0, cy=13.0, w=1.0, h=0.5, kind='r')), ('smd', dict(cx=30.0, cy=16.0, w=1.0, h=0.5, kind='r')),
        ('smd', dict(cx=29.0, cy=30.0, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=33.0, cy=36.0, w=1.0, h=0.5, kind='c')),
        ('text', dict(x=68.0, y=38.0, t='DUE', size=2.6)),
    ])

# ---------------- Teensy 4.1 (по 24 вывода в ряду; размеры по стандарту 2.4" x 0.7", приблизительно) ----------------
T41T = ['VIN', 'GND', '3V3', '23', '22', '21', '20', '19', '18', '17', '16', '15', '14', '13', 'GND', '41', '40', '39', '38', '37', '36', '35', '34', '33']
T41B = ['GND', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '3V3', '24', '25', '26', '27', '28', '29', '30', '31', '32']
BOARDS['teensy-41'] = dict(
    W=60.96, H=17.78, mask='green', radius=0.8, title='Teensy 4.1',
    pins=row('t', 1.27, 1.27, T41T, 'b') + row('b', 1.27, 16.51, T41B, 't'),
    comps=[
        ('micro', dict(cx=0.0, edge=-1.6, side='l', cy=8.89)),
        ('bga', dict(cx=20.0, cy=8.89, s=9.4, text='IMXRT1062\nDVJ6A')),
        ('box', dict(cx=49.6, cy=9.0, w=13.6, h=15.0, dz=2.0, mat='shield', bevel=0.3)),
        ('btn', dict(cx=33.4, cy=7.6, small=True)),
        ('xtal_sm', dict(cx=28.6, cy=5.2)),
        ('soic', dict(cx=8.0, cy=5.4, w=2.6, h=2.6, text='', pins=0, sot=True)),
        ('soic', dict(cx=33.0, cy=12.8, w=3.0, h=2.4, text='', pins=8)),
        ('led', dict(cx=38.0, cy=12.4, color='red')),
        ('smd', dict(cx=9.0, cy=12.0, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=11.0, cy=12.0, w=1.0, h=0.5, kind='c')),
        ('smd', dict(cx=40.4, cy=5.0, w=1.0, h=0.5, kind='r')), ('smd', dict(cx=13.2, cy=4.6, w=1.0, h=0.5, kind='c')),
    ])
