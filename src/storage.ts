import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Actuacion,
  Convocatoria,
  CONVOCATORIA_VACIA,
  DEFAULT_STATS,
  FORMATS,
  Partido,
  Player,
  POSITIONS,
  Sorteo,
  Squad,
  STAT_KEYS,
} from './types';

const PLANTELES_KEY = 'cancha-app/planteles/v1';
/** Clave de cuando había un solo plantel. Se migra la primera vez. */
const PLAYERS_KEY = 'cancha-app/players/v1';

export interface Guardado {
  planteles: Squad[];
  activoId: string;
  /** Plantel que se abre solo al arrancar. Sin esto, se muestra la lista. */
  predeterminadoId: string | null;
  /**
   * Planteles borrados acá que todavía pueden seguir en la nube.
   *
   * Se guardan en el disco y no sólo en memoria porque el backup es manual:
   * entre que borrás y subís puede pasar una semana y cerrarse la app veinte
   * veces. Si se perdieran, la nube nunca se enteraría y el plantel volvería
   * a aparecer la próxima vez que restaures.
   */
  borrados: string[];
  /**
   * Lo último que se confirmó subido de cada plantel, por id.
   *
   * Comparado con el `actualizado` de cada uno dice qué falta subir. Va al
   * disco porque entre que cambiás algo y hay internet puede pasar un día y
   * cerrarse la app: si esto se perdiera, o se subiría todo de nuevo o —peor—
   * se daría por subido algo que no llegó.
   */
  subido: Record<string, string>;
  /** Hasta cuándo se leyó del servidor. El corte lo pone él, no el teléfono. */
  hasta: string | null;
  /**
   * De quién es todo esto.
   *
   * Sin esto, cerrar sesión dejaba los planteles en el teléfono y la siguiente
   * cuenta que entraba se los subía como propios: los planteles de uno
   * aparecían en la cuenta del otro. Ahora, si el dueño no coincide con quien
   * entró, lo guardado se descarta y se trae lo de esa cuenta.
   */
  dueno: string | null;
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Normaliza lo leído del disco para tolerar datos viejos o incompletos. */
function sanitizeJugador(raw: any): Player | null {
  if (!raw || typeof raw.id !== 'string' || typeof raw.nombre !== 'string') {
    return null;
  }
  const stats = { ...DEFAULT_STATS };
  for (const key of STAT_KEYS) {
    const value = Number(raw?.stats?.[key]);
    if (Number.isFinite(value)) {
      stats[key] = Math.min(99, Math.max(1, Math.round(value)));
    }
  }
  return {
    id: raw.id,
    nombre: raw.nombre,
    posicion: POSITIONS.includes(raw.posicion) ? raw.posicion : 'MED',
    stats,
    foto: typeof raw.foto === 'string' && raw.foto ? raw.foto : undefined,
  };
}

function numero(valor: any, minimo = 0): number {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.max(minimo, Math.round(n)) : minimo;
}

function sanitizeActuacion(raw: any): Actuacion | null {
  if (!raw || typeof raw.jugadorId !== 'string') return null;
  return {
    jugadorId: raw.jugadorId,
    goles: numero(raw.goles),
    asistencias: numero(raw.asistencias),
  };
}

function ids(raw: any): string[] {
  return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : [];
}

function sanitizePartido(raw: any): Partido | null {
  if (!raw || typeof raw.id !== 'string' || typeof raw.fecha !== 'string') {
    return null;
  }
  const nombres: Record<string, string> = {};
  if (raw.nombres && typeof raw.nombres === 'object') {
    for (const [id, nombre] of Object.entries(raw.nombres)) {
      if (typeof nombre === 'string') nombres[id] = nombre;
    }
  }
  const gol = (valor: any) =>
    valor === null || valor === undefined ? null : numero(valor);

  return {
    id: raw.id,
    fecha: raw.fecha,
    formato: FORMATS.includes(raw.formato) ? raw.formato : 5,
    equipoA: ids(raw.equipoA),
    equipoB: ids(raw.equipoB),
    banco: ids(raw.banco),
    nombres,
    golesA: gol(raw.golesA),
    golesB: gol(raw.golesB),
    actuaciones: Array.isArray(raw.actuaciones)
      ? raw.actuaciones
          .map(sanitizeActuacion)
          .filter((a: Actuacion | null): a is Actuacion => a !== null)
      : [],
  };
}

function sanitizeConvocatoria(raw: any): Convocatoria {
  return {
    formato: FORMATS.includes(raw?.formato) ? raw.formato : 5,
    seleccionados: ids(raw?.seleccionados),
    usarTodos: raw?.usarTodos === true,
  };
}

function sanitizeSorteo(raw: any): Sorteo | null {
  if (!raw) return null;
  const equipoA = ids(raw.equipoA);
  const equipoB = ids(raw.equipoB);
  if (equipoA.length === 0 || equipoB.length === 0) return null;
  return {
    equipoA,
    equipoB,
    banco: ids(raw.banco),
    partidoId: typeof raw.partidoId === 'string' ? raw.partidoId : null,
  };
}

/**
 * Los planteles guardados antes de que existiera `llegada` no tienen fecha. Se
 * la inventa a partir de su posición, que es el orden en que entraron (siempre
 * se agregan al final), y bien en el pasado para que cualquier plantel nuevo
 * quede después. Sale igual en cada lectura, así que el orden no se mueve solo.
 */
const FECHA_BASE = Date.UTC(2024, 0, 1);

function fechaLlegada(raw: any, indice: number): string {
  if (
    typeof raw?.llegada === 'string' &&
    !Number.isNaN(Date.parse(raw.llegada))
  ) {
    return raw.llegada;
  }
  return new Date(FECHA_BASE + indice * 60000).toISOString();
}

/**
 * Normaliza un plantel venga de donde venga: del disco o de la nube. Lo que
 * falta o viene roto se reemplaza por algo usable en vez de tirar todo.
 */
export function sanitizePlantel(raw: any, indice: number): Squad | null {
  if (!raw || typeof raw.id !== 'string') return null;
  return {
    id: raw.id,
    llegada: fechaLlegada(raw, indice),
    // Sin fecha de cambio se toma la de llegada: es lo más viejo que puede
    // ser, así que en la primera sincronización se sube y queda al día.
    actualizado:
      typeof raw?.actualizado === 'string' &&
      !Number.isNaN(Date.parse(raw.actualizado))
        ? raw.actualizado
        : fechaLlegada(raw, indice),
    nombre:
      typeof raw.nombre === 'string' && raw.nombre.trim()
        ? raw.nombre
        : 'Plantel',
    jugadores: Array.isArray(raw.jugadores)
      ? raw.jugadores
          .map(sanitizeJugador)
          .filter((j: Player | null): j is Player => j !== null)
      : [],
    partidos: Array.isArray(raw.partidos)
      ? raw.partidos
          .map(sanitizePartido)
          .filter((p: Partido | null): p is Partido => p !== null)
      : [],
    convocatoria: sanitizeConvocatoria(raw.convocatoria),
    sorteo: sanitizeSorteo(raw.sorteo),
  };
}

export function plantelVacio(nombre = 'Mi plantel'): Squad {
  const ahora = new Date().toISOString();
  return {
    id: newId(),
    nombre,
    llegada: ahora,
    actualizado: ahora,
    jugadores: [],
    partidos: [],
    convocatoria: { ...CONVOCATORIA_VACIA },
    sorteo: null,
  };
}

/** Lee los jugadores sueltos de la versión anterior, si quedaron. */
async function migrarDesdeJugadoresSueltos(): Promise<Squad[] | null> {
  try {
    const json = await AsyncStorage.getItem(PLAYERS_KEY);
    if (!json) return null;
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const jugadores = parsed
      .map(sanitizeJugador)
      .filter((j): j is Player => j !== null);
    if (jugadores.length === 0) return null;
    return [{ ...plantelVacio('Mi plantel'), jugadores }];
  } catch {
    return null;
  }
}

export async function loadPlanteles(): Promise<Guardado> {
  try {
    const json = await AsyncStorage.getItem(PLANTELES_KEY);
    if (json) {
      const parsed = JSON.parse(json);
      const planteles = Array.isArray(parsed?.planteles)
        ? parsed.planteles
            .map(sanitizePlantel)
            .filter((p: Squad | null): p is Squad => p !== null)
        : [];
      if (planteles.length > 0) {
        const existe = (id: unknown) =>
          typeof id === 'string' && planteles.some((p: Squad) => p.id === id);
        return {
          planteles,
          activoId: existe(parsed?.activoId) ? parsed.activoId : planteles[0].id,
          predeterminadoId: existe(parsed?.predeterminadoId)
            ? parsed.predeterminadoId
            : null,
          subido:
            parsed?.subido && typeof parsed.subido === 'object'
              ? parsed.subido
              : {},
          hasta: typeof parsed?.hasta === 'string' ? parsed.hasta : null,
          dueno: typeof parsed?.dueno === 'string' ? parsed.dueno : null,
          borrados: Array.isArray(parsed?.borrados)
            ? parsed.borrados.filter((x: unknown) => typeof x === 'string')
            : [],
        };
      }
    }

    const migrados = await migrarDesdeJugadoresSueltos();
    if (migrados) {
      // Quien venía de la versión de un solo plantel espera abrir en el suyo.
      const guardado: Guardado = {
        planteles: migrados,
        activoId: migrados[0].id,
        predeterminadoId: migrados[0].id,
        borrados: [],
        subido: {},
        hasta: null,
        dueno: null,
      };
      await savePlanteles(guardado);
      return guardado;
    }
  } catch {
    // Si el archivo está roto se arranca limpio en vez de no abrir.
  }

  // Instalación nueva: sin planteles. Que el primero lo cree y lo nombre el
  // usuario hace que el grupo tenga nombre propio desde el arranque, y es lo
  // que le da sentido a la pantalla de bienvenida.
  return {
    planteles: [],
    activoId: '',
    predeterminadoId: null,
    borrados: [],
    subido: {},
    hasta: null,
    dueno: null,
  };
}

const GUIA_KEY = 'cancha-app/guia/v1';

export interface EstadoGuia {
  activa: boolean;
  vistos: string[];
}

export async function loadGuia(): Promise<EstadoGuia> {
  try {
    const json = await AsyncStorage.getItem(GUIA_KEY);
    if (!json) return { activa: true, vistos: [] };
    const parsed = JSON.parse(json);
    return {
      activa: parsed?.activa !== false,
      vistos: Array.isArray(parsed?.vistos)
        ? parsed.vistos.filter((x: unknown) => typeof x === 'string')
        : [],
    };
  } catch {
    return { activa: true, vistos: [] };
  }
}

export async function saveGuia(estado: EstadoGuia): Promise<void> {
  try {
    await AsyncStorage.setItem(GUIA_KEY, JSON.stringify(estado));
  } catch {
    // La guía es una ayuda: si no se puede guardar, tampoco es grave.
  }
}

/** Borra todo lo guardado y deja la app como recién instalada. */
export async function borrarTodo(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([PLANTELES_KEY, PLAYERS_KEY, GUIA_KEY]);
  } catch {
    // Si no se puede borrar, al menos la app queda con el estado nuevo.
  }
}

export async function savePlanteles(guardado: Guardado): Promise<void> {
  try {
    await AsyncStorage.setItem(PLANTELES_KEY, JSON.stringify(guardado));
  } catch {
    // Si falla el guardado la app sigue andando con lo que tiene en memoria.
  }
}
