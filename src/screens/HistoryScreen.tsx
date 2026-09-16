import React, { useEffect, useMemo, useState } from 'react';
import Panel, { DIAGONAL } from '../components/Angular';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useDialogo } from '../components/Dialogo';
import Opcion from '../components/Opcion';
import { Button, EmptyState, RatingBadge } from '../components/ui';
import {
  comoSeLeeCorto,
  comoSeLeeDia,
  diaDe,
  mesDe,
  nombreDelMes,
} from '../fechas';
import { reparto, resumenDe, Signo, tieneResultado, winrate } from '../stats';
import { angulo, colors, radius, spacing } from '../theme';
import { Ajuste, mediaDe } from '../elo';
import { Partido, Player } from '../types';

interface Props {
  players: Player[];
  partidos: Partido[];
  /** La media corregida por resultados, para mostrar la misma en todos lados. */
  ajustes: Record<string, Ajuste>;
  /** Qué mirar: lo elige la barra de abajo, que tiene una pestaña por vista. */
  vista: Pestania;
  onCargarResultado: (partido: Partido) => void;
  onBorrarPartidos: (ids: string[]) => void;
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

/** Uno de los meses del filtro. */
function ChipMes({
  texto,
  activo,
  onPress,
}: {
  texto: string;
  activo: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <Panel
        style={styles.chipMes}
        esquinas={DIAGONAL}
        chaflan={8}
        fondo={activo ? colors.primary : 'transparent'}
        opacidadFondo={activo ? 0.13 : undefined}
        borde={activo ? colors.primary : colors.border}
        grosor={1.5}
      >
        <Text style={[styles.chipMesTexto, activo && styles.chipMesActivo]}>
          {texto}
        </Text>
      </Panel>
    </Pressable>
  );
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
  ajustes,
  vista,
  onCargarResultado,
  onBorrarPartidos,
}: Props) {
  const { dialogo, preguntar } = useDialogo();
  /**
   * `null` cuando no se está eligiendo nada. Un conjunto vacío ya es modo
   * selección, así que la barra aparece apenas se entra y no recién al marcar
   * el primero.
   */
  const [elegidos, setElegidos] = useState<Set<string> | null>(null);

  // Cambiar de pestaña sale del modo: lo que quedó marcado era de la otra
  // lista, y borrar eso no sería lo que nadie espera.
  useEffect(() => setElegidos(null), [vista]);

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

  /*
   * Los meses que tienen partidos, del más nuevo al más viejo. Salen de lo que
   * hay y no de un calendario: ofrecer meses vacíos es hacer tocar para no
   * encontrar nada.
   */
  const meses = useMemo(() => {
    const vistos = new Map<string, { anio: number; mes: number }>();
    for (const p of jugados) {
      const f = new Date(p.fecha);
      if (Number.isNaN(f.getTime())) continue;
      vistos.set(mesDe(p.fecha), { anio: f.getFullYear(), mes: f.getMonth() });
    }
    return [...vistos.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([clave, { anio, mes }]) => ({ clave, etiqueta: nombreDelMes(anio, mes) }));
  }, [jugados]);

  const [mes, setMes] = useState<string | null>(null);
  const [dia, setDia] = useState<string | null>(null);

  // Un mes o un día elegidos que se quedaron sin partidos —se borraron todos—
  // dejarían la lista vacía sin que se entienda por qué.
  useEffect(() => {
    if (mes && !meses.some((m) => m.clave === mes)) setMes(null);
  }, [meses, mes]);

  const jugadosDelMes = useMemo(
    () => (mes ? jugados.filter((p) => mesDe(p.fecha) === mes) : jugados),
    [jugados, mes]
  );

  /*
   * Los días del mes elegido que tienen partidos. Sin mes elegido no se
   * muestran: serían todos los días de todos los meses, una fila interminable
   * que no ayuda a encontrar nada.
   */
  const dias = useMemo(() => {
    if (!mes) return [];
    const vistos = new Map<string, string>();
    for (const p of jugadosDelMes) vistos.set(diaDe(p.fecha), p.fecha);
    return [...vistos.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([clave, fecha]) => ({ clave, etiqueta: comoSeLeeDia(fecha) }));
  }, [jugadosDelMes, mes]);

  useEffect(() => {
    if (dia && !dias.some((d) => d.clave === dia)) setDia(null);
  }, [dias, dia]);

  const jugadosFiltrados = useMemo(
    () => (dia ? jugadosDelMes.filter((p) => diaDe(p.fecha) === dia) : jugadosDelMes),
    [jugadosDelMes, dia]
  );

  const lista = vista === 'activos' ? activos : jugadosFiltrados;

  function alternar(id: string) {
    setElegidos((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  function confirmarBorrado() {
    const ids = [...(elegidos ?? [])];
    if (ids.length === 0) return;
    const uno = ids.length === 1;
    preguntar({
      titulo: uno ? 'Borrar partido' : `Borrar ${ids.length} partidos`,
      mensaje:
        (uno
          ? 'Se elimina del historial y deja de contar '
          : 'Se eliminan del historial y dejan de contar ') +
        'en la tabla y en las cartas. No se puede deshacer.',
      confirmar: 'Borrar',
      peligro: true,
      onConfirmar: () => {
        onBorrarPartidos(ids);
        setElegidos(null);
      },
    });
  }

  return (
    <View style={styles.container}>
      {/*
        El filtro sólo en el historial: los activos son pocos y se están
        jugando ahora, no hay nada que buscar ahí.
      */}
      {vista === 'historial' && meses.length > 0 ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.mesesCaja}
            contentContainerStyle={styles.meses}
            keyboardShouldPersistTaps="handled"
          >
            <ChipMes
              texto="Todos"
              activo={mes === null}
              onPress={() => {
                setMes(null);
                setDia(null);
              }}
            />
            {meses.map((m) => (
              <ChipMes
                key={m.clave}
                texto={m.etiqueta}
                activo={mes === m.clave}
                onPress={() => {
                  // Cambiar de mes tira el día elegido: era de otro mes.
                  setDia(null);
                  setMes(mes === m.clave ? null : m.clave);
                }}
              />
            ))}
          </ScrollView>

          {/* Los días aparecen recién con un mes elegido, y sólo si ese mes
              tiene más de una fecha: con una sola no hay nada que elegir. */}
          {dias.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.mesesCaja}
              contentContainerStyle={styles.meses}
              keyboardShouldPersistTaps="handled"
            >
              <ChipMes
                texto="Todo el mes"
                activo={dia === null}
                onPress={() => setDia(null)}
              />
              {dias.map((d) => (
                <ChipMes
                  key={d.clave}
                  texto={d.etiqueta}
                  activo={dia === d.clave}
                  onPress={() => setDia(dia === d.clave ? null : d.clave)}
                />
              ))}
            </ScrollView>
          ) : null}
        </>
      ) : null}

      {vista !== 'tabla' && lista.length > 0 ? (
        <View style={styles.barra}>
          {elegidos ? (
            <>
              <Pressable onPress={() => setElegidos(null)} hitSlop={8}>
                <Text style={styles.accion}>Cancelar</Text>
              </Pressable>
              <Text style={styles.cuenta}>
                {elegidos.size}{' '}
                {elegidos.size === 1 ? 'elegido' : 'elegidos'}
              </Text>
              <Pressable
                onPress={() =>
                  setElegidos(
                    elegidos.size === lista.length
                      ? new Set()
                      : new Set(lista.map((p) => p.id))
                  )
                }
                hitSlop={8}
              >
                <Text style={styles.accion}>
                  {elegidos.size === lista.length ? 'Ninguno' : 'Todos'}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.cuenta}>
                {lista.length}{' '}
                {lista.length === 1 ? 'partido' : 'partidos'}
              </Text>
              <Pressable onPress={() => setElegidos(new Set())} hitSlop={8}>
                <Text style={styles.accion}>Elegir para borrar</Text>
              </Pressable>
            </>
          )}
        </View>
      ) : null}

      {vista !== 'tabla' ? (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={lista}
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
            const marcado = elegidos?.has(item.id) ?? false;
            return (
              <Pressable
                onPress={() =>
                  elegidos ? alternar(item.id) : onCargarResultado(item)
                }
                // Mantener apretado entra al modo con ese ya marcado, que es
                // el atajo que espera cualquiera que borró algo en el celular.
                onLongPress={() => setElegidos(new Set([item.id]))}
              >
                <Panel
                  style={styles.partido}
                  esquinas={DIAGONAL}
                  fondo={colors.surface}
                  borde={marcado ? colors.primary : colors.border}
                  grosor={marcado ? 1.5 : 1}
                >
                <View style={styles.partidoCabecera}>
                  <Text style={styles.fecha}>{comoSeLeeCorto(item.fecha)}</Text>
                  <Text style={styles.formato}>
                    {reparto(item.equipoA.length, item.equipoB.length)}
                  </Text>
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
                  {cargado || elegidos ? null : (
                    <Button
                      title="Cargar resultado"
                      onPress={() => onCargarResultado(item)}
                      style={styles.cargar}
                    />
                  )}
                </Panel>
              </Pressable>
            );
          }}
        />
      ) : (
        <FlatList
          keyboardShouldPersistTaps="handled"
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
              <RatingBadge value={mediaDe(item.jugador, ajustes)} />
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

              {item.resumen.jugados > 0 ? (
                <View style={styles.dg}>
                  {/*
                    Etiquetado porque al lado está la media corregida, que
                    también es un número suelto: sin decir cuál es cuál se
                    confunden.
                  */}
                  <Text style={styles.dgTitulo}>Ganados</Text>
                  <Text
                    style={[
                      styles.dgNumero,
                      winrate(item.resumen) >= 60 && styles.dgBien,
                      winrate(item.resumen) < 40 && styles.dgMal,
                    ]}
                  >
                    {winrate(item.resumen)}%
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        />
      )}

      {elegidos && elegidos.size > 0 ? (
        <View style={styles.pieBorrar}>
          <Button
            title={`Borrar ${elegidos.size} ${
              elegidos.size === 1 ? 'partido' : 'partidos'
            }`}
            variant="danger"
            onPress={confirmarBorrado}
          />
        </View>
      ) : null}

      {dialogo}
    </View>
  );
}

