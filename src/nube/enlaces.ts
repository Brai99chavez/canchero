import * as Linking from 'expo-linking';

/**
 * Los links que abren la app desde afuera.
 *
 * Por ahora hay uno solo: el del mail para cambiar la contraseña. El servidor
 * verifica el token y redirige a `canchero://recuperar?token=...`, o a
 * `canchero://recuperar?error=INVALID_TOKEN` si venció o ya se usó.
 *
 * Sin alguien escuchando acá, ese mail no servía para nada: tocabas el botón,
 * se abría la app y no pasaba nada, porque nadie miraba con qué link había
 * arrancado.
 */
export interface Recuperacion {
  /** El token del mail, o null si el servidor lo rechazó. */
  token: string | null;
  /** Qué dijo el servidor cuando no hay token. */
  error: string | null;
}

function leer(url: string): Recuperacion | null {
  const { path, hostname, queryParams } = Linking.parse(url);
  /*
   * Dónde queda `recuperar` depende de con qué se abrió la app:
   *
   *   canchero://recuperar              -> host, y el camino viene vacío
   *   exp://ip:8081/--/recuperar        -> camino, con el `--/` adelante
   *
   * Lo segundo es Expo Go. El `--/` normalmente lo saca expo-linking solo,
   * pero no lo hace cuando la app declara su propio esquema —que es nuestro
   * caso— así que hay que sacarlo acá. Sin esto el link andaba en el APK y no
   * andaba probando, que es donde uno mira.
   */
  const destino = (path ?? hostname ?? '')
    .replace(/^\/+|\/+$/g, '')
    .replace(/^--\//, '');
  if (destino !== 'recuperar') return null;

  const uno = (valor: unknown) =>
    typeof valor === 'string' && valor.length > 0 ? valor : null;

  return {
    token: uno(queryParams?.token),
    error: uno(queryParams?.error),
  };
}

/**
 * Avisa cuando llega un link de recuperación, ahora o mientras la app está
 * abierta.
 *
 * Las dos formas hacen falta y no son la misma: si la app estaba cerrada, el
 * link ya se consumió antes de que esto corriera y sólo lo cuenta
 * `getInitialURL`; si estaba abierta, llega por el evento.
 */
export function alRecuperar(avisar: (dato: Recuperacion) => void): () => void {
  let vivo = true;

  Linking.getInitialURL().then((url) => {
    if (!vivo || !url) return;
    const dato = leer(url);
    if (dato) avisar(dato);
  });

  const sub = Linking.addEventListener('url', ({ url }) => {
    const dato = leer(url);
    if (dato) avisar(dato);
  });

  return () => {
    vivo = false;
    sub.remove();
  };
}

/**
 * La dirección a la que el servidor tiene que devolver el link del mail.
 *
 * En la app compilada es `canchero://recuperar`. Con Expo Go es
 * `exp://ip:8081/--/recuperar`, porque el que abre es Expo Go y no la app:
 * por eso se arma acá en vez de escribirse a mano.
 */
export function urlDeRecuperacion(): string {
  return Linking.createURL('recuperar');
}
