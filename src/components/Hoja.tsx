import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, degradados, fuentes, spacing } from '../theme';
import Panel, { DIAGONAL, FondoDegradado } from './Angular';
import { Presionable } from './motion';

/**
 * Una hoja que sube desde abajo para elegir algo. Se usa cuando una acción
 * tiene dos caminos y preguntar con un `Alert` del sistema quedaría fuera de
 * lugar: los carteles del sistema no se parecen en nada al resto de la app.
 *
 * El fondo oscuro cierra al tocarlo, que es lo que espera cualquiera.
 */
export default function Hoja({
  visible,
  titulo,
  bajada,
  onClose,
  children,
}: {
  visible: boolean;
  titulo: string;
  bajada?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.fondo}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <SafeAreaView edges={['bottom']} style={styles.abajo}>
          <Panel
            style={styles.hoja}
            degradado={degradados.panel}
            borde={colors.border}
            grosor={1.5}
            esquinas={DIAGONAL}
          >
            <Text style={styles.titulo}>{titulo.toUpperCase()}</Text>
            {bajada ? <Text style={styles.bajada}>{bajada}</Text> : null}
            <View style={styles.contenido}>{children}</View>
          </Panel>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/**
 * Una de las opciones de la hoja: ícono, qué hace y qué significa elegirla.
 * La explicación no es adorno — es la diferencia entre entender la opción y
 * tener que probarla para saber qué hace.
 */
export function Opcion({
  icono,
  titulo,
  detalle,
  onPress,
  disabled,
}: {
  icono: React.ReactNode;
  titulo: string;
  detalle: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Presionable
      onPress={onPress}
      disabled={disabled}
      style={[styles.opcion, disabled && styles.apagada]}
    >
      <FondoDegradado colores={degradados.panelTenue} />
      {/*
        Con el acento al 15% el recuadro no se veía sobre el panel oscuro y el
        ícono quedaba como un trazo fino flotando. Va el degradado lleno y el
        ícono oscuro encima, igual que los botones principales de la app.
      */}
      <View style={styles.icono}>
        <FondoDegradado colores={degradados.acento} />
        {icono}
      </View>
      <View style={styles.textos}>
        <Text style={styles.opcionTitulo}>{titulo}</Text>
        <Text style={styles.opcionDetalle}>{detalle}</Text>
      </View>
    </Presionable>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: '#050814CC', justifyContent: 'flex-end' },
  abajo: { paddingHorizontal: spacing.md },
  hoja: { padding: spacing.lg, marginBottom: spacing.md },
  titulo: {
    color: colors.text,
    fontSize: 19,
    fontFamily: fuentes.display,
    letterSpacing: 0.5,
  },
  bajada: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fuentes.regular,
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  contenido: { marginTop: spacing.lg, gap: spacing.sm },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  apagada: { opacity: 0.45 },
  icono: {
    width: 44,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  textos: { flex: 1 },
  opcionTitulo: {
    color: colors.text,
    fontSize: 15,
    fontFamily: fuentes.extra,
    letterSpacing: 0.3,
  },
  opcionDetalle: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fuentes.regular,
    lineHeight: 16,
    marginTop: 2,
  },
});
