import { olvidarTelefono } from './avisos';
import { urlDeRecuperacion } from './enlaces';
import { borrarTodo } from '../storage';
import { olvidarPerfil } from './perfil';
import { alPerderSesion, authClient, clienteObligatorio } from './cliente';

export interface Sesion {
  id: string;
  email: string;
}

/**
 * Qué mostrar cuando algo falla. Los mensajes del servidor vienen en inglés y
 * bastante secos, así que se traducen los que un usuario puede provocar.
 *
 * Cada uno lleva un detalle con qué hacer al respecto: decir "mail o
 * contraseña incorrectos" y nada más deja a la persona probando lo mismo de
 * nuevo. El que no reconocemos pasa tal cual, que es más útil que un "algo
 * salió mal" sin información.
 */
export interface Explicacion {
  titulo: string;
  detalle: string;
}

export function explicar(error: unknown): Explicacion {
  const crudo = error instanceof Error ? error.message : String(error);
  const m = crudo.toLowerCase();

  if (m.includes('invalid email or password') || m.includes('invalid credentials')) {
    return {
      titulo: 'Mail o contraseña incorrectos',
      detalle:
        'Revisá que no se haya colado un espacio ni las mayúsculas. Si nunca ' +
        'creaste la cuenta, tocá "No tengo cuenta" y registrate.',
    };
  }
  if (m.includes('already exists') || m.includes('already registered')) {
    return {
      titulo: 'Ese mail ya tiene cuenta',
      detalle: 'Tocá "Ya tengo cuenta" y entrá con tu contraseña.',
    };
  }
  if (m.includes('password') && (m.includes('short') || m.includes('length'))) {
    return {
      titulo: 'Contraseña muy corta',
      detalle: 'Tiene que tener 8 caracteres o más.',
    };
  }
  if (m.includes('invalid email')) {
    return {
      titulo: 'Ese mail no parece válido',
      detalle: 'Fijate que tenga arroba y que no falte nada después del punto.',
    };
  }
  if (m.includes('not verified') || m.includes('verify')) {
    return {
      titulo: 'Falta confirmar tu mail',
      detalle:
        'Te mandamos un link cuando creaste la cuenta. Buscalo en tu casilla ' +
        '—fijate también en spam— y tocalo para poder entrar.',
    };
  }
  if (m.includes('invalid token') || m.includes('expired')) {
    return {
      titulo: 'Ese link ya no sirve',
      detalle:
        'Los links para cambiar la contraseña duran una hora y se usan una ' +
        'sola vez. Pedí uno nuevo desde "Olvidé mi contraseña".',
    };
  }
  if (m.includes('no hay nadie que se llame')) {
    return {
      titulo: 'No encontramos a esa persona',
      detalle:
        'Fijate que el nombre esté bien escrito. Tiene que ser el que eligió ' +
        'en su perfil, que no es su mail.',
    };
  }
  if (m.includes('elegí tu nombre de usuario')) {
    return {
      titulo: 'Te falta tu nombre de usuario',
      detalle:
        'Entrá a Cuenta y elegí uno en Perfil. El que recibe el plantel ' +
        'necesita saber de quién es.',
    };
  }
  if (m.includes('ese sos vos')) {
    return {
      titulo: 'Ese sos vos',
      detalle: 'Poné el nombre de la persona a la que se lo querés mandar.',
    };
  }
  if (m.includes('ya está tomado')) {
    return {
      titulo: 'Ese nombre ya está tomado',
      detalle: 'Probá con otro: no puede haber dos personas con el mismo.',
    };
  }
  if (m.includes('too many') || m.includes('rate limit')) {
    return {
      titulo: 'Demasiados intentos',
      detalle: 'Esperá un minuto y probá de nuevo.',
    };
  }
  if (m.includes('origin')) {
    return {
      titulo: 'El servidor no acepta esta versión de la app',
      detalle:
        'Pasa al probar con Expo Go: el servidor sólo confía en los orígenes ' +
        'que tiene configurados. Hay que agregar el de Expo Go en la variable ' +
        'TRUSTED_ORIGINS del servidor.',
    };
  }
  if (m.includes('conexión') || m.includes('network') || m.includes('fetch')) {
    return {
      titulo: 'No hay conexión con el servidor',
      detalle:
        'Fijate que tengas internet. Si es la primera vez en un rato, el ' +
        'servidor puede tardar hasta un minuto en despertar: probá de nuevo.',
    };
  }

  if (
    m.includes('no te entra otro plantel') ||
    m.includes('límite de planteles')
  ) {
    return {
      titulo: 'No te entra otro plantel',
      detalle:
        'Tu plan llega hasta los que ya tenés. Borrá uno para hacer lugar y ' +
        'volvé a intentar: esto no se pierde mientras tanto.',
    };
  }
  if (m.includes('cerró la sesión') || m.includes('401')) {
    return {
      titulo: 'Se cerró la sesión',
      detalle: 'Entrá de nuevo con tu mail y contraseña.',
    };
  }
  return { titulo: 'No se pudo', detalle: crudo };
}

