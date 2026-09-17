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
 * Busca si hay una versión nueva y se la baja.
 *
 * Devuelve si quedó una lista para usar. No la aplica: reiniciar la app en el
 * medio de algo es de lo más molesto que hay, y acá se está armando un partido
 * con gente esperando. Aplicarla es trabajo de `aplicarActualizacion`.
 *
 * No tira nunca. Sin señal esto falla, y es normal: la próxima vez se vuelve a
 * fijar. No hay nada que decirle a nadie.
 */
export async function buscarActualizacion(): Promise<boolean> {
  const mod = await updates();
  if (!mod?.isEnabled) return false;

  try {
    const hay = await mod.checkForUpdateAsync();
    if (!hay.isAvailable) return false;
    await mod.fetchUpdateAsync();
    return true;
  } catch {
    return false;
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
