import { consultar } from './db.js';

/**
 * La papelera de planteles.
 *
 * Existe por el guardado automático. Antes, borrar un plantel sin querer no
 * tocaba la copia de la nube hasta que apretabas el botón de backup; ahora todo
 * sube solo, así que el seguro tiene que estar acá: borrar lo manda a la
 * papelera y de ahí se puede sacar.
 */
export const DIAS_DE_PAPELERA = 30;

/**
 * Saca de la base lo que lleva demasiado tiempo en la papelera.
 *
 * Corre cuando alguien borra algo, no con un reloj: un servicio que se despierta
 * solo cada tanto mantendría despierta la base, que es lo que no queremos. La
 * consecuencia es que si nadie borra nada nunca, lo viejo se queda un tiempo
 * más — no molesta a nadie y no ocupa casi nada.
 *
 * Devuelve las fotos que quedaron sin dueño, para que quien llama las barra.
 */
export async function vaciarPapeleraVieja(usuarioId) {
  const { rows } = await consultar(
    `delete from planteles
      where dueno = $1 and borrado
        and borrado_en is not null
        and borrado_en < now() - ($2 || ' days')::interval
      returning datos`,
    [usuarioId, String(DIAS_DE_PAPELERA)]
  );

  const fotos = [];
  for (const fila of rows) {
    for (const jugador of fila.datos?.jugadores ?? []) {
      if (typeof jugador?.foto === 'string') fotos.push(jugador.foto);
    }
  }
  return fotos;
}
