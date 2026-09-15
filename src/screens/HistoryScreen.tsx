import React, { useMemo } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Opcion from '../components/Opcion';
import { Button, EmptyState, RatingBadge } from '../components/ui';
import { resumenDe, Signo, tieneResultado } from '../stats';
import { angulo, colors, radius, spacing } from '../theme';
import { overall, Partido, Player } from '../types';

interface Props {
  players: Player[];
  partidos: Partido[];
  /** Qué mirar: lo elige la barra de abajo, que tiene una pestaña por vista. */
  vista: Pestania;
  onCargarResultado: (partido: Partido) => void;
  onBorrarPartido: (id: string) => void;
}

/**
 * El marcador es lo que separa un partido activo de uno jugado. No hay un
 * estado aparte a propósito: un campo así podría quedar desincronizado del
 * resultado y dejar partidos mintiendo sobre sí mismos.
 */
export type Pestania = 'activos' | 'historial' | 'tabla';

const COLOR_SIGNO: Record<Signo, string> = {
  G: colors.primary,
  E: '#F59E0B',
  P: colors.danger,
};

function fechaCorta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

function Forma({ ultimos }: { ultimos: Signo[] }) {
  if (ultimos.length === 0) {
    return <Text style={styles.sinDatos}>sin partidos</Text>;
  }
  return (
    <View style={styles.forma}>
      {ultimos.map((signo, i) => (
        <View
          key={i}
          style={[styles.pastilla, { backgroundColor: COLOR_SIGNO[signo] }]}
        >
          <Text style={styles.pastillaTexto}>{signo}</Text>
        </View>
      ))}
    </View>
  );
}

export default function HistoryScreen({
  players,
  partidos,
  vista,
  onCargarResultado,
  onBorrarPartido,
}: Props) {
  const ordenados = useMemo(
    () => partidos.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [partidos]
  );

  const activos = useMemo(
    () => ordenados.filter((p) => !tieneResultado(p)),
    [ordenados]
  );
  const jugados = useMemo(
    () => ordenados.filter(tieneResultado),
    [ordenados]
  );

  const tabla = useMemo(() => {
    return players
      .map((jugador) => ({
        jugador,
        resumen: resumenDe(jugador.id, partidos),
      }))
      .sort((a, b) => {
        if (b.resumen.ganados !== a.resumen.ganados) {
          return b.resumen.ganados - a.resumen.ganados;
        }
        return b.resumen.jugados - a.resumen.jugados;
      });
  }, [players, partidos]);

  function confirmarBorrado(partido: Partido) {
    Alert.alert(
      'Borrar partido',
      'Se elimina del historial y deja de contar en las estadísticas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: () => onBorrarPartido(partido.id),
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      {vista !== 'tabla' ? (
        <FlatList
          data={vista === 'activos' ? activos : jugados}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            vista === 'activos' ? (
              <EmptyState
                title="No hay partidos en curso"
                subtitle="Armá los equipos y tocá GUARDAR PARTIDO: queda acá esperando el resultado."
              />
            ) : (
              <EmptyState
                title="Todavía no jugaste ninguno"
                subtitle="Cuando le cargues el marcador a un partido activo, pasa a esta lista."
              />
            )
          }
          renderItem={({ item }) => {
            const cargado = tieneResultado(item);
            return (
              <Pressable
                style={styles.partido}
                onPress={() => onCargarResultado(item)}
                onLongPress={() => confirmarBorrado(item)}
              >
                <View style={styles.partidoCabecera}>
                  <Text style={styles.fecha}>{fechaCorta(item.fecha)}</Text>
                  <Text style={styles.formato}>Fútbol {item.formato}</Text>
                  {cargado ? (
                    <Text style={styles.marcador}>
                      {item.golesA} - {item.golesB}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.equipos} numberOfLines={1}>
                  {item.equipoA.map((id) => item.nombres[id]).join(', ')}
                </Text>
                <Text style={styles.equiposB} numberOfLines={1}>
                  {item.equipoB.map((id) => item.nombres[id]).join(', ')}
                </Text>
                {cargado ? null : (
                  <Button
                    title="Cargar resultado"
                    onPress={() => onCargarResultado(item)}
                    style={styles.cargar}
                  />
                )}
              </Pressable>
            );
          }}
        />
      ) : (
        <FlatList
          data={tabla}
          keyExtractor={(item) => item.jugador.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              title="Sin datos todavía"
              subtitle="Cargá el resultado de algún partido y acá aparece la tabla."
            />
          }
          renderItem={({ item }) => (
            <View style={styles.filaTabla}>
              <RatingBadge value={overall(item.jugador)} />
              <View style={styles.filaTexto}>
                <Text style={styles.nombre} numberOfLines={1}>
                  {item.jugador.nombre}
                </Text>
                <Text style={styles.detalle}>
                  {item.resumen.jugados} PJ · {item.resumen.ganados} G ·{' '}
                  {item.resumen.empatados} E · {item.resumen.perdidos} P
                  {item.resumen.goles > 0 || item.resumen.asistencias > 0
                    ? `  ·  ${item.resumen.goles} gol${
                        item.resumen.goles === 1 ? '' : 'es'
                      } / ${item.resumen.asistencias} asist.`
                    : ''}
                </Text>
                <Forma ultimos={item.resumen.ultimos} />
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pestania: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    transform: [{ skewX: angulo.inclinacion }],
  },
  pestaniaTexto: {
    color: colors.text,
    fontSize: 13,
    fontFamily: 'Barlow_800ExtraBold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    transform: [{ skewX: angulo.derecho }],
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  partido: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 3,
  },
  partidoCabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 3,
  },
  fecha: { color: colors.text, fontSize: 14, fontFamily: 'Barlow_800ExtraBold' },
  formato: { flex: 1, color: colors.textMuted, fontSize: 12 , fontFamily: 'Barlow_400Regular'},
  marcador: { color: colors.text, fontSize: 16, fontFamily: 'Barlow_900Black' },
  cargar: { marginTop: spacing.md },
  equipos: { color: colors.teamA, fontSize: 12 , fontFamily: 'Barlow_400Regular'},
  equiposB: { color: colors.teamB, fontSize: 12 , fontFamily: 'Barlow_400Regular'},
  filaTabla: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  filaTexto: { flex: 1 },
  nombre: {
    color: colors.text,
    fontSize: 16,
    fontFamily: 'Barlow_700Bold',
    flexShrink: 1,
  },
  detalle: { color: colors.textMuted, fontSize: 11, fontFamily: 'Barlow_400Regular', marginTop: 3 },
  forma: { flexDirection: 'row', gap: 4, marginTop: 6 },
  pastilla: {
    width: 17,
    height: 17,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastillaTexto: { color: colors.sobreAcento, fontSize: 10, fontFamily: 'Barlow_900Black' },
  sinDatos: { color: colors.textMuted, fontSize: 11, fontFamily: 'Barlow_400Regular', marginTop: 5 },
});
