# PNG рендеры -> WebP с мягкой тенью + src/renderer/src/reference/data/boardRenders.ts
#   python convert.py <папка с png и meta.json> <выходной .ts> <папка для webp (для просмотра)>
import base64, io, json, os, sys
from PIL import Image, ImageFilter

src, out_ts, out_dir = sys.argv[1:4]
os.makedirs(out_dir, exist_ok=True)
meta = json.load(open(os.path.join(src, 'meta.json'), encoding='utf8'))
LIC = 'собственная отрисовка: 3D-модель AVR IDE (Blender), размеры и порядок выводов по документации производителя'


def shadow(img, k):
    a = img.getchannel('A')
    layers = []
    for dx, dy, sigma, op in ((0.5, 0.9, 0.95, 0.40), (0.15, 0.3, 0.22, 0.30)):
        m = Image.new('L', img.size, 0)
        m.paste(a, (round(dx * k), round(dy * k)))
        m = m.filter(ImageFilter.GaussianBlur(sigma * k)).point(lambda v, o=op: int(v * o))
        layers.append(m)
    base = Image.new('RGBA', img.size, (0, 0, 0, 0))
    for m in layers:
        sh = Image.new('RGBA', img.size, (0, 0, 0, 255))
        sh.putalpha(m)
        base = Image.alpha_composite(base, sh)
    return Image.alpha_composite(base, img)


res = {}
for bid, m in meta.items():
    im = Image.open(os.path.join(src, bid + '.png')).convert('RGBA')
    im = shadow(im, m['K'])
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=84, alpha_quality=92, method=6)
    data = buf.getvalue()
    open(os.path.join(out_dir, bid + '.webp'), 'wb').write(data)
    res[bid] = dict(svg='', img='data:image/webp;base64,' + base64.b64encode(data).decode(), bw=m['W'], bh=m['H'], x=m['x'], y=m['y'], w=m['w'], h=m['h'], pins=m['pins'], license=LIC, bytes=len(data))
    print(bid, im.size, len(data) // 1024, 'KB')

head = '''// СГЕНЕРИРОВАНО scripts/boardart/build.mjs (рендер Blender + convert.py) — не править вручную.
// Реалистичные рендеры плат (собственные 3D-модели по размерам из документации). Лицензия: licenses/THIRD_PARTY.md.
/* eslint-disable */
import type { BoardArt } from './boardArt'

export const boardRenders: Record<string, BoardArt> = '''
for r in res.values():
    r.pop('bytes')
open(out_ts, 'w', encoding='utf8').write(head + json.dumps(res, ensure_ascii=False, indent=1) + '\n')
