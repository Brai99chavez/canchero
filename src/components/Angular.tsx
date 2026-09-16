import React, { useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { colors } from '../theme';

/**
 * Los degradados de SVG se referencian por id, y en React Native los ids son
 * globales: dos paneles con el mismo id se pisan. Este contador le da uno
 * propio a cada instancia.
 */
let siguienteId = 0;
function useIdDegradado() {
  // El azar además evita choques después de un recargado en caliente, que
  // reinicia el contador pero no desmonta lo que ya estaba en pantalla.
  const [id] = useState(
    () => `deg${siguienteId++}x${Math.random().toString(36).slice(2, 7)}`
  );
  return id;
}

/**
 * Rellena a su padre con un degradado. Se mide con `onLayout` en vez de usar
 * porcentajes: el SVG en porcentaje no siempre resuelve contra un padre cuyo
 * alto todavía depende del contenido, y queda dibujado en cero.
 */
export function FondoDegradado({
  colores,
  vertical = false,
  opacidad,
}: {
  colores: readonly [string, string];
  vertical?: boolean;
  /**
   * De 0 a 1, para teñir en vez de pintar.
   *
   * Va acá y no como un color con alfa —`#5BF5A526`— porque react-native-svg
   * descarta el alfa del color de cada parada: hace `color & 0x00ffffff` y usa
   * `stopOpacity`, que por defecto es 1. O sea que un hex de ocho dígitos se
   * dibuja opaco y el tinte sale pintado a fondo.
   */
  opacidad?: number;
}) {
  const id = useIdDegradado();
  const [medida, setMedida] = useState({ ancho: 0, alto: 0 });

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) =>
        setMedida({
          ancho: e.nativeEvent.layout.width,
          alto: e.nativeEvent.layout.height,
        })
      }
    >
      {medida.ancho > 0 && medida.alto > 0 ? (
        <Svg width={medida.ancho} height={medida.alto}>
          <Defs>
            <LinearGradient
              id={id}
              x1="0"
              y1="0"
              x2={vertical ? '0' : '1'}
              y2={vertical ? '1' : '0'}
            >
              <Stop offset="0" stopColor={colores[0]} />
              <Stop offset="1" stopColor={colores[1]} />
            </LinearGradient>
          </Defs>
          <Rect
            width={medida.ancho}
            height={medida.alto}
            fill={`url(#${id})`}
            opacity={opacidad}
          />
        </Svg>
      ) : null}
    </View>
  );
}

/**
 * Nada de esquinas redondeadas: acá se cortan en diagonal. Como React Native
 * no sabe hacerlo, el fondo se dibuja con un SVG detrás del contenido, medido
 * al vuelo. El chaflán es el largo del corte en cada esquina.
 */
export const CHAFLAN = 12;

function pathChaflan(w: number, h: number, c: number, esquinas: Esquinas) {
  const ci = esquinas.superiorIzq ? c : 0;
  const cd = esquinas.superiorDer ? c : 0;
  const ii = esquinas.inferiorIzq ? c : 0;
  const id = esquinas.inferiorDer ? c : 0;
  return [
    `M ${ci} 0`,
    `L ${w - cd} 0`,
    `L ${w} ${cd}`,
    `L ${w} ${h - id}`,
    `L ${w - id} ${h}`,
    `L ${ii} ${h}`,
    `L 0 ${h - ii}`,
    `L 0 ${ci}`,
    'Z',
  ].join(' ');
}

interface Esquinas {
  superiorIzq: boolean;
  superiorDer: boolean;
  inferiorIzq: boolean;
  inferiorDer: boolean;
}

const TODAS: Esquinas = {
  superiorIzq: true,
  superiorDer: true,
  inferiorIzq: true,
  inferiorDer: true,
};

/** Sólo dos esquinas en diagonal: da el aire de bloque cortado al sesgo. */
export const DIAGONAL: Esquinas = {
  superiorIzq: false,
  superiorDer: true,
  inferiorIzq: true,
  inferiorDer: false,
};

export default function Panel({
  children,
  style,
  fondo = colors.surface,
  degradado,
  borde = colors.border,
  grosor = 1,
  chaflan = CHAFLAN,
  esquinas = TODAS,
  opacidadFondo,
  onMedida,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  fondo?: string;
  /** Si viene, reemplaza al color plano del fondo. */
  degradado?: readonly [string, string];
  borde?: string;
  grosor?: number;
  chaflan?: number;
  esquinas?: Esquinas;
  /**
   * De 0 a 1, para teñir con un color en vez de pintarlo.
   *
   * Va como número aparte y no como un color con alfa —`#FFC24B26`— porque
   * react-native-svg no trata el alfa del color igual en todos lados, y un
   * tinte del 15% que se dibuja opaco tapa todo lo de abajo. El mismo problema
   * ya había aparecido con las paradas de los degradados.
   */
  opacidadFondo?: number;
  /**
   * Qué tamaño terminó teniendo. El panel ya se mide para dibujar el fondo, y
   * a veces quien lo usa necesita ese mismo número —la barra de pestañas, para
   * saber cuánto mide cada una— y medirlo de nuevo por afuera sería pedirle al
   * sistema lo mismo dos veces.
   */
  onMedida?: (ancho: number, alto: number) => void;
}) {
  const [medida, setMedida] = useState({ ancho: 0, alto: 0 });
  const id = useIdDegradado();

  return (
    <View
      style={style}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setMedida({ ancho: width, alto: height });
        onMedida?.(width, height);
      }}
    >
      {medida.ancho > 0 ? (
        <Svg
          width={medida.ancho}
          height={medida.alto}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          {degradado ? (
            <Defs>
              <LinearGradient id={id} x1="0" y1="0" x2="0.6" y2="1">
                <Stop offset="0" stopColor={degradado[0]} />
                <Stop offset="1" stopColor={degradado[1]} />
              </LinearGradient>
            </Defs>
          ) : null}
          <Path
            d={pathChaflan(medida.ancho, medida.alto, chaflan, esquinas)}
            fill={degradado ? `url(#${id})` : fondo}
            fillOpacity={opacidadFondo}
            stroke={borde}
            strokeWidth={grosor}
          />
        </Svg>
      ) : null}
      {children}
    </View>
  );
}
