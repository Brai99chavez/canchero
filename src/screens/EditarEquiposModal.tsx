import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Panel, { DIAGONAL } from '../components/Angular';
import HeaderModal from '../components/HeaderModal';
import { Presionable } from '../components/motion';
import { colors, fuentes, spacing } from '../theme';
import { overall, Player, ratingColor, TeamSplit } from '../types';

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
  media,
  elegido,
  onPress,
}: {
  player: Player;
  media: number;
  elegido: boolean;
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
        <View style={styles.chipTextos}>
          <Text
            style={[styles.nombre, elegido && styles.nombreElegido]}
            numberOfLines={1}
          >
            {player.nombre}
          </Text>
          <Text style={styles.posicion}>{player.posicion}</Text>
        </View>
        {/*
          El puntaje va acá aunque no vaya en la imagen que se comparte: son
          dos cosas distintas. Al grupo un número al lado del nombre le da de
          qué discutir; al que está cambiando jugadores le hace falta, o está
          eligiendo a ciegas y puede dejar los equipos desparejos sin enterarse.
        */}
        <Text style={[styles.media, { color: ratingColor(media) }]}>
          {media}
        </Text>
      </Panel>
    </Presionable>
  );
}

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
  const mediaDe = (p: Player) => medias[p.id] ?? overall(p);

  /** El promedio del equipo, que es lo que hay que mirar al intercambiar. */
  const promedio = (players: Player[]) =>
    players.length === 0
      ? 0
      : Math.round(
          players.reduce((acc, p) => acc + mediaDe(p), 0) / players.length
        );
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

  const columna = (
    nombre: string,
    color: string,
    players: Player[],
    conMedia = true
  ) => (
    <View style={styles.columna}>
      <View style={[styles.encabezado, { borderBottomColor: color }]}>
        <Text style={[styles.equipo, { color }]}>{nombre}</Text>
        {/*
          La media del equipo, que se actualiza sola con cada intercambio: es
          la única forma de darse cuenta en el momento de que un cambio dejó
          los equipos desparejos. En el banco no significa nada.
        */}
        {conMedia ? (
          <Text style={styles.promedio}>{promedio(players)}</Text>
        ) : null}
      </View>
      {players.map((p) => (
        <Chip
          key={p.id}
          player={p}
          media={mediaDe(p)}
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
                  {columna('Suplentes', colors.textMuted, split.bench, false)}
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
  encabezado: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    paddingBottom: 4,
  },
  equipo: { fontSize: 12, fontFamily: fuentes.black, letterSpacing: 0.5 },
  promedio: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fuentes.black,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chipTextos: { flex: 1 },
  nombre: {
    color: colors.text,
    fontSize: 14,
    fontFamily: fuentes.medium,
  },
  nombreElegido: { fontFamily: fuentes.bold },
  posicion: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: fuentes.bold,
    letterSpacing: 0.5,
  },
  media: { fontSize: 15, fontFamily: fuentes.black },
  banco: { opacity: 0.85 },
});
