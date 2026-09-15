import { esLocal } from '../photos';
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
 * Las fotos que ya están en la nube viajan: su URL sirve en cualquier
 * teléfono. Las que todavía son un archivo de acá no, porque esa ruta no
 * significa nada en otro aparato — esas las sube el backup justo antes, y si
 * alguna falla se manda el plantel igual y se reintenta la próxima.
 */
function sinFotosLocales(jugadores: Squad['jugadores']) {
  return jugadores.map((j) =>
    esLocal(j.foto) ? { ...j, foto: undefined } : j
  );
}

/**
 * Un resumen corto de lo que se subiría. Comparando el de ahora con el de la
 * última subida exitosa se sabe si quedó algo sin guardar, que es lo que hay
 * que avisar antes de cerrar la sesión.
 *
 * Se arma sobre lo mismo que viaja —y no sobre el plantel entero— para que un
 * cambio que no se sube, como elegir una foto, no cuente como pendiente.
 */
export function firmaDe(planteles: Squad[]): string {
  const crudo = JSON.stringify(planteles.map(aFila));
  // Hash corto: guardar el JSON entero para compararlo sería cargar en memoria
  // dos veces todo el plantel sin ninguna ventaja.
  let h = 5381;
  for (let i = 0; i < crudo.length; i++) {
    h = ((h * 33) ^ crudo.charCodeAt(i)) >>> 0;
  }
  return `${crudo.length}-${h.toString(36)}`;
}

function aFila(p: Squad) {
  return {
    id: p.id,
    nombre: p.nombre,
    llegada: p.llegada,
    datos: { jugadores: sinFotosLocales(p.jugadores), partidos: p.partidos },
  };
}

export async function subir(planteles: Squad[]): Promise<void> {
  // Sin planteles no se sube nada: una app recién instalada no tiene por qué
  // poder vaciar el respaldo antes de que la persona alcance a restaurarlo.
  if (planteles.length === 0) return;

  await pedir('/planteles', {
    metodo: 'PUT',
    cuerpo: { planteles: planteles.map(aFila) },
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
