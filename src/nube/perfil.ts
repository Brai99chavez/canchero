import { Plan } from '../plan';
import { pedir } from './cliente';

/**
 * El perfil de la cuenta: el nombre con el que te encuentran y la foto.
 *
 * El nombre de usuario es para que un amigo pueda mandarte un plantel sin que
 * le pases tu mail. Por eso es público y el mail no.
 */
export interface Perfil {
  email: string;
  plan: Plan;
  /** Null hasta que se elige uno. */
  usuario: string | null;
  foto: string | null;
}

/**
 * Qué tiene de malo un nombre, o null si está bien.
 *
 * Es una copia de la regla del servidor (`servidor/src/perfil.js`), y está
 * duplicada a propósito: sirve para avisar mientras se escribe, sin ida y
 * vuelta por la red. El que decide sigue siendo el servidor, que además es el
 * único que sabe si el nombre ya lo tiene otro.
 */
const FORMATO = /^[a-z0-9][a-z0-9._-]{1,18}[a-z0-9]$/;

const RESERVADOS = new Set([
  'admin',
  'administrador',
  'canchero',
  'soporte',
  'ayuda',
  'sistema',
  'root',
  'api',
  'oficial',
  'null',
  'undefined',
]);

export function normalizar(nombre: string): string {
  return nombre.trim().toLowerCase();
}

export function problemaDelUsuario(nombre: string): string | null {
  const limpio = normalizar(nombre);
  if (limpio.length < 3) return 'Tiene que tener al menos 3 letras.';
  if (limpio.length > 20) return 'No puede pasar de 20 letras.';
  if (!FORMATO.test(limpio)) {
    return 'Sólo letras sin acento, números, punto, guión y guión bajo. No puede empezar ni terminar con un símbolo.';
  }
  if (RESERVADOS.has(limpio)) return 'Ese nombre está reservado. Elegí otro.';
  return null;
}

export function leerPerfil(): Promise<Perfil> {
  return pedir<Perfil>('/perfil');
}

/**
 * Guarda lo que cambió. Lo que no se manda no se toca: cambiar la foto no
 * borra el nombre.
 */
export function guardarPerfil(cambios: {
  usuario?: string | null;
  foto?: string | null;
}): Promise<Perfil> {
  return pedir<Perfil>('/perfil', { metodo: 'PUT', cuerpo: cambios });
}
