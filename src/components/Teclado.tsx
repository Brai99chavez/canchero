import React from 'react';
import { Keyboard, TouchableWithoutFeedback } from 'react-native';

/**
 * Tocar en cualquier lado que no sea un campo cierra el teclado.
 *
 * Sin esto hay que bajarlo con el botón del sistema, que además tapa media
 * pantalla mientras tanto: escribís el nombre de un jugador, querés tocar
 * Guardar, y el botón está abajo del teclado.
 *
 * IMPORTANTE: no envolver nada que tenga adentro un ScrollView o un FlatList.
 * Esto se queda con el toque apenas empieza y el scroll nunca recibe el
 * movimiento, así que la lista deja de correr. Pasó: los partidos activos no
 * se podían scrollear para ver los dos equipos.
 *
 * Ahí no hace falta igual. Un ScrollView con `keyboardShouldPersistTaps="handled"`
 * ya cierra el teclado solo cuando el toque no lo usa ninguno de sus hijos, que
 * es exactamente lo mismo que hace esto. Por eso todas las listas de la app
 * llevan esa prop, y esto queda sólo para las pantallas que no scrollean.
 *
 * Y va por pantalla, no una vez en la raíz: cada modal es su propia ventana
 * del sistema, y lo que envuelve a la app no alcanza a los de adentro.
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
