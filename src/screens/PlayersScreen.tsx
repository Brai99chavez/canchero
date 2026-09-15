import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SILUETA } from '../assets';
import Panel, {
  DIAGONAL,
  FondoDegradado,
} from '../components/Angular';
import { Objetivo } from '../components/Guia';
import { PlusIcon } from '../components/icons';
import { Aparecer, Presionable } from '../components/motion';
import { EmptyState, PositionPill, RatingBadge } from '../components/ui';
import { angulo, colors, degradados, radius, sombra, spacing } from '../theme';
import { Ajuste } from '../elo';
import {
  overall,
  Player,
  Position,
  POSITION_COLORS,
  POSITION_LABELS,
  POSITIONS,
  STAT_KEYS,
  STAT_LABELS,
} from '../types';

interface Props {
  players: Player[];
  /** La media corregida por resultados. Vacío mientras no haya partidos. */
  ajustes: Record<string, Ajuste>;
  onAdd: () => void;
  onEdit: (player: Player) => void;
}

/**
 * Por qué campo y para qué lado. El botón muestra el sentido —`99-0`, `A-Z`—
 * en vez de decir sólo el campo: así se sabe qué va a pasar antes de tocarlo,
 * y tocar el que ya está activo lo da vuelta.
 */
type Campo = 'media' | 'nombre';
interface Orden {
  campo: Campo;
  desc: boolean;
}

/** El sentido con el que arranca cada campo: la media de mayor a menor. */
const SENTIDO_INICIAL: Record<Campo, boolean> = { media: true, nombre: false };

/**
 * El rótulo de cada botón. El que no está elegido muestra con qué sentido
 * arrancaría, no el del otro: si dijera el ajeno estaría anunciando algo que
 * no va a pasar al tocarlo.
 */
function etiquetaOrden(campo: Campo, orden: Orden): string {
  const desc = orden.campo === campo ? orden.desc : SENTIDO_INICIAL[campo];
  if (campo === 'media') return desc ? '99-0' : '0-99';
  return desc ? 'Z-A' : 'A-Z';
}

export default function PlayersScreen({
  players,
  ajustes,
  onAdd,
  onEdit,
}: Props) {
  const [query, setQuery] = useState('');
  /** `null` es "todas": el filtro apagado no es una posición más. */
  const [puesto, setPuesto] = useState<Position | null>(null);
  const [orden, setOrden] = useState<Orden>({ campo: 'media', desc: true });

  /** La media que se muestra y con la que se ordena: la corregida si la hay. */
  const media = (p: Player) => ajustes[p.id]?.elo ?? overall(p);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = players.filter(
      (p) =>
        (!q || p.nombre.toLowerCase().includes(q)) &&
        (!puesto || p.posicion === puesto)
    );
    // Los dos comparadores van de menor a mayor y el sentido los da vuelta.
    // Antes uno era descendente y el otro ascendente, con lo cual el mismo
    // signo significaba cosas distintas y el nombre ordenaba al reves de lo
    // que decia el boton.
    const sentido = orden.desc ? -1 : 1;
    const porNombre = (a: Player, b: Player) =>
      a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });

    return list.sort((a, b) =>
      orden.campo === 'media'
        ? // A igual media manda el nombre, si no el orden baila entre
          // renderizados con los que empatan.
          sentido * (media(a) - media(b)) || porNombre(a, b)
        : sentido * porNombre(a, b)
    );
  }, [players, query, puesto, orden]);

  /** Cambia de campo, o da vuelta el que ya estaba elegido. */
  function ordenarPor(campo: Campo) {
    setOrden((prev) =>
      prev.campo === campo
        ? { campo, desc: !prev.desc }
        : { campo, desc: SENTIDO_INICIAL[campo] }
    );
  }

  /** Cuántos hay de cada puesto, para no ofrecer un filtro que da vacío. */
  const porPuesto = useMemo(() => {
    const cuenta = {} as Record<Position, number>;
    for (const p of players) cuenta[p.posicion] = (cuenta[p.posicion] ?? 0) + 1;
    return cuenta;
  }, [players]);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>
            {players.length} {players.length === 1 ? 'jugador' : 'jugadores'}
          </Text>
        </View>
        <Objetivo paso={['agregar-jugador', 'segundo-jugador']}>
          <Presionable onPress={onAdd} style={styles.addButton}>
            <FondoDegradado colores={degradados.acento} />
            <PlusIcon color="#04140C" size={17} />
            <Text style={styles.addButtonText}>Agregar</Text>
          </Presionable>
        </Objetivo>
      </View>

      {players.length > 3 ? (
        <>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar jugador"
            placeholderTextColor={colors.textMuted}
            style={styles.search}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            // Sin esto se estira y se queda con el alto que le sobra a la
            // lista: un ScrollView adentro de una columna crece hasta llenar
            // lo que haya, y la lista quedaba flotando en el medio.
            style={styles.filtrosCaja}
            contentContainerStyle={styles.filtros}
            keyboardShouldPersistTaps="handled"
          >
            <Chip
              texto="Todos"
              activo={puesto === null}
              onPress={() => setPuesto(null)}
            />
            {POSITIONS.filter((p) => porPuesto[p]).map((p) => (
              <Chip
                key={p}
                texto={`${p} ${porPuesto[p]}`}
                activo={puesto === p}
                color={POSITION_COLORS[p]}
                onPress={() => setPuesto(puesto === p ? null : p)}
              />
            ))}

            <View style={styles.separadorFiltros} />

            <Chip
              texto={etiquetaOrden('media', orden)}
              activo={orden.campo === 'media'}
              onPress={() => ordenarPor('media')}
            />
            <Chip
              texto={etiquetaOrden('nombre', orden)}
              activo={orden.campo === 'nombre'}
              onPress={() => ordenarPor('nombre')}
            />
          </ScrollView>
        </>
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        style={styles.lista}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          query || puesto ? (
            <EmptyState
              title="Sin resultados"
              subtitle={
                puesto && !query
                  ? `No hay ningún ${POSITION_LABELS[puesto].toLowerCase()} en el plantel.`
                  : 'Probá con otro nombre.'
              }
            />
          ) : (
            <EmptyState
              title="Empezá por el plantel"
              subtitle="Cargá una vez a los pibes y después armar los equipos son tres toques."
              pasos={[
                'Agregá a cada jugador con su posición y sus stats.',
                'En Partido, elegí el formato y tildá quiénes vienen hoy.',
                'Armá los equipos y compartilos en el grupo.',
              ]}
              accion="Agregar el primer jugador"
              onAccion={onAdd}
            />
          )
        }
        renderItem={({ item, index }) => (
          <Aparecer llave={item.id} duracion={200 + Math.min(index, 8) * 35}>
          <Presionable onPress={() => onEdit(item)}>
            <Panel
              style={styles.card}
              degradado={degradados.panelTenue}
              esquinas={DIAGONAL}
            >
            <View style={styles.avatar}>
              {item.foto ? (
                <Image
                  source={{ uri: item.foto }}
                  style={styles.avatarFoto}
                  resizeMode="cover"
                />
              ) : (
                <Image
                  source={SILUETA}
                  style={styles.avatarSilueta}
                  resizeMode="contain"
                />
              )}
            </View>
            <View style={styles.medias}>
              <RatingBadge value={ajustes[item.id]?.elo ?? overall(item)} />
              {ajustes[item.id]?.ajuste ? (
                <Text
                  style={[
                    styles.ajuste,
                    ajustes[item.id].ajuste > 0 ? styles.sube : styles.baja,
                  ]}
                >
                  {/* De cuánto era su media antes de corregirla. */}
                  {`de ${ajustes[item.id].base}`}
                </Text>
              ) : null}
            </View>
            <View style={styles.cardBody}>
              <View style={styles.cardHeader}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.nombre}
                </Text>
                <PositionPill position={item.posicion} />
              </View>
              <Text style={styles.statsLine} numberOfLines={1}>
                {STAT_KEYS.map(
                  (k) => `${STAT_LABELS[k].slice(0, 3).toUpperCase()} ${item.stats[k]}`
                ).join('  ·  ')}
              </Text>
            </View>
            </Panel>
          </Presionable>
          </Aparecer>
        )}
      />
    </View>
  );
}

