import { Actuacion, Partido } from './types';

/** Un partido cuenta para estadísticas recién cuando tiene resultado. */
export function tieneResultado(p: Partido): boolean {
  return p.golesA !== null && p.golesB !== null;
}

export type Signo = 'G' | 'E' | 'P';

export interface Resumen {
  jugados: number;
  ganados: number;
  empatados: number;
  perdidos: number;
  goles: number;
  asistencias: number;
  /** Positiva si viene ganando, negativa si viene perdiendo. */
  racha: number;
  /** Del más reciente al más viejo, para dibujar la tirita de forma. */
  ultimos: Signo[];
}

const VACIO: Resumen = {
  jugados: 0,
  ganados: 0,
  empatados: 0,
  perdidos: 0,
  goles: 0,
  asistencias: 0,
  racha: 0,
  ultimos: [],
};

function actuacion(partido: Partido, jugadorId: string): Actuacion | undefined {
  return partido.actuaciones.find((a) => a.jugadorId === jugadorId);
}

function comoLeFue(partido: Partido, jugadorId: string): Signo | null {
  if (!tieneResultado(partido)) return null;
  const enA = partido.equipoA.includes(jugadorId);
  const enB = partido.equipoB.includes(jugadorId);
  if (!enA && !enB) return null;

  const propios = enA ? partido.golesA! : partido.golesB!;
  const ajenos = enA ? partido.golesB! : partido.golesA!;
  if (propios > ajenos) return 'G';
  if (propios < ajenos) return 'P';
  return 'E';
}

/** Ordena del más nuevo al más viejo. */
function porFecha(partidos: Partido[]): Partido[] {
  return partidos
    .slice()
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function resumenDe(jugadorId: string, partidos: Partido[]): Resumen {
  const jugados = porFecha(partidos).filter(
    (p) => comoLeFue(p, jugadorId) !== null
  );
  if (jugados.length === 0) return { ...VACIO };

  const resumen: Resumen = { ...VACIO, jugados: jugados.length, ultimos: [] };

  for (const partido of jugados) {
    const signo = comoLeFue(partido, jugadorId)!;
    if (signo === 'G') resumen.ganados++;
    else if (signo === 'E') resumen.empatados++;
    else resumen.perdidos++;

    const act = actuacion(partido, jugadorId);
    resumen.goles += act?.goles ?? 0;
    resumen.asistencias += act?.asistencias ?? 0;

    if (resumen.ultimos.length < 5) resumen.ultimos.push(signo);
  }

  // La racha corta en cuanto cambia el signo, y los empates la cortan.
  const primero = resumen.ultimos[0];
  if (primero !== 'E') {
    let largo = 0;
    for (const signo of jugados.map((p) => comoLeFue(p, jugadorId)!)) {
      if (signo !== primero) break;
      largo++;
    }
    resumen.racha = primero === 'G' ? largo : -largo;
  }

  return resumen;
}

/** Cuántos partidos recientes se miran para el banco. */
const VENTANA = 8;

/**
 * Cuántas veces quedó afuera cada jugador en los últimos partidos. El sorteo
 * lo usa para rotar el banco en vez de sentar siempre a los mismos.
 */
export function bancoPrevio(partidos: Partido[]): Record<string, number> {
  const cuenta: Record<string, number> = {};
  for (const partido of porFecha(partidos).slice(0, VENTANA)) {
    for (const id of partido.banco) {
      cuenta[id] = (cuenta[id] ?? 0) + 1;
    }
  }
  return cuenta;
}
