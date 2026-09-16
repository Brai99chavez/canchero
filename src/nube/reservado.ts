import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * El nombre de usuario elegido al registrarse, hasta que se pueda guardar.
 *
 * Al crear la cuenta todavía no hay sesión —falta confirmar el mail— y sin
 * sesión no hay dónde guardarlo. Así que queda anotado en el teléfono y se
 * guarda solo la primera vez que se entra.
 *
 * Va al disco y no a memoria porque entre registrarse y confirmar el mail
 * pasan minutos y la app se cierra: en memoria se perdería y habría que
 * elegirlo de nuevo.
 *
 * Reservarlo de verdad en el servidor no se puede: habría que crear algo a
 * nombre de una cuenta que todavía no existe, y eso deja nombres tomados por
 * gente que nunca confirmó. Al entrar se vuelve a intentar, y si en el medio
 * alguien lo tomó, la app pide otro — que es lo que pasaba antes siempre y
 * ahora sólo en ese caso raro.
 */
const CLAVE = 'canchero.usuario.reservado';

export async function reservarNombre(nombre: string): Promise<void> {
  try {
    await AsyncStorage.setItem(CLAVE, nombre);
  } catch {
    // Sin esto sólo se pierde la comodidad: se pide al entrar, como antes.
  }
}

export async function nombreReservado(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

export async function olvidarNombreReservado(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CLAVE);
  } catch {
    // Si no se puede borrar, el próximo intento de guardarlo va a fallar
    // porque ya es tuyo, y ahí se limpia igual.
  }
}
