import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, degradados, fuentes, spacing } from '../theme';
import Panel, { DIAGONAL } from './Angular';
import { Presionable } from './motion';

/**
 * Una opción de un grupo. Elegida, es un bloque relleno con el degradado y
 * texto oscuro; sin elegir, es sólo el rótulo dentro de su recuadro. Nada de
 * bordes de color: el contraste lo hace el relleno, que es lo que hace legible
 * un menú de un vistazo.
 *
 * La esquina cortada en diagonal es la misma de los planteles y la de los
 * botones. Antes era un paralelogramo inclinado, que era otra forma para lo
 * mismo.
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
    <Presionable onPress={onPress} style={[styles.exterior, style]}>
      <Panel
        style={styles.caja}
        esquinas={DIAGONAL}
        chaflan={9}
        degradado={activa ? degradados.acento : undefined}
        fondo="transparent"
        borde={activa ? 'transparent' : colors.border}
        grosor={activa ? 0 : 1}
      >
        <Text style={[styles.label, activa && styles.labelActiva]}>
          {label.toUpperCase()}
        </Text>
        {detalle ? (
          <Text style={[styles.detalle, activa && styles.detalleActiva]}>
            {detalle}
          </Text>
        ) : null}
      </Panel>
    </Presionable>
  );
}

const styles = StyleSheet.create({
  // El `flex` va afuera para que las opciones de una fila midan igual entre
  // ellas; adentro el panel sólo se ocupa de dibujar el bloque.
  exterior: { flex: 1 },
  caja: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fuentes.extra,
    letterSpacing: 1,
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
  },
  detalleActiva: {
    color: colors.sobreAcento,
    opacity: 0.75,
  },
});
