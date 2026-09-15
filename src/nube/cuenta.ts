import { Plan } from '../plan';
import { authClient, clienteObligatorio, pedir } from './cliente';

export interface Sesion {
  id: string;
  email: string;
}

/**
 * Los mensajes del servidor vienen en inglés. Se traducen los que un usuario
 * puede provocar; el resto pasa tal cual, que es más útil que un "algo salió
 * mal" sin información.
 */
function enCastellano(mensaje: string): string {
  const m = mensaje.toLowerCase();
  if (m.includes('invalid email or password') || m.includes('invalid credentials')) {
    return 'Mail o contraseña incorrectos.';
  }
  if (m.includes('already exists') || m.includes('already registered')) {
    return 'Ya hay una cuenta con ese mail. Probá entrar.';
  }
  if (m.includes('password') && m.includes('short')) {
    return 'La contraseña tiene que tener al menos 8 caracteres.';
  }
  if (m.includes('invalid email')) return 'Ese mail no parece válido.';
  if (m.includes('too many')) {
    return 'Demasiados intentos seguidos. Esperá un minuto.';
  }
  return mensaje;
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
