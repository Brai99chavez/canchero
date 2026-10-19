import { comoSeLeeElDia, enLista, fechaDelDia } from './asistencia';
import { Cancha, Partido } from './types';

/**
 * La cuenta de la cancha: cuánto pone cada uno y quién falta.
 *
 * Aparte de las pantallas para poder probarla sola, y porque es plata: una
 * cuenta que no cierra es la discusión que esto viene a evitar.
 */

/**
 * Quiénes ponen: todos los que vinieron, jueguen de entrada o esperen en el
 * banco. El suplente también alquila la cancha.
 */
export function quienesPonen(partido: Partido): string[] {
  return [
    ...new Set([...partido.equipoA, ...partido.equipoB, ...partido.banco]),
  ];
}

/**
 * La parte de cada uno, redondeada para arriba al peso. Para arriba porque
 * si se redondea para abajo, al que pagó la cancha le faltan unos pesos y
 * los pone él.
 */
export function parteDeCadaUno(total: number, cuantos: number): number {
  if (cuantos <= 0 || total <= 0) return 0;
  return Math.ceil(total / cuantos);
}

export interface EstadoDeLaCancha {
  total: number;
  parte: number;
  /** Los que ya pagaron, entre los que ponen. */
  pagaron: string[];
  /** Los que todavía no. */
  faltan: string[];
  /** Lo que falta juntar: la parte de cada uno de los que no pagaron. */
  falta: number;
}

/** Cómo viene la cuenta de ese partido, o null si nadie cargó la cancha. */
export function estadoDeLaCancha(partido: Partido): EstadoDeLaCancha | null {
  const cancha = partido.cancha;
  if (!cancha || cancha.total <= 0) return null;

  const ponen = quienesPonen(partido);
  const parte = parteDeCadaUno(cancha.total, ponen.length);
  // Sólo cuentan los que siguen en el partido: el que al final no jugó se
  // saca del partido, y si había pagado, esa plata no es de esta cuenta.
  const pagaron = ponen.filter((id) => cancha.pagaron.includes(id));
  const faltan = ponen.filter((id) => !cancha.pagaron.includes(id));

  return {
    total: cancha.total,
    parte,
    pagaron,
    faltan,
    falta: parte * faltan.length,
  };
}

/**
 * El mensaje para pedir la plata en el grupo: cuánto pone cada uno, quiénes
 * faltan y a qué alias. Null si ya pagaron todos o no hay cancha cargada.
 *
 * Con los nombres de los que faltan y no con un "faltan algunos": nadie se
 * da por aludido si no lo nombran, y es la única forma de que el que ya pagó
 * no transfiera dos veces.
 */
export function textoParaCobrar(partido: Partido, alias?: string): string | null {
  const estado = estadoDeLaCancha(partido);
  if (!estado || estado.faltan.length === 0) return null;
  const dia = new Date(partido.fecha);
  const cuando = Number.isNaN(dia.getTime())
    ? ''
    : ` del ${comoSeLeeElDia(fechaDelDia(dia))}`;
  const nombres = estado.faltan.map((id) => partido.nombres[id] ?? 'Jugador');
  return [
    `La cancha${cuando}: ${enPesos(estado.parte)} cada uno.`,
    `Falta${nombres.length === 1 ? '' : 'n'} pagar ${enLista(nombres)}.`,
    ...(alias ? [`Alias: ${alias}`] : []),
  ].join(' ');
}

/** Marca o desmarca que alguien pagó. */
export function alternarPago(cancha: Cancha, id: string): Cancha {
  return {
    ...cancha,
    pagaron: cancha.pagaron.includes(id)
      ? cancha.pagaron.filter((x) => x !== id)
      : [...cancha.pagaron, id],
  };
}

/**
 * Lee lo que venga guardado, del teléfono o de la nube. Sin un total que
 * sirva no hay nada que dividir: es como no haberlo cargado.
 */
export function limpiarCancha(raw: unknown): Cancha | undefined {
  const r = raw as { total?: unknown; pagaron?: unknown } | null | undefined;
  const total = Math.round(Number(r?.total));
  if (!Number.isFinite(total) || total <= 0) return undefined;
  const pagaron = Array.isArray(r?.pagaron)
    ? r.pagaron.filter((x): x is string => typeof x === 'string')
    : [];
  return { total, pagaron: [...new Set(pagaron)] };
}

/**
 * "$45.000". A mano y no con `toLocaleString`: el motor de JavaScript del
 * teléfono no siempre trae los formatos de cada país, y un "$45,000" en una
 * app argentina se lee como cuarenta y cinco pesos.
 */
export function enPesos(n: number): string {
  const entero = Math.round(n);
  const signo = entero < 0 ? '-' : '';
  return `${signo}$${String(Math.abs(entero)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}
