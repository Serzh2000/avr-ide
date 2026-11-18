# Рендер плат справочника в Blender (Cycles), вид строго сверху, ортографическая камера, прозрачный фон.
#   blender -b --python scripts/boardart/render.py -- <папка вывода> [id платы ...]
# Для каждой платы из boards.py: <id>.png (RGBA) и общий meta.json (масштаб, поля, координаты выводов в мм).
# Все платы строятся одним кодом (материалы, свет, камера одинаковы), чтобы они выглядели как набор.
import bpy
import bmesh
import math
import os
import sys
import json
import random
from mathutils import Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import boards  # noqa: E402
import boards2  # noqa: E402
import boards3  # noqa: E402
import boards4  # noqa: E402
import boards5  # noqa: E402
boards.BOARDS.update(boards2.BOARDS)
boards.BOARDS.update(boards3.BOARDS)
boards.BOARDS.update(boards4.BOARDS)
boards.BOARDS.update(boards5.BOARDS)

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0]
ONLY = argv[1:]
SAMPLES = int(os.environ.get('BOARDART_SAMPLES', '128'))
MAXPX = int(os.environ.get('BOARDART_MAXPX', '1700'))
PAD = 3.5          # поле вокруг платы (под тень), мм
TOP = 1.6          # толщина платы
DROP = 0.8         # зазор между платой и «столом» (тень)
MAXK = 30.0        # макс. пикселей на мм


def lin(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c] + [1.0]


# ---------------- материалы ----------------
MATS = {}


def material(name, color, metallic=0.0, rough=0.5, coat=0.0, emit=None, bump=0.0, bump_scale=60.0, noise_col=0.0, alpha=1.0, spec=0.5, grad=0.0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bs = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(bs.outputs['BSDF'], out.inputs['Surface'])
    base = lin(color)
    bs.inputs['Metallic'].default_value = metallic
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Specular IOR Level'].default_value = spec
    if coat:
        bs.inputs['Coat Weight'].default_value = coat
        bs.inputs['Coat Roughness'].default_value = 0.12
    if emit:
        bs.inputs['Emission Color'].default_value = lin(emit)
        bs.inputs['Emission Strength'].default_value = 0.6
    if alpha < 1:
        bs.inputs['Alpha'].default_value = alpha
    if noise_col or bump:
        tc = nt.nodes.new('ShaderNodeTexCoord')
        nz = nt.nodes.new('ShaderNodeTexNoise')
        nz.inputs['Scale'].default_value = bump_scale
        nz.inputs['Detail'].default_value = 8.0
        nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
        if noise_col:
            mix = nt.nodes.new('ShaderNodeMix')
            mix.data_type = 'RGBA'
            mix.inputs['A'].default_value = [c * (1 - noise_col) for c in base[:3]] + [1]
            mix.inputs['B'].default_value = [min(1, c * (1 + noise_col)) for c in base[:3]] + [1]
            nt.links.new(nz.outputs['Fac'], mix.inputs['Factor'])
            nt.links.new(mix.outputs['Result'], bs.inputs['Base Color'])
        else:
            bs.inputs['Base Color'].default_value = base
        if bump:
            bp = nt.nodes.new('ShaderNodeBump')
            bp.inputs['Strength'].default_value = bump
            bp.inputs['Distance'].default_value = 0.02
            nt.links.new(nz.outputs['Fac'], bp.inputs['Height'])
            nt.links.new(bp.outputs['Normal'], bs.inputs['Normal'])
    else:
        bs.inputs['Base Color'].default_value = base
    if grad:
        # широкий градиент яркости по плате — имитация отражения мягкого источника в металле
        tc2 = nt.nodes.new('ShaderNodeTexCoord')
        sep = nt.nodes.new('ShaderNodeSeparateXYZ')
        nt.links.new(tc2.outputs['Object'], sep.inputs['Vector'])
        a = nt.nodes.new('ShaderNodeMath'); a.operation = 'SUBTRACT'
        nt.links.new(sep.outputs['X'], a.inputs[0]); nt.links.new(sep.outputs['Y'], a.inputs[1])
        b = nt.nodes.new('ShaderNodeMapRange')
        b.inputs['From Min'].default_value = -60; b.inputs['From Max'].default_value = 60
        nt.links.new(a.outputs['Value'], b.inputs['Value'])
        mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'
        mx.inputs['A'].default_value = [c * (1 - grad) for c in base[:3]] + [1]
        mx.inputs['B'].default_value = [min(1, c * (1 + grad)) for c in base[:3]] + [1]
        nt.links.new(b.outputs['Result'], mx.inputs['Factor'])
        src = bs.inputs['Base Color'].links[0].from_socket if bs.inputs['Base Color'].links else None
        if src is not None:
            mul = nt.nodes.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'
            mul.inputs['Factor'].default_value = 1.0
            nt.links.new(src, mul.inputs['A']); nt.links.new(mx.outputs['Result'], mul.inputs['B'])
            nt.links.new(mul.outputs['Result'], bs.inputs['Base Color'])
        else:
            nt.links.new(mx.outputs['Result'], bs.inputs['Base Color'])
    MATS[name] = m
    return m


def init_materials(mask_key):
    masks = {
        'black': '#202329', 'black_blue': '#192030', 'blue': '#1d4fb4', 'white': '#e8eae7',
        'teal': '#0c6a90', 'red': '#a3201f', 'green': '#0f6b3b', 'purple': '#5b2a86', 'purple_dark': '#2c1a4a',
    }
    material('mask', masks[mask_key], rough=0.45, coat=0.25, noise_col=0.035, bump=0.03, bump_scale=90)
    material('gold', '#e2b04a', metallic=1, rough=0.26, grad=0.18)
    material('via', '#9a8f78' if mask_key == 'white' else '#5d4f2a', metallic=0.5, rough=0.45)
    material('hole', '#050506', rough=0.6)
    material('tin', '#c9ccd0', metallic=1, rough=0.32, grad=0.25)
    material('shield', '#c6cacf', metallic=1, rough=0.34, bump=0.12, bump_scale=240, noise_col=0.05, grad=0.28)
    material('usb', '#bcc0c6', metallic=1, rough=0.3, bump=0.06, bump_scale=180, grad=0.25)
    material('plastic_black', '#0e0f11', rough=0.38, spec=0.5)
    material('plastic_gray', '#2a2c30', rough=0.4)
    material('plastic_white', '#e6e5dc', rough=0.45)
    material('module_pcb', '#101114', rough=0.4, coat=0.3)
    material('copper', '#c98a3c', metallic=1, rough=0.35)
    material('cap_tan', '#a9824a', rough=0.5)
    material('res_black', '#17181a', rough=0.45)
    material('ceramic', '#cfc8b4', rough=0.5)
    material('yellow', '#e0b020', rough=0.4)
    material('btn_top', '#18191c', rough=0.3)
    material('btn_red', '#c4252a', rough=0.3)
    material('btn_blue', '#1f4fb0', rough=0.3)
    material('btn_white', '#e9e9e4', rough=0.35)
    material('ecap', '#6f747b', metallic=0.6, rough=0.4)
    material('socket', '#26282c', rough=0.45)
    material('led_red', '#c8232a', rough=0.15, emit='#ff3030')
    material('led_green', '#1fa84a', rough=0.15, emit='#35ff70')
    material('led_blue', '#2a6bd8', rough=0.15, emit='#4a8cff')
    material('led_white', '#f0f0e8', rough=0.12, emit='#ffffff')
    material('silk_w', '#f3f3ee', rough=0.7)
    material('silk_blue', '#1a3a86', rough=0.7)
    material('print_dark', '#1c1c1c', rough=0.6)
    material('print_gray', '#8d9299', rough=0.5)
    material('shadow', '#000000', rough=1)


# ---------------- пакетная геометрия ----------------
BATCH = {}


def B(mname):
    if mname not in BATCH:
        BATCH[mname] = bmesh.new()
    return BATCH[mname]


def add_box(m, cx, cy, z0, w, h, dz, rot=0.0, bevel=0.0, vert_only=False):
    bm = B(m)
    verts = bmesh.ops.create_cube(bm, size=1.0)['verts']
    bmesh.ops.scale(bm, vec=(w, h, dz), verts=verts)
    if rot:
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(-math.radians(rot), 3, 'Z'), verts=verts)
    bmesh.ops.translate(bm, vec=(cx, -cy, z0 + dz / 2), verts=verts)
    if bevel > 0:
        edges = list({e for v in verts for e in v.link_edges})
        if vert_only:
            edges = [e for e in edges if abs(e.verts[0].co.z - e.verts[1].co.z) > dz * 0.5]
        bmesh.ops.bevel(bm, geom=edges, offset=min(bevel, min(w, h, dz) * 0.45), segments=3 if not vert_only else 8, affect='EDGES')


