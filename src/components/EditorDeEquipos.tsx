import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Panel, { DIAGONAL } from './Angular';
import { Presionable } from './motion';
import Pitch from './Pitch';
import { RatingBadge } from './ui';
import { colors, degradados, fuentes, spacing } from '../theme';
import {
  overall,
  Player,
  ratingColor,
  STAT_KEYS,
  STAT_LABELS,
  statAverage,
  TeamSplit,
} from '../types';

/**
 * Los dos equipos uno al lado del otro, para intercambiar jugadores.
 *
 * Existe aparte de las cartas del sorteo por una razón concreta: ahí los
 * equipos van uno debajo del otro y hay que scrollear para ver el segundo.
 * Para intercambiar hay que ver a los dos al mismo tiempo, o para cuando
 * llegás al segundo ya te olvidaste a quién tocaste.
 *
 * Por eso acá no hay barras de estadísticas ni cartas: nombre, posición y
 * puntaje, que es lo mínimo para decidir sin quedar a ciegas.
 *
 * El panel de ayuda —«tocá uno y después otro»— no viene incluido: lo pone
 * quien lo usa, porque en el sorteo va arriba de las pestañas y en la pantalla
 * del partido va abajo del encabezado.
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
        <View style={styles.textos}>
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

/** Un equipo dibujado en la cancha, con su media arriba. */
function Cancha({
  nombre,
  color,
  players,
  medias,
  media,
  elegidoId,
  onTocar,
}: {
  nombre: string;
  color: string;
  players: Player[];
  medias: Record<string, number>;
  media: number;
  elegidoId: string | null;
  onTocar: (id: string) => void;
}) {
  return (
    <Panel
      style={styles.cancha}
      degradado={degradados.panel}
      borde={color}
      grosor={1.5}
    >
      <View style={styles.canchaHeader}>
        <View style={styles.canchaTitulo}>
          <View style={[styles.punto, { backgroundColor: color }]} />
          <Text style={styles.canchaNombre}>{nombre.toUpperCase()}</Text>
        </View>
        <RatingBadge value={media} size={44} />
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

/**
 * Cómo viene cada equipo en cada cosa, uno enfrente del otro.
 *
 * Va debajo de las columnas porque es lo que se mira después de intercambiar:
 * la media sola dice si el reparto quedó parejo en total, y esto dice en qué.
 * Se puede terminar con dos equipos de 74 donde uno mete todos los goles y el
 * otro no puede parar una pelota.
 *
 * El que va ganando cada renglón va en el color de su equipo y el otro en
 * gris, para no tener que comparar dos números leyéndolos.
 */
function Comparacion({
  split,
}: {
  split: TeamSplit;
}) {
  return (
    <View style={styles.comparacion}>
      {STAT_KEYS.map((key) => {
        const a = statAverage(split.teamA, key);
        const b = statAverage(split.teamB, key);
        return (
          <View key={key} style={styles.renglon}>
            <Text
              style={[
                styles.valor,
                styles.valorA,
                a >= b ? { color: colors.teamA } : null,
              ]}
            >
              {a}
            </Text>
            <Text style={styles.queCosa} numberOfLines={1}>
              {STAT_LABELS[key]}
            </Text>
            <Text
              style={[
                styles.valor,
                styles.valorB,
                b >= a ? { color: colors.teamB } : null,
              ]}
            >
              {b}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Las dos formas de mirar lo mismo: en columnas o en la cancha. */
export type VistaDeEquipos = 'columnas' | 'cancha';

export default function EditorDeEquipos({
  split,
  medias,
  vista = 'columnas',
  elegidoId,
  onTocar,
}: {
  split: TeamSplit;
  /** La media corregida por resultados, por jugador. */
  medias: Record<string, number>;
  vista?: VistaDeEquipos;
  /** El primero de un intercambio, que espera al segundo toque. */
  elegidoId: string | null;
  onTocar: (id: string) => void;
}) {
  const mediaDe = (p: Player) => medias[p.id] ?? overall(p);

  /** El promedio del equipo, que es lo que hay que mirar al intercambiar. */
  const promedio = (players: Player[]) =>
    players.length === 0
      ? 0
      : Math.round(
          players.reduce((acc, p) => acc + mediaDe(p), 0) / players.length
        );

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
          onPress={() => onTocar(p.id)}
        />
      ))}
    </View>
  );

  const cancha = (nombre: string, color: string, players: Player[]) => (
    <Cancha
      nombre={nombre}
      color={color}
      players={players}
      medias={medias}
      media={promedio(players)}
      elegidoId={elegidoId}
      onTocar={onTocar}
    />
  );

  return (
    <View style={styles.todo}>
      {vista === 'cancha' ? (
        /*
         * En la cancha van uno debajo del otro y no hay forma de evitarlo: un
         * campo de juego al lado del otro, en un teléfono, no se ve. Por eso
         * existen las columnas, que es donde se intercambia.
         */
        <View style={styles.todo}>
          {cancha('Equipo A', colors.teamA, split.teamA)}
          {cancha('Equipo B', colors.teamB, split.teamB)}
        </View>
      ) : (
        <>
          <View style={styles.columnas}>
            {columna('Equipo A', colors.teamA, split.teamA)}
            {columna('Equipo B', colors.teamB, split.teamB)}
          </View>
          <Comparacion split={split} />
        </>
      )}

      {/*
        Los suplentes entran al intercambio como cualquiera: el caso más común
        es justamente ése, alguien avisa que no viene y entra uno del banco.
      */}
      {split.bench.length > 0 ? (
        <View style={styles.banco}>
          {columna('Suplentes', colors.textMuted, split.bench, false)}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  todo: { gap: spacing.lg },
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
  promedio: { color: colors.textMuted, fontSize: 13, fontFamily: fuentes.black },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  textos: { flex: 1 },
  nombre: { color: colors.text, fontSize: 14, fontFamily: fuentes.medium },
  nombreElegido: { fontFamily: fuentes.bold },
  posicion: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: fuentes.bold,
    letterSpacing: 0.5,
  },
  media: { fontSize: 15, fontFamily: fuentes.black },
  banco: { opacity: 0.85 },
  comparacion: {
    gap: 2,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  renglon: { flexDirection: 'row', alignItems: 'center' },
  valor: {
    width: 34,
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fuentes.black,
  },
  valorA: { textAlign: 'left' },
  valorB: { textAlign: 'right' },
  queCosa: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fuentes.semi,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  cancha: { padding: spacing.lg },
  canchaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  canchaTitulo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  punto: { width: 10, height: 10, borderRadius: 5 },
  canchaNombre: {
    color: colors.text,
    fontSize: 19,
    fontFamily: fuentes.display,
    letterSpacing: 0.8,
  },
});
