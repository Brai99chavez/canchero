import { esLocal } from '../photos';
import { sanitizePlantel } from '../storage';
import { Squad } from '../types';
import { pedir } from './cliente';
import { subirFotosPendientes } from './fotos';

/**
 * El guardado automático.
 *
 * Cada plantel lleva su `actualizado`, y acá se guarda cuál fue el último que
 * se confirmó arriba. Lo que no coincide, falta subir. Así cambiar un jugador
 * sube ese plantel y no los diez.
 *
 * Primero se sube y después se baja, y eso no es casual: cuando se baja, lo
 * que este teléfono tenía pendiente ya está en el servidor, así que lo que
 * llega coincide con lo de acá y no hay nada que resolver. Sin ese orden
 * habría que comparar dos relojes —el del teléfono y el del servidor— para
 * decidir quién gana, y los relojes de los celulares no son de fiar.
 *
 * Gana el último que llega al servidor. Dos teléfonos editando el mismo
 * plantel al mismo tiempo es raro en esta app: cada plantel lo lleva una
 * persona.
 */

interface PlantelDeLaNube {
  id: string;
  nombre: string;
  llegada: string;
  datos: {
    jugadores?: unknown;
    partidos?: unknown;
    detalle?: boolean;
    alias?: unknown;
  } | null;
  borrado?: boolean;
  /** Cuándo salió de la papelera, si salió alguna vez. */
  restaurado_en?: string | null;
}

/** Qué se le manda al servidor de cada plantel. */
function aFila(p: Squad) {
  return {
    nombre: p.nombre,
    llegada: p.llegada,
    datos: {
      /*
       * Las fotos que ya están arriba viajan: su URL sirve en cualquier
       * teléfono. Las que todavía son un archivo de acá no significan nada en
       * otro aparato, así que no se mandan — se suben antes, y la que falla se
       * reintenta en la próxima vuelta.
       */
      jugadores: p.jugadores.map((j) =>
        esLocal(j.foto) ? { ...j, foto: undefined } : j
      ),
      partidos: p.partidos,
      // Es una preferencia del grupo, no del teléfono: viaja con el plantel.
      detalle: p.detalle === true,
      // Lo mismo el alias para cobrar la cancha.
      ...(p.alias ? { alias: p.alias } : {}),
    },
  };
}

export interface EstadoSync {
  /** Lo último confirmado arriba de cada plantel, por id. */
  subido: Record<string, string>;
  /** Hasta cuándo se leyó del servidor. */
  hasta: string | null;
}

export interface Resultado {
  estado: EstadoSync;
  /** Los planteles como quedaron: con las URLs de las fotos que se subieron. */
  planteles: Squad[];
  /** Los borrados que ya se avisaron y se pueden olvidar. */
  borradosListos: string[];
  /** Cuántos no entraron por el plan. */
  sinLugar: number;
  /** Si algo quedó sin subir y hay que reintentar. */
  faltaSubir: boolean;
}

/**
 * Cuáles tienen algo sin subir.
 *
 * `permitidos` son los que el plan deja guardar. Los que quedaron afuera no se
 * mandan: el servidor los va a rechazar igual —el que decide el límite es él—
 * así que pedirlo es un viaje para que conteste que no. Y como el rechazo no
 * los saca de la lista de pendientes, se volvía a intentar en cada vuelta para
 * siempre. Cuando se hace lugar entran solos, sin que haya que avisar nada.
 */
export function sinSubir(
  planteles: Squad[],
  subido: EstadoSync['subido'],
  opciones: {
    permitidos?: ReadonlySet<string>;
    /** Los que cambiaron de foto: van aunque la fecha no se haya movido. */
    conFotoNueva?: ReadonlySet<string>;
  } = {}
) {
  return planteles.filter((p) => {
    if (opciones.permitidos && !opciones.permitidos.has(p.id)) return false;
    if (opciones.conFotoNueva?.has(p.id)) return true;
    return subido[p.id] !== p.actualizado;
  });
}

/**
 * Sube lo que falta, borra lo que hay que borrar y trae lo que cambió.
 *
 * No tira error hacia afuera: si no hay señal devuelve lo que pudo y deja
 * anotado que falta. Un guardado que falla no puede romper la pantalla.
 */
