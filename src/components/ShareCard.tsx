import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import {
  Format,
  overall,
  Player,
  teamOverall,
  TeamSplit,
} from '../types';

/**
 * La estampa que se comparte en el grupo. Es una vista aparte de la pantalla
 * de equipos: acá importa que entre todo junto en una imagen, no que se pueda
 * scrollear.
 */
const ANCHO = 360;

function Columna({
  nombre,
  color,
  players,
}: {
  nombre: string;
  color: string;
  players: Player[];
}) {
  return (
    <View style={styles.columna}>
      <View style={[styles.encabezado, { borderColor: color }]}>
        <Text style={[styles.equipo, { color }]}>{nombre}</Text>
        <Text style={styles.media}>{teamOverall(players)}</Text>
      </View>
      {/*
        Sin el puntaje de cada uno. La imagen va al grupo entero, y ver que a
        uno le pusieron 62 al lado de un 88 no le suma nada al partido. La
        media del equipo sí queda: sirve para ver que el reparto fue parejo,
        que es lo que la imagen tiene que comunicar.
      */}
      {players.map((p) => (
        <View key={p.id} style={styles.fila}>
          <Text style={styles.nombre} numberOfLines={1}>
            {p.nombre}
          </Text>
          <Text style={styles.posicion}>{p.posicion}</Text>
        </View>
      ))}
    </View>
  );
}

export default function ShareCard({
  split,
  format,
  plantel,
}: {
  split: TeamSplit;
  format: Format;
  plantel: string;
}) {
  const fecha = new Date().toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
  });
  const diff = Math.abs(teamOverall(split.teamA) - teamOverall(split.teamB));

  return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>Fútbol {format}</Text>
      <Text style={styles.subtitulo}>
        {plantel} · {fecha}
      </Text>

      <View style={styles.columnas}>
        <Columna nombre="Equipo A" color={colors.teamA} players={split.teamA} />
        <View style={styles.separador} />
        <Columna nombre="Equipo B" color={colors.teamB} players={split.teamB} />
      </View>

      {split.bench.length > 0 ? (
        <Text style={styles.banco} numberOfLines={2}>
          Suplentes: {split.bench.map((p) => p.nombre).join(', ')}
        </Text>
      ) : null}

      <Text style={styles.pie}>
        {diff === 0
          ? 'Equipos igualados'
          : `Diferencia de media: ${diff}`}
        {'   ·   '}armado con CANCHERO
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    width: ANCHO,
    backgroundColor: colors.bg,
    padding: spacing.lg,
  },
  titulo: {
    color: colors.text,
    fontSize: 24,
    fontFamily: 'Anton_400Regular',
    textAlign: 'center',
  },
  subtitulo: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: 'Barlow_400Regular',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: spacing.lg,
  },
  columnas: { flexDirection: 'row' },
  separador: { width: 1, backgroundColor: colors.border, marginHorizontal: 10 },
  columna: { flex: 1 },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    paddingBottom: 5,
    marginBottom: 6,
  },
  equipo: { fontSize: 13, fontFamily: 'Barlow_900Black' },
  media: { color: colors.text, fontSize: 17, fontFamily: 'Barlow_900Black' },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  nombre: { color: colors.text, fontSize: 13, fontFamily: 'Barlow_400Regular', flexShrink: 1 },
  posicion: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: 'Barlow_700Bold',
    letterSpacing: 0.5,
  },
  banco: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: 'Barlow_400Regular',
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  pie: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: 'Barlow_400Regular',
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