def rounded_pts(W, H, r, seg=12):
    pts = []
    for (cx, cy, a0) in ((W - r, r, -90), (W - r, H - r, 0), (r, H - r, 90), (r, r, 180)):
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def arc(cx, cy, r, a0, a1, seg=6):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / seg)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / seg))) for i in range(seg + 1)]


def uno_outline(L, H, r=1.0):
    """Контур плат формата Uno (стандартный чертёж Arduino: скосы справа, ступень у разъёмов)."""
    pts = [(r, 0), (L - 4.065, 0), (L - 2.54, 1.525), (L - 2.54, 12.955), (L, 15.495), (L, 48.26), (L - 2.54, 50.8), (L - 2.54, H - 1), (L - 3.54, H)]
    return pts + arc(r, H - r, r, 90, 180) + arc(r, r, r, 180, 270)


def mega_outline(L, H, r=1.0):
    pts = [(r, 0), (L - 4.8, 0), (L - 2.41, 2.41), (L - 2.41, 12.06), (L, 14.47), (L, H - 3.6), (L - 2.41, H - 1.2), (L - 2.41, H)]
    return pts + arc(r, H - r, r, 90, 180) + arc(r, r, r, 180, 270)


def add_rounded(m, W, H, r, z0, dz, seg=12, pts=None):
    """Плата: контур (по умолчанию скруглённый прямоугольник), выдавленный по высоте."""
    bm = B(m)
    pts = [(x, -y) for x, y in (pts or rounded_pts(W, H, r, seg))]
    verts = [bm.verts.new((x, y, z0)) for x, y in pts]
    face = bmesh.ops.contextual_create(bm, geom=verts)['faces'][0]
    if face.normal.z < 0:
        face.normal_flip()
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    vs = [v for v in ext['geom'] if isinstance(v, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, 0, dz), verts=vs)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))


def add_cyl(m, cx, cy, z0, r, dz, seg=28):
    bm = B(m)
    verts = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r, depth=dz)['verts']
    bmesh.ops.translate(bm, vec=(cx, -cy, z0 + dz / 2), verts=verts)


def flush_batches():
    for mname, bm in BATCH.items():
        me = bpy.data.meshes.new(mname)
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(mname, me)
        ob.data.materials.append(MATS[mname])
        bpy.context.scene.collection.objects.link(ob)
    BATCH.clear()


TEXTS = []
KEEP = []  # занятые прямоугольники (x0, y0, x1, y1) — чтобы подписи выводов и переходные отверстия не лезли под детали


def keep(cx, cy, w, h, rot=0):
    if abs(rot) % 180 == 90:
        w, h = h, w
    elif rot % 90 != 0:
        w = h = max(w, h) * 1.2
    KEEP.append((cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2))


