import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Panel, { DIAGONAL } from '../components/Angular';
import EditorDeEquipos, {
  VistaDeEquipos,
} from '../components/EditorDeEquipos';
import HeaderModal from '../components/HeaderModal';
import Opcion from '../components/Opcion';
import { colors, fuentes, spacing } from '../theme';
import { TeamSplit } from '../types';

/**
 * Cambiar de equipo a dos jugadores de un partido que ya está armado.
 *
 * Hasta ahora esto sólo se podía en la pantalla del sorteo, y esa pantalla no
 * se vuelve a abrir una vez guardado el partido: alguien avisaba que no venía
 * y no quedaba más que borrar el partido y sortear de nuevo.
 *
 * Las dos vistas son las mismas que en el sorteo, y el intercambio anda en las
 * dos: en columnas se ve a los dos equipos juntos, que es lo que hace falta
 * para intercambiar; en la cancha se ve cómo quedan parados.
 */
export default function EditarEquiposModal({
  visible,
  split,
  medias,
  onSwap,
  onClose,
}: {
  visible: boolean;
  split: TeamSplit | null;
  /** La media corregida por resultados, por jugador. */
  medias: Record<string, number>;
  /** Se guarda en el momento: no hay botón de aceptar ni hay nada que perder. */
  onSwap: (unoId: string, otroId: string) => void;
  onClose: () => void;
}) {
  /** El primero de un intercambio. El segundo toque lo completa. */
  const [elegidoId, setElegidoId] = useState<string | null>(null);
  const [vista, setVista] = useState<VistaDeEquipos>('columnas');

  useEffect(() => {
    if (visible) {
      setElegidoId(null);
      setVista('columnas');
    }
  }, [visible]);

  function tocar(id: string) {
    if (elegidoId === null) {
      setElegidoId(id);
      return;
    }
    if (elegidoId === id) {
      setElegidoId(null);
      return;
    }
    onSwap(elegidoId, id);
    setElegidoId(null);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <HeaderModal
          titulo="Equipos"
          izquierda={{ label: 'Volver', onPress: onClose }}
        />

        <View style={styles.vistas}>
          {(['columnas', 'cancha'] as VistaDeEquipos[]).map((key) => (
            <Opcion
              key={key}
              label={key === 'columnas' ? 'Lista' : 'Cancha'}
              activa={key === vista}
              onPress={() => setVista(key)}
            />
          ))}
        </View>

        <Panel
          style={styles.ayuda}
          esquinas={DIAGONAL}
          chaflan={8}
          fondo="transparent"
          borde={elegidoId ? colors.primary : colors.border}
          grosor={1.5}
        >
          <Text style={[styles.ayudaTexto, elegidoId && styles.ayudaActiva]}>
            {elegidoId
              ? 'Ahora tocá a otro para cambiarlos de lugar'
              : 'Tocá un jugador y después otro para intercambiarlos'}
          </Text>
        </Panel>

        <ScrollView contentContainerStyle={styles.content}>
          {split ? (
            <EditorDeEquipos
              split={split}
              medias={medias}
              vista={vista}
              elegidoId={elegidoId}
              onTocar={tocar}
            />
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  vistas: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  ayuda: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  ayudaTexto: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fuentes.medium,
    textAlign: 'center',
  },
  ayudaActiva: { color: colors.primary },
  content: { padding: spacing.lg },
});
