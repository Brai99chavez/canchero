import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fuentes, spacing } from '../theme';
import { Button } from './ui';

export interface AccionHeader {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

/**
 * El encabezado de todos los modales. Estaba repetido en cinco pantallas, cada
 * una con su alto y sus acciones como texto suelto: por eso no se parecían
 * entre sí y quedaban apretadas contra el borde.
 *
 * La palabra de la izquierda sigue una sola regla, y es por lo que hace el
 * botón, no por la pantalla en la que está:
 *
 *   «Volver»    sale de la pantalla
 *   «Descartar» deshace lo que se estaba editando y se queda ahí
 *
 * Había cuatro palabras para lo mismo —Cancelar, Cerrar, Volver, Atrás— y a
 * veces dos en la misma pantalla en momentos distintos. «Cancelar» era la peor
 * de todas: al entrar a un partido activo decía "Cancelar", y parecía que iba
 * a cancelar el partido en vez de cerrar la pantalla.
 */
export default function HeaderModal({
  titulo,
  izquierda,
  derecha,
}: {
  titulo: string;
  izquierda: AccionHeader;
  derecha?: AccionHeader;
}) {
  return (
    <View style={styles.barra}>
      <View style={styles.lado}>
        <Button
          title={izquierda.label}
          onPress={izquierda.onPress}
          variant="ghost"
          compacto
        />
      </View>

      <Text style={styles.titulo} numberOfLines={1}>
        {titulo.toUpperCase()}
      </Text>

      <View style={[styles.lado, styles.ladoDerecho]}>
        {derecha ? (
          <Button
            title={derecha.label}
            onPress={derecha.onPress}
            disabled={derecha.disabled}
            compacto
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  // Los dos lados miden igual para que el título quede realmente centrado.
  lado: { flex: 1, alignItems: 'flex-start' },
  ladoDerecho: { alignItems: 'flex-end' },
  titulo: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 14,
    fontFamily: fuentes.display,
    letterSpacing: 1,
  },
});
