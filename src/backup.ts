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

/** Deja el JSON escrito en la carpeta temporal y devuelve el archivo. */
function aTemporal(planteles: Squad[]): File {
  const carpeta = new Directory(Paths.cache, 'export');
  if (!carpeta.exists) carpeta.create({ intermediates: true, idempotent: true });

  const archivo = new File(carpeta, nombreArchivo(planteles));
  if (archivo.exists) archivo.delete();
  archivo.create();
  archivo.write(JSON.stringify(aArchivo(planteles), null, 2));
  return archivo;
}

/** Abre el menú de compartir del teléfono: WhatsApp, Drive, mail, lo que haya. */
export async function compartir(planteles: Squad[]): Promise<boolean> {
  const archivo = aTemporal(planteles);
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(archivo.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Compartir plantel',
  });
  return true;
}

/**
 * Guarda el JSON donde la persona elija: Descargas, Drive, una carpeta suya.
 *
 * Va por el selector del sistema y no directo a la carpeta de descargas
 * porque una app no puede escribir ahí por su cuenta —Android no se lo
 * permite desde hace varias versiones—. El selector además deja elegir, que
 * termina siendo mejor que decidir por el otro.
 *
 * Devuelve el nombre de la carpeta elegida, o `null` si se arrepintió.
 */
export async function descargar(planteles: Squad[]): Promise<string | null> {
  let carpeta: Directory;
  try {
    carpeta = await Directory.pickDirectoryAsync();
  } catch (error) {
    // Cerrar el selector llega como error. No es una falla: no hay nada que
    // avisar cuando alguien decide no guardar.
    const mensaje = String(error).toLowerCase();
    if (mensaje.includes('cancel') || mensaje.includes('dismiss')) return null;
    throw error;
  }
  if (!carpeta) return null;

  const archivo = carpeta.createFile(
    nombreArchivo(planteles),
    'application/json'
  );
  archivo.write(JSON.stringify(aArchivo(planteles), null, 2));
  return carpeta.name || 'la carpeta elegida';
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

  const leidos = planteesDesde(crudo.planteles);
  if (leidos.planteles.length === 0) {
    throw new Error('El archivo no tiene planteles.');
  }
  return leidos;
}

/**
 * Arma planteles nuevos a partir de unos crudos, vengan de un archivo o de un
 * envío de otra persona.
 *
 * Siempre con ids nuevos: los del origen podrían chocar con los que ya hay en
 * este teléfono, y dos planteles con el mismo id se pisarían al respaldar. Por
 * eso se lleva un mapa de los ids viejos a los nuevos, sin el cual el historial
 * de partidos quedaría apuntando a jugadores que no existen.
 */
export function planteesDesde(crudos: any[]): Importado {
  const planteles: Squad[] = [];
  let jugadores = 0;
  let partidos = 0;
  // Lo que llega, llega ahora: nunca le saca el lugar a lo que ya está en el
  // teléfono. El índice conserva el orden del origen, que importa cuando se
  // restaura un respaldo entero en un teléfono vacío.
  const ahora = Date.now();
  let indice = 0;

  for (const p of crudos) {
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

  return { planteles, jugadores, partidos };
}
