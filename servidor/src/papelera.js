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

/**
 * Los ids de las filas que se fueron de verdad.
 *
 * Es lo que necesita quien llama para borrarles la carpeta en R2. Antes se
 * devolvían las URLs de las fotos que tenían guardadas, pero eso sólo alcanza
 * a las que alguna vez llegaron a quedar nombradas adentro del plantel: ahora
 * cada plantel tiene su carpeta y se va entera, así que con el id sobra.
 */
function idsDe(rows) {
  return rows.map((fila) => fila.id);
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
 * Las fotos las saca de R2 quien llama, borrándole la carpeta.
 */
export async function borrarParaSiempre(usuarioId, id) {
  /*
   * Las tres condiciones juntas son las que hacen que esto sea seguro de
   * llamar siempre: si el plantel no existe, o ya está borrado, o nunca salió
   * de la papelera, no toca nada y devuelve false. Quien llama lo usa así —lo
   * intenta primero y si no pasó nada manda a la papelera— en vez de preguntar
   * antes, que serían dos viajes a la base y una ventana entre ellos.
   */
  const { rowCount } = await consultar(
    `update planteles
        set borrado = true,
            borrado_en = now(),
            definitivo = true,
            datos = '{}'::jsonb,
            actualizado = now()
      where dueno = $1 and id = $2 and not borrado
        and restaurado_en is not null`,
    [usuarioId, id]
  );

  return rowCount > 0;
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
 * Devuelve los ids que se fueron, para que quien llama les borre la carpeta.
 */
export async function vaciarPapeleraVieja(usuarioId) {
  const { rows } = await consultar(
    `delete from planteles
      where dueno = $1 and borrado
        and borrado_en is not null
        and borrado_en < now() - ($2 || ' days')::interval
      returning id`,
    [usuarioId, String(DIAS_DE_PAPELERA)]
  );
  return idsDe(rows);
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
      returning id`,
    [usuarioId, tope]
  );
  return idsDe(rows);
}