export async function sincronizar(
  planteles: Squad[],
  borrados: string[],
  estado: EstadoSync,
  /** Los que el plan deja guardar. Sin esto se mandan todos. */
  permitidos?: ReadonlySet<string>
): Promise<Resultado> {
  const subido = { ...estado.subido };
  const borradosListos: string[] = [];
  let sinLugar = 0;
  let faltaSubir = false;

  // ── Las fotos primero: el plantel tiene que viajar con la URL, no con la
  //    ruta de un archivo de este teléfono.
  const conFotos = await subirFotosPendientes(planteles).catch(() => ({
    planteles,
    cambiados: new Set<string>(),
    subidas: 0,
    fallaron: 0,
  }));
  let lista = conFotos.planteles;

  // ── Los borrados antes que las subidas: si se borró y se volvió a crear con
  //    el mismo id, el borrado tiene que quedar atrás.
  for (const id of borrados) {
    try {
      await pedir(`/planteles/${encodeURIComponent(id)}`, { metodo: 'DELETE' });
      borradosListos.push(id);
      delete subido[id];
    } catch {
      faltaSubir = true;
    }
  }

  for (const p of sinSubir(lista, subido, {
    permitidos,
    conFotoNueva: conFotos.cambiados,
  })) {
    try {
      await pedir(`/planteles/${encodeURIComponent(p.id)}`, {
        metodo: 'PUT',
        cuerpo: aFila(p),
      });
      subido[p.id] = p.actualizado;
    } catch (error) {
      // El servidor rechaza los que no entran en el plan. No es un error de
      // red: reintentarlo no va a cambiar nada hasta que se haga lugar.
      if (String(error instanceof Error ? error.message : error).includes('límite')) {
        sinLugar++;
      } else {
        faltaSubir = true;
      }
    }
  }

  // ── Y ahora lo que cambió en otro lado.
  let hasta = estado.hasta;
  try {
    const desde = estado.hasta
      ? `?desde=${encodeURIComponent(estado.hasta)}`
      : '';
    const traido = await pedir<{
      planteles: PlantelDeLaNube[];
      hasta: string;
    }>(`/planteles${desde}`);

    lista = aplicar(lista, traido.planteles ?? []);
    for (const fila of traido.planteles ?? []) {
      if (fila.borrado) delete subido[fila.id];
    }
    // El corte lo pone el servidor: con el del teléfono, un celular atrasado
    // se perdería los cambios de esa ventana para siempre.
    hasta = traido.hasta ?? hasta;
  } catch {
    faltaSubir = true;
  }

  // Lo que ya no está no tiene sentido seguir recordándolo.
  const vivos = new Set(lista.map((p) => p.id));
  for (const id of Object.keys(subido)) {
    if (!vivos.has(id)) delete subido[id];
  }

  return {
    estado: { subido, hasta },
    planteles: lista,
    borradosListos,
    sinLugar,
    faltaSubir: faltaSubir || conFotos.fallaron > 0,
  };
}

/** Mete lo que vino del servidor en lo que hay acá. */
function aplicar(locales: Squad[], traidos: PlantelDeLaNube[]): Squad[] {
  if (traidos.length === 0) return locales;

  const porId = new Map(locales.map((p) => [p.id, p]));

  for (const fila of traidos) {
    if (fila.borrado) {
      porId.delete(fila.id);
      continue;
    }

    const existente = porId.get(fila.id);
    const armado = sanitizePlantel(
      {
        id: fila.id,
        nombre: fila.nombre,
        llegada: fila.llegada,
        jugadores: fila.datos?.jugadores,
        partidos: fila.datos?.partidos,
        detalle: fila.datos?.detalle,
        alias: fila.datos?.alias,
        // Viene del servidor, o sea que ya está subido: se marca con lo mismo
        // que se va a guardar en `subido` para que no se vuelva a mandar.
        actualizado: existente?.actualizado,
        // Esto sí lo sabe sólo el servidor: cuándo salió de la papelera. Es lo
        // que decide si el próximo borrado es definitivo.
        yaVolvio: fila.restaurado_en != null,
      },
      0
    );
    if (!armado) continue;

    porId.set(fila.id, {
      ...armado,
      // La convocatoria y el sorteo son de este teléfono y de esta tarde: no
      // viajan, así que si ya había algo acá se conserva.
      convocatoria: existente?.convocatoria ?? armado.convocatoria,
      sorteo: existente?.sorteo ?? armado.sorteo,
      actualizado: existente?.actualizado ?? armado.actualizado,
    });
  }

  return [...porId.values()].sort((a, b) => a.llegada.localeCompare(b.llegada));
}

/** Lo que está en la papelera del servidor. */
export interface EnPapelera {
  id: string;
  nombre: string;
  llegada: string;
  jugadores: number;
  borradoEn: string;
}

export interface Papelera {
  planteles: EnPapelera[];
  dias: number;
  /** Cuántos guarda. El número lo manda el servidor, que es el que lo aplica. */
  tope: number;
}

export async function verPapelera(): Promise<Papelera> {
  const r = await pedir<{
    planteles: {
      id: string;
      nombre: string;
      llegada: string;
      datos: { jugadores?: unknown[] } | null;
      borrado_en: string;
    }[];
    dias: number;
    tope: number;
  }>('/planteles/papelera');

  return {
    dias: r.dias,
    tope: typeof r.tope === 'number' ? r.tope : 5,
    planteles: (r.planteles ?? []).map((p) => ({
      id: p.id,
      nombre: p.nombre,
      llegada: p.llegada,
      jugadores: Array.isArray(p.datos?.jugadores) ? p.datos.jugadores.length : 0,
      borradoEn: p.borrado_en,
    })),
  };
}

export async function restaurarDePapelera(id: string): Promise<void> {
  await pedir(`/planteles/${encodeURIComponent(id)}/restaurar`, {
    metodo: 'POST',
  });
}
