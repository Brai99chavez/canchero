"""
Genera la marca de CANCHERO: el escudo inclinado y biselado de la app, con la
cancha calada adentro y el degradado menta-cyan de la interfaz.

    python tools/generar-iconos.py

Sobreescribe los PNG de assets/ que referencia app.json y la pantalla de carga.
Volver a correrlo es inofensivo: siempre dibuja lo mismo.

Las coordenadas son las mismas que usa `src/components/Logo.tsx`, en una caja
de 100x100. Si se toca una, hay que tocar la otra: el splash nativo y la
pantalla de carga se ven uno detrás del otro y cualquier diferencia se nota
como un salto.

Requiere Pillow (pip install pillow).
"""

import math
import os

from PIL import Image, ImageDraw, ImageFont

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(RAIZ, 'assets')
ANTON = os.path.join(
    RAIZ, 'node_modules', '@expo-google-fonts', 'anton', '400Regular',
    'Anton_400Regular.ttf',
)

# Los mismos valores que src/theme.ts.
FONDO = (13, 17, 36)
FONDO_CLARO = (26, 32, 62)
MENTA = (91, 245, 165)
CYAN = (47, 217, 232)
TEXTO = (237, 239, 255)

# Dibujar en grande y achicar al final es lo único que da bordes limpios en un
# polígono inclinado: PIL no tiene antialias propio.
SUPER = 4

# El escudo: rectángulo inclinado -9° con dos esquinas opuestas biseladas. La
# inclinación va metida en los puntos y no como transformación, así el bisel
# conserva su ángulo en vez de estirarse con el resto.
ESCUDO = [(23, 6), (75, 6), (88.5, 22), (77, 94), (25, 94), (11.5, 78)]
# La línea del medio cruza de lado a lado: es lo que hace que el escudo se
# lea como una cancha y no como un sello cualquiera. Se dibuja pasada de
# largo a propósito, porque sólo pinta adentro del polígono.
LINEA_MEDIA = ((12, 50), (88, 50))
CIRCULO_R = 16.0
GROSOR = 5.0
INCLINACION = math.radians(9)


def degradado(size):
    """El menta-cyan en diagonal, del vértice de arriba a la izquierda."""
    img = Image.new('RGB', (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            k = (x + y) / (2 * size - 2)
            px[x, y] = tuple(
                int(MENTA[i] + (CYAN[i] - MENTA[i]) * k) for i in range(3)
            )
    return img


def mascara_marca(size, escala):
    """
    Silueta de la marca en escala de grises: blanco lo que se pinta, negro lo
    calado. `escala` es cuánto del lado ocupa la caja de 100 unidades.
    """
    lado = size * SUPER
    caja = lado * escala
    off = (lado - caja) / 2
    u = caja / 100.0

    def p(punto):
        return (off + punto[0] * u, off + punto[1] * u)

    m = Image.new('L', (lado, lado), 0)
    d = ImageDraw.Draw(m)
    d.polygon([p(v) for v in ESCUDO], fill=255)

    # La cancha se cala: línea del medio y círculo central en negro.
    grosor = max(1, int(round(GROSOR * u)))
    d.line([p(LINEA_MEDIA[0]), p(LINEA_MEDIA[1])], fill=0, width=grosor)
    cx, cy = p((50, 50))
    r = CIRCULO_R * u
    d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=0, width=grosor)

    return m.resize((size, size), Image.LANCZOS)


def marca(size, escala=1.0, color=None):
    """La marca sola, con fondo transparente."""
    mask = mascara_marca(size, escala)
    relleno = (
        Image.new('RGB', (size, size), color) if color else degradado(size)
    )
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    img.paste(relleno, (0, 0), mask)
    return img


def fondo(size):
    """El azul de la app con un degradado apenas perceptible."""
    img = Image.new('RGB', (size, size), FONDO)
    d = ImageDraw.Draw(img)
    for y in range(size):
        k = y / max(1, size - 1)
        d.line(
            (0, y, size, y),
            fill=tuple(
                int(FONDO_CLARO[i] + (FONDO[i] - FONDO_CLARO[i]) * k)
                for i in range(3)
            ),
        )
    return img.convert('RGBA')


def sobre_fondo(size, escala):
    base = fondo(size)
    base.alpha_composite(marca(size, escala))
    return base


def palabra(texto, alto, color=TEXTO):
    """
    'CANCHERO' en Anton, inclinada los mismos 9° que todo lo demás. Se dibuja
    en grande y se achica porque el corte de la inclinación, a tamaño final,
    deja los bordes dentados.
    """
    fuente = ImageFont.truetype(ANTON, int(alto * SUPER))
    caja = ImageDraw.Draw(Image.new('L', (1, 1))).textbbox(
        (0, 0), texto, font=fuente
    )
    ancho = caja[2] - caja[0]
    altura = caja[3] - caja[1]
    margen = int(altura * 0.35)  # aire para que la inclinación no se corte

    img = Image.new('RGBA', (ancho + margen * 2, altura + margen), (0, 0, 0, 0))
    ImageDraw.Draw(img).text(
        (margen - caja[0], -caja[1]), texto, font=fuente, fill=color + (255,)
    )

    # Inclinación: el corrimiento se mide desde el medio, así la palabra no se
    # va de posición, sólo se acuesta.
    w, h = img.size
    k = math.tan(INCLINACION)
    img = img.transform(
        (w, h), Image.AFFINE, (1, k, -k * h / 2, 0, 1, 0), Image.BICUBIC
    )
    return img.resize((w // SUPER, h // SUPER), Image.LANCZOS)


def logotipo(size):
    """Escudo arriba, CANCHERO abajo. Es lo que se ve mientras la app carga."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))

    escudo = marca(int(size * 0.42))
    texto = palabra('CANCHERO', int(size * 0.125))
    hueco = int(size * 0.055)

    total = escudo.height + hueco + texto.height
    y = (size - total) // 2
    img.alpha_composite(escudo, ((size - escudo.width) // 2, y))
    img.alpha_composite(
        texto, ((size - texto.width) // 2, y + escudo.height + hueco)
    )
    return img


def guardar(img, nombre):
    img.save(os.path.join(ASSETS, nombre))
    print('->', nombre, img.size)


if __name__ == '__main__':
    # Icono principal: a sangre, el sistema le recorta las esquinas.
    guardar(sobre_fondo(1024, 0.76), 'icon.png')

    # Adaptativo de Android: la marca sola y chica, porque el sistema recorta
    # hasta un 33% de los bordes.
    guardar(marca(1024, 0.56), 'android-icon-foreground.png')
    guardar(Image.new('RGBA', (1024, 1024), FONDO), 'android-icon-background.png')
    guardar(
        marca(1024, 0.56, color=(255, 255, 255)),
        'android-icon-monochrome.png',
    )

    # Splash nativo y pantalla de carga comparten este archivo a propósito.
    guardar(logotipo(1024), 'splash-icon.png')
    guardar(sobre_fondo(96, 0.8), 'favicon.png')
