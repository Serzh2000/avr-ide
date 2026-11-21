# Adafruit KB2040 (RP2040, Pro Micro: 33.02 x 17.78 мм). Положения USB-C, RP2040, Flash, стабилизатора, кнопок и разъёма STEMMA QT — из файла платы Adafruit (.brd,
# репозиторий Adafruit-KB2040-PCB), пересчитаны в вертикальную ориентацию (USB сверху, как на схеме Adafruit).
from boards import col

BOARDS = {}
BOARDS['kb2040'] = dict(
    W=17.78, H=33.02, mask='purple', radius=0.8, title='KB2040', pin_silk=False,
    pins=col('L', 1.27, 1.27, ['D+', 'D0', 'D1', 'GND', 'GND.1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9'], 'r')
    + col('R', 16.51, 1.27, ['D-', 'RAW', 'GND.2', 'RESET', '3V3', 'A3', 'A2', 'A1', 'A0', 'SCK', 'MISO', 'MOSI', 'D10'], 'l'),
    comps=[
        ('usbc', dict(cx=8.89, edge=-0.9, side='t')),
        ('qfn', dict(cx=9.18, cy=19.37, s=7.0, text='RP2040', pins=12)),
        ('soic', dict(cx=5.65, cy=12.32, w=3.2, h=2.6, text='', pins=8)),
        ('soic', dict(cx=10.94, cy=8.70, w=3.0, h=1.6, text='', sot=True)),
        ('box', dict(cx=13.58, cy=30.23, w=2.8, h=4.6, dz=1.6, mat='usb')), ('box', dict(cx=4.2, cy=30.23, w=2.8, h=4.6, dz=1.6, mat='usb')),
        ('box', dict(cx=8.89, cy=30.48, w=4.0, h=3.0, dz=2.5, mat='plastic_white')),
        ('led', dict(cx=13.35, cy=23.98, color='white')),
    ])
