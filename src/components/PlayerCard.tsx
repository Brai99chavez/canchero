import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  ClipPath,
  Defs,
  G,
  Image as SvgImage,
  Mask,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { CardTemplate, CARD_TEMPLATES, SILUETA } from '../assets';
import { fuentes } from '../theme';
import { overall, Player, STAT_KEYS, STAT_LABELS, tierFor } from '../types';

/**
 * La carta entera vive dentro del SVG: fondo, foto y textos comparten el
 * sistema de coordenadas del PNG de la plantilla. Así el viewBox escala todo
 * junto y nada se desalinea, sea cual sea el tamaño de pantalla.
 *
 * Las medidas de cada plantilla están en src/assets.ts.
 */

/**
 * La foto se apaga con una viñeta elíptica ajustada a su propia zona: llega a
 * cero justo en los cuatro bordes, así no queda ningún canto recto y el
 * desvanecido sale igual para cualquier foto.
 *
 * La elipse NO se pide con `rx`/`ry`: en Android, react-native-svg ubica mal
 * el centro cuando los dos radios difieren (multiplica `cy` por `ry/rx`), y la
 * viñeta sube. Con la foto en la mitad de arriba de la carta eso dejaba el
 * degradado por encima del borde superior y la foto aparecía cortada al ras
 * arriba. En su lugar se pide un círculo —que el bug no toca— y la elipse sale
 * de estirar el grupo que lo usa.
 */
const VINETA = [
  { offset: 0, opacity: 1 },
  { offset: 0.62, opacity: 1 },
  { offset: 0.78, opacity: 0.86 },
  { offset: 0.9, opacity: 0.5 },
  { offset: 0.97, opacity: 0.16 },
  { offset: 1, opacity: 0 },
];

/**
 * En una tipografía bold la altura de las mayúsculas ronda 0.72 del cuerpo.
 * Los textos se ubican por su línea de base, así que este factor convierte
 * "quiero el centro del texto acá" en la base correspondiente.
 */
const CAP = 0.72;
const baseCentrada = (centro: number, cuerpo: number) =>
  centro + (cuerpo * CAP) / 2;

interface TextoProps {
  x: number;
  y: number;
  size: number;
  plantilla: CardTemplate;
  anchor?: 'start' | 'middle' | 'end';
  maxWidth?: number;
  /** Anton para lo grande; el resto va en la de la interfaz. */
  fuente?: string;
  children: string | number;
}

/**
 * Cada texto se dibuja dos veces: primero engrosado con el color del fondo y
 * después relleno. Ese halo es lo que lo mantiene legible cuando cae sobre una
 * foto clara u oscura, sin tener que oscurecer media carta.
 */
function Texto({
  x,
  y,
  size,
  plantilla,
  anchor = 'middle',
  maxWidth,
  fuente = fuentes.extra,
  children,
}: TextoProps) {
  const texto = String(children);
  // Estimación del ancho: alcanza para decidir si hay que condensarlo.
  const ancho = texto.length * size * 0.62;
  const condensar = maxWidth && ancho > maxWidth ? maxWidth : undefined;

  const comunes = {
    x,
    y,
    fontSize: size,
    fontFamily: fuente,
    textAnchor: anchor,
    textLength: condensar,
    lengthAdjust: 'spacingAndGlyphs' as const,
  };

  return (
    <G>
      <SvgText
        {...comunes}
        fill={plantilla.halo}
        stroke={plantilla.halo}
        strokeWidth={size * 0.13}
        opacity={0.55}
      >
        {texto}
      </SvgText>
      <SvgText {...comunes} fill={plantilla.ink}>
        {texto}
      </SvgText>
    </G>
  );
}

export interface ResumenCarta {
  jugados: number;
  goles: number;
  asistencias: number;
}

