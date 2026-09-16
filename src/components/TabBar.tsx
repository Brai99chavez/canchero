import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  angulo,
  colors,
  degradados,
  radius,
  spacing,
  tiempos,
} from '../theme';
import { FondoDegradado } from './Angular';
import { Objetivo, PasoGuia } from './Guia';
import {
  BallIcon,
  ChartIcon,
  ChatIcon,
  CheckListIcon,
  ClockIcon,
  PeopleIcon,
  UserIcon,
} from './icons';

export type TabKey =
  | 'plantel'
  | 'partido'
  | 'activos'
  | 'historial'
  | 'tabla';

/** Las tres secciones de arriba de todo, antes de entrar a un plantel. */
export type SeccionKey = 'perfil' | 'planteles' | 'amigos';

export interface Pestania<K extends string> {
  key: K;
  label: string;
  Icon: typeof PeopleIcon;
  /** Si es un hito de la guía, cuál. */
  paso?: PasoGuia;
  /** Un número encima del ícono: lo que hay sin mirar. */
  pendientes?: number;
}

const TABS: Pestania<TabKey>[] = [
  { key: 'plantel', label: 'Plantel', Icon: PeopleIcon },
  { key: 'partido', label: 'Partido', Icon: BallIcon, paso: 'ir-a-partido' },
  { key: 'activos', label: 'Activos', Icon: ClockIcon },
  { key: 'historial', label: 'Historial', Icon: CheckListIcon },
  { key: 'tabla', label: 'Tabla', Icon: ChartIcon },
];

/**
 * Barra inferior con una pastilla que se desliza hasta la pestaña activa.
 * El ancho se mide al vuelo, así no hay que asumir el tamaño de pantalla.
 *
 * Sirve para las dos barras de la app —las secciones de arriba y las pestañas
 * de adentro de un plantel— porque son la misma cosa con otros rótulos. Una
 * segunda copia con tres items en vez de cinco se iba a despegar de ésta al
 * primer retoque.
 */
export function Barra<K extends string>({
  items,
  activa,
  onChange,
}: {
  items: Pestania<K>[];
  activa: K;
  onChange: (tab: K) => void;
}) {
  const [ancho, setAncho] = useState(0);
  const indice = Math.max(
    items.findIndex((t) => t.key === activa),
    0
  );
  const deslizar = useRef(new Animated.Value(indice)).current;

  useEffect(() => {
    Animated.timing(deslizar, {
      toValue: indice,
      duration: tiempos.medio,
      easing: Easing.bezier(...tiempos.rebote),
      useNativeDriver: true,
    }).start();
  }, [indice, deslizar]);

  const anchoTab = ancho / items.length;
  // En las de los extremos, la pastilla acompaña la curva de la barra en vez
  // de quedar cortada contra ella.
  const primera = indice === 0;
  const ultima = indice === items.length - 1;

  return (
    <View style={styles.contenedor}>
      <View
        style={styles.barra}
        onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
      >
        {ancho > 0 ? (
          <Animated.View
            style={[
              styles.pastilla,
              primera && styles.pastillaIzquierda,
              ultima && styles.pastillaDerecha,
              {
                width: anchoTab - 8,
                transform: [
                  {
                    translateX: deslizar.interpolate({
                      inputRange: items.map((_, i) => i),
                      outputRange: items.map((_, i) => i * anchoTab + 4),
                    }),
                  },
                ],
              },
            ]}
          >
            <FondoDegradado colores={degradados.acento} />
          </Animated.View>
        ) : null}

        {items.map((tab) => {
          const activo = tab.key === activa;
          const boton = (
            <Pressable onPress={() => onChange(tab.key)} style={styles.item}>
              <View>
                <tab.Icon
                  color={activo ? colors.sobreAcento : colors.textMuted}
                  size={19}
                />
                {/*
                  El globito va sobre el ícono y no al lado del rótulo: al lado
                  empujaría el texto y las pestañas dejarían de medir igual.
                */}
                {tab.pendientes ? (
                  <View style={styles.globo}>
                    <Text style={styles.globoTexto}>
                      {tab.pendientes > 9 ? '9+' : tab.pendientes}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={[styles.texto, activo && styles.textoActivo]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
          return tab.paso ? (
            <Objetivo key={tab.key} paso={tab.paso} style={styles.celda}>
              {boton}
            </Objetivo>
          ) : (
            <View key={tab.key} style={styles.celda}>
              {boton}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Las pestañas de adentro de un plantel. */
export default function TabBar({
  activa,
  onChange,
}: {
  activa: TabKey;
  onChange: (tab: TabKey) => void;
}) {
  return <Barra items={TABS} activa={activa} onChange={onChange} />;
}

/**
 * Las secciones de arriba de todo. Planteles va al medio y es la que abre: es
 * a lo que se entra a la app, las otras dos son de vez en cuando.
 */
export function NavPrincipal({
  activa,
  onChange,
  pendientes,
}: {
  activa: SeccionKey;
  onChange: (seccion: SeccionKey) => void;
  /** Solicitudes y mensajes sin mirar, para el globito de Amigos. */
  pendientes: number;
}) {
  const items: Pestania<SeccionKey>[] = [
    { key: 'perfil', label: 'Perfil', Icon: UserIcon },
    { key: 'planteles', label: 'Planteles', Icon: PeopleIcon },
    { key: 'amigos', label: 'Amigos', Icon: ChatIcon, pendientes },
  ];
  return <Barra items={items} activa={activa} onChange={onChange} />;
}

const styles = StyleSheet.create({
  contenedor: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bg,
  },
  barra: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    // La pastilla va inclinada: sin esto sus puntas se salen de la barra, y
    // sus esquinas rectas asoman por fuera de la curva del borde.
    overflow: 'hidden',
  },
  pastilla: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 0,
    overflow: 'hidden',
    transform: [{ skewX: angulo.inclinacion }],
  },
  // El radio de la barra menos su relleno: así la curva de adentro queda
  // concéntrica con la de afuera en vez de parecer otra curva.
  pastillaIzquierda: {
    borderTopLeftRadius: radius.lg - 4,
    borderBottomLeftRadius: radius.lg - 4,
  },
  pastillaDerecha: {
    borderTopRightRadius: radius.lg - 4,
    borderBottomRightRadius: radius.lg - 4,
  },
  celda: { flex: 1 },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  globo: {
    position: 'absolute',
    top: -5,
    right: -9,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  globoTexto: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: 'Barlow_800ExtraBold',
  },
  texto: {
    color: colors.textMuted,
    // Con cinco pestañas manda el ancho: cuerpo chico y sin espaciado extra,
    // si no "HISTORIAL" no entra en pantallas angostas.
    fontSize: 9,
    fontFamily: 'Barlow_800ExtraBold',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  textoActivo: {
    color: colors.sobreAcento,
  },
});
