import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { angulo, colors, degradados, radius, spacing } from '../theme';
import { FondoDegradado } from './Angular';
import { GearIcon } from './icons';
import { Presionable } from './motion';

/**
 * Encabezado del plantel abierto. Vive en el contenedor y no en cada pestaña:
 * así volver y la configuración están siempre a mano, se esté donde se esté.
 */
export default function AppHeader({
  titulo,
  subtitulo,
  onVolver,
  onConfig,
}: {
  titulo: string;
  subtitulo?: string;
  onVolver: () => void;
  onConfig: () => void;
}) {
  return (
    <View style={styles.barra}>
      <Presionable
        onPress={onVolver}
        style={styles.redondo}
        accessibilityLabel="Volver a planteles"
      >
        <FondoDegradado colores={degradados.panel} />
        <Text style={styles.flecha}>‹</Text>
      </Presionable>

      <View style={styles.centro}>
        <Text style={styles.titulo} numberOfLines={1}>
          {titulo}
        </Text>
        {subtitulo ? (
          <Text style={styles.subtitulo} numberOfLines={1}>
            {subtitulo}
          </Text>
        ) : null}
      </View>

      <Presionable
        onPress={onConfig}
        style={styles.redondo}
        accessibilityLabel="Configuración del plantel"
      >
        <FondoDegradado colores={degradados.panel} />
        <GearIcon color={colors.primary} size={19} />
      </Presionable>
    </View>
  );
}

const styles = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  redondo: {
    width: 40,
    height: 38,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ skewX: angulo.inclinacion }],
  },
  flecha: {
    color: colors.text,
    fontSize: 26,
    fontFamily: 'Barlow_700Bold',
    lineHeight: 30,
    // La cursiva del glifo lo deja corrido a la derecha.
    marginLeft: -2,
    marginTop: -3,
  },
  centro: { flex: 1, alignItems: 'center' },
  titulo: {
    color: colors.text,
    fontSize: 18,
    fontFamily: 'Anton_400Regular',
  },
  subtitulo: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: 'Barlow_400Regular',
    marginTop: 1,
  },
});
