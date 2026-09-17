import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, fuentes, spacing, tiempos } from '../theme';

/**
 * El aviso de que no hay internet, y el de que volvió.
 *
 * Es una barra que baja desde arriba y no una ventana que haya que cerrar, y
 * eso es a propósito: en una cancha la señal se va y vuelve sola diez veces
 * por partido. Una ventana en el medio habría que cerrarla cada vez, y encima
 * cortaría lo que se está haciendo para avisar de algo que no impide hacer
 * nada —la app anda igual sin internet, todo se guarda acá y sube después—.
 *
 * Ocupa lugar en vez de taparle la cabeza a la pantalla: puede quedarse un
 * buen rato, y algo que tapa el título o el botón de volver durante media hora
 * molesta más que lo que informa.
 */
export type EstadoConexion = 'sin' | 'volvio' | null;

const CARTELES = {
  sin: {
    color: colors.aviso,
    titulo: 'SIN CONEXIÓN',
    detalle: 'Seguí tranquilo: cuando vuelva se sincroniza todo solo.',
  },
  volvio: {
    color: colors.primary,
    titulo: 'VOLVIÓ LA CONEXIÓN',
    detalle: 'Ya está todo guardado en tu cuenta.',
  },
} as const;

export default function SinConexion({ estado }: { estado: EstadoConexion }) {
  const anim = useRef(new Animated.Value(0)).current;
  /*
   * Qué cartel dibujar, que no es lo mismo que cuál corresponde ahora: cuando
   * `estado` pasa a null todavía falta la animación de salida, y sin esto la
   * barra se quedaría vacía mientras se va.
   */
  const [mostrando, setMostrando] = useState<Exclude<EstadoConexion, null>>(
    estado ?? 'sin'
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
      <View style={[styles.punto, { backgroundColor: cartel.color }]} />
      <View style={styles.textos}>
        <Text style={[styles.titulo, { color: cartel.color }]}>
          {cartel.titulo}
        </Text>
        <Text style={styles.detalle}>{cartel.detalle}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1.5,
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