export default function PlayerCard({
  player,
  media: mediaProp,
  resumen,
}: {
  player: Player;
  /**
   * La media a dibujar. Sin esto usa la que sale de las stats — que es lo que
   * hay que mostrar mientras se edita, porque es la que se está tocando.
   */
  media?: number;
  /** Lo que hizo en los partidos cargados. Sin partidos, no se dibuja nada. */
  resumen?: ResumenCarta;
}) {
  const media = mediaProp ?? overall(player);
  const p = CARD_TEMPLATES[tierFor(media)];

  const columnas = [STAT_KEYS.slice(0, 3), STAT_KEYS.slice(3)];
  const altoStats = p.stats.bottom - p.stats.top;
  const anchoStats = p.stats.right - p.stats.left;

  return (
    <View style={[styles.card, { aspectRatio: p.width / p.height }]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${p.width} ${p.height}`}>
        <Defs>
          {/* En una máscara el blanco se ve y el negro se esconde. */}
          <RadialGradient
            id="vineta"
            cx={p.foto.width / 2}
            cy={p.foto.width / 2}
            r={p.foto.width / 2}
            gradientUnits="userSpaceOnUse"
          >
            {VINETA.map((parada) => (
              <Stop
                key={parada.offset}
                offset={parada.offset}
                stopColor="#FFFFFF"
                stopOpacity={parada.opacity}
              />
            ))}
          </RadialGradient>

          <Mask
            id="desvanecido"
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width={p.width}
            height={p.height}
          >
            {/*
              El cuadrado se estira hasta la zona de la foto y con él el
              círculo, que así termina siendo la elipse que se quiere.
            */}
            <G
              transform={`translate(${p.foto.x} ${p.foto.y}) scale(1 ${
                p.foto.height / p.foto.width
              })`}
            >
              <Rect
                x="0"
                y="0"
                width={p.foto.width}
                height={p.foto.width}
                fill="url(#vineta)"
              />
            </G>
          </Mask>

          <ClipPath id="recorte">
            <Path d={p.clip} />
          </ClipPath>
        </Defs>

        <SvgImage
          href={p.source}
          x="0"
          y="0"
          width={p.width}
          height={p.height}
          preserveAspectRatio="none"
        />

        <G clipPath="url(#recorte)" mask="url(#desvanecido)">
          {player.foto ? (
            <SvgImage
              href={{ uri: player.foto }}
              x={p.foto.x}
              y={p.foto.y}
              width={p.foto.width}
              height={p.foto.height}
              // Llena la zona y recorta lo que sobra, anclado arriba para no
              // cortarle la cabeza a nadie.
              preserveAspectRatio="xMidYMin slice"
            />
          ) : (
            <SvgImage
              href={SILUETA}
              x={p.busto.x}
              y={p.busto.y}
              width={p.busto.width}
              height={p.busto.height}
              preserveAspectRatio="xMidYMax meet"
            />
          )}
        </G>

        <Texto
          x={p.media.x}
          y={p.media.baseline}
          size={p.media.size}
          plantilla={p}
          fuente={fuentes.display}
        >
          {media}
        </Texto>

        <Texto
          x={p.posicion.x}
          y={p.posicion.baseline}
          size={p.posicion.size}
          plantilla={p}
        >
          {player.posicion}
        </Texto>

        <Texto
          x={p.nombre.x}
          y={p.nombre.baseline}
          size={p.nombre.size}
          maxWidth={p.nombre.maxWidth}
          plantilla={p}
          fuente={fuentes.display}
        >
          {player.nombre.toUpperCase()}
        </Texto>

        {resumen && resumen.jugados > 0 ? (
          <Texto
            x={p.aportes.x}
            y={p.aportes.baseline}
            size={p.aportes.size}
            plantilla={p}
          >
            {`${resumen.jugados} PJ · ${resumen.goles} G · ${resumen.asistencias} A`}
          </Texto>
        ) : null}

        {columnas.map((columna, ci) =>
          columna.map((key, ri) => {
            const cx = p.stats.left + anchoStats * (0.25 + 0.5 * ci);
            const cy = p.stats.top + (altoStats * (ri + 0.5)) / 3;
            const base = baseCentrada(cy, p.stats.value);
            return (
              <G key={key}>
                <Texto
                  x={cx - p.stats.value * 0.28}
                  y={base}
                  size={p.stats.value}
                  anchor="end"
                  plantilla={p}
                >
                  {player.stats[key]}
                </Texto>
                <Texto
                  x={cx + p.stats.value * 0.07}
                  y={base}
                  size={p.stats.label}
                  anchor="start"
                  plantilla={p}
                >
                  {STAT_LABELS[key].slice(0, 3).toUpperCase()}
                </Texto>
              </G>
            );
          })
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  // Se estira hasta donde la deje el contenedor, manteniendo la proporción
  // exacta del PNG. Eso la hace andar igual en cualquier pantalla.
  card: {
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
  },
});
