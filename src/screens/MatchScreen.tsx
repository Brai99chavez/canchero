import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
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

  /*
   * El formato y "repartir a todos" son la misma decisión: cuántos por lado.
   * Antes eran un selector arriba y un interruptor abajo que lo invalidaba sin
   * decirlo —elegías Fútbol 5, prendías el interruptor y jugaban 12 contra 12—
   * y lo único que avisaba era que el selector se veía apagado. Ahora es una
   * fila sola: se elige una cosa, y esa es la que manda.
   */
  const elegir = (opcion: Format | 'todos') => {
    if (opcion === 'todos') {
      onUsarTodosChange(true);
      return;
    }
    // El formato se recuerda: si después vuelve a Fútbol 5, sigue siendo el
    // que había elegido.
    onUsarTodosChange(false);
    onFormatChange(opcion);
  };

  const sorted = useMemo(
    () => players.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [players]
  );

  /*
   * El formato que llenaría dos equipos completos con los que están marcados.
   * Se ofrece, no se aplica: que la app te cambie la elección mientras estás
   * marcando gente molesta, y además a veces se equivoca. Doce personas que
   * juegan fútbol 5 con dos suplentes no quieren fútbol 7, quieren banco —y
   * eso la app no lo puede saber, pero la persona sí.
   */
  const sugerido = useMemo(() => {
    const entran = FORMATS.filter((f) => f * 2 <= count);
    return entran.length > 0 ? entran[entran.length - 1] : null;
  }, [count]);

  const sugerencia =
    !usarTodos && sugerido !== null && sugerido !== format ? sugerido : null;

  const porLado = Math.floor(count / 2);
  const hint =
    count < 2
      ? 'Elegí al menos 2 jugadores'
      : usarTodos
      ? count % 2 === 0
        ? `Juegan todos: dos equipos de ${porLado}`
        : `Juegan todos: ${porLado + 1} contra ${porLado}`
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

      <Text style={styles.rotulo}>Cuántos por lado</Text>
      <View style={[styles.formatRow, styles.formatRowPrimera]}>
        {FORMATS.map((f) => (
          <Opcion
            key={f}
            label={String(f)}
            detalle={`${f} vs ${f}`}
            activa={!usarTodos && f === format}
            onPress={() => elegir(f)}
          />
        ))}
        <Opcion
          label="Todos"
          detalle={
            usarTodos && count >= 2
              ? count % 2 === 0
                ? `${porLado} vs ${porLado}`
                : `${porLado + 1} vs ${porLado}`
              : 'sin banco'
          }
          activa={usarTodos}
          onPress={() => elegir('todos')}
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

      {sugerencia !== null ? (
        <Pressable
          onPress={() => elegir(sugerencia)}
          style={styles.sugerencia}
          hitSlop={6}
        >
          <Text style={styles.sugerenciaTexto}>
            Son {count}: alcanzan para fútbol {sugerencia}.{' '}
            <Text style={styles.sugerenciaAccion}>Cambiar</Text>
          </Text>
        </Pressable>
      ) : null}

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
              {/*
                Teñido, no pintado: encima van la pastilla de posición y la
                media, que tienen sus propios colores y sobre el acento lleno
                no se leen. El borde y el tilde alcanzan para que se entienda
                que está elegido.
              */}
              {selected ? (
                <FondoDegradado colores={degradados.acento} opacidad={0.14} />
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
  sugerencia: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sugerenciaTexto: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: 'Barlow_400Regular',
    lineHeight: 17,
  },
  // Subrayado y en el color de la app: sin eso no se ve que se puede tocar.
  sugerenciaAccion: {
    color: colors.primary,
    fontFamily: 'Barlow_800ExtraBold',
    textDecorationLine: 'underline',
  },
  rotulo: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: 'Barlow_800ExtraBold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.lg,
    paddingBottom: 6,
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
