import { Squad } from '../types';

/**
 * Junta lo que devolvió una vuelta de sincronización con lo que se hizo
 * mientras tanto en el teléfono.
 *
 * La vuelta arranca con una foto de los planteles y tarda: sube las fotos de a
 * una, y el servidor se duerme y le cuesta despertar. Antes, al terminar, se
 * pisaban los planteles con lo que ella devolvía, y todo lo que se había hecho
 * en ese rato se perdía sin aviso. Pasaba justo después de cargar jugadores,
 * que es cuando hay fotos para subir: convocabas, elegías «Todos», armabas y
 * guardabas el partido, la vuelta terminaba y se lo llevaba puesto. El
 * partido no aparecía en Activos y la convocatoria volvía a como estaba.
 *
 * La regla es por plantel. El que no se tocó durante la vuelta queda como ella
 * lo devolvió: con las URLs de las fotos y lo que llegó de otro teléfono. El
 * que se tocó queda como está acá, que es lo último que pasó y la próxima
 * vuelta lo sube; sólo se le ponen las fotos que la vuelta ya subió, para no
 * volver a subirlas.
 */
export function juntarConLoDeAhora(
  /** Los planteles con los que arrancó la vuelta. */
  antes: Squad[],
  /** Los que devolvió la vuelta. */
  despues: Squad[],
  /** Los que hay en el teléfono ahora que terminó. */
  ahora: Squad[]
): Squad[] {
  // Nadie tocó nada en el medio: vale lo que trajo la vuelta, tal cual.
  if (ahora === antes) return despues;

  const deAntes = new Map(antes.map((p) => [p.id, p]));
  const deDespues = new Map(despues.map((p) => [p.id, p]));
  const resultado: Squad[] = [];
  const puestos = new Set<string>();

  for (const actual of ahora) {
    const previo = deAntes.get(actual.id);
    const sincronizado = deDespues.get(actual.id);

    if (previo && actual === previo) {
      // Sin tocar. Si la vuelta no lo devolvió es que se borró en otro
      // teléfono, y se va.
      if (sincronizado) resultado.push(sincronizado);
    } else if (previo && sincronizado) {
      resultado.push(conFotosSubidas(actual, previo, sincronizado));
    } else {
      // Creado durante la vuelta, o tocado acá mientras en otro teléfono lo
      // borraban: lo de acá no se pierde.
      resultado.push(actual);
    }
    puestos.add(actual.id);
  }

  // Lo que llegó de otro teléfono. Lo que acá se borró durante la vuelta no
  // vuelve: estaba en `antes` y ya no está en `ahora`.
  for (const p of despues) {
    if (!deAntes.has(p.id) && !puestos.has(p.id)) resultado.push(p);
  }

  return resultado.sort((a, b) => a.llegada.localeCompare(b.llegada));
}

/**
 * Las fotos que la vuelta subió, puestas en la versión de acá.
 *
 * Sólo las de los jugadores cuya foto no se cambió en el medio: si alguien le
 * puso otra foto mientras la vuelta subía la vieja, manda la nueva.
 */
function conFotosSubidas(
  actual: Squad,
  previo: Squad,
  sincronizado: Squad
): Squad {
  const fotoAntes = new Map(previo.jugadores.map((j) => [j.id, j.foto]));
  const fotoDespues = new Map(sincronizado.jugadores.map((j) => [j.id, j.foto]));

  let cambio = false;
  const jugadores = actual.jugadores.map((j) => {
    // Sin él en la vuelta no hay foto que traer: no es que se la sacaron.
    if (!fotoDespues.has(j.id)) return j;
    const nueva = fotoDespues.get(j.id);
    if (nueva === j.foto || fotoAntes.get(j.id) !== j.foto) return j;
    cambio = true;
    return { ...j, foto: nueva };
  });

  return cambio ? { ...actual, jugadores } : actual;
}
