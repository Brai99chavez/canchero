import * as Sharing from 'expo-sharing';
import { CalendarIcon } from '../components/icons';
import SelectorFecha from '../components/SelectorFecha';
import { comoSeLee } from '../fechas';
import { reparto } from '../stats';
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HeaderModal from '../components/HeaderModal';
import { captureRef } from 'react-native-view-shot';
import Panel, { DIAGONAL } from '../components/Angular';
import Opcion from '../components/Opcion';
import Pitch from '../components/Pitch';
import ShareCard from '../components/ShareCard';
import { Button, PositionPill, RatingBadge, StatBar } from '../components/ui';
import { angulo, colors, degradados, radius, spacing } from '../theme';
import {
  Format,
  overall,
  Player,
  STAT_KEYS,
  STAT_LABELS,
  statAverage,
  teamOverall,
  TeamSplit,
} from '../types';

interface Props {
  visible: boolean;
  split: TeamSplit | null;
  plantel: string;
  /** La media corregida por resultados, por jugador. */
  medias: Record<string, number>;
  guardado: boolean;
  onClose: () => void;
  onReshuffle: () => void;
  /** Guarda el partido con el día que se haya elegido. */
  onGuardar: (fecha: Date) => void;
  onSwap: (unoId: string, otroId: string) => void;
  onDescartar: () => void;
}

type Vista = 'lista' | 'cancha';

/** El promedio del equipo con las medias ya corregidas por resultados. */
function mediaDeEquipo(
  players: Player[],
  medias: Record<string, number>
): number {
  if (players.length === 0) return 0;
  const total = players.reduce(
    (a, p) => a + (medias[p.id] ?? overall(p)),
    0
  );
  return Math.round(total / players.length);
}

/** Fila de jugador que se puede tocar para permutarlo con otro. */
function Fila({
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
    <Pressable
      onPress={onPress}
      style={[styles.playerRow, elegido && styles.playerRowElegido]}
    >
      <Text style={styles.playerName} numberOfLines={1}>
        {player.nombre}
      </Text>
      <PositionPill position={player.posicion} />
      <Text style={styles.playerOvr}>{media}</Text>
    </Pressable>
  );
}

function TeamCard({
  name,
  color,
  players,
  medias,
  elegidoId,
  onTocar,
}: {
  name: string;
  color: string;
  players: Player[];
  medias: Record<string, number>;
  elegidoId: string | null;
  onTocar: (id: string) => void;
}) {
  return (
    <Panel
      style={styles.teamCard}
      degradado={degradados.panel}
      borde={color}
      grosor={1.5}
    >
      <View style={styles.teamHeader}>
        <View style={styles.teamTitleRow}>
          <View style={[styles.teamDot, { backgroundColor: color }]} />
          <Text style={styles.teamName}>{name.toUpperCase()}</Text>
        </View>
        <RatingBadge value={mediaDeEquipo(players, medias)} size={44} />
      </View>

      {players.map((p) => (
        <Fila
          key={p.id}
          player={p}
          media={medias[p.id] ?? overall(p)}
          elegido={p.id === elegidoId}
          onPress={() => onTocar(p.id)}
        />
      ))}

      <View style={styles.statsBlock}>
        {STAT_KEYS.map((key) => (
          <StatBar
            key={key}
            label={STAT_LABELS[key]}
            value={statAverage(players, key)}
          />
        ))}
      </View>
    </Panel>
  );
}

function TeamPitch({
  name,
  color,
  players,
  medias,
  elegidoId,
  onTocar,
}: {
  name: string;
  color: string;
  players: Player[];
  medias: Record<string, number>;
  elegidoId: string | null;
  onTocar: (id: string) => void;
}) {
  return (
    <Panel
      style={styles.teamCard}
      degradado={degradados.panel}
      borde={color}
      grosor={1.5}
    >
      <View style={styles.teamHeader}>
        <View style={styles.teamTitleRow}>
          <View style={[styles.teamDot, { backgroundColor: color }]} />
          <Text style={styles.teamName}>{name.toUpperCase()}</Text>
        </View>
        <RatingBadge value={mediaDeEquipo(players, medias)} size={44} />
      </View>
      <Pitch
        players={players}
        medias={medias}
        color={color}
        elegidoId={elegidoId}
        onTocar={onTocar}
      />
    </Panel>
  );
}