def text(x, y, t, size, z, m='silk_w', rot=0.0, extrude=0.01):
    cu = bpy.data.curves.new('t', 'FONT')
    cu.body = t
    cu.size = size
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.extrude = extrude
    cu.space_line = 0.9
    ob = bpy.data.objects.new('t', cu)
    ob.location = (x, -y, z)
    ob.rotation_euler = (0, 0, -math.radians(rot))
    ob.data.materials.append(MATS[m])
    bpy.context.scene.collection.objects.link(ob)


class F:
    """Локальная система координат детали: центр (cx, cy), поворот rot (по часовой, град.)."""
    def __init__(s, cx, cy, rot=0.0):
        s.cx, s.cy, s.rot = cx, cy, rot
        s.c, s.s = math.cos(math.radians(rot)), math.sin(math.radians(rot))

    def pt(s, lx, ly):
        return (s.cx + lx * s.c - ly * s.s, s.cy + lx * s.s + ly * s.c)

    def box(s, m, lx, ly, w, h, z0, dz, bevel=0.0, vert_only=False):
        x, y = s.pt(lx, ly)
        add_box(m, x, y, z0, w, h, dz, s.rot, bevel, vert_only)

    def cyl(s, m, lx, ly, z0, r, dz):
        x, y = s.pt(lx, ly)
        add_cyl(m, x, y, z0, r, dz)

    def text(s, lx, ly, t, size, z, m='print_gray'):
        x, y = s.pt(lx, ly)
        text(x, y, t, size, z, m, s.rot)


SIDE_ROT = {'b': 0, 't': 180, 'l': 90, 'r': -90}


# ---------------- детали ----------------
def c_usbc(cx, edge, side, cy=None):
    p = (cx, edge) if side in 'bt' else (edge, cy)
    f = F(p[0], p[1], SIDE_ROT[side])
    L, W = 7.35, 8.94
    f.box('usb', 0, -L / 2, W, L, TOP, 3.2, bevel=0.9, vert_only=False)
    f.box('usb', 0, -L / 2 + 0.3, W - 1.2, L - 1.0, TOP + 3.2, 0.03, bevel=0.01)  # чуть приподнятая панель крышки
    for sx in (-1, 1):
        f.box('tin', sx * (W / 2 + 0.2), -1.6, 0.7, 2.0, TOP, 0.25)
        f.box('tin', sx * (W / 2 + 0.2), -5.4, 0.7, 1.6, TOP, 0.25)
        f.box('print_dark', sx * 2.4, -L + 1.2, 1.3, 0.5, TOP + 3.2, 0.04)
    f.box('plastic_black', 0, -L + 0.35, 5.8, 0.5, TOP + 3.2, 0.04)
    x, y = f.pt(0, -L / 2)
    keep(x, y, W if side in 'bt' else L, L if side in 'bt' else W, 0)
    KEEP.append((x - W / 2 - 0.6, y - W / 2 - 0.6, x + W / 2 + 0.6, y + W / 2 + 0.6) if False else (x, y, x, y))


def c_micro(cx, edge, side, cy=None):
    p = (cx, edge) if side in 'bt' else (edge, cy)
    f = F(p[0], p[1], SIDE_ROT[side])
    L, W = 5.6, 7.5
    f.box('usb', 0, -L / 2, W, L, TOP, 2.6, bevel=0.45)
    f.box('usb', 0, -L / 2 + 0.1, W - 1.4, L - 0.8, TOP + 2.6, 0.03)
    for sx in (-1, 1):
        f.box('tin', sx * (W / 2 + 0.25), -4.2, 0.8, 1.6, TOP, 0.22)
        f.box('print_dark', sx * 2.0, -L + 1.0, 1.1, 0.45, TOP + 2.6, 0.04)
    x, y = f.pt(0, -L / 2)
    keep(x, y, W if side in 'bt' else L, L if side in 'bt' else W, 0)


def c_qfn(cx, cy, s, text_, pins=7, shield=False, rot=0):
    f = F(cx, cy, rot)
    pit = (s - 1.0) / max(pins - 1, 1) if pins > 1 else 0.5
    for k in range(4):
        g = F(cx, cy, rot + 90 * k)
        for i in range(pins):
            g.box('tin', (i - (pins - 1) / 2) * pit, -s / 2 - 0.12, pit * 0.5, 0.45, TOP, 0.03)
    f.box('shield' if shield else 'plastic_black', 0, 0, s, s, TOP + 0.03, 0.85, bevel=0.14)
    f.cyl('print_gray', -s / 2 + 0.8, -s / 2 + 0.8, TOP + 0.88, 0.22, 0.02)
    lines = text_.split('\n')
    for i, ln in enumerate(lines):
        f.text(0.3, (i - (len(lines) - 1) / 2) * 0.95 + 0.1, ln, 0.75 if s < 6 else 0.9, TOP + 0.9, 'print_dark' if shield else 'print_gray')
    keep(cx, cy, s + 1.2, s + 1.2, rot)


def c_qfp(cx, cy, body, pins, rot, text_):
    f = F(cx, cy, rot)
    pit = 0.5
    for k in range(4):
        g = F(cx, cy, rot + 90 * k)
        for i in range(pins):
            g.box('tin', (i - (pins - 1) / 2) * pit, -body / 2 - 0.55, 0.26, 1.15, TOP, 0.14)
    f.box('plastic_black', 0, 0, body, body, TOP + 0.1, 1.4, bevel=0.25)
    f.box('plastic_gray', 0, 0, body - 0.9, body - 0.9, TOP + 1.5, 0.03, bevel=0.1)
    f.cyl('print_gray', -body / 2 + 1.0, -body / 2 + 1.0, TOP + 1.54, 0.3, 0.02)
    lines = text_.split('\n')
    for i, ln in enumerate(lines):
        f.text(0.5, (i - (len(lines) - 1) / 2) * 1.0 + 0.2, ln, 0.9, TOP + 1.55)
    keep(cx, cy, body + 3.2, body + 3.2, rot)


