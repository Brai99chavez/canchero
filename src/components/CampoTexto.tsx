import React from 'react';
import {
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { colors, fuentes, spacing } from '../theme';
import Panel, { DIAGONAL } from './Angular';

/**
 * Un campo de texto con la esquina cortada, igual que los planteles y los
 * botones. Antes cada pantalla se armaba el suyo con `borderRadius`, así que
 * eran la única parte de la app con las esquinas redondeadas y además había
 * ocho copias del mismo estilo.
 *
 * `izquierda` y `derecha` son para lo que va adentro del recuadro sin ser
 * texto: la arroba del nombre de usuario, el ojo de ver la contraseña. Van
 * como hermanos del campo y no encima, para que el texto no se les meta abajo.
 */
export default function CampoTexto({
  izquierda,
  derecha,
  contenedor,
  style,
  multiline,
  ...resto
}: TextInputProps & {
  izquierda?: React.ReactNode;
  derecha?: React.ReactNode;
  /** El recuadro entero: márgenes, ancho, lo que lo acomoda en la pantalla. */
  contenedor?: StyleProp<ViewStyle>;
}) {
  return (
    <Panel
      style={[styles.caja, multiline && styles.cajaAlta, contenedor]}
      esquinas={DIAGONAL}
      chaflan={10}
      fondo={colors.surface}
      borde={colors.border}
      grosor={1}
    >
      {izquierda ? <View style={styles.adorno}>{izquierda}</View> : null}
      <TextInput
        {...resto}
        multiline={multiline}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, style]}
      />
      {derecha ? <View style={styles.adorno}>{derecha}</View> : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  caja: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  // Con varias líneas los adornos van arriba, no centrados contra un campo
  // que crece hacia abajo.
  cajaAlta: { alignItems: 'flex-end' },
  adorno: { justifyContent: 'center' },
  input: {
    flex: 1,
    paddingVertical: 13,
    color: colors.text,
    fontSize: 16,
    fontFamily: fuentes.regular,
  },
});
