import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fuentes, spacing, tiempos } from '../theme';

/**
 * La barra que baja desde arriba para contar algo que pasa solo.
 *
 * Es una barra y no una ventana a propósito: en una cancha la señal se va y
 * vuelve diez veces por partido. Una ventana habría que cerrarla cada vez, y
 * encima cortaría lo que se está haciendo para avisar de algo que no impide
 * hacer nada —la app anda igual sin internet, todo se guarda acá y sube
 * después—.
 *
 * Ocupa lugar en vez de taparle la cabeza a la pantalla: puede quedarse un
 * buen rato, y algo que tapa el título o el botón de volver durante media hora
 * molesta más que lo que informa.
 */
export type EstadoCartel =
  | 'sin-conexion'
  | 'volvio'
  | 'bajando'
  | 'lista'
  | null;

const CARTELES = {
  'sin-conexion': {
    color: colors.aviso,
    titulo: 'SIN CONEXIÓN',
    detalle: 'Seguí tranquilo: cuando vuelva se sincroniza todo solo.',
  },
  volvio: {
    color: colors.primary,
    titulo: 'VOLVIÓ LA CONEXIÓN',
    detalle: 'Ya está todo guardado en tu cuenta.',
  },
  bajando: {
    color: colors.teamB,
    titulo: 'BAJANDO UNA VERSIÓN NUEVA',
    detalle: 'Seguí usando la app, esto pasa de fondo.',
  },
  lista: {
    color: colors.primary,
    titulo: 'VERSIÓN NUEVA LISTA',
    detalle: 'Tocá para usarla ahora, o se pone sola la próxima vez que abras.',
  },
} as const;

export default function Cartel({
  estado,
  onPress,
}: {
  estado: EstadoCartel;
  /** Sólo hace algo en los estados que se pueden tocar. */
  onPress?: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  /*
   * Qué cartel dibujar, que no es lo mismo que cuál corresponde ahora: cuando
   * `estado` pasa a null todavía falta la animación de salida, y sin esto la
   * barra se quedaría vacía mientras se va.
   */
  const [mostrando, setMostrando] = useState<Exclude<EstadoCartel, null>>(
    estado ?? 'sin-conexion'
  );
  const [montado, setMontado] = useState(estado !== null);

  useEffect(() => {
    if (estado) {
      setMostrando(estado);
      setMontado(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: tiempos.medio,
        easing: Easing.bezier(...tiempos.filoso),
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.timing(anim, {
      toValue: 0,
      duration: tiempos.corto,
      easing: Easing.bezier(...tiempos.filoso),
      useNativeDriver: true,
    }).start(({ finished }) => {
      // Si la animación se cortó es porque volvió a aparecer: desmontarlo ahí
      // lo haría parpadear.
      if (finished) setMontado(false);
    });
  }, [estado, anim]);

  if (!montado) return null;

  const cartel = CARTELES[mostrando];
  const tocable = mostrando === 'lista' && onPress !== undefined;

  return (
    <Animated.View
      style={[
        styles.barra,
        { borderBottomColor: cartel.color },
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [-44, 0],
              }),
            },
          ],
        },
      ]}
      // Que el lector de pantalla lo diga cuando aparece, sin que haya que ir
      // a buscarlo.
      accessibilityLiveRegion="polite"
    >
      <Pressable
        style={styles.toque}
        onPress={tocable ? onPress : undefined}
        disabled={!tocable}
        accessibilityRole={tocable ? 'button' : undefined}
      >
        <View style={[styles.punto, { backgroundColor: cartel.color }]} />
        <View style={styles.textos}>
          <Text style={[styles.titulo, { color: cartel.color }]}>
            {cartel.titulo}
          </Text>
          <Text style={styles.detalle}>{cartel.detalle}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  barra: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1.5,
  },
  // El área tocable es toda la barra y no sólo el texto: un blanco chico en un
  // cartel que aparece solo se falla más de lo que se acierta.
  toque: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  punto: { width: 8, height: 8, borderRadius: 4 },
  textos: { flex: 1 },
  titulo: {
    fontSize: 11,
    fontFamily: fuentes.extra,
    letterSpacing: 0.8,
  },
  detalle: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fuentes.regular,
    lineHeight: 15,
    marginTop: 1,
  },
});
