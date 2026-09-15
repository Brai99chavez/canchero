import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { angulo, colors, degradados, fuentes, spacing } from '../theme';
import { FondoDegradado } from './Angular';
import { Presionable } from './motion';

/**
 * Una opción de un grupo. Elegida, es un bloque relleno con el degradado y
 * texto oscuro; sin elegir, es sólo el rótulo. Nada de bordes de color: el
 * contraste lo hace el relleno, que es lo que hace legible un menú de un
 * vistazo.
 */
export default function Opcion({
  label,
  detalle,
  activa,
  onPress,
  style,
}: {
  label: string;
  detalle?: string;
  activa: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Presionable
      onPress={onPress}
      style={[styles.caja, activa && styles.cajaActiva, style]}
    >
      {activa ? <FondoDegradado colores={degradados.acento} /> : null}
      <Text style={[styles.label, activa && styles.labelActiva]}>
        {label.toUpperCase()}
      </Text>
      {detalle ? (
        <Text style={[styles.detalle, activa && styles.detalleActiva]}>
          {detalle}
        </Text>
      ) : null}
    </Presionable>
  );
}

const styles = StyleSheet.create({
  caja: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    overflow: 'hidden',
    transform: [{ skewX: angulo.inclinacion }],
  },
  cajaActiva: {},
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fuentes.extra,
    letterSpacing: 1,
    transform: [{ skewX: angulo.derecho }],
  },
  labelActiva: {
    color: colors.sobreAcento,
  },
  detalle: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: fuentes.medium,
    marginTop: 1,
    opacity: 0.8,
    transform: [{ skewX: angulo.derecho }],
  },
  detalleActiva: {
    color: colors.sobreAcento,
    opacity: 0.75,
  },
});
