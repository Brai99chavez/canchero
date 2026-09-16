import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ajuste, mediaDe } from '../elo';
import { Objetivo } from '../components/Guia';
import CampoTexto from '../components/CampoTexto';
import Opcion from '../components/Opcion';
import Panel, { DIAGONAL, FondoDegradado } from '../components/Angular';
import { Presionable } from '../components/motion';
import { Button, EmptyState, PositionPill, RatingBadge } from '../components/ui';
import { angulo, colors, degradados, spacing } from '../theme';
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
  /**
   * Convoca a los que se ven. Recibe los ids porque con el buscador puesto
   * "Todos" tiene que ser los que están a la vista y no el plantel entero: si
   * buscás "mar" y tocás Todos, esperás convocar a los Martín.
   */
  onSelectAll: (ids: string[]) => void;
  onClear: () => void;
  onBuild: () => void;
  haySorteo: boolean;
  /** Si ese sorteo ya se guardó como partido y está esperando el resultado. */
  sorteoGuardado: boolean;
  onVerSorteo: () => void;
}

/** Una salida del cartel amarillo. Chico, pero claramente tocable. */
function AccionAviso({
  texto,
  onPress,
}: {
  texto: string;
  onPress: () => void;
}) {
  return (
    <Presionable onPress={onPress}>
      <Panel
        style={styles.alertaAccion}
        esquinas={DIAGONAL}
        chaflan={7}
        fondo={colors.aviso}
        opacidadFondo={0.18}
        borde={colors.aviso}
        grosor={1}
      >
        <Text style={styles.alertaAccionTexto}>{texto}</Text>
      </Panel>
    </Presionable>
  );
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
  sorteoGuardado,
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
   * El buscador aparece recién cuando la lista es larga: con seis jugadores
   * se ven todos de un vistazo y el campo sería un renglón de más en una
   * pantalla que ya tiene bastante arriba de la lista.
   */
  const [busqueda, setBusqueda] = useState('');
  const hayBuscador = players.length > 6;

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return sorted;
    return sorted.filter((p) => p.nombre.toLowerCase().includes(texto));
  }, [sorted, busqueda]);

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

  /** Cuántos se quedan afuera con el formato elegido. */
  const banco = !usarTodos && count > needed ? count - needed : 0;

  /*
   * Un solo cartel y no dos. Cuando sobra gente casi siempre pasan las dos
   * cosas a la vez —hay banco y además entraría un formato más grande— y dos
   * carteles amarillos seguidos se anulan entre ellos: se vuelven pared y no
   * se lee ninguno.
   */
  const alerta =
    banco > 0
      ? {
          titulo: `${banco} ${banco === 1 ? 'se queda' : 'se quedan'} en el banco`,
          /*
           * Con "todos" no hay banco sea cual sea el número: reparte a los que
           * haya en dos equipos. Es la salida para el que quiere una cantidad
           * que no es ninguno de los formatos —seis contra seis, ocho contra
           * ocho— y que no se quede nadie afuera.
           */
          todos: true,
        }
      : sugerencia !== null
      ? { titulo: `Marcaste ${count}: alcanzan para fútbol ${sugerencia}`, todos: false }
      : null;

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
      : 'Justo para dos equipos completos';

  return (
    <View style={styles.container}>
      {haySorteo ? (
        <Presionable onPress={onVerSorteo}>
          <Panel
            style={styles.aviso}
            esquinas={DIAGONAL}
            degradado={degradados.acento}
            borde="transparent"
            grosor={0}
          >
            {/*
              Decir cuál de las dos cosas es. "Hay equipos armados" a secas se
              confundía con los partidos de Activos, y son distintas: esto es
              el sorteo que quedó en el plantel —el único modo de volver a él
              sin sortear de nuevo y perder los cambios hechos a mano—, no un
              partido esperando resultado.
            */}
            <Text style={styles.avisoTitulo}>
              {sorteoGuardado
                ? 'Los equipos del partido en curso'
                : 'Tenés equipos armados sin guardar'}
            </Text>
            <Text style={styles.avisoTexto}>
              {sorteoGuardado
                ? 'Tocá para verlos o cambiar a alguien de lado'
                : 'Tocá para verlos y guardar el partido'}
            </Text>
          </Panel>
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
        <Pressable
          onPress={
            count > 0 ? onClear : () => onSelectAll(visibles.map((p) => p.id))
          }
          hitSlop={8}
        >
          <Text style={styles.link}>{count > 0 ? 'Limpiar' : 'Todos'}</Text>
        </Pressable>
      </View>

      {/*
        Como cartel y no como una línea de texto: era una frase gris entre
        otras frases grises y pasaba desapercibida, que es lo único que esto
        no se puede permitir — si no se ve, no sirve para nada.
      */}
      {alerta !== null ? (
        <View style={styles.alertaCaja}>
          <Panel
            style={styles.alerta}
            esquinas={DIAGONAL}
            chaflan={9}
            fondo={colors.aviso}
            opacidadFondo={0.12}
            borde={colors.aviso}
            grosor={1.5}
          >
            <View style={styles.alertaLinea}>
              <Text style={styles.alertaSigno}>!</Text>
              <Text style={styles.alertaTitulo}>{alerta.titulo}</Text>
            </View>

            <View style={styles.alertaAcciones}>
              {sugerencia !== null ? (
                <AccionAviso
                  texto={`Jugar fútbol ${sugerencia}`}
                  onPress={() => elegir(sugerencia)}
                />
              ) : null}
              {alerta.todos ? (
                <AccionAviso
                  texto="Que jueguen todos"
                  onPress={() => elegir('todos')}
                />
              ) : null}
            </View>
          </Panel>
        </View>
      ) : null}

      {hayBuscador ? (
        <CampoTexto
          value={busqueda}
          onChangeText={setBusqueda}
          placeholder="Buscar por nombre"
          contenedor={styles.buscador}
          style={styles.buscadorTexto}
          autoCorrect={false}
        />
      ) : null}

      <Objetivo paso="convocar" style={styles.lista}>
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={visibles}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          busqueda.trim() ? (
            <EmptyState
              title="Sin resultados"
              subtitle={`Ninguno de los jugadores se llama así. Probá con menos letras.`}
            />
          ) : (
            <EmptyState
              title="No hay jugadores cargados"
              subtitle="Para armar equipos primero hay que tener a quién repartir. Cargalos desde la pestaña Plantel."
            />
          )
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
              <Panel
                style={styles.check}
                esquinas={DIAGONAL}
                chaflan={6}
                degradado={selected ? degradados.acento : undefined}
                fondo="transparent"
                borde={selected ? 'transparent' : colors.border}
                grosor={selected ? 0 : 1.5}
              >
                {selected ? <Text style={styles.checkMark}>✓</Text> : null}
              </Panel>
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
  buscador: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  buscadorTexto: { paddingVertical: 10, fontSize: 15 },
  alertaCaja: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  alerta: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: spacing.sm,
  },
  alertaLinea: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // El signo va en su propia columna: la línea de texto arranca siempre en el
  // mismo lugar aunque el número cambie de largo.
  alertaSigno: {
    color: colors.aviso,
    fontSize: 22,
    lineHeight: 26,
    fontFamily: 'Anton_400Regular',
    width: 14,
    textAlign: 'center',
  },
  alertaTitulo: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontFamily: 'Barlow_700Bold',
    lineHeight: 18,
  },
  // Las salidas van en fila y se acomodan solas: en pantallas angostas los dos
  // botones no entran al lado del otro.
  alertaAcciones: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  alertaAccion: { paddingHorizontal: spacing.md, paddingVertical: 6 },
  alertaAccionTexto: {
    color: colors.aviso,
    fontSize: 11,
    fontFamily: 'Barlow_800ExtraBold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
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
  formatRowPrimera: { marginTop: spacing.xs },
  aviso: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
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
    alignItems: 'center',
    justifyContent: 'center',
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
