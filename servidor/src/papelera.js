import { consultar } from './db.js';

/**
 * La papelera de planteles.
 *
 * Existe por el guardado automático. Antes, borrar un plantel sin querer no
 * tocaba la copia de la nube hasta que apretabas el botón de backup; ahora todo
 * sube solo, así que el seguro tiene que estar acá: borrar lo manda a la
 * papelera y de ahí se puede sacar.
 *
 * De la papelera se saca UNA vez. La segunda vez que se borra ese plantel el
 * borrado es definitivo, y se avisa antes de hacerlo. Eso es lo que impide
 * usarla para tener más planteles de los que el plan deja: con una papelera
 * grande y recuperaciones libres se puede borrar uno de los activos, sacar uno
 * guardado, usarlo, volver a borrarlo y sacar el siguiente — rotando así se
 * usan todos los que haya, de a dos por vez, con un plan de dos.
 */
export const DIAS_DE_PAPELERA = 7;

/**
 * Qué cuenta como "está en la papelera", en SQL.
 *
 * Vive acá y no repetido en cada consulta porque son tres condiciones y si una
 * se olvida en un lado, ese lado ve cosas distintas que los demás.
 *
 * `borrado_en` nulo es de las versiones viejas, de cuando no se guardaba
 * cuándo. `definitivo` marca las lápidas: la fila vacía que queda de un
 * plantel borrado para siempre, que sigue ahí sólo para que los otros
 * teléfonos se enteren — sin ella lo darían por vivo y lo volverían a subir.
 */
export const EN_LA_PAPELERA =
  'borrado and borrado_en is not null and not definitivo';

/** Las fotos que había en las filas que se borraron de verdad. */
function fotosDe(rows) {
  const fotos = [];
  for (const fila of rows) {
    for (const jugador of fila.datos?.jugadores ?? []) {
      if (typeof jugador?.foto === 'string') fotos.push(jugador.foto);
    }
  }
  return fotos;
}

/**
 * Borra un plantel para siempre: se va el contenido, queda la lápida.
 *
 * Es lo que pasa al borrar por segunda vez uno que ya habías sacado de la
 * papelera. Los jugadores, los partidos y las fotos se van; la fila se queda
 * vacía y marcada, porque es lo que viaja a los otros teléfonos para que se
 * enteren. Esa fila la barre `vaciarPapeleraVieja` a los mismos días que el
 * resto, así que tampoco se acumula.
 *
 * Devuelve las fotos que tenía, para que quien llama las saque de R2.
 */
export async function borrarParaSiempre(usuarioId, id) {
  /*
   * `returning` da los valores nuevos, y lo que hace falta son los de antes:
   * las fotos que había justo antes de vaciarlo. Por eso la lectura va en un
   * `with`, que ve la fila como estaba cuando arrancó la consulta.
   */
  const { rows } = await consultar(
    `with antes as (
       select datos from planteles
        where dueno = $1 and id = $2 and not borrado
          and restaurado_en is not null
     ), limpiado as (
       update planteles
          set borrado = true,
              borrado_en = now(),
              definitivo = true,
              datos = '{}'::jsonb,
              actualizado = now()
        where dueno = $1 and id = $2 and not borrado
          and restaurado_en is not null
        returning id
     )
     select (select count(*) from limpiado)::int as cuantos,
            (select datos from antes) as datos`,
    [usuarioId, id]
  );

  return {
    borrado: rows[0]?.cuantos > 0,
    fotos: fotosDe(rows[0]?.datos ? [{ datos: rows[0].datos }] : []),
  };
}

/**
 * Saca de la base lo que lleva demasiado tiempo en la papelera.
 *
 * Corre cuando alguien borra algo, no con un reloj: un servicio que se despierta
 * solo cada tanto mantendría despierta la base, que es lo que no queremos. La
 * consecuencia es que si nadie borra nada nunca, lo viejo se queda un tiempo
 * más — no molesta a nadie y no ocupa casi nada.
 *
 * Entran también las lápidas, que llevan `borrado_en` por esto mismo: se van
 * cuando ya no le sirven a ningún teléfono.
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
  return fotosDe(rows);
}

/**
 * Deja en la papelera sólo los `tope` más recientes y borra el resto de verdad.
 *
 * Es el otro límite de la papelera, y hace falta porque el de los días no
 * alcanza: sin éste se puede juntar todo lo que se quiera mientras se borre
 * seguido, que es usar la papelera de depósito. Con los dos, lo guardado de una
 * cuenta queda acotado por arriba pase lo que pase.
 *
 * Se van los más viejos, que es como funciona cualquier deshacer: lo último que
 * borraste es lo que más chance tenés de querer de vuelta. Las lápidas no
 * cuentan ni se tocan — no están en la papelera y sacarlas antes de tiempo
 * dejaría a algún teléfono con un plantel que ya no existe.
 */
export async function recortarPapelera(usuarioId, tope) {
  if (!Number.isFinite(tope)) return [];

  const { rows } = await consultar(
    `delete from planteles
      where dueno = $1 and ${EN_LA_PAPELERA} and id in (
        select id from planteles
         where dueno = $1 and ${EN_LA_PAPELERA}
         order by borrado_en desc, id desc
        offset $2
      )
      returning datos`,
    [usuarioId, tope]
  );
  return fotosDe(rows);
}
