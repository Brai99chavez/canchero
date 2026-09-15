import { consultar } from './db.js';

/**
 * Los límites del plan, del lado que no se puede tocar.
 *
 * En la app hay una copia de estos números (`src/plan.ts`), pero esa es para
 * mostrar y para frenar al que se pasa sin querer: vive adentro del APK, y un
 * APK se descompila, se cambia y se vuelve a firmar. Quien quiera saltearse el
 * límite sólo tiene que cambiar una constante.
 *
 * Por eso el que decide de verdad es este archivo. Si los dos números dejan de
 * coincidir, manda éste y el usuario ve que algo no le entró.
 */
const LIMITES = {
  gratis: { planteles: 2 },
  pro: { planteles: Infinity },
};

export async function planDe(usuarioId) {
  const { rows } = await consultar(
    `insert into perfiles (usuario_id) values ($1)
     on conflict (usuario_id) do update set usuario_id = excluded.usuario_id
     returning plan`,
    [usuarioId]
  );
  return rows[0]?.plan === 'pro' ? 'pro' : 'gratis';
}

/**
 * Cuáles de los planteles que llegaron entran en el plan: los más viejos, la
 * misma regla que aplica la app. Devuelve los aceptados y cuántos quedaron
 * afuera, para poder decírselo a quien subió.
 *
 * El tope de jugadores por plantel no se verifica acá a propósito. Un plantel
 * de treinta no le cuesta nada al servidor, y rechazarlo le haría perder datos
 * a alguien que importó un respaldo grande y no hizo nada malo. Lo que se cobra
 * es la cantidad de planteles, y eso sí se verifica.
 */
export function recortarAlPlan(planteles, plan) {
  const tope = LIMITES[plan]?.planteles ?? LIMITES.gratis.planteles;
  if (planteles.length <= tope) return { aceptados: planteles, ignorados: 0 };

  const porLlegada = planteles
    .slice()
    .sort((a, b) =>
      String(a.llegada ?? '').localeCompare(String(b.llegada ?? '')) ||
      String(a.id).localeCompare(String(b.id))
    );

  return {
    aceptados: porLlegada.slice(0, tope),
    ignorados: planteles.length - tope,
  };
}
