"""
Dibuja la carta del jugador fuera de la app, para poder ajustar el diseno sin
tener que compilar y mirar en el celular.

    python tools/preview-carta.py            # la plantilla activa
    python tools/preview-carta.py AZUL       # una en particular
    python tools/preview-carta.py MARMOL

Deja las imagenes en tools/salida/. La grilla de abajo es la misma que la de
src/assets.ts: si la tocas aca, tocala alla tambien.

Requiere Pillow (pip install pillow).
"""

import os
import sys
from PIL import Image, ImageChops, ImageDraw, ImageFont

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, 'tools', 'salida')
FUENTE = 'C:/Windows/Fonts/arialbd.ttf'

# --- mismas constantes que src/components/PlayerCard.tsx ---
VINETA = [(0, 1.0), (0.62, 1.0), (0.78, 0.86), (0.9, 0.5), (0.97, 0.16), (1, 0.0)]
CAP = 0.72

# --- misma grilla que src/assets.ts ---
GRILLA = {
    'foto': dict(x=0.1, y=0.037, width=0.8, height=0.541),
    'busto': dict(x=0.2, y=0.21, width=0.6, height=0.368),
    'media': dict(x=0.23, baseline=0.28, size=0.145),
    'posicion': dict(x=0.23, baseline=0.377, size=0.0625),
    'nombre': dict(x=0.5, baseline=0.5997, size=0.0825, maxWidth=0.675),
    'aportes': dict(x=0.5, baseline=0.636, size=0.035),
    'stats': dict(left=0.15, right=0.85, top=0.677, bottom=0.8656,
                  value=0.0725, label=0.0625),
}

PLANTILLAS = {
    'AZUL': dict(
        archivo='card-jugador-1.png', w=400, h=647,
        ink=(233, 218, 136), halo=(10, 18, 38),
        clip=[(154, 8), (28, 82), (8, 88), (12, 560), (33, 574), (193, 634),
              (207, 634), (376, 570), (387, 560), (391, 88), (377, 84), (246, 8)],
        ajustes={},
    ),
    'MARMOL': dict(
        archivo='card-jugador-3.png', w=327, h=457,
        ink=(43, 39, 32), halo=(237, 234, 229),
        clip=[(129, 14), (43, 52), (26, 56), (33, 408), (41, 416), (53, 422),
              (153, 440), (173, 440), (275, 422), (294, 408), (299, 56),
              (284, 52), (199, 14)],
        ajustes={'stats': dict(GRILLA['stats'], top=0.665, bottom=0.825)},
    ),
    'NEON': dict(
        archivo='card-jugador.png', w=1084, h=1451,
        ink=(242, 246, 255), halo=(8, 19, 46),
        clip=[(434, 75), (650, 75), (992, 218), (992, 1241), (862, 1310),
              (520, 1390), (222, 1310), (114, 1241), (114, 218)],
        ajustes={
            'foto': dict(x=0.08, y=0.125, width=0.86, height=0.485),
            'busto': dict(x=0.20, y=0.265, width=0.60, height=0.345),
            'nombre': dict(GRILLA['nombre'], baseline=0.6150),
            'aportes': dict(GRILLA['aportes'], baseline=0.6510),
            'stats': dict(GRILLA['stats'], top=0.6780, bottom=0.8720),
        },
    ),
}

ACTIVA = 'NEON'


def construir(nombre):
    p = PLANTILLAS[nombre]
    w, h = p['w'], p['h']
    g = dict(GRILLA)
    g.update(p['ajustes'])

    def zona(z):
        return dict(x=z['x'] * w, y=z['y'] * h,
                    w=z['width'] * w, h=z['height'] * h)

    return dict(
        archivo=p['archivo'], w=w, h=h, clip=p['clip'],
        ink=p['ink'] + (255,), halo=p['halo'] + (255,),
        foto=zona(g['foto']), busto=zona(g['busto']),
        media=dict(x=g['media']['x'] * w, base=g['media']['baseline'] * h,
                   size=g['media']['size'] * w),
        posicion=dict(x=g['posicion']['x'] * w,
                      base=g['posicion']['baseline'] * h,
                      size=g['posicion']['size'] * w),
        nombre=dict(x=g['nombre']['x'] * w, base=g['nombre']['baseline'] * h,
                    size=g['nombre']['size'] * w),
        aportes=dict(x=g['aportes']['x'] * w, base=g['aportes']['baseline'] * h,
                     size=g['aportes']['size'] * w),
        stats=dict(left=g['stats']['left'] * w, right=g['stats']['right'] * w,
                   top=g['stats']['top'] * h, bottom=g['stats']['bottom'] * h,
                   value=g['stats']['value'] * w, label=g['stats']['label'] * w),
    )


def opacidad(dist):
    if dist >= 1:
        return 0.0
    for i in range(len(VINETA) - 1):
        o0, a0 = VINETA[i]
        o1, a1 = VINETA[i + 1]
        if o0 <= dist <= o1:
            k = 0 if o1 == o0 else (dist - o0) / (o1 - o0)
            return a0 + (a1 - a0) * k
    return 0.0


