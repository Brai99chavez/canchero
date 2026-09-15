import React, { useState } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Line,
  Mask,
  Path,
  Stop,
} from 'react-native-svg';
import { angulo, colors, degradados, fuentes } from '../theme';

/**
 * La marca de CANCHERO: el escudo inclinado y biselado que usa toda la app,
 * con la cancha calada adentro.
 *
 * Las coordenadas son las mismas que dibuja `tools/generar-iconos.py`, que
 * genera el icono y el splash nativo. Si se toca una hay que tocar la otra: el
 * splash y esta pantalla se ven uno detrás del otro y cualquier diferencia se
 * nota como un salto.
 *
 * La inclinación va metida en los puntos en vez de aplicarse como `skew`: así
 * el bisel conserva su ángulo en lugar de estirarse junto con el resto.
 */
const ESCUDO = 'M 23 6 L 75 6 L 88.5 22 L 77 94 L 25 94 L 11.5 78 Z';
const CIRCULO_R = 16;
const GROSOR = 5;

/**
 * Los ids de SVG son globales en React Native: dos logos con el mismo id se
 * pisan el degradado. El azar además cubre el recargado en caliente, que deja
 * montado lo viejo.
 */
let siguiente = 0;
function useIds() {
  return useState(() => {
    const base = `logo${siguiente++}x${Math.random().toString(36).slice(2, 7)}`;
    return { deg: `${base}d`, mask: `${base}m` };
  })[0];
}

export function Logo({ size = 48 }: { size?: number }) {
  const id = useIds();

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={id.deg} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={degradados.acento[0]} />
          <Stop offset="1" stopColor={degradados.acento[1]} />
        </LinearGradient>
        {/*
          La cancha se cala con una máscara y no con `fillRule`: donde la línea
          del medio cruza el círculo, el par/impar volvería a rellenar el cruce
          y dejaría el anillo cortado.
        */}
        <Mask
          id={id.mask}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="100"
          height="100"
        >
          <Path d={ESCUDO} fill="#fff" />
          {/* Pasada de largo a propósito: sólo pinta dentro del escudo. */}
          <Line
            x1="12"
            y1="50"
            x2="88"
            y2="50"
            stroke="#000"
            strokeWidth={GROSOR}
          />
          <Circle
            cx="50"
            cy="50"
            r={CIRCULO_R}
            fill="none"
            stroke="#000"
            strokeWidth={GROSOR}
          />
        </Mask>
      </Defs>
      <Path d={ESCUDO} fill={`url(#${id.deg})`} mask={`url(#${id.mask})`} />
    </Svg>
  );
}

/**
 * El escudo con la palabra al lado. Sólo sirve con las tipografías ya
 * cargadas: mientras Anton no esté, el texto saldría con la fuente del
 * sistema y saltaría al llegar la propia.
 */
export function Logotipo({
  size = 30,
  style,
}: {
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.fila, style]}>
      <Logo size={size} />
      <Text
        style={[styles.palabra, { fontSize: size * 0.72 }]}
        numberOfLines={1}
      >
        CANCHERO
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  palabra: {
    color: colors.text,
    fontFamily: fuentes.display,
    letterSpacing: 0.5,
    // La misma inclinación que el escudo y que el resto de la interfaz.
    transform: [{ skewX: angulo.inclinacion }],
  },
});