/** Para los pocos lugares que todavía muestran el error como texto suelto. */
function enCastellano(mensaje: string): string {
  return explicar(new Error(mensaje)).titulo;
}

/**
 * Los avisos de entrada y salida. Los dispara este módulo, que es por donde
 * pasan todas las formas de cambiar de sesión desde la app.
 *
 * Que venza el token no se entera por acá: se entera el primer pedido que
 * falle con 401, y ahí la pantalla pide entrar de nuevo.
 */
const oyentes = new Set<(sesion: Sesion | null) => void>();

function avisar(sesion: Sesion | null) {
  oyentes.forEach((f) => f(sesion));
}

export function alCambiarSesion(
  escuchar: (sesion: Sesion | null) => void
): () => void {
  oyentes.add(escuchar);
  return () => oyentes.delete(escuchar);
}

/**
 * Cuando el servidor contesta que la sesión no vale —venció, o la cuenta ya no
 * existe— hay que soltarla acá también. Si no, la app sigue mostrándose
 * conectada para siempre con una sesión muerta.
 */
alPerderSesion(() => {
  olvidarPerfil();
  // Sin cliente no hay sesión que soltar, así que ni se intenta.
  authClient
    ?.signOut()
    .catch(() => {})
    .finally(() => avisar(null));
});

export async function sesionActual(): Promise<Sesion | null> {
  if (!authClient) return null;
  const { data } = await authClient.getSession();
  const usuario = data?.user;
  return usuario ? { id: usuario.id, email: usuario.email } : null;
}

export interface Alta {
  sesion: Sesion | null;
  /** El servidor pide confirmar el mail, así que la sesión no viene todavía. */
  faltaConfirmar: boolean;
}

export async function registrarse(email: string, clave: string): Promise<Alta> {
  const limpio = email.trim();
  const { data, error } = await clienteObligatorio().signUp.email({
    email: limpio,
    password: clave,
    // El servidor lo pide. Todavía no hay dónde escribir un nombre en la app,
    // así que va la parte de adelante del mail hasta que la haya.
    name: limpio.split('@')[0] || 'Jugador',
  });
  if (error) throw new Error(enCastellano(error.message ?? 'No se pudo crear la cuenta.'));

  /*
   * Lo que decide si quedó adentro es el token, no el usuario. Cuando hace
   * falta confirmar el mail, el servidor devuelve igual los datos del usuario
   * —la cuenta se creó— pero con `token: null`. Preguntando por el usuario la
   * app daba por iniciada una sesión que no existía: te mostraba adentro y no
   * te decía nunca que tenías que confirmar.
   */
  const sesion =
    data?.token && data?.user
      ? { id: data.user.id, email: data.user.email }
      : null;
  if (sesion) avisar(sesion);
  return { sesion, faltaConfirmar: !sesion };
}