def c_soic(cx, cy, w, h, text_='', pins=8, sot=False, pitch=1.27):
    f = F(cx, cy)
    if sot:
        w, h = 3.0, 1.6
        for i in range(3):
            f.box('tin', (i - 1) * 0.95, h / 2 + 0.4, 0.4, 0.8, TOP, 0.14)
        for i in range(2):
            f.box('tin', (i - 0.5) * 1.9, -h / 2 - 0.4, 0.4, 0.8, TOP, 0.14)
        f.box('plastic_black', 0, 0, w, h, TOP + 0.1, 1.0, bevel=0.15)
        keep(cx, cy, w + 1.6, h + 2.2)
        return
    per = pins // 2
    for i in range(per):
        for sy in (-1, 1):
            f.box('tin', (i - (per - 1) / 2) * pitch, sy * (h / 2 + 0.45), min(0.5, pitch * 0.55), 1.0, TOP, 0.14)
    f.box('plastic_black', 0, 0, w, h, TOP + 0.1, 1.2, bevel=0.2)
    f.cyl('print_gray', -w / 2 + 0.7, -h / 2 + 0.7, TOP + 1.34, 0.2, 0.02)
    f.text(0.3, 0.1, text_, 0.8, TOP + 1.35)
    keep(cx, cy, w + 1.2, h + 2.4)


def c_sot223(cx, cy, rot=0, small=False):
    k = 0.8 if small else 1.0
    f = F(cx, cy, rot)
    f.box('plastic_black', 0, 0, 6.5 * k, 3.5 * k, TOP + 0.1, 1.5, bevel=0.2)
    f.box('tin', 0, -(1.75 + 1.1) * k, 3.0 * k, 2.0 * k, TOP, 0.16)
    for i in (-1, 0, 1):
        f.box('tin', i * 2.3 * k, (1.75 + 0.9) * k, 0.8 * k, 1.8 * k, TOP, 0.16)
    keep(cx, cy, 7.2 * k, 7.4 * k, rot)


def c_btn(cx, cy, small=False):
    k = 0.82 if small else 1.0
    f = F(cx, cy)
    for sx in (-1, 1):
        for sy in (-1, 1):
            f.box('tin', sx * 2.15 * k, sy * 1.2 * k, 1.0 * k, 1.0 * k, TOP, 0.12)
    f.box('usb', 0, 0, 3.6 * k, 3.6 * k, TOP + 0.05, 1.5, bevel=0.35)
    f.box('plastic_black', 0, 0, 3.0 * k, 3.0 * k, TOP + 1.55, 0.04, bevel=0.2)
    f.cyl('btn_top', 0, 0, TOP + 1.55, 1.05 * k, 0.7)
    keep(cx, cy, 5.8 * k, 4.2 * k)


def c_led(cx, cy, color, rot=0):
    f = F(cx, cy, rot)
    f.box('tin', -0.85, 0, 0.45, 1.25, TOP, 0.25)
    f.box('tin', 0.85, 0, 0.45, 1.25, TOP, 0.25)
    f.box('led_' + color, 0, 0, 1.4, 1.2, TOP + 0.02, 0.5, bevel=0.1)
    keep(cx, cy, 2.6, 1.6, rot)


def c_rgb(cx, cy):
    f = F(cx, cy)
    for sx in (-1, 1):
        for sy in (-1, 1):
            f.box('tin', sx * 2.4, sy * 1.7, 1.3, 0.9, TOP, 0.1)
    f.box('plastic_white', 0, 0, 5.0, 5.0, TOP + 0.05, 1.5, bevel=0.25)
    f.cyl('led_white', 0, 0, TOP + 1.54, 1.55, 0.05)
    f.cyl('plastic_gray', 0, 0, TOP + 1.6, 0.35, 0.02)
    keep(cx, cy, 6.8, 5.2)


def c_smd(cx, cy, w, h, kind='r', rot=0):
    f = F(cx, cy, rot)
    big = w >= 2
    body = 'cap_tan' if kind == 'c' else 'res_black'
    e = 0.3 if not big else 0.5
    f.box('tin', -(w - e) / 2, 0, e, h, TOP, 0.5 if not big else 1.0)
    f.box('tin', (w - e) / 2, 0, e, h, TOP, 0.5 if not big else 1.0)
    f.box(body, 0, 0, w - 2 * e + 0.02, h * (0.95 if not big else 1), TOP, 0.45 if not big else 0.95)
    keep(cx, cy, w + 0.6, h + 0.6, rot)


def c_xtal(cx, cy, w, h, text_=''):
    f = F(cx, cy)
    f.box('tin', 0, 0, w + 0.3, h + 0.3, TOP, 0.2, bevel=0.1)
    f.box('shield', 0, 0, w, h, TOP + 0.2, 1.6, bevel=min(0.6, h * 0.3))
    if text_:
        f.text(0, 0, text_, 0.8, TOP + 1.85, 'print_dark')
    keep(cx, cy, w + 0.8, h + 0.8)


def c_xtal_sm(cx, cy, vertical=False):
    f = F(cx, cy, 90 if vertical else 0)
    f.box('tin', 0, 0, 3.4, 1.9, TOP, 0.2, bevel=0.1)
    f.box('shield', 0, 0, 3.2, 1.5, TOP + 0.2, 1.0, bevel=0.55)
    keep(cx, cy, 3.6, 2.0, 90 if vertical else 0)


