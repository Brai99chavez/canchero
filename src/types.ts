export type Position = 'ARQ' | 'DEF' | 'MED' | 'DEL' | 'LIB';

/** LIB va último: es comodín y se reparte después de las posiciones fijas. */
export const POSITIONS: Position[] = ['ARQ', 'DEF', 'MED', 'DEL', 'LIB'];

/** Posiciones que hay que repartir parejo entre los dos equipos. */
export const FIXED_POSITIONS: Position[] = ['ARQ', 'DEF', 'MED', 'DEL'];

export const POSITION_LABELS: Record<Position, string> = {
  ARQ: 'Arquero',
  DEF: 'Defensor',
  MED: 'Mediocampista',
  DEL: 'Delantero',
  LIB: 'Líbero',
};

export const POSITION_HINTS: Record<Position, string> = {
  ARQ: 'Arquero',
  DEF: 'Defensor',
  MED: 'Medio',
  DEL: 'Delantero',
  LIB: 'Juega en cualquier lado',
};

export const POSITION_COLORS: Record<Position, string> = {
  ARQ: '#F59E0B',
  DEF: '#38BDF8',
  MED: '#22C55E',
  DEL: '#EF4444',
  LIB: '#A78BFA',
};

export type StatKey =
  | 'pases'
  | 'regate'
  | 'definicion'
  | 'posicionamiento'
  | 'resistencia';

export const STAT_KEYS: StatKey[] = [
  'pases',
  'regate',
  'definicion',
  'posicionamiento',
  'resistencia',
];

export const STAT_LABELS: Record<StatKey, string> = {
  pases: 'Pases',
  regate: 'Regate',
  definicion: 'Definición',
  posicionamiento: 'Posicionamiento',
  resistencia: 'Resistencia',
};

export type Stats = Record<StatKey, number>;

export interface Player {
  id: string;
  nombre: string;
  posicion: Position;
  stats: Stats;
  /** Ruta local de la foto. Sin foto, la carta muestra la silueta. */
  foto?: string;
}

/** Jugadores por equipo: fútbol 5, 7 u 11. */
export type Format = 5 | 7 | 11;

export const FORMATS: Format[] = [5, 7, 11];

/** Lo que hizo un jugador en un partido puntual. */
export interface Actuacion {
  jugadorId: string;
  goles: number;
  asistencias: number;
}

/**
 * Un partido jugado. Guarda los equipos por id, pero también una foto de los
 * nombres: así el historial se sigue leyendo aunque después borres al jugador.
 */
export interface Partido {
  id: string;
  fecha: string;
  formato: Format;
  equipoA: string[];
  equipoB: string[];
  banco: string[];
  nombres: Record<string, string>;
  /** null mientras no se haya cargado el resultado. */
  golesA: number | null;
  golesB: number | null;
  actuaciones: Actuacion[];
}

/** Cómo quedó configurado el último partido de este plantel. */
export interface Convocatoria {
  formato: Format;
  seleccionados: string[];
  usarTodos: boolean;
}

/**
 * El último sorteo, guardado por id. Sobrevive a cerrar la app: sortear en
 * casa y que en la cancha salgan otros equipos es peor que no tener la app.
 */
export interface Sorteo {
  equipoA: string[];
  equipoB: string[];
  banco: string[];
  /** Id del partido si ya se guardó en el historial. */
  partidoId: string | null;
}

/**
 * Un plantel es un grupo de amigos con su propia lista de jugadores. La app
 * guarda varios y se trabaja sobre uno a la vez.
 */
export interface Squad {
  id: string;
  nombre: string;
  /**
   * Cuándo entró a este teléfono, en ISO — al crearlo o al importarlo, no
   * cuándo se creó en el teléfono de otro. Es lo que decide cuáles entran en
   * el plan cuando hay más de los permitidos: manda el que llegó primero.
   *
   * Por eso no viaja en el respaldo: si viajara, importar un plantel viejo le
   * sacaría el lugar al que venías usando. Cuando exista la cuenta, este dato
   * tiene que sincronizarse con ella para que los dos teléfonos coincidan.
   */
  llegada: string;
  /**
   * Cuándo cambió por última vez en este teléfono, en ISO.
   *
   * Es lo que decide qué hay que subir: si no coincide con lo último que se
   * confirmó arriba, este plantel tiene algo sin guardar. Sin esto habría que
   * subir los diez planteles cada vez que se toca un jugador.
   */
  actualizado: string;
  jugadores: Player[];
  partidos: Partido[];
  convocatoria: Convocatoria;
  sorteo: Sorteo | null;
  /**
   * Si al cargar un resultado se piden los goles y asistencias de cada uno.
   *
   * Apagado por defecto, porque en un picado nadie lleva esa cuenta: terminás
   * 11 a 8 y a los diez minutos ya nadie sabe si fueron tres o cuatro del
   * Colo. Pedir un dato que la gente no tiene no da un dato vacío, da un dato
   * inventado, y un goleador inventado en la tabla es peor que no tener tabla.
   *
   * El Elo no lo necesita: se calcula con el marcador del equipo y nada más.
   * Esto es sólo para el grupo que sí lleva la cuenta y quiere su tabla de
   * goleadores. Por eso viaja con el plantel: es del grupo, no del teléfono.
   */
  detalle?: boolean;
  /**
   * Si este plantel ya salió una vez de la papelera.
   *
   * Lo decide el servidor y acá sólo se guarda, porque hace falta antes de
   * borrar: de la papelera se saca una vez, así que si ya salió, el próximo
   * borrado es definitivo y hay que avisarlo. Se necesita en el teléfono —y no
   * preguntando— para poder avisar sin internet, que es cuando el borrado
   * funciona igual.
   */
  yaVolvio?: boolean;
}

export const CONVOCATORIA_VACIA: Convocatoria = {
  formato: 5,
  seleccionados: [],
  usarTodos: false,
};

export interface TeamSplit {
  teamA: Player[];
  teamB: Player[];
  bench: Player[];
}

export const DEFAULT_STATS: Stats = {
  pases: 50,
  regate: 50,
  definicion: 50,
  posicionamiento: 50,
  resistencia: 50,
};

/** Media general del jugador (1-99). */
export function overall(p: Player): number {
  const total = STAT_KEYS.reduce((acc, k) => acc + p.stats[k], 0);
  return Math.round(total / STAT_KEYS.length);
}

export function teamOverall(team: Player[]): number {
  if (team.length === 0) return 0;
  return Math.round(team.reduce((acc, p) => acc + overall(p), 0) / team.length);
}

export function statAverage(team: Player[], key: StatKey): number {
  if (team.length === 0) return 0;
  return Math.round(team.reduce((acc, p) => acc + p.stats[key], 0) / team.length);
}

/** Tres tiers al estilo carta: oro, plata y bronce. */
export type Tier = 'oro' | 'plata' | 'bronce';

export function tierFor(value: number): Tier {
  if (value >= 80) return 'oro';
  if (value >= 65) return 'plata';
  return 'bronce';
}

export function ratingColor(value: number): string {
  if (value >= 80) return '#22C55E';
  if (value >= 65) return '#84CC16';
  if (value >= 50) return '#F59E0B';
  return '#EF4444';
}
