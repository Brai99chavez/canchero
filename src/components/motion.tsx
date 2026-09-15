import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { tiempos } from '../theme';

/**
 * El `Pressable` es el que se anima. Envolverlo en un `View` aparte parece
 * equivalente, pero deja el estilo en el hijo: los `flex` y los márgenes le
 * llegarían al de adentro y no al que pelea por el espacio con sus hermanos.
 */
const PressableAnimado = Animated.createAnimatedComponent(Pressable);

/**
 * Lo que se toca se hunde un poco. Es el detalle que hace que la app se sienta
 * viva sin que nadie sepa por qué.
 */
export function Presionable({
  children,
  style,
  escala = 0.97,
  ...props
}: PressableProps & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  escala?: number;
}) {
  const anim = useRef(new Animated.Value(1)).current;

  const animar = (hacia: number) =>
    Animated.spring(anim, {
      toValue: hacia,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();

  return (
    <PressableAnimado
      {...props}
      onPressIn={(e) => {
        animar(escala);
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animar(1);
        props.onPressOut?.(e);
      }}
      style={[style, { transform: [{ scale: anim }] }]}
    >
      {children}
    </PressableAnimado>
  );
}

/**
 * Aparece subiendo apenas. `llave` reinicia la animación: cambiándola en cada
 * pestaña, el contenido entra de nuevo cada vez que se cambia de vista.
 */
export function Aparecer({
  children,
  llave,
  style,
  desplazamiento = 10,
  duracion = tiempos.medio,
}: {
  children: React.ReactNode;
  llave?: string | number;
  style?: StyleProp<ViewStyle>;
  desplazamiento?: number;
  duracion?: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: duracion,
      easing: Easing.bezier(...tiempos.filoso),
      useNativeDriver: true,
    }).start();
  }, [llave, anim, duracion]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [
            {
              // Entra desde la izquierda y en diagonal: el mismo sesgo que
              // tienen los bloques, aplicado al movimiento.
              translateX: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [desplazamiento * 1.6, 0],
              }),
            },
            {
              skewX: anim.interpolate({
                inputRange: [0, 1],
                outputRange: ['-6deg', '0deg'],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
