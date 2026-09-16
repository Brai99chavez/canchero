import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import { GearIcon } from './icons';
import { BotonIcono } from './ui';

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
      <BotonIcono onPress={onVolver} accessibilityLabel="Volver a planteles">
        <Text style={styles.flecha}>‹</Text>
      </BotonIcono>

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

      <BotonIcono
        onPress={onConfig}
        accessibilityLabel="Configuración del plantel"
      >
        <GearIcon color={colors.primary} size={19} />
      </BotonIcono>
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
