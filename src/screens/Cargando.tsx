import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { FondoDegradado } from '../components/Angular';
import { angulo, colors, degradados, tiempos } from '../theme';

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

export default function Cargando() {
  const correr = useRef(new Animated.Value(0)).current;
  const entrar = useRef(new Animated.Value(0)).current;

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
