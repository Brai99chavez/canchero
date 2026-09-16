import React from 'react';
import { Keyboard, TouchableWithoutFeedback } from 'react-native';

/**
 * Tocar en cualquier lado que no sea un campo cierra el teclado.
 *
 * Sin esto hay que bajarlo con el botón del sistema, que además tapa media
 * pantalla mientras tanto: escribís el nombre de un jugador, querés tocar
 * Guardar, y el botón está abajo del teclado.
 *
 * No se traga los toques: el sistema de gestos de React Native le da primero
 * la chance a lo que esté abajo del dedo, así que un botón sigue andando de un
 * solo toque y sólo llega acá lo que nadie usó. Por eso los listados y las
 * pantallas con scroll llevan además `keyboardShouldPersistTaps="handled"`:
 * sin eso, el primer toque con el teclado abierto lo consume el scroll y hay
 * que tocar el botón dos veces.
 *
 * Va por modal y no una sola vez en la raíz porque cada modal es su propia
 * ventana del sistema: lo que envuelve a la app no alcanza a los de adentro.
 */
export default function CierraTeclado({
  children,
}: {
  /** Un solo elemento: se le enganchan los toques al que ya está ahí, sin
   *  meter una vista de más que desacomode el layout. */
  children: React.ReactElement;
}) {
  return (
    <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
      {children}
    </TouchableWithoutFeedback>
  );
}