def c_jumper(cx, cy):
    f = F(cx, cy)
    f.box('plastic_black', 0, 0, 2.54, 7.62, TOP, 2.5, bevel=0.15)
    f.box('yellow', 0, -1.27, 2.2, 5.0, TOP + 2.5, 0.9, bevel=0.25)
    f.box('gold', 0, 2.54, 0.64, 0.64, TOP + 2.5, 0.05)
    keep(cx, cy, 3.2, 8.2)


def c_pinheader(cx, cy, n=4, vertical=True, pins=None):
    f = F(cx, cy, 0)
    f.box('plastic_black', 0, 0, 2.54, n * 2.54, TOP, 2.5, bevel=0.15)
    for i in range(n):
        f.box('gold', 0, (i - (n - 1) / 2) * 2.54, 0.64, 0.64, TOP + 2.5, 0.6)
    keep(cx, cy, 3.0, n * 2.54 + 0.4)


def c_ceramic_ant(cx, cy, w, h):
    f = F(cx, cy)
    f.box('tin', 0, 0, w + 0.2, h, TOP, 0.1)
    f.box('ceramic', 0, 0, w - 1.0, h - 0.2, TOP + 0.1, 0.7, bevel=0.15)
    f.box('tin', -(w - 1.0) / 2, 0, 0.5, h - 0.3, TOP + 0.1, 0.72)
    f.box('tin', (w - 1.0) / 2, 0, 0.5, h - 0.3, TOP + 0.1, 0.72)
    keep(cx, cy, w + 0.6, h + 0.6)


def c_module(x, y, w, h, ant, text_, pad_pitch=1.27, shield_inset=0.4, pads_n=None):
    zs = TOP
    add_box('module_pcb', x + w / 2, y + h / 2, zs, w, h, 0.8, bevel=0.1)
    zt = zs + 0.8
    # антенна: меандр из медной дорожки
    ax0, ax1 = x + 1.0, x + w - 1.0
    tw = 0.3
    pitch_t = 0.85
    ys = y + 0.8
    n = int((ant - 1.6) / pitch_t)
    for i in range(n + 1):
        yy = ys + i * pitch_t
        add_box('copper', (ax0 + ax1) / 2, yy, zt, ax1 - ax0 - (0.0 if i % 2 else 0.0), tw, 0.03)
        if i < n:
            xx = ax1 if i % 2 == 0 else ax0
            add_box('copper', xx, yy + pitch_t / 2, zt + 0.01, tw, pitch_t + tw, 0.03)
    add_box('copper', x + w / 2, y + ant - 0.3, zt + 0.01, tw, 0.8, 0.03)
    # контактные площадки по краю модуля
    py0 = y + ant + 1.2
    py1 = y + h - 0.9
    if pads_n:
        pys = [py1 - i * pad_pitch for i in range(pads_n)]
    else:
        cnt = int((py1 - py0) / pad_pitch) + 1
        pys = [py0 + i * pad_pitch for i in range(cnt)]
    for yy in pys:
        for xx in (x + 0.22, x + w - 0.22):
            add_box('gold', xx, yy, zt, 0.7, min(0.8, pad_pitch * 0.6), 0.03)
    # экран
    sx0 = x + shield_inset
    sw = w - 2 * shield_inset
    sy0 = y + ant
    sh = h - ant - 0.3
    add_box('shield', sx0 + sw / 2, sy0 + sh / 2, zt, sw, sh, 2.0, bevel=0.2)
    add_box('shield', sx0 + sw / 2, sy0 + sh / 2, zt + 2.0, sw - 0.8, sh - 0.8, 0.04, bevel=0.1)
    cx = sx0 + sw / 2
    cy = sy0 + sh / 2
    for i, ln in enumerate(text_):
        text(cx, cy + (i - (len(text_) - 1) / 2) * 1.4 - 0.4 * (len(text_) - 1), ln, 1.05 if i == 0 else 0.8, zt + 2.06, 'print_dark')
    keep(x + w / 2, y + h / 2, w + 0.6, h + 0.6)




SKIP = set()


