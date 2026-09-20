import { File } from 'expo-file-system';
import { esLocal } from '../photos';
import { Squad } from '../types';
import { API, pedir } from './cliente';

/**
 * Las fotos viajan con el backup, pero no adentro del JSON: se suben a R2 y en
 * el plantel queda la URL.
 *
 * El archivo va derecho de este teléfono al bucket. El servidor sólo firma un
 * permiso que vale unos minutos y no toca ni un byte de la imagen: pasarla por
 * el medio ocuparía el contenedor —512 MB, y que además se duerme— para mover
 * algo que no lo necesita.
 */
interface Permiso {
  /** Adónde mandar el archivo. Vence en minutos. */
  url: string;
  /** Con qué URL se va a poder mirar después. */
  publica: string;
}

function tipoDe(uri: string): string {
  const limpio = uri.split('?')[0].toLowerCase();
  if (limpio.endsWith('.png')) return 'image/png';
  if (limpio.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

/**
 * Sube una foto del teléfono y devuelve la URL con la que se ve.
 *
 * `destino` dice en qué carpeta del bucket cae: `'perfil'`, o el id del
 * plantel al que pertenece el jugador. No es cosmético: en el servidor cada
 * plantel es una carpeta, y borrarlo borra la carpeta entera. Una foto puesta
 * en la carpeta equivocada sobrevive al plantel que la usaba y se va con uno
 * que no tenía nada que ver.
 *
 * El perfil va aparte porque su foto no aparece en ningún plantel: adentro de
 * uno, la limpieza de huérfanas la borraría todas las veces.
 */
export async function subirFoto(
  uri: string,
  destino: string
): Promise<string> {
  const tipo = tipoDe(uri);
  const permiso = await pedir<Permiso>('/fotos/permiso', {
    metodo: 'POST',
    cuerpo: { tipo, destino },
  });

  // Los bytes en crudo: R2 espera el archivo tal cual, no un formulario.
  const bytes = await new File(uri).bytes();
  const respuesta = await fetch(permiso.url, {
    method: 'PUT',
    headers: { 'content-type': tipo },
    body: bytes,
  });
  if (!respuesta.ok) {
    throw new Error(`No se pudo subir la foto (${respuesta.status}).`);
  }
  return permiso.publica;
}

export interface FotosSubidas {
  planteles: Squad[];
  /**
   * Los planteles a los que se les cambió alguna foto por su URL.
   *
   * Hay que avisarlo porque cambiar la foto no cambia la fecha del plantel, y
   * es esa fecha la que dice qué falta subir. Sin esta lista, una foto que
   * falló la primera vez y subió bien la segunda se quedaba en el teléfono
   * para siempre: el plantel ya figuraba subido —había viajado sin esa foto—
   * así que nunca se volvía a mandar, y en los otros aparatos ese jugador se
   * quedaba sin cara.
   */
  cambiados: Set<string>;
  subidas: number;
  fallaron: number;
}

/**
 * Sube las fotos que todavía viven sólo en este teléfono y devuelve los
 * planteles con las URLs ya puestas.
 *
 * Una foto que falla no frena el backup: queda local, se reintenta en el
 * próximo, y el resto del plantel se guarda igual. Perder el respaldo entero
 * porque una imagen no subió sería mucho peor que quedarse sin esa imagen.
 */
export async function subirFotosPendientes(
  planteles: Squad[]
): Promise<FotosSubidas> {
  const nada = { cambiados: new Set<string>(), subidas: 0, fallaron: 0 };
  if (!API) return { planteles, ...nada };

  let subidas = 0;
  let fallaron = 0;
  const cambiados = new Set<string>();
  const actualizados: Squad[] = [];

  for (const plantel of planteles) {
    const jugadores = [];
    let cambio = false;
    for (const jugador of plantel.jugadores) {
      if (!esLocal(jugador.foto)) {
        jugadores.push(jugador);
        continue;
      }
      try {
        const publica = await subirFoto(jugador.foto as string, plantel.id);
        jugadores.push({ ...jugador, foto: publica });
        cambio = true;
        subidas++;
      } catch {
        jugadores.push(jugador);
        fallaron++;
      }
    }
    // El que no cambió vuelve tal cual, el mismo objeto. Así quien llama puede
    // comparar por identidad y no reescribir el disco en cada vuelta.
    if (cambio) cambiados.add(plantel.id);
    actualizados.push(cambio ? { ...plantel, jugadores } : plantel);
  }

  return {
    planteles: cambiados.size > 0 ? actualizados : planteles,
    cambiados,
    subidas,
    fallaron,
  };
}

/*
 * Borrar del bucket no se hace desde acá, y no es un olvido: una foto que en
 * este teléfono ya no se usa puede seguir siendo la que referencia la copia de
 * la nube, o la de otro aparato que todavía no sincronizó. Borrarla dejaría
 * esas copias con la carta rota.
 *
 * Lo hace el servidor, que es el único que ve todo: al terminar el backup
 * barre lo que ya no referencia ningún plantel, y al borrar un plantel se
 * lleva su carpeta entera.
 */
