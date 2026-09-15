import { tieneResultado } from './stats';
import { overall, Partido, Player } from './types';

/**
 * El número que corrige tu ojo con lo que pasó en la cancha.
 *
 * La media que cargás a mano dice lo que el jugador *sabe hacer*. Esto dice lo
 * que *pasa cuando juega*: arranca exactamente en tu media y se va moviendo
 * según los resultados, comparados con lo que se esperaba de cada partido.
 *
 * Por qué eso responde al caso del que juega bien pero el equipo pierde: no
 * mira si ganó, mira si ganó **cuando se esperaba que ganara**. Si su equipo
 * era favorito y perdió, pega fuerte. Si lo llevaron de arrastre en un equipo
 * muy superior, ganar casi no le suma. Esa corrección por compañeros y rivales
 * sale de la fórmula, no hay que programarla aparte.
 *
 * No se guarda: se recalcula del historial cada vez. Así borrar un partido de
 * prueba lo deshace solo, corregir las stats de alguien mueve su número con
 * ellas, y el respaldo ya lo lleva sin hacer nada — porque lleva los partidos.
 */

/**
 * Cuánto se puede alejar de la media según cuántos partidos lo respaldan.
 *
 * El tope **es** la confianza. Con pocos partidos el sistema no sabe, y en vez
 * de avisarlo con una etiqueta que nadie lee, directamente no se le permite
 * opinar mucho. Con una temporada encima sí.
 */
const TOPES: { desde: number; tope: number }[] = [
  { desde: 40, tope: 8 },
  { desde: 15, tope: 6 },
  { desde: 5, tope: 3 },
  { desde: 0, tope: 0 },
];

export function topeDe(partidos: number): number {
  return TOPES.find((t) => partidos >= t.desde)!.tope;
}

/**
 * Cuánto mueve un partido. Con 1.2, una victoria totalmente inesperada suma
 * 0.6: hacen falta varias fechas seguidas para despegarse, que es lo que se
 * quiere — un mal sábado no define a nadie.
 */
const K = 1.2;

/**
 * Cuánta ventaja de media hace falta para ser claro favorito. Con 10, diez
 * puntos de diferencia dan una expectativa de ganar de tres cuartos.
 */
const ESCALA = 10;

/**
 * Cuánto pesa la goleada. Un 5-0 dice más que un 1-0, pero no cinco veces
 * más: el tope está en +45% para que un resultado suelto no desordene todo.
 */
function pesoDelMarcador(diferencia: number): number {
  return 1 + Math.min(Math.abs(diferencia), 4) * 0.15;
}

export interface Ajuste {
  /** La media que cargaste a mano. */
  base: number;
  /** La media corregida por los resultados, entre 1 y 99. */
  elo: number;
  /** La diferencia entre las dos. Cero mientras no haya partidos suficientes. */
  ajuste: number;
  /** Con cuántos partidos está hecho. */
  partidos: number;
  /** Cuánto se le permite moverse hoy. */
  tope: number;
}

/** Ordena del más viejo al más nuevo: el Elo se construye hacia adelante. */
function cronologico(partidos: Partido[]): Partido[] {
  return partidos
    .filter(tieneResultado)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function ajustesDe(
  players: Player[],
  partidos: Partido[]
): Record<string, Ajuste> {
  const base: Record<string, number> = {};
  const movimiento: Record<string, number> = {};
  const jugados: Record<string, number> = {};

  for (const p of players) {
    base[p.id] = overall(p);
    movimiento[p.id] = 0;
    jugados[p.id] = 0;
  }

  const fuerza = (ids: string[]) => {
    const suyos = ids.filter((id) => id in base);
    if (suyos.length === 0) return null;
    const total = suyos.reduce((a, id) => a + base[id] + movimiento[id], 0);
    return total / suyos.length;
  };

  for (const partido of cronologico(partidos)) {
    const fuerzaA = fuerza(partido.equipoA);
    const fuerzaB = fuerza(partido.equipoB);
    // Un partido de gente que ya no está en el plantel no dice nada de nadie.
    if (fuerzaA === null || fuerzaB === null) continue;

    const esperadoA = 1 / (1 + 10 ** ((fuerzaB - fuerzaA) / ESCALA));
    const golesA = partido.golesA!;
    const golesB = partido.golesB!;
    const realA = golesA > golesB ? 1 : golesA < golesB ? 0 : 0.5;

    const delta =
      K * (realA - esperadoA) * pesoDelMarcador(golesA - golesB);

    for (const id of partido.equipoA) {
      if (id in movimiento) {
        movimiento[id] += delta;
        jugados[id]++;
      }
    }
    for (const id of partido.equipoB) {
      if (id in movimiento) {
        movimiento[id] -= delta;
        jugados[id]++;
      }
    }
  }

  const salida: Record<string, Ajuste> = {};
  for (const p of players) {
    const tope = topeDe(jugados[p.id]);
    const ajuste = Math.round(
      Math.max(-tope, Math.min(tope, movimiento[p.id]))
    );
    salida[p.id] = {
      base: base[p.id],
      elo: Math.max(1, Math.min(99, base[p.id] + ajuste)),
      ajuste,
      partidos: jugados[p.id],
      tope,
    };
  }
  return salida;
}

/** Sólo el número corregido, que es lo que necesita el sorteo. */
export function elosDe(
  players: Player[],
  partidos: Partido[]
): Record<string, number> {
  const ajustes = ajustesDe(players, partidos);
  const salida: Record<string, number> = {};
  for (const id in ajustes) salida[id] = ajustes[id].elo;
  return salida;
}

/**
 * La media a mostrar, resuelta contra el mapa de ajustes. Si no hay partidos
 * suficientes devuelve la que cargaste, que es lo mismo que el ajuste en cero.
 */
export function mediaDe(p: Player, ajustes: Record<string, Ajuste>): number {
  return ajustes[p.id]?.elo ?? overall(p);
}