def c_fheader(pts):
    """Розеточная гребёнка (формат Uno): чёрный пластик 8,5 мм с гнёздами; pts — центры гнёзд."""
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    x0, x1, y0, y1 = min(xs) - 1.27, max(xs) + 1.27, min(ys) - 1.27, max(ys) + 1.27
    add_box('plastic_black', (x0 + x1) / 2, (y0 + y1) / 2, TOP, x1 - x0, y1 - y0, 8.5, bevel=0.2)
    for (x, y) in pts:
        add_box('hole', x, y, TOP + 8.5, 1.05, 1.05, 0.02)
        SKIP.add((round(x, 2), round(y, 2)))
    keep((x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0)


def c_usbb(cx, cy, x0, x1):
    """USB-B (Uno/Mega): металлический короб x0..x1 по x, 12 мм по y."""
    w = x1 - x0
    add_box('usb', (x0 + x1) / 2, cy, TOP, w, 12.1, 10.8, bevel=0.35)
    add_box('usb', (x0 + x1) / 2 + 0.6, cy, TOP + 10.8, w - 2.6, 9.6, 0.04, bevel=0.1)
    for sy in (-1, 1):
        add_box('print_dark', (x0 + x1) / 2 + 3, cy + sy * 4.6, TOP + 10.8, 1.6, 0.5, 0.04)
        add_box('tin', x1 - 2.0, cy + sy * 6.5, 1.6, 0.9, TOP, 0.25)
    keep((x0 + x1) / 2, cy, w + 1, 13)


def c_dcjack(cx, cy, w, h):
    add_box('plastic_black', cx, cy, TOP, w, h, 10.8, bevel=0.5)
    add_box('plastic_gray', cx - w / 2 + 3.5, cy, TOP + 10.8, w - 7.5, 3.0, 0.04, bevel=0.2)
    add_box('plastic_gray', cx + w / 2 - 2.2, cy, TOP + 10.8, 2.8, h - 2.2, 0.04, bevel=0.2)
    for sy in (-1, 1):
        add_box('tin', cx + w / 2 + 0.6, cy + sy * (h / 2 - 1.0), 1.6, 1.2, TOP, 0.25)
    keep(cx, cy, w + 1, h + 1)


def c_dip(cx, cy, w, h, text_, pins=14):
    add_box('socket', cx, cy, TOP, w + 2.4, h + 1.6, 3.6, bevel=0.25)
    add_box('plastic_black', cx, cy, TOP + 3.6, w, h, 0.9, bevel=0.2)
    add_cyl('socket', cx - w / 2 - 0.1, cy, TOP + 4.5, 1.0, 0.03)
    for i in range(pins):
        x = cx - (pins - 1) / 2 * 2.54 + i * 2.54
        for sy in (-1, 1):
            add_box('tin', x, cy + sy * (h / 2 + 0.15), 1.0, 0.5, TOP + 3.4, 0.25)
    add_cyl('print_gray', cx - w / 2 + 2.0, cy + h / 2 - 1.3, TOP + 4.5, 0.4, 0.02)
    text(cx + 0.5, cy, text_, 1.0, TOP + 4.52, 'print_gray')
    keep(cx, cy, w + 3.4, h + 2.6)


def c_ecap(cx, cy, r):
    add_cyl('ecap', cx, cy, TOP, r, 5.5)
    add_cyl('print_gray', cx, cy, TOP + 5.5, r * 0.82, 0.03)
    add_box('plastic_black', cx + r * 0.55, cy, TOP + 5.5, r * 0.5, r * 1.5, 0.04)
    keep(cx, cy, 2 * r + 0.6, 2 * r + 0.6)


def c_icsp(cx, cy, cols=2, rows=3):
    add_box('plastic_black', cx, cy, TOP, cols * 2.54, rows * 2.54, 2.5, bevel=0.15)
    for i in range(cols):
        for j in range(rows):
            px, py = cx + (i - (cols - 1) / 2) * 2.54, cy + (j - (rows - 1) / 2) * 2.54
            add_box('gold', px, py, 0.64, 0.64, TOP + 2.5, 0.6)
            SKIP.add((round(px, 2), round(py, 2)))
    keep(cx, cy, cols * 2.54 + 0.4, rows * 2.54 + 0.4)


def c_hole(cx, cy, r=1.6):
    add_cyl('gold', cx, cy, TOP, r + (0.9 if r > 1.2 else 0.6), 0.05, 32)
    add_cyl('hole', cx, cy, TOP + 0.05, r, 0.01, 32)
    keep(cx, cy, 2 * r + 2.2, 2 * r + 2.2)


def c_btn2(cx, cy, top='btn_red', size=6.0):
    f = F(cx, cy)
    for sx in (-1, 1):
        for sy in (-1, 1):
            f.box('tin', sx * (size / 2 + 0.5), sy * 2.2, 1.2, 1.0, TOP, 0.12)
    f.box('usb', 0, 0, size, size, TOP + 0.05, 2.2, bevel=0.5)
    f.cyl(top, 0, 0, TOP + 2.25, size * 0.3, 1.5)
    keep(cx, cy, size + 2.4, size + 0.6)


def c_castell(ys, W):
    """Полуотверстия по краям платы (Pico)."""
    for y in ys:
        for x, sgn in ((0, 1), (W, -1)):
            add_box('gold', x + sgn * 0.5, y, TOP, 1.0, 1.5, 0.05)
            add_box('hole', x + sgn * 0.3, y, TOP + 0.05, 0.6, 1.0, 0.01)


def c_shieldbox(cx, cy, w, h, text_=''):
    add_box('shield', cx, cy, TOP, w, h, 2.0, bevel=0.2)
    add_box('shield', cx, cy, TOP + 2.0, w - 0.8, h - 0.8, 0.04, bevel=0.1)
    if text_:
        text(cx, cy, text_, 0.9, TOP + 2.06, 'print_dark')
    keep(cx, cy, w + 0.6, h + 0.6)


def c_antenna(cx, cy, w, h, n=4):
    pitch = h / (n + 1)
    for i in range(n):
        add_box('copper', cx, cy - h / 2 + (i + 1) * pitch, TOP, w, 0.3, 0.04)
    for i in range(n - 1):
        xx = cx + (w / 2 if i % 2 == 0 else -w / 2)
        add_box('copper', xx, cy - h / 2 + (i + 1.5) * pitch, TOP + 0.01, 0.3, pitch + 0.3, 0.04)
    keep(cx, cy, w + 0.6, h + 0.6)


def c_bga(cx, cy, s, text_=''):
    add_box('plastic_black', cx, cy, TOP, s, s, 0.9, bevel=0.18)
    add_box('plastic_gray', cx, cy, TOP + 0.9, s - 0.8, s - 0.8, 0.03, bevel=0.1)
    lines = text_.split(chr(10))
    for i, ln in enumerate(lines):
        text(cx, cy + (i - (len(lines) - 1) / 2) * 1.0, ln, 0.8, TOP + 0.95, 'print_gray')
    keep(cx, cy, s + 0.6, s + 0.6)


def c_box(cx, cy, w, h, dz, mat='plastic_black', z0=None, bevel=0.2):
    add_box(mat, cx, cy, TOP if z0 is None else z0, w, h, dz, bevel=bevel)
    keep(cx, cy, w + 0.6, h + 0.6)


def c_lens(cx, cy, r, dz, mat='print_dark', z0=None):
    add_cyl(mat, cx, cy, TOP if z0 is None else z0, r, dz)
    keep(cx, cy, 2 * r + 0.6, 2 * r + 0.6)


COMP = {
    'box': lambda d: c_box(d['cx'], d['cy'], d['w'], d['h'], d['dz'], d.get('mat', 'plastic_black'), d.get('z0'), d.get('bevel', 0.2)),
    'lens': lambda d: c_lens(d['cx'], d['cy'], d['r'], d['dz'], d.get('mat', 'print_dark'), d.get('z0')),
    'bga': lambda d: c_bga(d['cx'], d['cy'], d['s'], d.get('text', '')),
    'usbc': lambda d: c_usbc(d['cx'], d['edge'], d['side'], d.get('cy')),
    'micro': lambda d: c_micro(d['cx'], d['edge'], d['side'], d.get('cy')),
    'qfn': lambda d: c_qfn(d['cx'], d['cy'], d['s'], d['text'], d.get('pins', 7), d.get('shield', False), d.get('rot', 0)),
    'qfp': lambda d: c_qfp(d['cx'], d['cy'], d['body'], d['pins'], d.get('rot', 0), d['text']),
    'soic': lambda d: c_soic(d['cx'], d['cy'], d['w'], d['h'], d.get('text', ''), d.get('pins', 8), d.get('sot', False), d.get('pitch', 1.27)),
    'sot223': lambda d: c_sot223(d['cx'], d['cy'], d.get('rot', 0), d.get('small', False)),
    'btn': lambda d: c_btn(d['cx'], d['cy'], d.get('small', False)),
    'led': lambda d: c_led(d['cx'], d['cy'], d['color'], d.get('rot', 0)),
    'rgb': lambda d: c_rgb(d['cx'], d['cy']),
    'smd': lambda d: c_smd(d['cx'], d['cy'], d['w'], d['h'], d.get('kind', 'r'), d.get('rot', 0)),
    'xtal': lambda d: c_xtal(d['cx'], d['cy'], d['w'], d['h'], d.get('text', '')),
    'xtal_sm': lambda d: c_xtal_sm(d['cx'], d['cy'], d.get('vertical', False)),
    'jumper': lambda d: c_jumper(d['cx'], d['cy']),
    'pinheader': lambda d: c_pinheader(d['cx'], d['cy'], d.get('n', 4), d.get('vertical', True)),
    'ceramic_ant': lambda d: c_ceramic_ant(d['cx'], d['cy'], d['w'], d['h']),
    'fheader': lambda d: c_fheader(d['pts']),
    'usbb': lambda d: c_usbb(d['cx'], d['cy'], d['x0'], d['x1']),
    'dcjack': lambda d: c_dcjack(d['cx'], d['cy'], d['w'], d['h']),
    'dip': lambda d: c_dip(d['cx'], d['cy'], d['w'], d['h'], d.get('text', ''), d.get('pins', 14)),
    'ecap': lambda d: c_ecap(d['cx'], d['cy'], d['r']),
    'icsp': lambda d: c_icsp(d['cx'], d['cy'], d.get('cols', 2), d.get('rows', 3)),
    'hole': lambda d: c_hole(d['cx'], d['cy'], d.get('r', 1.6)),
    'btn2': lambda d: c_btn2(d['cx'], d['cy'], d.get('top', 'btn_red'), d.get('size', 6.0)),
    'castell': lambda d: c_castell(d['ys'], d['W']),
    'shieldbox': lambda d: c_shieldbox(d['cx'], d['cy'], d['w'], d['h'], d.get('text', '')),
    'antenna': lambda d: c_antenna(d['cx'], d['cy'], d['w'], d['h'], d.get('n', 4)),
    'module': lambda d: c_module(d['x'], d['y'], d['w'], d['h'], d['ant'], d['text'], d.get('pad_pitch', 1.27), d.get('shield_inset', 0.4), d.get('pads_n')),
}


def build(bid, spec):
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for k in list(BATCH):
        BATCH[k].free()
    BATCH.clear()
    KEEP.clear()
    MATS.clear()
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m)
    SKIP.clear()
    init_materials(spec['mask'])
    W, H = spec['W'], spec['H']
    kk = spec.get('k', 1.0)
    ox, oy = spec.get('off', (0.0, 0.0))
    # выводы заданы в координатах схемы (слоя выводов); в модели: x / k - смещение
    pins = [dict(p, x=round(p['x'] / kk - ox, 3), y=round(p['y'] / kk - oy, 3)) for p in spec['pins']]
    silk = 'silk_blue' if spec['mask'] == 'white' else 'silk_w'
    outline = spec.get('outline')
    opts = uno_outline(W, H, spec['radius']) if outline == 'uno' else mega_outline(W, H, spec['radius']) if outline == 'mega' else None
    add_rounded('mask', W, H, spec['radius'], 0, TOP, pts=opts)
    # детали
    for kind, d in spec['comps']:
        if kind == 'text':
            text(d['x'], d['y'], d['t'], d['size'], TOP + 0.005, d.get('m', silk), d.get('rot', 0))
            n = len(d['t']) * d['size'] * 0.62
            KEEP.append((d['x'] - n / 2, d['y'] - d['size'] * 0.5, d['x'] + n / 2, d['y'] + d['size'] * 0.5))
        else:
            COMP[kind](d)
    # контактные площадки (кроме скрытых под гребёнками)
    skip = set(SKIP)
    for kind, d in spec['comps']:
        if kind == 'pinheader':
            for i in range(d.get('n', 4)):
                skip.add((round(d['cx'], 2), round(d['cy'] + (i - (d.get('n', 4) - 1) / 2) * 2.54, 2)))
    for p in pins:
        if (round(p['x'], 2), round(p['y'], 2)) in skip:
            continue
        add_cyl('gold', p['x'], p['y'], TOP, 0.98, 0.05)
        add_cyl('hole', p['x'], p['y'], TOP + 0.05, 0.55, 0.01, 24)
    # шёлкография у выводов (если не упирается в детали и другие подписи)
    for p in (pins if spec.get('pin_silk', True) else []):
        t = p['silk']
        if not t:
            continue
        size = 0.85
        n = len(t) * size * 0.64
        side = p['side']
        if side in 'rl':
            cx = p['x'] + (1.2 + n / 2 if side == 'r' else -(1.2 + n / 2))
            cy, rot, bw, bh = p['y'], 0, n, size * 0.8
        else:
            cy = p['y'] + (1.25 + n / 2 if side == 'b' else -(1.25 + n / 2))
            cx, rot, bw, bh = p['x'], 90, size * 0.8, n
        box = (cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2)
        if box[0] < 0.3 or box[2] > W - 0.3 or box[1] < 0.3 or box[3] > H - 0.3:
            continue
        if any(box[0] < k[2] and box[2] > k[0] and box[1] < k[3] and box[3] > k[1] for k in KEEP if k[0] != k[2]):
            continue
        text(cx, cy, t, size, TOP + 0.005, silk, rot)
        KEEP.append(box)
    # переходные отверстия (мелкие), детерминированно
    rnd = random.Random(bid)
    pts = [(p['x'], p['y']) for p in pins]
    cnt, tries = 0, 0
    target = int(W * H / (160 if spec['mask'] == 'white' else 90))
    while cnt < target and tries < 4000:
        tries += 1
        x, y = rnd.uniform(1.5, W - 1.5), rnd.uniform(1.5, H - 1.5)
        if outline and x > W - 4.2:
            continue
        if any((x - a) ** 2 + (y - b) ** 2 < 2.2 ** 2 for a, b in pts):
            continue
        if any(k[0] - 0.8 < x < k[2] + 0.8 and k[1] - 0.8 < y < k[3] + 0.8 for k in KEEP):
            continue
        add_cyl('via', x, y, TOP, 0.27, 0.03, 16)
        add_cyl('hole', x, y, TOP + 0.03, 0.12, 0.01, 12)
        KEEP.append((x - 0.3, y - 0.3, x + 0.3, y + 0.3))
        cnt += 1
    flush_batches()
    # границы кадра
    x0, y0, x1, y1 = 0, 0, W, H
    for k in KEEP:
        if k[0] != k[2]:
            x0, y0, x1, y1 = min(x0, k[0]), min(y0, k[1]), max(x1, k[2]), max(y1, k[3])
    x0 -= PAD
    y0 -= PAD
    x1 += PAD
    y1 += PAD
    return x0, y0, x1, y1


