import { CalendarIcon } from '../components/icons';
import SelectorFecha from '../components/SelectorFecha';
import { comoSeLee } from '../fechas';
import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HeaderModal from '../components/HeaderModal';
import { EstampaOculta, useCompartirEquipos } from '../compartirEquipos';
import Panel, { DIAGONAL } from '../components/Angular';
import EditorDeEquipos from '../components/EditorDeEquipos';
import Opcion from '../components/Opcion';
import { Button, PositionPill, RatingBadge, StatBar } from '../components/ui';
import { angulo, colors, degradados, radius, spacing } from '../theme';
import {
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
  /** Vuelve a la convocatoria con estos mismos jugadores tildados. */
  onCambiarJugadores: () => void;
}

/**
 * Tres formas de mirar el mismo sorteo.
 *
 * «Lista» es la que se usa para intercambiar, y por eso son dos columnas y no
 * dos cartas: las cartas van una debajo de la otra y hay que scrollear para
 * ver el otro equipo, así que al tocar al segundo jugador ya perdiste de vista
 * al primero. Es la misma vista que se abre desde un partido ya guardado.
 *
 * «Detalle» es lo que antes era la lista: las cartas con las barras de cada
 * estadística, para revisar si el reparto quedó parejo en defensa o en ataque.
 * Ahí la altura no molesta, porque no se está tocando nada.
 */
type Vista = 'lista' | 'cancha' | 'detalle';

const ROTULOS: Record<Vista, string> = {
  lista: 'Lista',
  cancha: 'Cancha',
  detalle: 'Detalle',
};

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
  onCambiarJugadores,
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
  const { estampa, compartir } = useCompartirEquipos(split);

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

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <HeaderModal
          titulo="Equipos"
          izquierda={{ label: 'Volver', onPress: onClose }}
          derecha={{ label: 'Compartir', onPress: compartir }}
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
          {(['lista', 'cancha', 'detalle'] as Vista[]).map((key) => (
            <Opcion
              key={key}
              label={ROTULOS[key]}
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
          {vista === 'detalle' ? (
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

              {/* El banco va aparte: las otras dos vistas traen el suyo. */}
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
            </>
          ) : (
            <EditorDeEquipos
              split={split}
              medias={medias}
              vista={vista === 'cancha' ? 'cancha' : 'columnas'}
              elegidoId={elegidoId}
              onTocar={tocarJugador}
            />
          )}
        </ScrollView>

        <EstampaOculta referencia={estampa} split={split} plantel={plantel} />

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
              expandir
              style={styles.mitad}
            />
            <Button
              title="Descartar"
              variant="ghost"
              onPress={onDescartar}
              expandir
              style={styles.mitad}
            />
          </View>
          {/*
            Para cuando falta alguien o se suma uno de último momento. Va
            aparte y en una fila propia porque es lo único que cambia quiénes
            juegan: los otros dos reparten o tiran lo que ya está.
          */}
          <Button
            title="Cambiar jugadores"
            variant="ghost"
            onPress={onCambiarJugadores}
          />
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
});
