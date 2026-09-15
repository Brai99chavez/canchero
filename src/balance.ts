import {
  FIXED_POSITIONS,
  Format,
  Player,
  Position,
  POSITIONS,
  STAT_KEYS,
  StatKey,
  TeamSplit,
  overall,
} from './types';

/** Pesos del costo: cuánto molesta cada tipo de desbalance. */
const W_OVERALL = 4; // diferencia de media general
const W_STATS = 1; // diferencia promedio por atributo
const W_POSITION = 2; // reparto de posiciones
const W_GOALKEEPER = 5; // extra: que no queden los dos arqueros juntos
const W_LIBERO_SPREAD = 0.5; // desempate: repartir los líberos entre los dos

/**
 * Margen de costo dentro del cual dos repartos se consideran igual de parejos.
 * El local search siempre cae en el mismo óptimo, así que la variedad de
 * "volver a sortear" sale de explorar los repartos que quedan dentro de este
 * margen, no de los reinicios.
 */
const TOLERANCE = 5;

/** Pasos de exploración para juntar repartos alternativos igual de parejos. */
const WALK_STEPS = 400;
const MAX_VARIANTS = 40;

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function meanStat(team: Player[], key: StatKey): number {
  return mean(team.map((p) => p.stats[key]));
}

function countPosition(team: Player[], pos: Position): number {
  return team.filter((p) => p.posicion === pos).length;
}

/**
 * Mide el desbalance de posiciones. Cada puesto que le falta a un equipo
 * respecto del otro es un hueco; los líberos de ese equipo tapan los huecos más
 * caros primero (el arco antes que nada), porque juegan donde haga falta.
 * Sólo penaliza lo que queda sin tapar.
 */
function positionPenalty(teamA: Player[], teamB: Player[]): number {
  const gapsA: number[] = [];
  const gapsB: number[] = [];

  for (const pos of FIXED_POSITIONS) {
    const weight = pos === 'ARQ' ? W_GOALKEEPER : 1;
    const diff = countPosition(teamA, pos) - countPosition(teamB, pos);
    const missing = diff < 0 ? gapsA : gapsB;
    for (let k = 0; k < Math.abs(diff); k++) missing.push(weight);
  }

  const uncovered = (gaps: number[], liberos: number) =>
    gaps
      .sort((a, b) => b - a)
      .slice(liberos)
      .reduce((acc, weight) => acc + weight, 0);

  const liberosA = countPosition(teamA, 'LIB');
  const liberosB = countPosition(teamB, 'LIB');

  return (
    uncovered(gapsA, liberosA) +
    uncovered(gapsB, liberosB) +
    Math.abs(liberosA - liberosB) * W_LIBERO_SPREAD
  );
}

/** Cuanto más bajo, más parejos están los dos equipos. */
function splitCost(teamA: Player[], teamB: Player[]): number {
  const ovrDiff = Math.abs(mean(teamA.map(overall)) - mean(teamB.map(overall)));

  const statDiff = mean(
    STAT_KEYS.map((k) => Math.abs(meanStat(teamA, k) - meanStat(teamB, k)))
  );

  return (
    ovrDiff * W_OVERALL +
    statDiff * W_STATS +
    positionPenalty(teamA, teamB) * W_POSITION
  );
}

/**
 * Reparto inicial: recorre por posición (arqueros primero) y de mayor a menor
 * media, y le da cada jugador al equipo que va más flojo en esa posición.
 */
function greedySplit(
  players: Player[],
  topeA: number,
  topeB: number
): [Player[], Player[]] {
  const ordered: Player[] = [];
  for (const pos of POSITIONS) {
    const group = shuffle(players.filter((p) => p.posicion === pos)).sort(
      (a, b) => overall(b) - overall(a)
    );
    ordered.push(...group);
  }

  const teamA: Player[] = [];
  const teamB: Player[] = [];

  for (const player of ordered) {
    if (teamA.length >= topeA) {
      teamB.push(player);
      continue;
    }
    if (teamB.length >= topeB) {
      teamA.push(player);
      continue;
    }

    const posA = countPosition(teamA, player.posicion);
    const posB = countPosition(teamB, player.posicion);
    if (posA !== posB) {
      (posA < posB ? teamA : teamB).push(player);
      continue;
    }

    const sumA = teamA.reduce((acc, p) => acc + overall(p), 0);
    const sumB = teamB.reduce((acc, p) => acc + overall(p), 0);
    if (sumA !== sumB) {
      (sumA < sumB ? teamA : teamB).push(player);
      continue;
    }

    (Math.random() < 0.5 ? teamA : teamB).push(player);
  }

  return [teamA, teamB];
}

/** Intercambia jugadores entre equipos mientras eso mejore el balance. */
function localSearch(teamA: Player[], teamB: Player[]): number {
  let best = splitCost(teamA, teamB);
  let improved = true;

  while (improved) {
    improved = false;
    for (let i = 0; i < teamA.length; i++) {
      for (let j = 0; j < teamB.length; j++) {
        [teamA[i], teamB[j]] = [teamB[j], teamA[i]];
        const cost = splitCost(teamA, teamB);
        if (cost < best - 1e-9) {
          best = cost;
          improved = true;
        } else {
          [teamA[i], teamB[j]] = [teamB[j], teamA[i]];
        }
      }
    }
  }

  return best;
}

/**
 * Identifica un reparto sin importar cuál lado se llamó A y cuál B, así no se
 * cuentan como variantes distintas dos sorteos que son el mismo partido.
 */
