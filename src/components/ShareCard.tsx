import React from 'react';
import { diaYMes } from '../fechas';
import { Goleador, reparto, textoDeGoleadores } from '../stats';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import {
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
      </View>
      {/*
        Sin puntajes: ni el de cada jugador ni la media del equipo. La imagen
        va al grupo entero, y un número al lado del nombre del equipo invita a
        discutir el reparto antes de jugar. Lo que la estampa tiene que decir
        es quién juega con quién.
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

/** Lo que cambia la estampa cuando el partido ya se jugó. */
export interface ResultadoParaCompartir {
  golesA: number;
  golesB: number;
  goleadores: Goleador[];
}

export default function ShareCard({
  split,
  plantel,
  fecha,
  resultado,
}: {
  split: TeamSplit;
  plantel: string;
  /**
   * El día del partido. Sin esto va el de hoy, que es lo que corresponde
   * recién sorteado; pero un partido guardado se juega otro día, y la imagen
   * del resultado se manda después: con la fecha de hoy, mentiría.
   */
  fecha?: string;
  /** Con esto la estampa es la del resultado y no la de los equipos. */
  resultado?: ResultadoParaCompartir;
}) {
  const dia = fecha ? new Date(fecha) : new Date();
  const textoFecha = diaYMes(Number.isNaN(dia.getTime()) ? new Date() : dia);
  const diff = Math.abs(teamOverall(split.teamA) - teamOverall(split.teamB));

  return (
    <View style={styles.contenedor}>
      {resultado ? (
        <View style={styles.marcador}>
          <Text style={[styles.marcadorEquipo, { color: colors.teamA }]}>
            EQUIPO A
          </Text>
          <Text style={styles.marcadorGoles}>
            {resultado.golesA} – {resultado.golesB}
          </Text>
          <Text style={[styles.marcadorEquipo, { color: colors.teamB }]}>
            EQUIPO B
          </Text>
        </View>
      ) : (
        /* Lo que se jugó, no el formato elegido: con "repartir a todos"
           los equipos no tienen nada que ver con el rótulo. */
        <Text style={styles.titulo}>
          {reparto(split.teamA.length, split.teamB.length)}
        </Text>
      )}
      <Text style={styles.subtitulo}>
        {plantel} · {textoFecha}
      </Text>

      <View style={styles.columnas}>
        <Columna nombre="Equipo A" color={colors.teamA} players={split.teamA} />
        <View style={styles.separador} />
        <Columna nombre="Equipo B" color={colors.teamB} players={split.teamB} />
      </View>

      {resultado && resultado.goleadores.length > 0 ? (
        <Text style={styles.goles}>
          <Text style={styles.golesRotulo}>Goles: </Text>
          {textoDeGoleadores(resultado.goleadores)}
        </Text>
      ) : null}

      {split.bench.length > 0 ? (
        <Text style={styles.banco} numberOfLines={2}>
          Suplentes: {split.bench.map((p) => p.nombre).join(', ')}
        </Text>
      ) : null}

      <Text style={styles.pie}>
        {/* Después de jugar, cuán parejos eran ya no importa: lo dice el
            marcador. */}
        {resultado
          ? 'anotado con CANCHERO'
          : `${
              diff === 0 ? 'Equipos igualados' : `Diferencia de media: ${diff}`
            }   ·   armado con CANCHERO`}
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
  marcador: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  marcadorEquipo: { fontSize: 13, fontFamily: 'Barlow_900Black', letterSpacing: 0.5 },
  marcadorGoles: {
    color: colors.text,
    fontSize: 40,
    lineHeight: 50,
    fontFamily: 'Anton_400Regular',
  },
  goles: {
    color: colors.text,
    fontSize: 12,
    fontFamily: 'Barlow_400Regular',
    marginTop: spacing.md,
  },
  golesRotulo: { color: colors.textMuted, fontFamily: 'Barlow_700Bold' },
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
    borderBottomWidth: 2,
    paddingBottom: 5,
    marginBottom: 6,
  },
  equipo: { fontSize: 13, fontFamily: 'Barlow_900Black' },
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
