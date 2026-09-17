import { isRunningInExpoGo } from 'expo';

/**
 * Las actualizaciones que llegan solas, sin bajar un APK nuevo.
 *
 * Lo que se puede actualizar así es todo lo que está escrito en JavaScript:
 * las pantallas, los textos, las reglas, los arreglos. Lo que no se puede es
 * lo nativo — agregar o sacar un módulo del sistema, tocar los permisos, el
 * ícono, el nombre del paquete o subir de versión de Expo—. Eso sigue pidiendo
 * una instalación nueva.
 *
 * `runtimeVersion` está en `fingerprint`, así que el propio EAS calcula una
 * huella de la parte nativa: una actualización nunca le llega a una
 * instalación que no la pueda correr. Sin eso habría que acordarse de subir el
 * número a mano cada vez que cambia algo nativo, y el día que uno se olvida la
 * app se cierra sola en el teléfono de otro.
 *
 * Nada de esto corre en Expo Go ni en desarrollo: ahí el que manda es Metro.
 */
type Updates = typeof import('expo-updates');

let modulo: Updates | null = null;
let intentado = false;

async function updates(): Promise<Updates | null> {
  if (intentado) return modulo;
  intentado = true;
  // Mismo cuidado que con las notificaciones: primero dónde estamos, después
  // el import. Un módulo nativo que no está no tiene por qué tirar la app.
  if (__DEV__ || isRunningInExpoGo()) return null;
  try {
    modulo = await import('expo-updates');
  } catch {
    modulo = null;
  }
  return modulo;
}

/**
 * Si hay una versión nueva esperando.
 *
 * Va separado de bajarla a propósito: preguntar es un pedido chico y rápido,
 * bajarla puede tardar. Sabiendo primero si hay algo, la pantalla puede
 * mostrar "bajando" sólo cuando de verdad se está bajando algo, y no cada vez
 * que la app arranca.
 *
 * No tira nunca. Sin señal esto falla, y es normal: la próxima vez se vuelve a
 * fijar. No hay nada que decirle a nadie.
 */
export async function hayActualizacion(): Promise<boolean> {
  const mod = await updates();
  if (!mod?.isEnabled) return false;
  try {
    return (await mod.checkForUpdateAsync()).isAvailable;
  } catch {
    return false;
  }
}

/**
 * Se baja la versión nueva y la deja lista.
 *
 * No la aplica: reiniciar la app en el medio de algo es de lo más molesto que
 * hay, y acá se puede estar armando un partido con gente esperando. Aplicarla
 * es trabajo de `aplicarActualizacion`.
 *
 * Lo que baja queda guardado en el teléfono. Cerrar la app no lo borra: si no
 * se aplica antes, `expo-updates` arranca solo con la versión nueva la próxima
 * vez que la app se abra de cero.
 */
export async function bajarActualizacion(): Promise<boolean> {
  const mod = await updates();
  if (!mod?.isEnabled) return false;
  try {
    await mod.fetchUpdateAsync();
    return true;
  } catch {
    return false;
  }
}

/**
 * Qué versión está corriendo, para mostrarla y para poder preguntarla.
 *
 * El número de la app no alcanza. Con las actualizaciones por aire, dos
 * personas con "1.0.0" pueden tener JavaScript distinto: una aplicó la última
 * y la otra no. Cuando alguien dice "no me anda", lo que hace falta saber es
 * exactamente qué código tiene, y eso lo dice el id de la actualización.
 *
 * `null` es la versión que vino adentro del APK, sin ninguna encima.
 */
export async function idDeLaVersion(): Promise<string | null> {
  const mod = await updates();
  if (!mod?.isEnabled) return null;
  try {
    return mod.updateId ?? null;
  } catch {
    return null;
  }
}

/** Arranca de nuevo con la versión que ya está bajada. */
export async function aplicarActualizacion(): Promise<void> {
  const mod = await updates();
  if (!mod?.isEnabled) return;
  try {
    await mod.reloadAsync();
  } catch {
    /*
     * Si no se puede reiniciar, no pasa nada: la versión bajada queda ahí y
     * `expo-updates` la usa sola la próxima vez que la app arranque de cero.
     */
  }
}
