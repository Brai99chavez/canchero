import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Panel, { DIAGONAL } from '../components/Angular';
import HeaderModal from '../components/HeaderModal';
import { Presionable } from '../components/motion';
import { colors, fuentes, spacing } from '../theme';
import { Player, TeamSplit } from '../types';

/**
 * Cambiar de equipo a dos jugadores de un partido que ya está armado.
 *
 * Hasta ahora esto sólo se podía en la pantalla del sorteo, y esa pantalla no
 * se vuelve a abrir una vez guardado el partido: alguien avisaba que no venía
 * y no quedaba más que borrar el partido y sortear de nuevo.
 *
 * Los dos equipos van uno al lado del otro y sin estadísticas, que es lo que
 * la pantalla del sorteo no puede hacer —ahí las cartas son altas y hay que
 * scrollear—. Para intercambiar hay que ver a los dos al mismo tiempo: si
 * para llegar al segundo tenés que perder de vista al primero, te olvidás a
 * quién habías tocado.
 */
function Chip({
  player,
  elegido,
  color,
  onPress,
}: {
  player: Player;
  elegido: boolean;
  color: string;
  onPress: () => void;
}) {
  return (
    <Presionable onPress={onPress} escala={0.95}>
      <Panel
        style={styles.chip}
        esquinas={DIAGONAL}
        chaflan={8}
        fondo={elegido ? colors.primary : colors.surface}
        opacidadFondo={elegido ? 0.18 : 1}
        borde={elegido ? colors.primary : colors.border}
        grosor={elegido ? 1.5 : 1}
      >
        <Text
          style={[styles.nombre, elegido && styles.nombreElegido]}
          numberOfLines={1}
        >
          {player.nombre}
        </Text>
        <Text style={[styles.posicion, { color }]}>{player.posicion}</Text>
      </Panel>
    </Presionable>
  );
}

export default function EditarEquiposModal({
  visible,
  split,
  onSwap,
  onClose,
}: {
  visible: boolean;
  split: TeamSplit | null;
  /** Se guarda en el momento: no hay botón de aceptar ni hay nada que perder. */
  onSwap: (unoId: string, otroId: string) => void;
  onClose: () => void;
}) {
  /** El primero de un intercambio. El segundo toque lo completa. */
  const [elegidoId, setElegidoId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) setElegidoId(null);
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

  const columna = (nombre: string, color: string, players: Player[]) => (
    <View style={styles.columna}>
      <View style={[styles.encabezado, { borderBottomColor: color }]}>
        <Text style={[styles.equipo, { color }]}>{nombre}</Text>
      </View>
      {players.map((p) => (
        <Chip
          key={p.id}
          player={p}
          color={color}
          elegido={p.id === elegidoId}
          onPress={() => tocar(p.id)}
        />
      ))}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <HeaderModal
          titulo="Equipos"
          izquierda={{ label: 'Volver', onPress: onClose }}
        />

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
            <>
              <View style={styles.columnas}>
                {columna('Equipo A', colors.teamA, split.teamA)}
                {columna('Equipo B', colors.teamB, split.teamB)}
              </View>

              {/*
                Los suplentes entran al intercambio como cualquiera: el caso
                más común es justamente ése, alguien avisa que no viene y
                entra uno del banco.
              */}
              {split.bench.length > 0 ? (
                <View style={styles.banco}>
                  {columna('Suplentes', colors.textMuted, split.bench)}
                </View>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
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
  content: { padding: spacing.lg, gap: spacing.lg },
  columnas: { flexDirection: 'row', gap: spacing.sm },
  columna: { flex: 1, gap: spacing.sm },
  encabezado: { borderBottomWidth: 2, paddingBottom: 4 },
  equipo: { fontSize: 12, fontFamily: fuentes.black, letterSpacing: 0.5 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  nombre: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontFamily: fuentes.medium,
  },
  nombreElegido: { fontFamily: fuentes.bold },
  posicion: { fontSize: 11, fontFamily: fuentes.bold, letterSpacing: 0.5 },
  banco: { opacity: 0.85 },
});