def setup_scene(x0, y0, x1, y1):
    sc = bpy.context.scene
    imw, imh = x1 - x0, y1 - y0
    K = min(MAXK, MAXPX / max(imw, imh))
    rx, ry = math.ceil(imw * K), math.ceil(imh * K)
    imw, imh = rx / K, ry / K
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    sc.cycles.max_bounces = 6
    sc.render.film_transparent = True
    sc.render.resolution_x, sc.render.resolution_y = rx, ry
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.image_settings.color_depth = '8'
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.exposure = float(os.environ.get('BOARDART_EXPOSURE', '0.0'))
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.type = 'ORTHO'
    cam.data.sensor_fit = 'HORIZONTAL'
    cam.data.ortho_scale = imw
    cam.data.clip_start, cam.data.clip_end = 1, 1000
    cam.location = ((x0 + x1) / 2, -(y0 + y1) / 2, 200)
    sc.collection.objects.link(cam)
    sc.camera = cam
    # мир: ровный мягкий свет
    w = bpy.data.worlds.new('w')
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (1, 1, 1, 1)
    bg.inputs['Strength'].default_value = float(os.environ.get('BOARDART_WORLD', '0.34'))
    sc.world = w
    # ключевой свет сверху-слева, мягкий (даёт сдвинутую мягкую тень вправо-вниз)
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = float(os.environ.get('BOARDART_SUN', '2.3'))
    sun.data.angle = math.radians(25)
    sun.rotation_euler = (math.radians(-18), math.radians(-24), 0)
    sc.collection.objects.link(sun)
    # тень под платой дорисовывает convert.py (по альфа-каналу): так она одинаково мягкая на светлой и тёмной теме
    return K, rx, ry, imw, imh