const styles = StyleSheet.create({
  // Sin esto el scroll horizontal se estira y se queda con el alto que le
  // sobra a la lista, que queda flotando en el medio.
  mesesCaja: { flexGrow: 0 },
  meses: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  chipMes: { paddingHorizontal: spacing.md, paddingVertical: 7 },
  chipMesTexto: {
    color: colors.textMuted,
    fontSize: 11.5,
    fontFamily: 'Barlow_800ExtraBold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  chipMesActivo: { color: colors.primary },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  cuenta: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: 'Barlow_700Bold',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  accion: {
    color: colors.primary,
    fontSize: 12,
    fontFamily: 'Barlow_800ExtraBold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  pieBorrar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  container: { flex: 1 },
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
  dg: { alignItems: 'flex-end', minWidth: 58 },
  dgTitulo: {
    color: colors.textMuted,
    fontSize: 9,
    fontFamily: 'Barlow_800ExtraBold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  dgNumero: {
    color: colors.textMuted,
    fontSize: 17,
    fontFamily: 'Anton_400Regular',
  },
  dgBien: { color: colors.primary },
  dgMal: { color: colors.danger },
  dgPie: {
    color: colors.textMuted,
    fontSize: 9.5,
    fontFamily: 'Barlow_600SemiBold',
    letterSpacing: 0.2,
  },
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