export async function entrar(email: string, clave: string): Promise<Sesion> {
  const { data, error } = await clienteObligatorio().signIn.email({
    email: email.trim(),
    password: clave,
  });
  if (error) throw new Error(enCastellano(error.message ?? 'No se pudo entrar.'));
  // Mismo criterio que al registrarse: sin token no hay sesión.
  if (!data?.token || !data?.user) {
    throw new Error('No se pudo iniciar sesión.');
  }

  const sesion = { id: data.user.id, email: data.user.email };
  avisar(sesion);
  return sesion;
}

/**
 * Manda el mail para elegir una contraseña nueva.
 *
 * Responde igual exista o no la cuenta, a propósito: si dijera "ese mail no
 * está registrado" sería una forma de averiguar quién tiene cuenta probando
 * direcciones.
 */
export async function pedirRecuperacion(email: string): Promise<void> {
  const { error } = await clienteObligatorio().requestPasswordReset({
    // Adónde vuelve el link. No puede ir fijo: en el APK es
    // `canchero://recuperar`, pero probando con Expo Go quien abre es Expo Go
    // y la dirección es otra. Con la fija, el mail no abría nada al probar.
    redirectTo: urlDeRecuperacion(),
    email: email.trim(),
  });
  if (error) {
    throw new Error(enCastellano(error.message ?? 'No se pudo pedir el cambio.'));
  }
}

/**
 * Cambia la contraseña con el token que vino en el link del mail.
 *
 * No deja la sesión abierta a propósito: el que llega hasta acá tiene el mail
 * en la mano, pero recién ahora sabe la contraseña nueva. Que la escriba una
 * vez confirma que la anotó en algún lado y no la olvida a los dos minutos.
 */
export async function cambiarClave(token: string, nueva: string): Promise<void> {
  const { error } = await clienteObligatorio().resetPassword({
    newPassword: nueva,
    token,
  });
  if (error) {
    throw new Error(enCastellano(error.message ?? 'No se pudo cambiar la contraseña.'));
  }
}

/**
 * Vuelve a mandar el mail de confirmación.
 *
 * Hace falta porque registrarse de nuevo con el mismo mail no manda nada: el
 * servidor contesta que sí —a propósito, para no delatar qué direcciones
 * tienen cuenta— pero no reenvía. Sin esto, si el primer mail se perdía o caía
 * en spam, la cuenta quedaba inaccesible para siempre.
 */
export async function reenviarConfirmacion(email: string): Promise<void> {
  const { error } = await clienteObligatorio().sendVerificationEmail({
    email: email.trim(),
  });
  if (error) {
    throw new Error(enCastellano(error.message ?? 'No se pudo reenviar.'));
  }
}

/**
 * Entra con el código que trajo la vuelta de confirmar el mail.
 *
 * Confirmar pasa en el navegador del teléfono, así que la sesión que se crea
 * ahí no le sirve a la app. El servidor manda en la vuelta un código de un
 * solo uso y esto lo canjea: la sesión queda guardada acá y la persona entra
 * sin escribir la contraseña de nuevo.
 */
export async function entrarConCodigo(codigo: string): Promise<Sesion> {
  const { data, error } = await clienteObligatorio().oneTimeToken.verify({
    token: codigo,
  });
  if (error || !data?.user) {
    throw new Error(
      enCastellano(error?.message ?? 'Ese link de confirmación ya no sirve.')
    );
  }
  const sesion = { id: data.user.id, email: data.user.email };
  avisar(sesion);
  return sesion;
}

export async function salir(): Promise<void> {
  // Primero se desanota el teléfono: después de cerrar la sesión el servidor
  // ya no sabe quién es y no lo dejaría hacerlo. Sin esto, al entrar otra
  // persona en este mismo teléfono le seguirían llegando los avisos del
  // anterior.
  await olvidarTelefono();
  await clienteObligatorio().signOut();
  olvidarPerfil();
  /*
   * Y se borra lo que hay en el teléfono. Está todo en la cuenta, así que no
   * se pierde nada; dejarlo era lo que hacía que los planteles de uno
   * aparecieran en la cuenta del que entrara después.
   */
  await borrarTodo();
  avisar(null);
}