/**
 * Una pastilla de filtro. Cuando está activa se pinta con el color del puesto,
 * que es el mismo que llevan las etiquetas de las cartas: así el filtro y lo
 * filtrado se leen como lo mismo.
 */
function Chip({
  texto,
  activo,
  color,
  onPress,
}: {
  texto: string;
  activo: boolean;
  color?: string;
  onPress: () => void;
}) {
  const acento = color ?? colors.primary;
  return (
    <Presionable
      onPress={onPress}
      style={[
        styles.chip,
        activo && { borderColor: acento, backgroundColor: `${acento}22` },
      ]}
    >
      <Text style={[styles.chipTexto, activo && { color: acento }]}>
        {texto}
      </Text>
    </Presionable>
  );
}

const styles = StyleSheet.create({
  medias: { alignItems: 'center', gap: 2 },
  ajuste: { fontSize: 11, fontFamily: 'Barlow_800ExtraBold', letterSpacing: 0.3 },
  sube: { color: colors.primary },
  baja: { color: colors.danger },
  filtrosCaja: { flexGrow: 0, flexShrink: 0 },
  filtros: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  separadorFiltros: {
    width: 1,
    height: 20,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: colors.border,
    transform: [{ skewX: angulo.inclinacion }],
  },
  chipTexto: {
    color: colors.textMuted,
    fontSize: 11.5,
    fontFamily: 'Barlow_800ExtraBold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    transform: [{ skewX: angulo.derecho }],
  },
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  titleBlock: {
    flex: 1,
    marginRight: spacing.md,
  },
  title: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: 'Barlow_700Bold',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    height: 40,
    overflow: 'hidden',
    transform: [{ skewX: angulo.inclinacion }],
  },
  addButtonText: {
    color: colors.sobreAcento,
    fontFamily: 'Barlow_800ExtraBold',
    fontSize: 14,
  },
  search: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
  },
  lista: { flex: 1 },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFoto: {
    width: '100%',
    height: '100%',
  },
  avatarSilueta: {
    width: 21,
    height: 21,
    opacity: 0.85,
  },
  cardBody: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontFamily: 'Barlow_700Bold',
    flexShrink: 1,
  },
  statsLine: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: 'Barlow_400Regular',
    marginTop: 4,
  },
});
