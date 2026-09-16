import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
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
 * Ojo al probar: los avisos remotos no funcionan dentro de Expo Go. Hace falta
 * el APK, que es donde los va a usar la gente igual.
 */

/** Con la app abierta, el aviso igual se ve y suena. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Lo que viaja adentro del aviso, para saber qué recargar. */
export interface Novedad {
  tipo: 'mensaje' | 'plantel' | 'amistad' | 'respuesta';
  /** El nombre de usuario del que la provocó. */
  de?: string;
}

function novedadDe(notificacion: Notifications.Notification): Novedad | null {
  const datos = notificacion.request.content.data as Record<string, unknown>;
  const tipo = datos?.tipo;
  if (
    tipo !== 'mensaje' &&
    tipo !== 'plantel' &&
    tipo !== 'amistad' &&
    tipo !== 'respuesta'
  ) {
    return null;
  }
  return { tipo, de: typeof datos.de === 'string' ? datos.de : undefined };
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
  try {
    if (Platform.OS === 'android') {
      // Android exige un canal declarado o no muestra nada.
      await Notifications.setNotificationChannelAsync('default', {
        name: 'CANCHERO',
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: '#4BF0A5',
      });
    }

    const { status } = await Notifications.getPermissionsAsync();
    const permiso =
      status === 'granted'
        ? status
        : (await Notifications.requestPermissionsAsync()).status;
    if (permiso !== 'granted') return;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (!projectId) return;

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
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
  try {
    await pedir('/dispositivos', {
      metodo: 'DELETE',
      cuerpo: { token: tokenDeEsteTelefono },
    });
  } catch {
    // Si no se pudo avisar, el servidor lo va a descartar solo la primera vez
    // que Expo le diga que ese teléfono ya no acepta avisos.
  }
  tokenDeEsteTelefono = null;
}

/**
 * Avisa cuando llega una novedad, con la app abierta o al tocar el aviso.
 *
 * Las dos formas hacen falta: con la app en primer plano no hay nada que
 * tocar, y con la app cerrada lo único que se sabe es que la abrieron desde
 * el aviso.
 */
export function alLlegarNovedad(avisar: (n: Novedad) => void): () => void {
  const recibido = Notifications.addNotificationReceivedListener((n) => {
    const novedad = novedadDe(n);
    if (novedad) avisar(novedad);
  });
  const tocado = Notifications.addNotificationResponseReceivedListener((r) => {
    const novedad = novedadDe(r.notification);
    if (novedad) avisar(novedad);
  });
  return () => {
    recibido.remove();
    tocado.remove();
  };
}
