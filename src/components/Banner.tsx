import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, degradados, fuentes, radius, spacing } from '../theme';
import { FondoDegradado } from './Angular';

/**
 * El corte en diagonal es la marca de la casa. Se logra inclinando la caja y
 * contra-inclinando el texto la misma cantidad, así el fondo queda en diagonal
 * pero las letras siguen derechas.
 */
const INCLINACION = '-10deg';
const DERECHO = '10deg';

/** Título de sección: una barra de acento y el rótulo, los dos en diagonal. */
export function Seccion({
  children,
  style,
}: {
  children: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.fila, style]}>
      <View style={styles.acento}>
        <FondoDegradado colores={degradados.acento} vertical />
      </View>
      <View style={styles.barra}>
        <Text style={styles.rotulo}>{children.toUpperCase()}</Text>
      </View>
    </View>
  );
}

/** Etiqueta chica en diagonal, como el "ELITE EDITION" del banner. */
export function Etiqueta({
  children,
  color = colors.primary,
  fondo,
}: {
  children: string;
  color?: string;
  fondo?: string;
}) {
  return (
    <View style={[styles.etiqueta, { backgroundColor: fondo ?? color + '24' }]}>
      <Text style={[styles.etiquetaTexto, { color }]}>
        {children.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  acento: {
    width: 6,
    overflow: 'hidden',
    transform: [{ skewX: INCLINACION }],
  },
  barra: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: 3,
    transform: [{ skewX: INCLINACION }],
  },
  rotulo: {
    color: colors.text,
    fontSize: 12,
    fontFamily: fuentes.display,
    letterSpacing: 1.5,
    transform: [{ skewX: DERECHO }],
  },
  etiqueta: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    transform: [{ skewX: INCLINACION }],
  },
  etiquetaTexto: {
    fontSize: 10,
    fontFamily: fuentes.extra,
    letterSpacing: 0.8,
    transform: [{ skewX: DERECHO }],
  },
});
