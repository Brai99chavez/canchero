import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
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
import { overall, Player, STAT_KEYS, STAT_LABELS } from '../types';

interface Props {
  players: Player[];
  onAdd: () => void;
  onEdit: (player: Player) => void;
}

export default function PlayersScreen({ players, onAdd, onEdit }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? players.filter((p) => p.nombre.toLowerCase().includes(q))
      : players;
    return list.slice().sort((a, b) => overall(b) - overall(a));
  }, [players, query]);

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
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar jugador"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
        />
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          query ? (
            <EmptyState
              title="Sin resultados"
              subtitle="Probá con otro nombre."
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
            <RatingBadge value={overall(item)} />
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

const styles = StyleSheet.create({
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
