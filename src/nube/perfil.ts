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

/**
 * Lo último que se supo del perfil, guardado en memoria.
 *
 * Sin esto se pedía cada vez que se entra a la sección —y encima dos veces, que
 * el plan sale del mismo lugar—, así que cambiar de pestaña despertaba la base
 * para traer algo que casi nunca cambia. Y mientras tanto se veía "trayendo tu
 * perfil", que es un parpadeo por nada.
 *
 * Vive mientras vive la app: no se guarda en el teléfono. Es poca cosa y así no
 * hay que preocuparse por dejar el nombre de nadie escrito en el disco.
 */
let enMemoria: Perfil | null = null;

/** Lo que ya se sabe, sin pedir nada. Null si todavía no se trajo. */
export function perfilEnMemoria(): Perfil | null {
  return enMemoria;
}

/**
 * El perfil. Si ya se trajo antes, eso mismo; con `refrescar` se vuelve a
 * preguntar, que es lo que hace el tirón hacia abajo de la pantalla.
 */
let enVuelo: Promise<Perfil> | null = null;

export function leerPerfil(refrescar = false): Promise<Perfil> {
  if (enMemoria && !refrescar) return Promise.resolve(enMemoria);
  /*
   * Si ya hay un pedido en camino se devuelve ese mismo. Al entrar se pedía el
   * perfil y el plan a la vez —salen del mismo lugar— y como ninguno de los
   * dos había terminado todavía, los dos fallaban el caché y salían dos
   * pedidos iguales.
   */
  if (!enVuelo) {
    enVuelo = pedir<Perfil>('/perfil')
      .then((traido) => {
        enMemoria = traido;
        return traido;
      })
      .finally(() => {
        enVuelo = null;
      });
  }
  return enVuelo;
}

/** Al cerrar sesión: lo que sabíamos era de la persona que se fue. */
export function olvidarPerfil(): void {
  enMemoria = null;
  enVuelo = null;
}

/**
 * Guarda lo que cambió. Lo que no se manda no se toca: cambiar la foto no
 * borra el nombre.
 */
export async function guardarPerfil(cambios: {
  usuario?: string | null;
  foto?: string | null;
}): Promise<Perfil> {
  // El servidor devuelve cómo quedó: con eso se actualiza lo que tenemos, sin
  // pedirlo de nuevo.
  enMemoria = await pedir<Perfil>('/perfil', { metodo: 'PUT', cuerpo: cambios });
  return enMemoria;
}
