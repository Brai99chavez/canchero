import React, { useMemo } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ajuste, mediaDe } from '../elo';
import { Objetivo } from '../components/Guia';
import Opcion from '../components/Opcion';
import { FondoDegradado } from '../components/Angular';
import { Presionable } from '../components/motion';
import { Button, EmptyState, PositionPill, RatingBadge } from '../components/ui';
import { angulo, colors, degradados, radius, spacing } from '../theme';
import { Format, FORMATS, overall, Player } from '../types';

interface Props {
  players: Player[];
  ajustes: Record<string, Ajuste>;
  format: Format;
  onFormatChange: (format: Format) => void;
  usarTodos: boolean;
  onUsarTodosChange: (valor: boolean) => void;
  selectedIds: string[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onBuild: () => void;
  haySorteo: boolean;
  onVerSorteo: () => void;
}

export default function MatchScreen({
  players,
  ajustes,
  format,
  onFormatChange,
  usarTodos,
  onUsarTodosChange,
  selectedIds,
  onToggle,
  onSelectAll,
  onClear,
  onBuild,
  haySorteo,
  onVerSorteo,
}: Props) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const needed = format * 2;
  const count = selectedIds.length;

  const sorted = useMemo(
    () => players.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [players]
  );

  const porLado = Math.floor(count / 2);
  const hint =
    count < 2
      ? 'Elegí al menos 2 jugadores'
      : usarTodos
      ? count % 2 === 0
        ? `Dos equipos de ${porLado}, sin suplentes`
        : `Equipos de ${porLado + 1} y ${porLado}, sin suplentes`
      : count < needed
      ? `Faltan ${needed - count} para dos equipos completos (se arma igual con ${porLado} por lado)`
      : count === needed
      ? 'Justo para dos equipos completos'
      : `${count - needed} van al banco`;

  return (
    <View style={styles.container}>
      {haySorteo ? (
        <Presionable onPress={onVerSorteo} style={styles.aviso}>
          <FondoDegradado colores={degradados.acento} />
          <Text style={styles.avisoTitulo}>Hay equipos armados</Text>
          <Text style={styles.avisoTexto}>Tocá para verlos</Text>
        </Presionable>
      ) : null}

      <View
        style={[
          styles.formatRow,
          styles.formatRowPrimera,
          usarTodos && styles.formatRowApagada,
        ]}
      >
        {FORMATS.map((f) => (
          <Opcion
            key={f}
            label={`Fútbol ${f}`}
            detalle={`${f} vs ${f}`}
            activa={f === format}
            onPress={() => onFormatChange(f)}
          />
        ))}
      </View>

      <View style={styles.todosRow}>
        <View style={styles.todosTexto}>
          <Text style={styles.todosTitulo}>Repartir a todos</Text>
          <Text style={styles.todosAyuda}>
            Divide a los convocados en dos equipos sin importar el formato. Con
            número impar, un equipo queda con uno más.
          </Text>
        </View>
        <Switch
          value={usarTodos}
          onValueChange={onUsarTodosChange}
          trackColor={{ false: colors.surfaceAlt, true: colors.primaryDark }}
          thumbColor={usarTodos ? colors.primary : colors.textMuted}
        />
      </View>

      <View style={styles.counterRow}>
        <View style={styles.counterInfo}>
          <Text style={styles.counter}>
            {count}
            <Text style={styles.counterTotal}>
              {usarTodos ? ' convocados' : ` / ${needed} convocados`}
            </Text>
          </Text>
          <Text style={styles.hint}>{hint}</Text>
        </View>
        <Pressable onPress={count > 0 ? onClear : onSelectAll} hitSlop={8}>
          <Text style={styles.link}>{count > 0 ? 'Limpiar' : 'Todos'}</Text>
        </Pressable>
      </View>

      <Objetivo paso="convocar" style={styles.lista}>
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            title="No hay jugadores cargados"
            subtitle="Para armar equipos primero hay que tener a quién repartir. Cargalos desde la pestaña Plantel."
          />
        }
        renderItem={({ item }) => {
          const selected = selectedSet.has(item.id);
          return (
            <Presionable
              onPress={() => onToggle(item.id)}
              style={[styles.row, selected && styles.rowSelected]}
            >
              {selected ? (
                <FondoDegradado colores={degradados.acentoTenue} />
              ) : null}
              <View style={[styles.check, selected && styles.checkOn]}>
                {selected ? (
                  <FondoDegradado colores={degradados.acento} />
                ) : null}
                {selected ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>
              <Text style={styles.name} numberOfLines={1}>
                {item.nombre}
              </Text>
              <PositionPill position={item.posicion} />
              <RatingBadge value={mediaDe(item, ajustes)} size={32} />
            </Presionable>
          );
        }}
      />
      </Objetivo>

      {players.length > 0 ? (
        <View style={styles.footer}>
          <Objetivo paso="armar-equipos">
            <Button
              title="Armar equipos"
              onPress={onBuild}
              disabled={count < 2}
            />
          </Objetivo>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  formatRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  formatChip: {
    flex: 1,
    paddingVertical: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    transform: [{ skewX: angulo.inclinacion }],
  },
  formatRowPrimera: { marginTop: spacing.xs },
  aviso: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    overflow: 'hidden',
    transform: [{ skewX: angulo.inclinacion }],
  },
  avisoTitulo: {
    color: colors.sobreAcento,
    fontSize: 14,
    fontFamily: 'Anton_400Regular',
    letterSpacing: 0.5,
    transform: [{ skewX: angulo.derecho }],
  },
  avisoTexto: {
    color: colors.sobreAcento,
    opacity: 0.75,
    fontSize: 12,
    fontFamily: 'Barlow_600SemiBold',
    marginTop: 1,
    transform: [{ skewX: angulo.derecho }],
  },
  formatRowApagada: { opacity: 0.45 },
  todosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  todosTexto: { flex: 1 },
  todosTitulo: {
    color: colors.text,
    fontSize: 14,
    fontFamily: 'Barlow_700Bold',
    marginBottom: 2,
  },
  todosAyuda: { color: colors.textMuted, fontSize: 11, fontFamily: 'Barlow_400Regular', lineHeight: 15 },
  formatText: {
    color: colors.text,
    fontFamily: 'Anton_400Regular',
    fontSize: 15,
    letterSpacing: 0.5,
    transform: [{ skewX: angulo.derecho }],
  },
  formatHint: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: 'Barlow_400Regular',
    marginTop: 2,
    transform: [{ skewX: angulo.derecho }],
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  // Sin esto, el texto largo del contador empuja "Limpiar" fuera de pantalla.
  counterInfo: {
    flex: 1,
  },
  counter: {
    color: colors.text,
    fontSize: 18,
    fontFamily: 'Barlow_800ExtraBold',
  },
  counterTotal: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: 'Barlow_600SemiBold',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: 'Barlow_400Regular',
    marginTop: 2,
  },
  link: {
    color: colors.primary,
    fontFamily: 'Barlow_700Bold',
    fontSize: 14,
    flexShrink: 0,
  },
  lista: { flex: 1 },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    overflow: 'hidden',
  },
  rowSelected: {
    borderColor: colors.primary,
  },
  check: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    transform: [{ skewX: angulo.inclinacion }],
  },
  checkOn: {
    borderColor: colors.primary,
  },
  checkMark: {
    color: colors.sobreAcento,
    fontSize: 13,
    fontFamily: 'Barlow_900Black',
  },
  name: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontFamily: 'Barlow_600SemiBold',
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
});
