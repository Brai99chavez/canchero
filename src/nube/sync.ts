import { sanitizePlantel } from '../storage';
import { Squad } from '../types';
import { pedir } from './cliente';

/**
 * Por ahora esto es un respaldo, no una sincronización de verdad: el teléfono
 * sube lo suyo y, cuando se lo pide, baja lo que hay. No se resuelven
 * conflictos entre dos aparatos editando a la vez, y por eso bajar avisa que
 * reemplaza lo local en lugar de mezclarlo a ciegas.
 *
 * Para mezclar haría falta una fecha de modificación por plantel, actualizada
 * en cada cambio. Es el próximo paso, no este.
 */

interface PlantelDeLaNube {
  id: string;
  nombre: string;
  llegada: string;
  datos: { jugadores?: unknown; partidos?: unknown } | null;
}

/**
 * Las fotos no suben: son archivos de este teléfono y la ruta no significa
 * nada en otro. El que restaure ve la silueta hasta sacarlas de nuevo.
 * Subirlas es otra etapa, con un lugar para archivos.
 */
function sinFotos(jugadores: Squad['jugadores']) {
  return jugadores.map(({ foto: _foto, ...resto }) => resto);
}

export async function subir(planteles: Squad[]): Promise<void> {
  // Sin planteles no se sube nada: una app recién instalada no tiene por qué
  // poder vaciar el respaldo antes de que la persona alcance a restaurarlo.
  if (planteles.length === 0) return;

  await pedir('/planteles', {
    metodo: 'PUT',
    cuerpo: {
      planteles: planteles.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        llegada: p.llegada,
        datos: { jugadores: sinFotos(p.jugadores), partidos: p.partidos },
      })),
    },
  });
}

/**
 * Borrar de verdad haría que el plantel reapareciera la próxima vez que otro
 * teléfono restaure, así que del lado del servidor queda marcado.
 */
export async function marcarBorrado(id: string): Promise<void> {
  await pedir(`/planteles/${encodeURIComponent(id)}`, { metodo: 'DELETE' });
}

export async function bajar(): Promise<Squad[]> {
  const { planteles } = await pedir<{ planteles: PlantelDeLaNube[] }>(
    '/planteles'
  );

  return (planteles ?? [])
    .map((fila, indice) =>
      // Lo que viene del servidor pasa por el mismo saneador que lo que viene
      // del disco: la convocatoria y el sorteo son de la sesión de cada
      // teléfono y no del respaldo, así que les pone los valores vacíos.
      sanitizePlantel(
        {
          id: fila.id,
          nombre: fila.nombre,
          llegada: fila.llegada,
          jugadores: fila.datos?.jugadores,
          partidos: fila.datos?.partidos,
        },
        indice
      )
    )
    .filter((p): p is Squad => p !== null);
}
