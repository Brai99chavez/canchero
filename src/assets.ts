import { ImageSourcePropType } from 'react-native';
import { Tier } from './types';

/** Silueta para cuando el jugador no tiene foto. */
export const SILUETA: ImageSourcePropType = require('../assets/silueta.png');

export interface Zona {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CardTemplate {
  source: ImageSourcePropType;
  /** Medidas del PNG: todo lo demás va en estas coordenadas. */
  width: number;
  height: number;
  /** Contorno de la carta, trazado del alfa del PNG y metido para adentro. */
  clip: string;
  /** Color del texto y del halo que lo despega de la foto. */
  ink: string;
  halo: string;
  foto: Zona;
  busto: Zona;
  media: { x: number; baseline: number; size: number };
  posicion: { x: number; baseline: number; size: number };
  aportes: { x: number; baseline: number; size: number };
  nombre: { x: number; baseline: number; size: number; maxWidth: number };
  stats: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    value: number;
    label: number;
  };
}

/**
 * La grilla se guarda en fracciones del tamaño de la carta, no en píxeles: así
 * una plantilla nueva sólo necesita su medida y el resto cae en el mismo lugar
 * relativo, sin importar que el PNG venga a otra escala.
 *
 * Los valores salen de medir las guías doradas de la plantilla 1, que es la
 * única que las trae dibujadas.
 */
const GRILLA = {
  foto: { x: 0.1, y: 0.037, width: 0.8, height: 0.541 },
  busto: { x: 0.2, y: 0.21, width: 0.6, height: 0.368 },
  media: { x: 0.23, baseline: 0.28, size: 0.145 },
  posicion: { x: 0.23, baseline: 0.377, size: 0.0625 },
  nombre: { x: 0.5, baseline: 0.5997, size: 0.0825, maxWidth: 0.675 },
  /** Renglón chico debajo del nombre: partidos, goles y asistencias. */
  aportes: { x: 0.5, baseline: 0.636, size: 0.035 },
  stats: {
    left: 0.15,
    right: 0.85,
    top: 0.677,
    bottom: 0.8656,
    value: 0.0725,
    label: 0.0625,
  },
};

type Grilla = typeof GRILLA;

function construir(
  source: ImageSourcePropType,
  width: number,
  height: number,
  clip: string,
  ink: string,
  halo: string,
  ajustes: Partial<Grilla> = {}
): CardTemplate {
  const g = { ...GRILLA, ...ajustes };
  const zona = (z: Grilla['foto']): Zona => ({
    x: z.x * width,
    y: z.y * height,
    width: z.width * width,
    height: z.height * height,
  });

  return {
    source,
    width,
    height,
    clip,
    ink,
    halo,
    foto: zona(g.foto),
    busto: zona(g.busto),
    // Los cuerpos de letra van contra el ancho, para que no se deformen
    // cuando una plantilla es más alta o más baja que otra.
    media: {
      x: g.media.x * width,
      baseline: g.media.baseline * height,
      size: g.media.size * width,
    },
    posicion: {
      x: g.posicion.x * width,
      baseline: g.posicion.baseline * height,
      size: g.posicion.size * width,
    },
    aportes: {
      x: g.aportes.x * width,
      baseline: g.aportes.baseline * height,
      size: g.aportes.size * width,
    },
    nombre: {
      x: g.nombre.x * width,
      baseline: g.nombre.baseline * height,
      size: g.nombre.size * width,
      maxWidth: g.nombre.maxWidth * width,
    },
    stats: {
      left: g.stats.left * width,
      right: g.stats.right * width,
      top: g.stats.top * height,
      bottom: g.stats.bottom * height,
      value: g.stats.value * width,
      label: g.stats.label * width,
    },
  };
}

/** Azul y dorada. Es la única con las líneas guía dibujadas. */
const AZUL = construir(
  require('../assets/card-jugador-1.png'),
  400,
  647,
  'M 154 8 L 28 82 L 8 88 L 12 560 L 33 574 L 193 634 L 207 634 L 376 ' +
    '570 L 387 560 L 391 88 L 377 84 L 246 8 Z',
  '#E9DA88',
  '#0A1226'
);

/**
 * Mármol. Fondo claro, así que el texto va oscuro con halo claro. Las stats
 * suben un poco: abajo la plantilla trae impreso "FUT CARDS".
 */
const MARMOL = construir(
  require('../assets/card-jugador-3.png'),
  327,
  457,
  'M 129 14 L 43 52 L 26 56 L 33 408 L 41 416 L 53 422 L 153 440 L 173 ' +
    '440 L 275 422 L 294 408 L 299 56 L 284 52 L 199 14 Z',
  '#2B2720',
  '#EDEAE5',
  { stats: { ...GRILLA.stats, top: 0.665, bottom: 0.825 } }
);

/**
 * Neón. La plantilla actual: fondo azul oscuro con el marco de esquirlas, sin
 * nada impreso adentro. Como el panel es oscuro, el texto va claro con halo
 * oscuro; y como no trae guías, el bloque de abajo se corrió un poco para
 * repartir el aire entre el nombre y la punta inferior del marco.
 *
 * La foto también baja: el marco tiene una punta arriba, así que arrancando
 * tan alto como en las otras plantillas el desvanecido quedaba cortado contra
 * el borde y la foto se veía como una calcomanía pegada. Corrida hacia abajo
 * entra entera y el degradado muere justo antes del nombre.
 */
const NEON = construir(
  require('../assets/card-jugador.png'),
  1084,
  1451,
  'M 434 75 L 650 75 L 992 218 L 992 1241 L 862 1310 L 520 1390 L 222 1310 ' +
    'L 114 1241 L 114 218 Z',
  '#F2F6FF',
  '#08132E',
  {
    foto: { x: 0.08, y: 0.125, width: 0.86, height: 0.485 },
    busto: { x: 0.2, y: 0.265, width: 0.6, height: 0.345 },
    nombre: { ...GRILLA.nombre, baseline: 0.615 },
    aportes: { ...GRILLA.aportes, baseline: 0.651 },
    stats: { ...GRILLA.stats, top: 0.678, bottom: 0.872 },
  }
);

/**
 * Hoy las tres categorías usan la misma plantilla. Con una por tier, cada
 * jugador usaría la que le toca por media.
 */
export const CARD_TEMPLATES: Record<Tier, CardTemplate> = {
  oro: NEON,
  plata: NEON,
  bronce: NEON,
};

/** Plantillas disponibles, para poder cambiar la de arriba en una línea. */
export const PLANTILLAS = { AZUL, MARMOL, NEON };
