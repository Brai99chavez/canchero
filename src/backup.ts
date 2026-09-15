import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
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

/** Marca del archivo, para no tragarse un JSON de otra cosa. */
const MARCA = 'canchero';
/** Los respaldos hechos antes del nombre definitivo se siguen abriendo. */
const MARCAS_VALIDAS = [MARCA, 'cancha-app'];
/** 1 llevaba sólo jugadores; 2 agrega el historial de partidos. */
const FORMATO = 2;

interface JugadorArchivo {
  id: string;
  nombre: string;
  posicion: Player['posicion'];
  stats: Player['stats'];
}

interface PlantelArchivo {
  nombre: string;
  jugadores: JugadorArchivo[];
  partidos: Partido[];
}

interface Archivo {
  app: string;
  formato: number;
  exportado: string;
  planteles: PlantelArchivo[];
}

/**
 * Las fotos no viajan: son archivos del teléfono y meterlas en el JSON lo
 * haría enorme. Sí viaja el id de cada jugador, porque el historial lo
 * referencia; al importar se traduce a ids nuevos.
 */
function aArchivo(planteles: Squad[]): Archivo {
  return {
    app: MARCA,
    formato: FORMATO,
    exportado: new Date().toISOString(),
    planteles: planteles.map((p) => ({
      nombre: p.nombre,
      jugadores: p.jugadores.map((j) => ({
        id: j.id,
        nombre: j.nombre,
        posicion: j.posicion,
        stats: j.stats,
      })),
      partidos: p.partidos,
    })),
  };
}

function nombreArchivo(planteles: Squad[]): string {
  const fecha = new Date().toISOString().slice(0, 10);
  const base =
    planteles.length === 1
      ? planteles[0].nombre.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()
      : 'planteles';
  return `canchero-${base || 'plantel'}-${fecha}.json`;
}

/** Escribe el JSON en un archivo temporal y abre el menú de compartir. */
export async function exportar(planteles: Squad[]): Promise<boolean> {
  const carpeta = new Directory(Paths.cache, 'export');
  if (!carpeta.exists) carpeta.create({ intermediates: true, idempotent: true });

  const archivo = new File(carpeta, nombreArchivo(planteles));
  if (archivo.exists) archivo.delete();
  archivo.create();
  archivo.write(JSON.stringify(aArchivo(planteles), null, 2));

  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(archivo.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Compartir plantel',
  });
  return true;
}

function numero(valor: any, minimo = 0): number {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.max(minimo, Math.round(n)) : minimo;
}

/** Devuelve el jugador saneado junto al id que traía el archivo. */
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
    },
    idOriginal: typeof raw.id === 'string' ? raw.id : null,
  };
}

/**
 * Traduce un partido del archivo a los ids nuevos. Si un jugador del partido
 * no está en el plantel importado, se lo saca: mejor un partido con menos
 * gente que uno que referencia a alguien que no existe.
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
          const jugadorId = typeof a?.jugadorId === 'string' ? mapa[a.jugadorId] : undefined;
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
 * Abre el selector de archivos y devuelve los planteles del JSON. Siempre se
 * suman como planteles nuevos: nunca pisa lo que ya tenés.
 */
export async function importar(): Promise<Importado | null> {
  const elegido = await File.pickFileAsync({
    mimeTypes: ['application/json'],
  });
  if (elegido.canceled || !elegido.result) return null;

  const crudo = JSON.parse(await elegido.result.text());
  if (
    !MARCAS_VALIDAS.includes(crudo?.app) ||
    !Array.isArray(crudo?.planteles)
  ) {
    throw new Error('El archivo no es un respaldo de CANCHERO.');
  }

  const planteles: Squad[] = [];
  let jugadores = 0;
  let partidos = 0;
  // Lo importado llega ahora, por definición: nunca le saca el lugar a lo que
  // ya está en el teléfono. El índice conserva el orden del archivo, que
  // importa cuando se restaura un respaldo entero en un teléfono vacío.
  const ahora = Date.now();
  let indice = 0;

  for (const p of crudo.planteles) {
    const lista: Player[] = [];
    // De los ids del archivo a los ids nuevos, para poder traer el historial.
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

    planteles.push({
      id: newId(),
      llegada: new Date(ahora + indice++ * 1000).toISOString(),
      nombre:
        typeof p?.nombre === 'string' && p.nombre.trim()
          ? p.nombre.trim()
          : 'Plantel',
      jugadores: lista,
      partidos: historial,
      // La convocatoria y el sorteo son de la sesión, no del respaldo.
      convocatoria: { ...CONVOCATORIA_VACIA },
      sorteo: null,
    });
    jugadores += lista.length;
    partidos += historial.length;
  }

  if (planteles.length === 0) throw new Error('El archivo no tiene planteles.');
  return { planteles, jugadores, partidos };
}
