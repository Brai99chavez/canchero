import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';

/**
 * El reporte de errores.
 *
 * Existe por una razón concreta: hoy un error de programación cerraba la app
 * al entrar a un partido activo, y se supo porque justo alguien la estaba
 * usando y lo contó. Con gente que no está al lado, lo que llega es "no me
 * anda" por WhatsApp — sin pantalla, sin pasos y sin saber dónde.
 *
 * El DSN no es un secreto: viaja adentro de la app y lo único que permite es
 * mandarle errores a este proyecto. Lo que sí es secreto es el token que sube
 * los mapas de código, y ése vive en EAS, no acá.
 *
 * Sin DSN configurado esto no hace nada y la app anda igual.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
const DSN = typeof extra.sentryDsn === 'string' ? extra.sentryDsn.trim() : '';

type Sentry = typeof import('@sentry/react-native');

let modulo: Sentry | null = null;

/**
 * Se prende una sola vez, al arrancar.
 *
 * En Expo Go no: ahí lo que corre es código en desarrollo que cambia cada vez
 * que se guarda un archivo, y llenaría el panel de errores que ya se están
 * arreglando. El import va diferido por el mismo cuidado que el resto de los
 * módulos nativos.
 */
export function prenderElReporte(): void {
  if (__DEV__ || isRunningInExpoGo() || !DSN) return;

  import('@sentry/react-native')
    .then((S) => {
      modulo = S;
      S.init({
        dsn: DSN,
        /*
         * Sin trazas de rendimiento: lo que hace falta es enterarse de lo que
         * se rompe, y cada traza consume de la cuota mensual gratis igual que
         * un error. Con dos apps compartiendo esa cuota, gastarla en medir
         * tiempos sería quedarse sin margen para lo que importa.
         */
        tracesSampleRate: 0,
        /*
         * La versión que está corriendo de verdad. Con las actualizaciones por
         * aire, dos personas con la misma versión de la app pueden tener
         * JavaScript distinto: sin esto, un error podría atribuirse a código
         * que ya se arregló.
         */
        release: `canchero@${Constants.expoConfig?.version ?? '0.0.0'}`,
      });
    })
    .catch(() => {
      // Que no se pueda reportar errores no puede ser, justamente, un error.
    });
}

/**
 * Deja anotado quién lo vivió, para poder juntar los errores de una misma
 * persona. Va el id de la cuenta y nada más: ni el mail ni el nombre, que no
 * hacen falta para arreglar un bug.
 */
export function quienEs(id: string | null): void {
  modulo?.setUser(id ? { id } : null);
}

/** Un error que se atajó pero conviene mirar. */
export function avisarDelError(error: unknown): void {
  modulo?.captureException(error);
}
