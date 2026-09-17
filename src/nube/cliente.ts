import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/client';
import { oneTimeTokenClient } from 'better-auth/client/plugins';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

/**
 * El enganche con la API (ver servidor/).
 *
 * `hayNube` en false es una copia de la app compilada sin servidor: ahí no se
 * pide cuenta y todo queda en el teléfono. No es el modo normal —hoy la app
 * guarda todo en el servidor y sin cuenta no se entra— pero deja que la app
 * siga siendo usable si alguna vez se compila sin backend.
 *
 * Acá sólo va la URL del servidor, que no es un secreto. La cadena de conexión
 * de la base y las claves del servidor viven en Render y no en la app, que es
 * un archivo que cualquiera se baja y descomprime.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;

function texto(valor: unknown): string {
  // Sin la barra final: después se le pegan los caminos.
  return typeof valor === 'string' ? valor.trim().replace(/\/+$/, '') : '';
}

export const API = texto(extra.apiUrl);
export const hayNube = Boolean(API);

/**
 * La sesión se guarda en el almacenamiento seguro del sistema y no junto a los
 * planteles: es la llave de la cuenta, no un dato más.
 */
export const authClient = hayNube
  ? createAuthClient({
      baseURL: API,
      plugins: [
        expoClient({ scheme: 'canchero', storage: SecureStore }),
        /*
         * Para entrar sola después de confirmar el mail. Eso pasa en el
         * navegador del teléfono, así que la sesión queda del lado del
         * navegador; el servidor manda un código de un solo uso en la vuelta y
         * esto lo canjea por la sesión de acá.
         */
        oneTimeTokenClient(),
      ],
    })
  : null;

export function clienteObligatorio() {
  if (!authClient) {
    throw new Error('La nube no está configurada en esta copia de la app.');
  }
  return authClient;
}


/**
 * Qué hacer cuando el servidor rechaza la sesión. Lo registra `cuenta.ts`; va
 * por acá para que este archivo no dependa de aquél y se arme un círculo.
 */
let avisarSesionPerdida: (() => void) | null = null;

export function alPerderSesion(f: () => void) {
  avisarSesionPerdida = f;
}

function legible(error: unknown): string {
  const mensaje = error instanceof Error ? error.message : String(error);
  if (/network|fetch|timeout|abort/i.test(mensaje)) {
    return 'No hay conexión con el servidor.';
  }
  return mensaje;
}

/**
 * Un pedido a nuestros endpoints, con la sesión adjunta.
 *
 * El plan gratis de Render apaga el servicio cuando no se usa y tarda en
 * despertar, así que el corte es generoso: cortar a los diez segundos daría
 * "sin conexión" cada vez que alguien es el primero del día en abrir la app.
 */
export async function pedir<T>(
  camino: string,
  opciones: { metodo?: string; cuerpo?: unknown } = {}
): Promise<T> {
  const cliente = clienteObligatorio();
  const cookie = await cliente.getCookie();

  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), 70_000);

  try {
    const respuesta = await fetch(`${API}${camino}`, {
      method: opciones.metodo ?? 'GET',
      headers: {
        cookie,

        ...(opciones.cuerpo ? { 'content-type': 'application/json' } : {}),
      },
      body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined,
      signal: corte.signal,
    });

    if (respuesta.status === 401) {
      avisarSesionPerdida?.();
      throw new Error('Se cerró la sesión. Entrá de nuevo.');
    }
    if (!respuesta.ok) {
      const detalle = await respuesta.json().catch(() => null);
      throw new Error(detalle?.error ?? `El servidor respondió ${respuesta.status}.`);
    }
    return (await respuesta.json()) as T;
  } catch (error) {
    throw new Error(legible(error));
  } finally {
    clearTimeout(reloj);
  }
}