function signature(teamA: Player[], teamB: Player[]): string {
  const ids = (team: Player[]) =>
    team
      .map((p) => p.id)
      .sort()
      .join(',');
  const a = ids(teamA);
  const b = ids(teamB);
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

interface Candidate {
  teamA: Player[];
  teamB: Player[];
  bench: Player[];
}

/**
 * Elige quiénes van al banco dando prioridad a jugar a los que más veces se
 * quedaron afuera. El azar entra sólo para desempatar, así el banco rota en
 * vez de caerle siempre a los mismos.
 */
function elegirBanco(
  players: Player[],
  cuantos: number,
  bancoPrevio: Record<string, number>
): { juegan: Player[]; banco: Player[] } {
  if (cuantos <= 0) return { juegan: players.slice(), banco: [] };

  const puntaje = new Map<string, number>();
  for (const p of players) {
    puntaje.set(p.id, (bancoPrevio[p.id] ?? 0) + Math.random());
  }
  // Los de puntaje más bajo son los que menos banco hicieron: van al banco.
  const orden = players
    .slice()
    .sort((a, b) => puntaje.get(a.id)! - puntaje.get(b.id)!);

  return { banco: orden.slice(0, cuantos), juegan: orden.slice(cuantos) };
}

/** Menos reinicios cuanto más grande el plantel: cada intento cuesta más. */
function restartsFor(playerCount: number): number {
  return Math.max(30, Math.round(700 / Math.max(1, playerCount)));
}

/**
 * Camina por los repartos vecinos aceptando sólo los que siguen dentro del
 * margen de justicia, y junta los distintos que va encontrando.
 */
function collectVariants(base: Candidate, threshold: number): Candidate[] {
  const teamA = base.teamA.slice();
  const teamB = base.teamB.slice();
  const bench = base.bench;

  const found = new Map<string, Candidate>();
  const remember = () => {
    const key = signature(teamA, teamB);
    if (!found.has(key)) {
      found.set(key, {
        teamA: teamA.slice(),
        teamB: teamB.slice(),
        bench: bench.slice(),
      });
    }
  };
  remember();

  const pick = (arr: Player[]) => Math.floor(Math.random() * arr.length);

  // Sólo se permutan jugadores entre los dos equipos. Meter mano en el banco
  // daría más variantes, pero pisaría la rotación: quién descansa ya se
  // decidió con el historial y no se toca acá.
  for (let step = 0; step < WALK_STEPS && found.size < MAX_VARIANTS; step++) {
    const i = pick(teamA);
    const j = pick(teamB);

    [teamA[i], teamB[j]] = [teamB[j], teamA[i]];
    if (splitCost(teamA, teamB) <= threshold) {
      remember();
    } else {
      [teamA[i], teamB[j]] = [teamB[j], teamA[i]];
    }
  }

  return Array.from(found.values());
}

/**
 * Arma dos equipos parejos con los jugadores convocados.
 *
 * Si sobran jugadores para el formato elegido, los extra quedan de suplentes.
 * Entre todos los repartos igual de parejos elige uno al azar, de modo que
 * "volver a sortear" dé variantes reales; `avoid` permite pedir que no repita
 * el reparto que ya está en pantalla.
 */
export interface OpcionesSorteo {
  /**
   * Reparte a todos los convocados entre los dos equipos, sin respetar el
   * tope del formato. Con número impar, un equipo queda con uno más.
   */
  usarTodos?: boolean;
  /** Cuántas veces quedó afuera cada jugador en los últimos partidos. */
  bancoPrevio?: Record<string, number>;
  avoid?: TeamSplit | null;
}

export function buildTeams(
  players: Player[],
  format: Format,
  opciones: OpcionesSorteo = {}
): TeamSplit {
  const { usarTodos = false, bancoPrevio = {}, avoid = null } = opciones;

  if (players.length < 2) {
    return { teamA: players.slice(0, 1), teamB: [], bench: [] };
  }

  const total = players.length;
  const topeA = usarTodos
    ? Math.ceil(total / 2)
    : Math.min(format, Math.floor(total / 2));
  const topeB = usarTodos ? Math.floor(total / 2) : topeA;
  const playing = topeA + topeB;

  let best: Candidate | null = null;
  let bestCost = Infinity;

  for (let attempt = 0; attempt < restartsFor(players.length); attempt++) {
    const { juegan, banco } = elegirBanco(
      players,
      total - playing,
      bancoPrevio
    );
    const [teamA, teamB] = greedySplit(shuffle(juegan), topeA, topeB);
    const cost = localSearch(teamA, teamB);
    const bench = banco;

    if (cost < bestCost) {
      bestCost = cost;
      best = { teamA, teamB, bench };
    }
  }

  const variants = collectVariants(best!, bestCost + TOLERANCE);

  const avoidKey = avoid ? signature(avoid.teamA, avoid.teamB) : null;
  const fresh = avoidKey
    ? variants.filter((c) => signature(c.teamA, c.teamB) !== avoidKey)
    : variants;
  const pool = fresh.length > 0 ? fresh : variants;
  const chosen = pool[Math.floor(Math.random() * pool.length)];

  // Sortea qué lado es A y cuál B para que el mismo reparto no salga siempre
  // con los mismos nombres de equipo.
  const [sideA, sideB] =
    Math.random() < 0.5
      ? [chosen.teamA, chosen.teamB]
      : [chosen.teamB, chosen.teamA];

  const posOrder = (p: Player) => POSITIONS.indexOf(p.posicion);
  const order = (a: Player, b: Player) =>
    posOrder(a) - posOrder(b) || overall(b) - overall(a);

  return {
    teamA: sideA.slice().sort(order),
    teamB: sideB.slice().sort(order),
    bench: chosen.bench.slice().sort(order),
  };
}
