import React, { useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  GearIcon,
  ImportIcon,
  PlusIcon,
  UserIcon,
} from '../components/icons';
import Panel, {
  DIAGONAL,
  FondoDegradado,
} from '../components/Angular';
import { Etiqueta } from '../components/Banner';
import { useDialogo } from '../components/Dialogo';
import { Logotipo } from '../components/Logo';
import { Objetivo } from '../components/Guia';
import { Aparecer, Presionable } from '../components/motion';
import { EmptyState } from '../components/ui';
import { angulo, colors, degradados, radius, spacing } from '../theme';
import { Squad } from '../types';
import ImportarModal from './ImportarModal';

interface Props {
  planteles: Squad[];
  /** Tope del plan. Se muestra para que el límite no aparezca de golpe. */
  limitePlanteles: number;
  /** Los que el plan deja usar. El resto se ve, pero no se abre. */
  activos: Set<string>;
  /** Qué decirle al plantel que quedó fuera del plan. */
  motivoBloqueo: string;
  /** La línea de Pro, aparte para poder resaltarla. */
  avisoPro: string;
  /**
   * La sesión abierta, `null` si no entró, o `undefined` si esta copia de la
   * app no tiene nube configurada — ahí el botón de cuenta ni aparece.
   */
  sesion?: { email: string } | null;
  onCuenta: () => void;
  predeterminadoId: string | null;
  onAbrir: (id: string) => void;
  onConfig: (id: string) => void;
  onNuevo: () => void;
  onImportar: (nuevos: Squad[]) => void;
  onReiniciar: () => void;
}

