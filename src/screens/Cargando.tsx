import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FondoDegradado } from '../components/Angular';
import { angulo, colors, degradados, fuentes, spacing, tiempos } from '../theme';

/**
 * Lo que se ve mientras cargan las tipografías y los planteles guardados.
 *
 * Usa el mismo archivo que el splash nativo y al mismo tamaño: `imageWidth`
 * en la configuración de `expo-splash-screen` y `ANCHO_LOGO` acá valen lo
 * mismo. Así el paso del splash del sistema a esta pantalla no se ve; lo único
 * que aparece es la barra de abajo.
 */
const ANCHO_LOGO = 320;
const PISTA = 132;
const SEGMENTO = 48;

/**
 * Cuánto se espera antes de explicar la demora.
 *
 * Con el servidor despierto esto no llega nunca: la pantalla dura un segundo
 * y el cartel no aparece. Sale sólo cuando de verdad está tardando, que es
 * cuando hace falta decir algo.
 */
const ANTES_DE_EXPLICAR = 4000;

export default function Cargando({
  esperandoAlServidor = false,
}: {
  /** Si lo que falta es que conteste el servidor, y no algo de acá. */
  esperandoAlServidor?: boolean;
}) {
  const correr = useRef(new Animated.Value(0)).current;
  const entrar = useRef(new Animated.Value(0)).current;
  const aviso = useRef(new Animated.Value(0)).current;
  const [explicar, setExplicar] = useState(false);

  /*
   * El plan gratis de Render apaga el servicio cuando nadie lo usa, y el
   * primero del día espera a que arranque. Sin decir nada parece que la app se
   * colgó: uno sabe por qué pasa, el que la abre por primera vez no.
   */
  useEffect(() => {
    if (!esperandoAlServidor) {
      setExplicar(false);
      return;
    }
    const reloj = setTimeout(() => setExplicar(true), ANTES_DE_EXPLICAR);
    return () => clearTimeout(reloj);
  }, [esperandoAlServidor]);

  useEffect(() => {
    if (!explicar) return;
    // Aparece con una transición: un cartel que salta de golpe asusta más de
    // lo que tranquiliza.
    Animated.timing(aviso, {
      toValue: 1,
      duration: tiempos.medio,
      easing: Easing.bezier(...tiempos.filoso),
      useNativeDriver: true,
    }).start();
  }, [explicar, aviso]);

  useEffect(() => {
    // La barra entra tarde a propósito: si apareciera en el primer cuadro se
    // notaría el corte con el splash del sistema, que no la tiene.
    const aparecer = Animated.timing(entrar, {
      toValue: 1,
      duration: tiempos.medio,
      delay: 320,
      useNativeDriver: true,
    });
    const vaiven = Animated.loop(
      Animated.sequence([
        Animated.timing(correr, {
          toValue: 1,
          duration: 620,
          easing: Easing.bezier(...tiempos.filoso),
          useNativeDriver: true,
        }),
        Animated.timing(correr, {
          toValue: 0,
          duration: 620,
          easing: Easing.bezier(...tiempos.filoso),
          useNativeDriver: true,
        }),
      ])
    );
    aparecer.start();
    vaiven.start();
    return () => {
      aparecer.stop();
      vaiven.stop();
    };
  }, [correr, entrar]);

  return (
    <View style={styles.fondo}>
      <Image
        source={require('../../assets/splash-icon.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      <Animated.View style={[styles.pista, { opacity: entrar }]}>
        <Animated.View
          style={[
            styles.segmento,
            {
              transform: [
                {
                  translateX: correr.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, PISTA - SEGMENTO],
                  }),
                },
              ],
            },
          ]}
        >
          <FondoDegradado colores={degradados.acento} />
        </Animated.View>
      </Animated.View>

      {explicar ? (
        <Animated.View style={[styles.aviso, { opacity: aviso }]}>
          <Text style={styles.avisoTitulo}>DESPERTANDO EL SERVIDOR</Text>
          <Text style={styles.avisoTexto}>
            Se apaga solo cuando nadie lo usa un rato. Suele tardar menos de un
            minuto, y pasa una vez por día.
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: ANCHO_LOGO, maxWidth: '100%', aspectRatio: 1 },
  // Debajo de la barra, no encima: la barra dice "está cargando" y esto dice
  // por qué tarda. Ese es el orden en que se leen.
  aviso: {
    position: 'absolute',
    bottom: '7%',
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    gap: 4,
  },
  avisoTitulo: {
    color: colors.primary,
    fontSize: 11,
    fontFamily: fuentes.extra,
    letterSpacing: 1,
  },
  avisoTexto: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fuentes.regular,
    lineHeight: 17,
    textAlign: 'center',
  },
  pista: {
    position: 'absolute',
    bottom: '16%',
    width: PISTA,
    height: 5,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
    transform: [{ skewX: angulo.inclinacion }],
  },
  segmento: { width: SEGMENTO, height: '100%' },
});
