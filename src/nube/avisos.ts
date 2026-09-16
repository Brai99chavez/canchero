import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import { pedir } from './cliente';

/**
 * Los avisos que llegan al teléfono cuando alguien te escribe, te manda un
 * plantel o te agrega.
 *
 * Son lo que reemplaza al refresco periódico. Sin esto habría que preguntarle
 * al servidor cada tantos segundos si pasó algo, y como casi nunca pasa nada
 * eso es despertar la base de datos todo el día para que conteste que no.
 *
 * Adentro de Expo Go ni se lo toca. `expo-notifications` tiene un módulo que
 * corre solo al importarse y, en Android dentro de Expo Go, TIRA a propósito:
 * le sacaron esa parte en el SDK 53. Y como tira mientras se carga el módulo,
 * no alcanza con envolverlo en un try: la app no levantaba, "runtime not
 * ready" y pantalla roja.
 *
 * Así que se pregunta primero dónde está corriendo y recién después se lo
 * importa. Probando con Expo Go la app anda igual, sin avisos; en el APK los
 * avisos funcionan.
 */
type Notificaciones = typeof import('expo-notifications');

let modulo: Notificaciones | null = null;
let intentado = false;

async function notificaciones(): Promise<Notificaciones | null> {
  if (intentado) return modulo;
  intentado = true;
  // Adentro de Expo Go importarlo tira y se lleva puesta la app entera.
  if (isRunningInExpoGo()) return null;
  try {
    // Diferido a propósito: Metro lo mete igual en el bundle, pero no lo
    // evalúa hasta acá, que es cuando ya sabemos que se puede.
    modulo = await import('expo-notifications');
  } catch {
    modulo = null;
  }
  return modulo;
}

/** Lo que viaja adentro del aviso, para saber qué recargar. */
export interface Novedad {
  tipo: 'mensaje' | 'plantel' | 'amistad' | 'respuesta';
  /** El nombre de usuario del que la provocó. */
  de?: string;
}

function novedadDe(datos: unknown): Novedad | null {
  const d = datos as Record<string, unknown> | null;
  const tipo = d?.tipo;
  if (
    tipo !== 'mensaje' &&
    tipo !== 'plantel' &&
    tipo !== 'amistad' &&
    tipo !== 'respuesta'
  ) {
    return null;
  }
  return { tipo, de: typeof d?.de === 'string' ? d.de : undefined };
}

let tokenDeEsteTelefono: string | null = null;

/**
 * Pide permiso, consigue el token y se lo deja al servidor.
 *
 * Si algo falla no pasa nada grave: sin avisos la app sigue andando, sólo que
 * las novedades se ven al abrir la pantalla en vez de en el momento. Por eso
 * nunca tira error hacia afuera.
 */
export async function registrarTelefono(): Promise<void> {
  const N = await notificaciones();
  if (!N) return;

  try {
    // Con la app abierta, el aviso igual se ve y suena.
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    if (Platform.OS === 'android') {
      // Android exige un canal declarado o no muestra nada.
      await N.setNotificationChannelAsync('default', {
        name: 'CANCHERO',
        importance: N.AndroidImportance.DEFAULT,
        lightColor: '#4BF0A5',
      });
    }

    const { status } = await N.getPermissionsAsync();
    const permiso =
      status === 'granted'
        ? status
        : (await N.requestPermissionsAsync()).status;
    if (permiso !== 'granted') return;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    if (!projectId) return;

    const { data } = await N.getExpoPushTokenAsync({ projectId });
    tokenDeEsteTelefono = data;
    await pedir('/dispositivos', { metodo: 'POST', cuerpo: { token: data } });
  } catch {
    // Sin permiso, sin red o en Expo Go: se sigue sin avisos.
  }
}

/**
 * Este teléfono deja de recibir los avisos de esta cuenta. Va al cerrar
 * sesión: si no, al entrar otra persona le seguirían llegando los de la
 * anterior.
 */
export async function olvidarTelefono(): Promise<void> {
  if (!tokenDeEsteTelefono) return;
  const token = tokenDeEsteTelefono;
  tokenDeEsteTelefono = null;
  try {
    await pedir('/dispositivos', { metodo: 'DELETE', cuerpo: { token } });
  } catch {
    // Si no se pudo avisar, el servidor lo va a descartar solo la primera vez
    // que Expo le diga que ese teléfono ya no acepta avisos.
  }
}

/**
 * Avisa cuando llega una novedad, con la app abierta o al tocar el aviso.
 *
 * Las dos formas hacen falta: con la app en primer plano no hay nada que
 * tocar, y con la app cerrada lo único que se sabe es que la abrieron desde
 * el aviso.
 */
export function alLlegarNovedad(avisar: (n: Novedad) => void): () => void {
  let soltar: (() => void) | null = null;
  let vivo = true;

  notificaciones().then((N) => {
    if (!N || !vivo) return;
    try {
      const recibido = N.addNotificationReceivedListener((n) => {
        const novedad = novedadDe(n.request.content.data);
        if (novedad) avisar(novedad);
      });
      const tocado = N.addNotificationResponseReceivedListener((r) => {
        const novedad = novedadDe(r.notification.request.content.data);
        if (novedad) avisar(novedad);
      });
      soltar = () => {
        recibido.remove();
        tocado.remove();
      };
    } catch {
      // Sin parte nativa no hay a qué escuchar.
    }
  });

  return () => {
    vivo = false;
    soltar?.();
  };
}