function buildShareText(split: TeamSplit): string {
  // Sin el puntaje de cada uno, por lo mismo que la imagen: esto va al grupo.
  const line = (p: Player) => `• ${p.nombre} (${p.posicion})`;
  const parts = [
    `${reparto(split.teamA.length, split.teamB.length)} — equipos armados`,
    '',
    `EQUIPO A — media ${teamOverall(split.teamA)}`,
    ...split.teamA.map(line),
    '',
    `EQUIPO B — media ${teamOverall(split.teamB)}`,
    ...split.teamB.map(line),
  ];
  if (split.bench.length > 0) {
    parts.push('', 'SUPLENTES', ...split.bench.map(line));
  }
  return parts.join('\n');
}

export default function TeamsModal({
  visible,
  split,
  plantel,
  medias,
  guardado,
  onClose,
  onReshuffle,
  onGuardar,
  onSwap,
  onDescartar,
}: Props) {
  /** El día que se va a guardar. Arranca en hoy cada vez que se abre. */
  const [dia, setDia] = useState(() => new Date());
  const [eligiendoDia, setEligiendoDia] = useState(false);

  useEffect(() => {
    if (visible) setDia(new Date());
  }, [visible]);

  const [vista, setVista] = useState<Vista>('lista');
  /** Primer jugador de un intercambio: el segundo toque completa el cambio. */
  const [elegidoId, setElegidoId] = useState<string | null>(null);
  const estampa = useRef<View>(null);

  useEffect(() => {
    if (visible) {
      setVista('lista');
      setElegidoId(null);
    }
  }, [visible]);

  function tocarJugador(id: string) {
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

  if (!split) return null;

  const diff = Math.abs(teamOverall(split.teamA) - teamOverall(split.teamB));

  /** Manda el texto plano. Es el plan B si la imagen no se puede generar. */
  async function compartirTexto() {
    if (!split) return;
    try {
      await Share.share({ message: buildShareText(split) });
    } catch {
      // El usuario canceló el diálogo de compartir.
    }
  }

  async function handleShare() {
    if (!split) return;
    try {
      const uri = await captureRef(estampa, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      if (!(await Sharing.isAvailableAsync())) {
        await compartirTexto();
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Compartir equipos',
      });
    } catch {
      // Si la captura falla (o el usuario cancela), queda el texto.
      await compartirTexto();
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <HeaderModal
          titulo="Equipos"
          izquierda={{ label: 'Cerrar', onPress: onClose }}
          derecha={{ label: 'Compartir', onPress: handleShare }}
        />

        <View style={styles.balanceBanner}>
          <Text style={styles.balanceText}>
            {diff === 0
              ? 'Equipos igualados: misma media'
              : `Diferencia de media: ${diff} ${
                  diff === 1 ? 'punto' : 'puntos'
                }`}
          </Text>
        </View>

        <View style={styles.vistas}>
          {(['lista', 'cancha'] as Vista[]).map((key) => (
            <Opcion
              key={key}
              label={key === 'lista' ? 'Lista' : 'Cancha'}
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
          <Text style={[styles.ayudaTexto, elegidoId && styles.ayudaTextoActivo]}>
            {elegidoId
              ? 'Ahora tocá a otro para cambiarlos de lugar'
              : 'Tocá un jugador y después otro para intercambiarlos'}
          </Text>
        </Panel>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {vista === 'lista' ? (
            <>
              <TeamCard
                name="Equipo A"
                color={colors.teamA}
                players={split.teamA}
                medias={medias}
                elegidoId={elegidoId}
                onTocar={tocarJugador}
              />
              <TeamCard
                name="Equipo B"
                color={colors.teamB}
                players={split.teamB}
                medias={medias}
                elegidoId={elegidoId}
                onTocar={tocarJugador}
              />
            </>
          ) : (
            <>
              <TeamPitch
                name="Equipo A"
                color={colors.teamA}
                players={split.teamA}
                medias={medias}
                elegidoId={elegidoId}
                onTocar={tocarJugador}
              />
              <TeamPitch
                name="Equipo B"
                color={colors.teamB}
                players={split.teamB}
                medias={medias}
                elegidoId={elegidoId}
                onTocar={tocarJugador}
              />
            </>
          )}

          {split.bench.length > 0 ? (
            <Panel
              style={styles.benchCard}
              degradado={degradados.panelTenue}
              esquinas={DIAGONAL}
            >
              <Text style={styles.benchTitle}>Suplentes</Text>
              {split.bench.map((p) => (
                <Fila
                  key={p.id}
                  player={p}
                  media={medias[p.id] ?? overall(p)}
                  elegido={p.id === elegidoId}
                  onPress={() => tocarJugador(p.id)}
                />
              ))}
            </Panel>
          ) : null}
        </ScrollView>

        {/* Fuera de pantalla, pero renderizada: es lo que se captura. */}
        <View style={styles.estampa} pointerEvents="none">
          <View ref={estampa} collapsable={false}>
            <ShareCard split={split} plantel={plantel} />
          </View>
        </View>

        <View style={styles.footer}>
          {/*
            El día se elige antes de guardar y no después: los equipos se
            sortean el jueves para el sábado tan seguido como se sortean y se
            juegan en el momento. Por defecto es hoy, que es el caso común.
          */}
          {guardado ? null : (
            <Pressable onPress={() => setEligiendoDia(true)}>
              <Panel
                style={styles.dia}
                esquinas={DIAGONAL}
                chaflan={9}
                fondo={colors.primary}
                opacidadFondo={0.1}
                borde={colors.primary}
                grosor={1.5}
              >
                <CalendarIcon color={colors.primary} size={20} />
                <View style={styles.diaTextos}>
                  <Text style={styles.diaRotulo}>Fecha</Text>
                  <Text style={styles.diaValor}>{comoSeLee(dia)}</Text>
                </View>
                <Text style={styles.diaCambiar}>Cambiar</Text>
              </Panel>
            </Pressable>
          )}

          <SelectorFecha
              visible={eligiendoDia}
              valor={dia}
              onElegir={(elegida) => {
                setDia(elegida);
                setEligiendoDia(false);
              }}
              onClose={() => setEligiendoDia(false)}
            />

          <Button
            title={guardado ? 'Partido guardado ✓' : 'Guardar partido'}
            onPress={() => onGuardar(dia)}
            disabled={guardado}
          />
          <View style={styles.footerFila}>
            <Button
              title="Volver a sortear"
              variant="ghost"
              onPress={onReshuffle}
              style={styles.mitad}
            />
            <Button
              title="Descartar"
              variant="ghost"
              onPress={onDescartar}
              style={styles.mitad}
            />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  balanceBanner: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  balanceText: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: 'Barlow_400Regular',
  },
  vistas: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  vista: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    transform: [{ skewX: angulo.inclinacion }],
  },
  vistaTexto: {
    color: colors.text,
    fontSize: 13,
    fontFamily: 'Barlow_800ExtraBold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    transform: [{ skewX: angulo.derecho }],
  },
  ayuda: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  ayudaTexto: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: 'Barlow_700Bold',
    letterSpacing: 0.4,
    transform: [{ skewX: angulo.derecho }],
  },
  ayudaTextoActivo: { color: colors.primary },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  teamCard: {
    padding: spacing.lg,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  teamTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  teamDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  teamName: {
    color: colors.text,
    fontSize: 19,
    fontFamily: 'Anton_400Regular',
    letterSpacing: 0.8,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 7,
    paddingHorizontal: spacing.sm,
    marginHorizontal: -spacing.sm,
    borderRadius: radius.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  playerRowElegido: {
    backgroundColor: colors.primary + '26',
    borderBottomColor: 'transparent',
  },
  playerName: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontFamily: 'Barlow_400Regular',
  },
  playerOvr: {
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: 'Barlow_700Bold',
    width: 26,
    textAlign: 'right',
  },
  statsBlock: {
    marginTop: spacing.md,
  },
  benchCard: {
    padding: spacing.lg,
  },
  benchTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: 'Barlow_700Bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  dia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    marginBottom: spacing.sm,
  },
  diaTextos: { flex: 1 },
  diaRotulo: {
    color: colors.primary,
    fontSize: 10,
    fontFamily: 'Barlow_800ExtraBold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  // El día en grande: es el dato, no el rótulo.
  diaValor: {
    color: colors.text,
    fontSize: 16,
    fontFamily: 'Barlow_800ExtraBold',
    marginTop: 1,
  },
  diaCambiar: {
    color: colors.primary,
    fontSize: 11,
    fontFamily: 'Barlow_800ExtraBold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerFila: { flexDirection: 'row', gap: spacing.sm },
  mitad: { flex: 1 },
  estampa: {
    position: 'absolute',
    left: -1000,
    top: 0,
    opacity: 0,
  },
});