def main():
    os.makedirs(OUT, exist_ok=True)
    meta_path = os.path.join(OUT, 'meta.json')
    meta = json.load(open(meta_path, encoding='utf8')) if os.path.exists(meta_path) else {}
    for bid, spec in boards.BOARDS.items():
        if ONLY and bid not in ONLY:
            continue
        x0, y0, x1, y1 = build(bid, spec)
        K, rx, ry, imw, imh = setup_scene(x0, y0, x1, y1)
        sc = bpy.context.scene
        sc.render.filepath = os.path.join(OUT, bid + '.png')
        bpy.ops.render.render(write_still=True)
        kk = spec.get('k', 1.0)
        ox, oy = spec.get('off', (0.0, 0.0))
        meta[bid] = dict(
            title=spec['title'], W=spec.get('LW', spec['W'] * kk), H=spec.get('LH', spec['H'] * kk), K=K / kk, px=[rx, ry],
            x=round((x0 + ox) * kk, 4), y=round((y0 + oy) * kk, 4), w=round(imw * kk, 4), h=round(imh * kk, 4),
            pins={p['name']: [p['x'], p['y']] for p in spec['pins']},
        )
        json.dump(meta, open(meta_path, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
        print('RENDERED', bid, rx, ry, round(K, 2))


main()
