import { Plan } from '../plan';
import { authClient, clienteObligatorio, pedir } from './cliente';

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

export async function sesionActual(): Promise<Sesion | null> {
  if (!authClient) return null;
  const { data } = await authClient.getSession();
  const usuario = data?.user;
  return usuario ? { id: usuario.id, email: usuario.email } : null;
}

export interface Alta {
  sesion: Sesion | null;
  /** Si algún día se prende la confirmación por mail, la sesión no viene. */
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

  const sesion = data?.user
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
  if (!data?.user) throw new Error('No se pudo iniciar sesión.');

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
    email: email.trim(),
    redirectTo: 'canchero://recuperar',
  });
  if (error) {
    throw new Error(enCastellano(error.message ?? 'No se pudo pedir el cambio.'));
  }
}

export async function salir(): Promise<void> {
  await clienteObligatorio().signOut();
  avisar(null);
}

/**
 * El plan según el servidor. Ante cualquier problema se asume gratis, que es
 * el lado seguro para equivocarse: mostrar los límites de más es un cartel,
 * dar Pro de más es regalar el producto.
 */
export async function planDeLaCuenta(): Promise<Plan> {
  try {
    const perfil = await pedir<{ plan: string }>('/perfil');
    return perfil.plan === 'pro' ? 'pro' : 'gratis';
  } catch {
    return 'gratis';
  }
}
