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
import { Objetivo } from './Guia';
import {
  BallIcon,
  ChartIcon,
  CheckListIcon,
  ClockIcon,
  PeopleIcon,
} from './icons';

export type TabKey =
  | 'plantel'
  | 'partido'
  | 'activos'
  | 'historial'
  | 'tabla';

const TABS: { key: TabKey; label: string; Icon: typeof PeopleIcon }[] = [
  { key: 'plantel', label: 'Plantel', Icon: PeopleIcon },
  { key: 'partido', label: 'Partido', Icon: BallIcon },
  { key: 'activos', label: 'En juego', Icon: ClockIcon },
  { key: 'historial', label: 'Jugados', Icon: CheckListIcon },
  { key: 'tabla', label: 'Tabla', Icon: ChartIcon },
];

/**
 * Barra inferior con una pastilla que se desliza hasta la pestaña activa.
 * El ancho se mide al vuelo, así no hay que asumir el tamaño de pantalla.
 */
export default function TabBar({
  activa,
  onChange,
}: {
  activa: TabKey;
  onChange: (tab: TabKey) => void;
}) {
  const [ancho, setAncho] = useState(0);
  const indice = TABS.findIndex((t) => t.key === activa);
  const deslizar = useRef(new Animated.Value(indice)).current;

  useEffect(() => {
    Animated.timing(deslizar, {
      toValue: indice,
      duration: tiempos.medio,
      easing: Easing.bezier(...tiempos.rebote),
      useNativeDriver: true,
    }).start();
  }, [indice, deslizar]);

  const anchoTab = ancho / TABS.length;
  // En las de los extremos, la pastilla acompaña la curva de la barra en vez
  // de quedar cortada contra ella.
  const primera = indice === 0;
  const ultima = indice === TABS.length - 1;

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
                      inputRange: TABS.map((_, i) => i),
                      outputRange: TABS.map((_, i) => i * anchoTab + 4),
                    }),
                  },
                ],
              },
            ]}
          >
            <FondoDegradado colores={degradados.acento} />
          </Animated.View>
        ) : null}

        {TABS.map((tab) => {
          const activo = tab.key === activa;
          const boton = (
            <Pressable
              onPress={() => onChange(tab.key)}
              style={styles.item}
            >
              <tab.Icon
                color={activo ? colors.sobreAcento : colors.textMuted}
                size={19}
              />
              <Text
                style={[styles.texto, activo && styles.textoActivo]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
          // La de Partido es un objetivo de la guía; las otras no.
          return tab.key === 'partido' ? (
            <Objetivo key={tab.key} paso="ir-a-partido" style={styles.celda}>
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
  texto: {
    color: colors.textMuted,
    // Con cinco pestañas manda el ancho: cuerpo chico y sin espaciado extra,
    // si no "EN JUEGO" no entra en pantallas angostas.
    fontSize: 9,
    fontFamily: 'Barlow_800ExtraBold',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  textoActivo: {
    color: colors.sobreAcento,
  },
});
