import { newId } from './storage';
import {
  Actuacion,
  CONVOCATORIA_VACIA,
  DEFAULT_STATS,
  FORMATS,
  Partido,
  Player,
  POSITIONS,
  Squad,
  STAT_KEYS,
} from './types';

/**
 * Armar un plantel propio con lo que te mandó otra persona.
 *
 * Esto era `backup.ts` y sabía exportar a un archivo, compartirlo por WhatsApp
 * e importarlo de vuelta. Todo eso se fue: desde que la app guarda sola en la
 * cuenta, el archivo suelto no respalda nada que no esté ya respaldado, y
 * pasarle un plantel a alguien se hace adentro de la app, donde además viajan
 * las fotos. Quedó lo único que se sigue usando, que es esto.
 */

function numero(valor: any, minimo = 0): number {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.max(minimo, Math.round(n)) : minimo;
}

/** Devuelve el jugador saneado junto al id que traía de donde vino. */
function sanearJugador(
  raw: any
): { player: Player; idOriginal: string | null } | null {
  if (!raw || typeof raw.nombre !== 'string' || !raw.nombre.trim()) return null;
  const stats = { ...DEFAULT_STATS };
  for (const key of STAT_KEYS) {
    const valor = Number(raw?.stats?.[key]);
    if (Number.isFinite(valor)) {
      stats[key] = Math.min(99, Math.max(1, Math.round(valor)));
    }
  }
  return {
    player: {
      id: newId(),
      nombre: raw.nombre.trim(),
      posicion: POSITIONS.includes(raw.posicion) ? raw.posicion : 'MED',
      stats,
      foto: typeof raw.foto === 'string' && raw.foto ? raw.foto : undefined,
    },
    idOriginal: typeof raw.id === 'string' ? raw.id : null,
  };
}

/**
 * Traduce un partido a los ids nuevos. Si un jugador del partido no está en el
 * plantel que llegó, se lo saca: mejor un partido con menos gente que uno que
 * referencia a alguien que no existe.
 */
function sanearPartido(raw: any, mapa: Record<string, string>): Partido | null {
  if (!raw || typeof raw.fecha !== 'string') return null;

  const traducir = (lista: any): string[] =>
    Array.isArray(lista)
      ? lista
          .map((id: any) => (typeof id === 'string' ? mapa[id] : undefined))
          .filter((id): id is string => Boolean(id))
      : [];

  const equipoA = traducir(raw.equipoA);
  const equipoB = traducir(raw.equipoB);
  if (equipoA.length === 0 || equipoB.length === 0) return null;

  const nombres: Record<string, string> = {};
  if (raw.nombres && typeof raw.nombres === 'object') {
    for (const [viejo, nombre] of Object.entries(raw.nombres)) {
      const nuevo = mapa[viejo];
      if (nuevo && typeof nombre === 'string') nombres[nuevo] = nombre;
    }
  }

  const actuaciones: Actuacion[] = Array.isArray(raw.actuaciones)
    ? raw.actuaciones
        .map((a: any) => {
          const jugadorId =
            typeof a?.jugadorId === 'string' ? mapa[a.jugadorId] : undefined;
          if (!jugadorId) return null;
          return {
            jugadorId,
            goles: numero(a.goles),
            asistencias: numero(a.asistencias),
          };
        })
        .filter((a: Actuacion | null): a is Actuacion => a !== null)
    : [];

  const gol = (valor: any) =>
    valor === null || valor === undefined ? null : numero(valor);

  return {
    id: newId(),
    fecha: raw.fecha,
    formato: FORMATS.includes(raw.formato) ? raw.formato : 5,
    equipoA,
    equipoB,
    banco: traducir(raw.banco),
    nombres,
    golesA: gol(raw.golesA),
    golesB: gol(raw.golesB),
    actuaciones,
  };
}

export interface Importado {
  planteles: Squad[];
  jugadores: number;
  partidos: number;
}

/**
 * Arma planteles nuevos a partir de unos crudos.
 *
 * Siempre con ids nuevos: los del origen podrían chocar con los que ya hay en
 * este teléfono, y dos planteles con el mismo id se pisarían al sincronizar.
 * Por eso se lleva un mapa de los ids viejos a los nuevos, sin el cual el
 * historial de partidos quedaría apuntando a jugadores que no existen.
 */
export function planteesDesde(crudos: any[]): Importado {
  const planteles: Squad[] = [];
  let jugadores = 0;
  let partidos = 0;
  // Lo que llega, llega ahora: nunca le saca el lugar a lo que ya está en el
  // teléfono.
  const ahora = Date.now();
  let indice = 0;

  for (const p of crudos) {
    const lista: Player[] = [];
    // De los ids del origen a los ids nuevos, para poder traer el historial.
    const mapa: Record<string, string> = {};

    if (Array.isArray(p?.jugadores)) {
      for (const raw of p.jugadores) {
        const saneado = sanearJugador(raw);
        if (!saneado) continue;
        lista.push(saneado.player);
        if (saneado.idOriginal) mapa[saneado.idOriginal] = saneado.player.id;
      }
    }

    const historial = Array.isArray(p?.partidos)
      ? p.partidos
          .map((raw: any) => sanearPartido(raw, mapa))
          .filter((x: Partido | null): x is Partido => x !== null)
      : [];

    const llegada = new Date(ahora + indice++ * 1000).toISOString();
    planteles.push({
      id: newId(),
      llegada,
      // Recién llegado: todavía no se subió nada de esto.
      actualizado: llegada,
      nombre:
        typeof p?.nombre === 'string' && p.nombre.trim()
          ? p.nombre.trim()
          : 'Plantel',
      jugadores: lista,
      partidos: historial,
      // La convocatoria y el sorteo son de la sesión del otro, no viajan.
      convocatoria: { ...CONVOCATORIA_VACIA },
      sorteo: null,
    });
    jugadores += lista.length;
    partidos += historial.length;
  }

  return { planteles, jugadores, partidos };
}
