/**
 * El plan de la cuenta y lo que deja hacer.
 *
 * Todo pasa por acá y no por cada pantalla: cuando exista la cuenta, cambia de
 * dónde sale `PLAN` y nada más.
 *
 * Y cuando haya cobro, el que manda es el servidor. Esto sirve para mostrar u
 * ocultar cosas y para frenar al que se pasa sin querer, nunca para dar por
 * buena una compra: un APK modificado cambia esta constante en cinco minutos.
 */
export type Plan = 'gratis' | 'pro';

/** Mientras no haya cuentas, todos usan el plan gratis. */
export const PLAN: Plan = 'gratis';

/**
 * Si Pro ya se puede comprar. Mientras esté en falso, los avisos dicen que
 * está por salir en vez de mandar a contratarlo: ofrecer una salida que
 * todavía no existe es peor que no ofrecer ninguna.
 *
 * El día que el cobro esté andando, esta constante pasa a true y los textos se
 * acomodan solos.
 */
export const PRO_DISPONIBLE = false;

/**
 * La línea de Pro, aparte del resto del mensaje. Viaja suelta para poder
 * pintarla con el color de la marca: mezclada adentro del párrafo se pierde,
 * y es justamente lo que se quiere que quede.
 */
export const AVISO_PRO = PRO_DISPONIBLE
  ? 'Con Pro no hay tope.'
  : 'El plan Pro, sin tope, sale próximamente.';

interface Limites {
  planteles: number;
  jugadores: number;
}

const LIMITES: Record<Plan, Limites> = {
  gratis: { planteles: 2, jugadores: 24 },
  pro: { planteles: Infinity, jugadores: Infinity },
};

export function limites(plan: Plan = PLAN): Limites {
  return LIMITES[plan];
}

/**
 * Respuesta a "¿esto entra en el plan?". Cuando no entra viene con el texto
 * para mostrar, así el mensaje vive con la regla y no repartido por las
 * pantallas.
 */
export type Permiso =
  | { ok: true }
  | { ok: false; titulo: string; motivo: string; pro: string };

const SI: Permiso = { ok: true };

/**
 * Cuáles planteles deja usar el plan: los que llegaron primero a este
 * teléfono. Los que sobran no se borran ni se esconden — quedan a la vista,
 * bloqueados, y al borrar uno de los activos el siguiente entra solo.
 *
 * Se ordena por `llegada` y no por cómo quedaron guardados, para que el
 * resultado no dependa del orden en que los devuelve el almacenamiento. Y se
 * usa la llegada y no la fecha de creación a propósito: importar un plantel
 * más viejo no tiene por qué mandar a sólo lectura al que venías usando.
 */
export function idsActivos(
  planteles: readonly { id: string; llegada: string }[],
  plan: Plan = PLAN
): Set<string> {
  const max = limites(plan).planteles;
  if (planteles.length <= max) return new Set(planteles.map((p) => p.id));

  const porLlegada = planteles
    .slice()
    .sort(
      (a, b) => a.llegada.localeCompare(b.llegada) || a.id.localeCompare(b.id)
    );
  return new Set(porLlegada.slice(0, max).map((p) => p.id));
}

/** Lo que se le muestra al plantel que quedó fuera del plan. */
export function motivoBloqueado(plan: Plan = PLAN): string {
  const max = limites(plan).planteles;
  return PRO_DISPONIBLE
    ? `Tu plan llega a ${max} planteles. Pasate a Pro o borrá otro para usarlo.`
    : `Tu plan llega a ${max} planteles. Borrá otro para poder usar este.`;
}

export function puedeCrearPlantel(
  cuantos: number,
  plan: Plan = PLAN
): Permiso {
  const max = limites(plan).planteles;
  if (cuantos < max) return SI;
  return {
    ok: false,
    titulo: 'Plan gratis',
    motivo:
      `El plan gratis llega hasta ${max} planteles y ya tenés ${cuantos}. ` +
      'Borrá uno para hacer lugar.',
    pro: AVISO_PRO,
  };
}

export function puedeAgregarJugador(
  cuantos: number,
  plan: Plan = PLAN
): Permiso {
  const max = limites(plan).jugadores;
  if (cuantos < max) return SI;
  return {
    ok: false,
    titulo: 'Plantel completo',
    motivo: `En el plan gratis cada plantel llega hasta ${max} jugadores.`,
    pro: AVISO_PRO,
  };
}
