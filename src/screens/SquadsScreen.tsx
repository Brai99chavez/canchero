import React, { useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GearIcon, ImportIcon, PlusIcon } from '../components/icons';
import Panel, {
  DIAGONAL,
} from '../components/Angular';
import { Etiqueta } from '../components/Banner';
import { useDialogo } from '../components/Dialogo';
import { Logotipo } from '../components/Logo';
import { Objetivo } from '../components/Guia';
import { Aparecer, Presionable } from '../components/motion';
import { BotonIcono, Button, EmptyState } from '../components/ui';
import { Envio } from '../nube/envios';
import { colors, degradados, spacing } from '../theme';
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
  predeterminadoId: string | null;
  onAbrir: (id: string) => void;
  onConfig: (id: string) => void;
  onNuevo: () => void;
  /**
   * Si entra otro plantel. Importar también suma, así que avisa lo mismo que
   * el botón de nuevo y antes de abrir el explorador de archivos: enterarse
   * después de elegir el archivo sería peor.
   */
  hayLugar: () => boolean;
  onImportar: (nuevos: Squad[]) => void;
  /** Los planteles que otros te mandaron, esperando que decidas. */
  envios: Envio[];
  onAceptarEnvio: (id: string) => Promise<void>;
  onRechazarEnvio: (id: string) => Promise<void>;
  onReiniciar: () => void;
}

export default function SquadsScreen({
  planteles,
  limitePlanteles,
  activos,
  motivoBloqueo,
  avisoPro,
  predeterminadoId,
  onAbrir,
  onConfig,
  onNuevo,
  hayLugar,
  onImportar,
  envios,
  onAceptarEnvio,
  onRechazarEnvio,
  onReiniciar,
}: Props) {
  const [importarVisible, setImportarVisible] = useState(false);
  /** Cuál se está aceptando o rechazando, para no tocarlo dos veces. */
  const [resolviendo, setResolviendo] = useState<string | null>(null);
  const { dialogo, avisar, preguntar } = useDialogo();

  const totalJugadores = planteles.reduce(
    (acc, p) => acc + p.jugadores.length,
    0
  );

  /** Acepta o rechaza, sin dejar tocar dos veces mientras va y viene. */
  async function resolver(id: string, accion: (id: string) => Promise<void>) {
    if (resolviendo) return;
    setResolviendo(id);
    try {
      await accion(id);
    } catch (error) {
      avisar(
        'No se pudo',
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setResolviendo(null);
    }
  }

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
          <BotonIcono
            onPress={() => hayLugar() && setImportarVisible(true)}
            accessibilityLabel="Importar planteles"
          >
            <ImportIcon color={colors.primary} size={20} />
          </BotonIcono>
          <Objetivo paso="crear-plantel">
            <Presionable onPress={onNuevo}>
              <Panel
                style={styles.addButton}
                esquinas={DIAGONAL}
                chaflan={9}
                degradado={degradados.acento}
                borde="transparent"
                grosor={0}
              >
                <PlusIcon color="#04140C" size={17} />
                <Text style={styles.addButtonText}>Nuevo</Text>
              </Panel>
            </Presionable>
          </Objetivo>
        </View>
      </View>

      {/*
        Lo que te mandaron va arriba de todo y no adentro de la lista: no es un
        plantel tuyo hasta que lo aceptes, y mezclarlo con los tuyos haría
        dudar de cuáles son cuáles.
      */}
      {envios.map((envio) => (
        <Panel
          key={envio.id}
          style={styles.envio}
          degradado={degradados.panel}
          borde={colors.primary}
          grosor={1.5}
          esquinas={DIAGONAL}
        >
          <Text style={styles.envioDe}>@{envio.de} te mandó un plantel</Text>
          <Text style={styles.envioNombre}>{envio.nombre}</Text>
          <Text style={styles.envioDetalle}>
            {envio.jugadores}{' '}
            {envio.jugadores === 1 ? 'jugador' : 'jugadores'} ·{' '}
            {envio.partidos}{' '}
            {envio.partidos === 1 ? 'partido' : 'partidos'}
          </Text>
          <View style={styles.envioBotones}>
            <Button
              title="Aceptar"
              onPress={() => resolver(envio.id, onAceptarEnvio)}
              disabled={resolviendo !== null}
              loading={resolviendo === envio.id}
              compacto
            />
            <Button
              title="Rechazar"
              onPress={() =>
                preguntar({
                  titulo: 'Rechazar el plantel',
                  mensaje: `Se descarta el que te mandó @${envio.de}. Si lo querés después, se lo vas a tener que pedir de nuevo.`,
                  confirmar: 'Rechazar',
                  peligro: true,
                  onConfirmar: () => resolver(envio.id, onRechazarEnvio),
                })
              }
              disabled={resolviendo !== null}
              variant="ghost"
              compacto
            />
          </View>
        </Panel>
      ))}

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
  envio: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    gap: 2,
  },
  envioDe: {
    color: colors.primary,
    fontSize: 11,
    fontFamily: 'Barlow_800ExtraBold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  envioNombre: {
    color: colors.text,
    fontSize: 17,
    fontFamily: 'Barlow_900Black',
  },
  envioDetalle: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: 'Barlow_400Regular',
  },
  envioBotones: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    height: 40,
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