export default function SquadsScreen({
  planteles,
  limitePlanteles,
  activos,
  motivoBloqueo,
  avisoPro,
  sesion,
  onCuenta,
  predeterminadoId,
  onAbrir,
  onConfig,
  onNuevo,
  onImportar,
  onReiniciar,
}: Props) {
  const [importarVisible, setImportarVisible] = useState(false);
  const { dialogo, preguntar } = useDialogo();

  const totalJugadores = planteles.reduce(
    (acc, p) => acc + p.jugadores.length,
    0
  );

  function confirmarReinicio() {
    // Se pregunta dos veces a propósito: es lo único de la app que no tiene
    // vuelta atrás.
    preguntar({
      titulo: 'Empezar de cero',
      mensaje:
        'Se borran todos los planteles, jugadores, partidos y fotos. La app ' +
        'queda como recién instalada y no se puede deshacer.',
      confirmar: 'Borrar todo',
      peligro: true,
      onConfirmar: () =>
        preguntar({
          titulo: '¿Seguro?',
          mensaje: 'Si no exportaste, esto no se recupera.',
          confirmar: 'Sí, borrar todo',
          peligro: true,
          onConfirmar: onReiniciar,
        }),
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.titleBlock}>
          {/*
            La lista es la portada de la app, y es el único lugar donde va el
            nombre: en las demás pantallas el título dice de qué plantel se
            trata, que es lo que hace falta saber ahí.
          */}
          <Logotipo size={28} />
          <Text style={styles.subtitle}>
            {planteles.length}
            {Number.isFinite(limitePlanteles) ? ` de ${limitePlanteles}` : ''}{' '}
            {planteles.length === 1 ? 'plantel' : 'planteles'} ·{' '}
            {totalJugadores}{' '}
            {totalJugadores === 1 ? 'jugador' : 'jugadores'}
          </Text>
        </View>
        <View style={styles.acciones}>
          {sesion !== undefined ? (
            <Presionable
              onPress={onCuenta}
              style={styles.iconoBoton}
              accessibilityLabel={sesion ? 'Tu cuenta' : 'Entrar a tu cuenta'}
            >
              <FondoDegradado colores={degradados.panel} />
              <UserIcon
                color={sesion ? colors.primary : colors.textMuted}
                size={20}
              />
            </Presionable>
          ) : null}
          <Presionable
            onPress={() => setImportarVisible(true)}
            style={styles.iconoBoton}
            accessibilityLabel="Importar planteles"
          >
            <FondoDegradado colores={degradados.panel} />
            <ImportIcon color={colors.primary} size={20} />
          </Presionable>
          <Objetivo paso="crear-plantel">
            <Presionable onPress={onNuevo} style={styles.addButton}>
              <FondoDegradado colores={degradados.acento} />
            <PlusIcon color="#04140C" size={17} />
              <Text style={styles.addButtonText}>Nuevo</Text>
            </Presionable>
          </Objetivo>
        </View>
      </View>

      <FlatList
        data={planteles}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            title="Creá tu primer plantel"
            subtitle="Un plantel es un grupo de amigos con sus propios jugadores. Podés tener varios."
            accion="Crear plantel"
            onAccion={onNuevo}
          />
        }
        ListFooterComponent={
          planteles.length > 0 ? (
            <Pressable onPress={confirmarReinicio} style={styles.reiniciar}>
              <Text style={styles.reiniciarTexto}>Empezar de cero</Text>
            </Pressable>
          ) : null
        }
        renderItem={({ item, index }) => {
          // Bloqueado se ve igual que los demás pero no se abre: la tuerca
          // sigue andando, que es por donde se lo borra para hacer lugar.
          const bloqueado = !activos.has(item.id);
          const fijo = item.id === predeterminadoId && !bloqueado;
          return (
            <Aparecer llave={item.id} duracion={200 + index * 30}>
            <Panel
              style={styles.fila}
              degradado={fijo ? degradados.panel : degradados.panelTenue}
              borde={
                bloqueado ? colors.danger : fijo ? colors.primary : colors.border
              }
              grosor={bloqueado || fijo ? 1.5 : 1}
              esquinas={DIAGONAL}
            >
              <Pressable
                style={styles.filaTexto}
                onPress={() => onAbrir(item.id)}
                disabled={bloqueado}
              >
                <View style={styles.filaTitulo}>
                  <Text
                    style={[styles.nombre, bloqueado && styles.nombreBloqueado]}
                    numberOfLines={1}
                  >
                    {item.nombre}
                  </Text>
                  {fijo ? <Etiqueta>por defecto</Etiqueta> : null}
                </View>
                <Text style={styles.detalle}>
                  {item.jugadores.length}{' '}
                  {item.jugadores.length === 1 ? 'jugador' : 'jugadores'}
                </Text>
                {bloqueado ? (
                  <>
                    <Text style={styles.bloqueado}>{motivoBloqueo}</Text>
                    <Text style={styles.proximamente}>{avisoPro}</Text>
                  </>
                ) : null}
              </Pressable>

              <Pressable
                onPress={() => onConfig(item.id)}
                hitSlop={12}
                style={styles.config}
              >
                <GearIcon color={colors.textMuted} size={21} />
              </Pressable>
            </Panel>
            </Aparecer>
          );
        }}
      />

      <ImportarModal
        visible={importarVisible}
        onClose={() => setImportarVisible(false)}
        onImportar={onImportar}
      />

      {dialogo}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  nombreBloqueado: { color: colors.textMuted },
  bloqueado: {
    color: colors.danger,
    fontSize: 12,
    fontFamily: 'Barlow_700Bold',
    marginTop: 5,
  },
  proximamente: {
    color: colors.primary,
    fontSize: 11.5,
    fontFamily: 'Barlow_800ExtraBold',
    letterSpacing: 0.3,
    marginTop: 2,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  titleBlock: { flex: 1, marginRight: spacing.md },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: 'Barlow_400Regular',
    marginTop: 3,
  },
  acciones: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconoBoton: {
    width: 42,
    height: 40,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ skewX: angulo.inclinacion }],
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
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    paddingVertical: spacing.md,
  },
  filaTexto: { flex: 1 },
  filaTitulo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  nombre: {
    color: colors.text,
    fontSize: 17,
    fontFamily: 'Barlow_700Bold',
    flexShrink: 1,
  },
  detalle: { color: colors.textMuted, fontSize: 12, fontFamily: 'Barlow_400Regular', marginTop: 3 },
  config: { padding: spacing.sm },
  reiniciar: {
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  reiniciarTexto: { color: colors.danger, fontSize: 13, fontFamily: 'Barlow_700Bold' },
});