def mascara(p):
    """Vineta eliptica ajustada a la zona de la foto. Igual que en el SVG."""
    m = Image.new('L', (p['w'], p['h']), 0)
    d = m.load()
    f = p['foto']
    cx, cy = f['x'] + f['w'] / 2, f['y'] + f['h'] / 2
    rx, ry = f['w'] / 2, f['h'] / 2
    for y in range(int(f['y']), int(f['y'] + f['h'])):
        for x in range(int(f['x']), int(f['x'] + f['w'])):
            dist = (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2) ** 0.5
            d[x, y] = int(round(255 * opacidad(dist)))
    return m


def recorte(p):
    m = Image.new('L', (p['w'], p['h']), 0)
    ImageDraw.Draw(m).polygon(p['clip'], fill=255)
    return m


def render(p, jugador, foto_path, destino):
    carta = Image.open(os.path.join(RAIZ, 'assets', p['archivo'])).convert('RGBA')
    capa = Image.new('RGBA', carta.size, (0, 0, 0, 0))
    f, b = p['foto'], p['busto']

    if foto_path:
        foto = Image.open(foto_path).convert('RGBA')
        esc = max(f['w'] / foto.width, f['h'] / foto.height)
        n = foto.resize((int(foto.width * esc), int(foto.height * esc)), Image.LANCZOS)
        izq = int((n.width - f['w']) // 2)
        capa.paste(n.crop((izq, 0, izq + int(f['w']), int(f['h']))),
                   (int(f['x']), int(f['y'])))
    else:
        sil = Image.open(os.path.join(RAIZ, 'assets', 'silueta.png')).convert('RGBA')
        esc = min(b['w'] / sil.width, b['h'] / sil.height)
        n = sil.resize((int(sil.width * esc), int(sil.height * esc)), Image.LANCZOS)
        capa.paste(n, (int(b['x'] + (b['w'] - n.width) / 2),
                       int(b['y'] + b['h'] - n.height)), n)

    alfa = ImageChops.multiply(
        ImageChops.multiply(capa.getchannel('A'), mascara(p)), recorte(p))
    capa.putalpha(alfa)
    carta = Image.alpha_composite(carta, capa)

    d = ImageDraw.Draw(carta)

    def texto(txt, x, base, size, anchor='ms'):
        """Halo con el color del fondo y despues el relleno, como en el SVG."""
        fnt = ImageFont.truetype(FUENTE, int(round(size)))
        d.text((x, base), txt, font=fnt, fill=p['halo'], anchor=anchor,
               stroke_width=max(1, int(size * 0.13)), stroke_fill=p['halo'])
        d.text((x, base), txt, font=fnt, fill=p['ink'], anchor=anchor)

    texto(str(jugador['media']), p['media']['x'], p['media']['base'],
          p['media']['size'])
    texto(jugador['posicion'], p['posicion']['x'], p['posicion']['base'],
          p['posicion']['size'])
    texto(jugador['nombre'].upper(), p['nombre']['x'], p['nombre']['base'],
          p['nombre']['size'])
    texto(jugador['aportes'], p['aportes']['x'], p['aportes']['base'],
          p['aportes']['size'])

    s = p['stats']
    columnas = [jugador['stats'][:3], jugador['stats'][3:]]
    alto, ancho = s['bottom'] - s['top'], s['right'] - s['left']
    for ci, col in enumerate(columnas):
        cx = s['left'] + ancho * (0.25 + 0.5 * ci)
        for ri, (valor, etiqueta) in enumerate(col):
            cy = s['top'] + alto * (ri + 0.5) / 3
            base = cy + s['value'] * CAP / 2
            texto(str(valor), cx - s['value'] * 0.28, base, s['value'], anchor='rs')
            texto(etiqueta, cx + s['value'] * 0.07, base, s['label'], anchor='ls')

    os.makedirs(SALIDA, exist_ok=True)
    ruta = os.path.join(SALIDA, destino)
    carta.save(ruta)
    print('->', ruta)


if __name__ == '__main__':
    nombre = sys.argv[1].upper() if len(sys.argv) > 1 else ACTIVA
    plantilla = construir(nombre)

    jugador = {
        'nombre': 'Rodrigo',
        'posicion': 'MED',
        'media': 82,
        'stats': [(80, 'PAS'), (90, 'REG'), (80, 'DEF'), (70, 'POS'), (90, 'RES')],
        'aportes': '12 PJ - 8 G - 3 A',
    }
    render(plantilla, jugador, None, 'carta-sin-foto.png')

    # Mitad izquierda oscura a proposito: es el caso que hace aparecer la
    # "banda" contra una franja oscura de la plantilla.
    prueba = Image.new('RGB', (600, 600), (60, 90, 120))
    dd = ImageDraw.Draw(prueba)
    dd.rectangle((0, 0, 260, 600), fill=(14, 14, 18))
    dd.ellipse((200, 120, 400, 340), fill=(210, 180, 150))
    dd.rounded_rectangle((150, 350, 450, 600), 40, fill=(200, 60, 60))
    os.makedirs(SALIDA, exist_ok=True)
    ruta_prueba = os.path.join(SALIDA, 'foto-prueba.png')
    prueba.save(ruta_prueba)
    render(plantilla, jugador, ruta_prueba, 'carta-con-foto.png')
