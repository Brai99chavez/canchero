import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import { diferencia, Recordatorio } from '../recordatorios';
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

/**
 * Android exige un canal declarado o no muestra nada. Declararlo de nuevo no
 * cambia nada, así que se hace antes de cada cosa que lo necesita: los
 * recordatorios pueden programarse antes de que se registre el teléfono.
 */
async function asegurarCanal(N: Notificaciones): Promise<void> {
  if (Platform.OS !== 'android') return;
  await N.setNotificationChannelAsync('default', {
    name: 'CANCHERO',
    importance: N.AndroidImportance.DEFAULT,
    lightColor: '#4BF0A5',
  });
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

    await asegurarCanal(N);

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

/**
 * Deja programados en el teléfono los recordatorios de "¿cómo salió?", y
 * cancela los que ya no van: el partido tiene resultado, se borró o cambió de
 * día. Qué recordatorios van lo decide `recordatorios.ts`.
 *
 * Son avisos del propio teléfono, no del servidor: llegan aunque no haya
 * señal, y no hace falta que nadie los mande.
 *
 * Sin permiso no hace nada y no lo pide: el permiso se pide al registrar el
 * teléfono, con su propio momento. Pedirlo de nuevo acá sería insistirle a
 * alguien que ya dijo que no.
 */
export async function programarRecordatorios(
  queTocan: Recordatorio[]
): Promise<void> {
  const N = await notificaciones();
  if (!N) return;
  try {
    const { status } = await N.getPermissionsAsync();
    if (status !== 'granted') return;
    await asegurarCanal(N);

    const programados = await N.getAllScheduledNotificationsAsync();
    const { cancelar, programar } = diferencia(
      programados.map((p) => p.identifier),
      queTocan
    );
    for (const id of cancelar) {
      await N.cancelScheduledNotificationAsync(id);
    }
    for (const r of programar) {
      await N.scheduleNotificationAsync({
        identifier: r.id,
        content: {
          title: r.titulo,
          body: r.cuerpo,
          sound: 'default',
          data: { tipo: 'resultado', plantelId: r.plantelId, partidoId: r.partidoId },
        },
        trigger: {
          type: N.SchedulableTriggerInputTypes.DATE,
          date: r.cuando,
          channelId: 'default',
        },
      });
    }
  } catch {
    // Un recordatorio que no se pudo programar no puede romper nada: es una
    // ayuda, y la próxima vez que cambien los partidos se vuelve a intentar.
  }
}

/** El partido al que lleva un recordatorio. */
export interface PedidoDeResultado {
  plantelId: string;
  partidoId: string;
}

function pedidoDe(datos: unknown): PedidoDeResultado | null {
  const d = datos as Record<string, unknown> | null;
  if (d?.tipo !== 'resultado') return null;
  if (typeof d.plantelId !== 'string' || typeof d.partidoId !== 'string') {
    return null;
  }
  return { plantelId: d.plantelId, partidoId: d.partidoId };
}

/**
 * Avisa cuando alguien toca un recordatorio, para abrir ese partido directo
 * en el resultado.
 *
 * Las dos formas hacen falta, y la de la app cerrada es la más común: el
 * aviso llega a la mañana, con la app sin abrir desde el partido. En ese caso
 * el toque ya pasó cuando esto se engancha, y lo único que queda es preguntar
 * cuál fue el último.
 */
export function alTocarRecordatorio(
  abrir: (pedido: PedidoDeResultado) => void
): () => void {
  let soltar: (() => void) | null = null;
  let vivo = true;

  notificaciones().then((N) => {
    if (!N || !vivo) return;
    try {
      const ultimo = N.getLastNotificationResponse();
      const pedido = pedidoDe(ultimo?.notification.request.content.data);
      if (pedido) {
        // Se olvida enseguida: si no, cada vez que se vuelve a montar la
        // pantalla abriría de nuevo el mismo partido.
        N.clearLastNotificationResponse();
        abrir(pedido);
      }
      const tocado = N.addNotificationResponseReceivedListener((r) => {
        const p = pedidoDe(r.notification.request.content.data);
        if (p) abrir(p);
      });
      soltar = () => tocado.remove();
    } catch {
      // Sin parte nativa no hay a qué escuchar.
    }
  });

  return () => {
    vivo = false;
    soltar?.();
  };
}
